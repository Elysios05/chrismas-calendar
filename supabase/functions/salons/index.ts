// Edge Function « salons » (Deno, Supabase) : tout ce qui touche aux COMPTES, donc réservé au serveur.
// Appelée par le site (SupabaseBackend) avec la clé publique ; elle agit avec la clé service_role.
//
//   { "action": "creer",    "config": SalonConfig, "motDePasse": "…", "email"?: "…", "captcha"?: "…" }
//       → crée le salon (limites par appareil / par jour), le compte du créateur (place "alexandre"),
//         le premier jeton d'invitation. Réponse : { salonId, jeton, email }
//   { "action": "accepter", "jeton": "…", "motDePasse": "…", "email"?: "…" }
//       → consomme le jeton (usage unique), crée le compte de l'invité·e (place "flavie"). Réponse : { salonId, email }
//   { "action": "connexion", "salonId": "…", "place": "alexandre"|"flavie", "motDePasse": "…" }
//       → connexion d'un compte qui a une adresse e-mail RÉELLE (SEC-05) : l'adresse ne quitte jamais le serveur.
//         Réponse : { session: { access_token, refresh_token } } (le site fait setSession).
//         Les comptes à adresse technique se connectent directement depuis le site (salon_connexion_info).
//   { "action": "oubli", "salonId": "…", "place": "…", "redirectTo": "https://…" }
//       → envoie l'e-mail « mot de passe oublié » à l'adresse réelle du compte. Réponse : { ok: true }
//   { "action": "supprimer" }  (avec la session de l'utilisateur, en-tête Authorization)
//       → supprime le salon de l'utilisateur : photos, comptes des deux membres, toutes les données. Réponse : { ok: true }
//
// Erreurs : { code: SalonErreurCode, message } avec un statut 400/401/403/404/409/429/500. Les messages sont
// génériques : le détail technique ne part que dans les journaux de la fonction (SEC-14).
//
// Comptes : si aucune adresse e-mail n'est donnée, une adresse technique <salon>-<place>@<domaine> est utilisée
// (jamais affichée, aucun e-mail n'y est envoyé). Domaine réglable avec le secret SALON_EMAIL_DOMAIN.
// Secrets : SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
//   TURNSTILE_SECRET (facultatif) : si présent, la création exige un jeton Cloudflare Turnstile valide (« captcha »).
// Déploiement : npx supabase functions deploy salons --project-ref <ID> --no-verify-jwt --use-api
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";

const MOT_DE_PASSE_MIN = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Code = "INVITATION_INVALIDE" | "INVITATION_UTILISEE" | "LIMITE_CREATION" | "MOT_DE_PASSE_FAIBLE" | "CONFIG_INVALIDE"
  | "NON_AUTORISE" | "SALON_INCONNU" | "INDISPONIBLE";
const STATUS: Record<Code, number> = {
  INVITATION_INVALIDE: 404, INVITATION_UTILISEE: 409, LIMITE_CREATION: 429, MOT_DE_PASSE_FAIBLE: 400,
  CONFIG_INVALIDE: 400, NON_AUTORISE: 401, SALON_INCONNU: 404, INDISPONIBLE: 500,
};
const GENERIQUE = "Le serveur n'a pas pu répondre. Réessaie dans un instant.";
const EMAIL_REFUSE = "Cette adresse e-mail ne peut pas être utilisée : laisse le champ vide ou choisis-en une autre.";

class Refus extends Error {
  constructor(readonly code: Code, message: string) { super(message); }
}
/** Les fonctions SQL lèvent « CODE : message » : on récupère le code et le message français. */
function fromSql(message: string): Refus {
  const m = /^(INVITATION_INVALIDE|INVITATION_UTILISEE|LIMITE_CREATION|CONFIG_INVALIDE|NON_AUTORISE)\s*:\s*(.*)$/s.exec(message);
  if (m) {
    const text = m[2].trim();
    return new Refus(m[1] as Code, text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? "" : "."));
  }
  console.error("[salons] erreur SQL :", message);
  return new Refus("INDISPONIBLE", GENERIQUE);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function checkPassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < MOT_DE_PASSE_MIN || pw.length > 200) {
    throw new Refus("MOT_DE_PASSE_FAIBLE", `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`);
  }
  return pw;
}
function cleanEmail(e: unknown): string | null {
  if (e == null || e === "") return null;
  if (typeof e !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) || e.length > 200) {
    throw new Refus("CONFIG_INVALIDE", "Adresse e-mail invalide.");
  }
  return e.trim().toLowerCase();
}
function salonPlace(body: Record<string, unknown>): { salonId: string; place: "alexandre" | "flavie" } {
  const salonId = typeof body.salonId === "string" ? body.salonId : "";
  const place = body.place;
  if (!UUID.test(salonId) || (place !== "alexandre" && place !== "flavie")) {
    throw new Refus("SALON_INCONNU", "Ce calendrier n'existe pas (ou plus).");
  }
  return { salonId, place };
}
const isTechnical = (email: string, salonId: string, place: string) => email.startsWith(`${salonId}-${place}@`);

/** Client « visiteur » (clé publique) : pour les appels Auth qui ne sont pas des appels d'administration. */
const anonClient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Cloudflare Turnstile : actif seulement si le secret TURNSTILE_SECRET existe. */
async function checkCaptcha(token: unknown, ip: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return;
  const refus = new Refus("LIMITE_CREATION", "La vérification anti-robot n'a pas abouti : recharge la page et réessaie.");
  if (typeof token !== "string" || !token || token.length > 4096) throw refus;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip !== "?") form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
    const out = await r.json() as { success?: boolean; "error-codes"?: string[] };
    if (!out.success) { console.error("[salons] Turnstile refusé :", out["error-codes"]); throw refus; }
  } catch (e) {
    if (e instanceof Refus) throw e;
    console.error("[salons] Turnstile injoignable :", e);
    throw refus;
  }
}

/** Limite d'essais ratés par appareil (connexion, invitation, mot de passe oublié). */
async function essaiOk(db: SupabaseClient, ipHash: string, action: string) {
  const { error } = await db.rpc("salon_essai_ok", { p_ip_hash: ipHash, p_action: action });
  if (error) throw fromSql(error.message);
}
async function essaiRate(db: SupabaseClient, ipHash: string, action: string) {
  const { error } = await db.rpc("salon_essai_rate", { p_ip_hash: ipHash, p_action: action });
  if (error) console.error("[salons] journal des essais :", error.message);
}

/**
 * Crée le compte Auth (déjà confirmé) et renvoie son id et l'adresse de connexion.
 * Sans adresse réelle : adresse technique, en essayant plusieurs domaines si Supabase en refuse un.
 */
async function createAccount(db: SupabaseClient, salonId: string, place: string, password: string, email: string | null) {
  const domains = email ? [null] : [Deno.env.get("SALON_EMAIL_DOMAIN") || "salons.invalid", "example.com"];
  let last = "";
  for (const d of domains) {
    const addr = email ?? `${salonId}-${place}@${d}`;
    const { data, error } = await db.auth.admin.createUser({ email: addr, password, email_confirm: true });
    if (!error && data.user) return { id: data.user.id, email: addr };
    last = error?.message ?? "?";
    if (/password/i.test(last)) throw new Refus("MOT_DE_PASSE_FAIBLE", "Mot de passe refusé par le serveur (trop court ou trop simple).");
    // Même message que l'adresse soit déjà prise ou refusée : on n'apprend pas qui a un calendrier (SEC-12)
    if (email) { console.error("[salons] adresse refusée :", last); throw new Refus("CONFIG_INVALIDE", EMAIL_REFUSE); }
    if (!/email|invalid/i.test(last)) break;   // autre erreur : inutile d'essayer un autre domaine
  }
  console.error("[salons] création du compte impossible :", last);
  throw new Refus("INDISPONIBLE", "Création du compte impossible pour le moment. Réessaie dans un instant.");
}

async function creer(db: SupabaseClient, body: Record<string, unknown>, ip: string, ipHash: string) {
  const password = checkPassword(body.motDePasse);
  const email = cleanEmail(body.email);
  await checkCaptcha(body.captcha, ip);
  const { data, error } = await db.rpc("salon_create", { p_config: body.config ?? null, p_ip_hash: ipHash });
  if (error) throw fromSql(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { salon_id: string; token: string };
  try {
    const acc = await createAccount(db, row.salon_id, "alexandre", password, email);
    const j = await db.rpc("salon_join", { p_salon: row.salon_id, p_user: acc.id, p_place: "alexandre" });
    if (j.error) { await db.auth.admin.deleteUser(acc.id); throw fromSql(j.error.message); }
    return { salonId: row.salon_id, jeton: row.token, email: acc.email };
  } catch (e) {
    // pas de salon sans créateur ; un salon supprimé ne compte plus dans les limites de création
    await db.from("salons").delete().eq("id", row.salon_id);
    throw e;
  }
}

async function accepter(db: SupabaseClient, body: Record<string, unknown>, ipHash: string) {
  const password = checkPassword(body.motDePasse);
  const email = cleanEmail(body.email);
  const jeton = typeof body.jeton === "string" ? body.jeton.slice(0, 200) : "";
  await essaiOk(db, ipHash, "accepter");
  const c = await db.rpc("salon_claim_invitation", { p_token: jeton });
  if (c.error) { await essaiRate(db, ipHash, "accepter"); throw fromSql(c.error.message); }
  const salonId = c.data as string;
  let userId: string | null = null;
  try {
    const acc = await createAccount(db, salonId, "flavie", password, email);
    userId = acc.id;
    const j = await db.rpc("salon_join", { p_salon: salonId, p_user: acc.id, p_place: "flavie" });
    if (j.error) throw fromSql(j.error.message);
    return { salonId, email: acc.email };
  } catch (e) {
    await essaiRate(db, ipHash, "accepter");
    if (userId) await db.auth.admin.deleteUser(userId);
    await db.rpc("salon_release_invitation", { p_token: jeton });   // le lien resservira
    throw e;
  }
}

/** Adresse complète (réelle ou technique) d'une place, lue côté serveur seulement. */
async function emailServeur(db: SupabaseClient, salonId: string, place: string): Promise<string> {
  const { data, error } = await db.rpc("salon_login_email_serveur", { p_salon: salonId, p_place: place });
  if (error) throw fromSql(error.message);
  if (!data) {
    throw new Refus("SALON_INCONNU", place === "flavie"
      ? "Cette personne n'a pas encore rejoint le calendrier : envoie-lui le lien d'invitation."
      : "Ce calendrier n'existe pas (ou plus).");
  }
  return String(data);
}

async function connexion(db: SupabaseClient, body: Record<string, unknown>, ipHash: string) {
  const { salonId, place } = salonPlace(body);
  const password = typeof body.motDePasse === "string" ? body.motDePasse.slice(0, 200) : "";
  await essaiOk(db, ipHash, "connexion");
  const email = await emailServeur(db, salonId, place);
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await essaiRate(db, ipHash, "connexion");
    if (error && !/invalid login credentials/i.test(error.message)) {
      console.error("[salons] connexion :", error.message);
      if (/rate limit|too many/i.test(error.message)) {
        throw new Refus("LIMITE_CREATION", "Trop de connexions en ce moment : réessaie dans quelques minutes.");
      }
      throw new Refus("INDISPONIBLE", GENERIQUE);
    }
    throw new Refus("NON_AUTORISE", "Mot de passe incorrect.");
  }
  return { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
}

async function oubli(db: SupabaseClient, body: Record<string, unknown>, ipHash: string) {
  const { salonId, place } = salonPlace(body);
  const redirectTo = typeof body.redirectTo === "string" && /^https?:\/\//.test(body.redirectTo) && body.redirectTo.length < 500
    ? body.redirectTo : undefined;
  await essaiOk(db, ipHash, "oubli");
  await essaiRate(db, ipHash, "oubli");   // chaque demande compte (envoi d'e-mails)
  const email = await emailServeur(db, salonId, place);
  if (isTechnical(email, salonId, place)) {
    throw new Refus("CONFIG_INVALIDE", "Aucune adresse e-mail n'a été donnée pour ce compte : le mot de passe ne peut pas être "
      + "réinitialisé par e-mail.");
  }
  const { error } = await anonClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.error("[salons] oubli :", error.message);
    throw new Refus("INDISPONIBLE", "Envoi de l'e-mail impossible pour le moment. Réessaie dans quelques minutes.");
  }
  return { ok: true };
}

/** Supprime tous les fichiers d'un dossier du bucket photos (et de ses sous-dossiers). */
async function viderDossier(db: SupabaseClient, dossier: string) {
  for (let tour = 0; tour < 50; tour++) {
    const { data, error } = await db.storage.from("photos").list(dossier, { limit: 1000 });
    if (error) throw new Error("liste des photos : " + error.message);
    if (!data?.length) return;
    const fichiers = data.filter((f) => f.id).map((f) => `${dossier}/${f.name}`);
    for (const sous of data.filter((f) => !f.id)) await viderDossier(db, `${dossier}/${sous.name}`);
    if (!fichiers.length) return;
    const r = await db.storage.from("photos").remove(fichiers);
    if (r.error) throw new Error("suppression des photos : " + r.error.message);
  }
}

async function supprimer(db: SupabaseClient, req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = jwt ? await db.auth.getUser(jwt) : { data: { user: null }, error: null };
  if (ue || !u?.user) throw new Refus("NON_AUTORISE", "Connecte-toi d'abord à ton calendrier.");
  const { data: salonId, error } = await db.rpc("salon_of_user", { p_user: u.user.id });
  if (error) throw fromSql(error.message);
  if (!salonId) throw new Refus("NON_AUTORISE", "Ce compte n'appartient à aucun calendrier.");
  const legacy = salonId === "00000000-0000-0000-0000-000000000001";
  for (const d of legacy ? ["alexandre", "flavie", `${salonId}/alexandre`, `${salonId}/flavie`]
                         : [`${salonId}/alexandre`, `${salonId}/flavie`]) {
    await viderDossier(db, d);
  }
  const s = await db.rpc("supprimer_salon", { p_salon: salonId });
  if (s.error) throw fromSql(s.error.message);
  return { ok: true };
}

/** Adresse IP du visiteur : celle vue par Cloudflare si elle existe, sinon la première de x-forwarded-for. */
function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")?.trim()
    || (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || req.headers.get("x-real-ip")?.trim() || "?";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "INDISPONIBLE", message: "Méthode non permise." });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { code: "CONFIG_INVALIDE", message: "Requête illisible." }); }
  if (!body || typeof body !== "object") return json(400, { code: "CONFIG_INVALIDE", message: "Requête illisible." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Appareil = adresse IP, gardée seulement hachée (avec la clé du serveur comme sel)
  const ip = clientIp(req);
  const ipHash = await sha256(ip + "|" + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""));

  try {
    switch (body.action) {
      case "creer": return json(200, await creer(db, body, ip, ipHash));
      case "accepter": return json(200, await accepter(db, body, ipHash));
      case "connexion": return json(200, await connexion(db, body, ipHash));
      case "oubli": return json(200, await oubli(db, body, ipHash));
      case "supprimer": return json(200, await supprimer(db, req));
      default: return json(400, { code: "CONFIG_INVALIDE", message: "Action inconnue." });
    }
  } catch (e) {
    if (!(e instanceof Refus)) console.error("[salons]", e);
    const r = e instanceof Refus ? e : new Refus("INDISPONIBLE", GENERIQUE);
    return json(STATUS[r.code], { code: r.code, message: r.message });
  }
});
