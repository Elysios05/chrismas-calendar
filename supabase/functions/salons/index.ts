// Edge Function « salons » (Deno, Supabase) : tout ce qui crée un COMPTE, donc réservé au serveur.
// Appelée par le site (SupabaseBackend.salons) avec la clé publique ; elle agit avec la clé service_role.
//
//   { "action": "creer",    "config": SalonConfig, "motDePasse": "…", "email"?: "…" }
//       → crée le salon (limites par appareil / par jour), le compte du créateur (place "alexandre"),
//         le premier jeton d'invitation. Réponse : { salonId, jeton, email }
//   { "action": "accepter", "jeton": "…", "motDePasse": "…", "email"?: "…" }
//       → consomme le jeton (usage unique), crée le compte de l'invité·e (place "flavie"). Réponse : { salonId, email }
//
// Le site se connecte ensuite lui-même avec { email, motDePasse } (signInWithPassword).
// Erreurs : { code: SalonErreurCode, message } avec un statut 400/403/409/429/500.
//
// Comptes : si aucune adresse e-mail n'est donnée, une adresse technique <salon>-<place>@<domaine> est utilisée
// (jamais affichée, aucun e-mail n'y est envoyé). Domaine réglable avec le secret SALON_EMAIL_DOMAIN.
// Secrets : aucun à ajouter (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase).
// Déploiement : npx supabase functions deploy salons --project-ref <ID> --no-verify-jwt --use-api
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const MOT_DE_PASSE_MIN = 6;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Code = "INVITATION_INVALIDE" | "INVITATION_UTILISEE" | "LIMITE_CREATION" | "MOT_DE_PASSE_FAIBLE" | "CONFIG_INVALIDE"
  | "INDISPONIBLE";
const STATUS: Record<Code, number> = {
  INVITATION_INVALIDE: 404, INVITATION_UTILISEE: 409, LIMITE_CREATION: 429, MOT_DE_PASSE_FAIBLE: 400,
  CONFIG_INVALIDE: 400, INDISPONIBLE: 500,
};
class Refus extends Error {
  constructor(readonly code: Code, message: string) { super(message); }
}
/** Les fonctions SQL lèvent « CODE : message » : on récupère le code et le message français. */
function fromSql(message: string): Refus {
  const m = /^(INVITATION_INVALIDE|INVITATION_UTILISEE|LIMITE_CREATION|CONFIG_INVALIDE)\s*:\s*(.*)$/s.exec(message);
  if (m) {
    const text = m[2].trim();
    return new Refus(m[1] as Code, text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? "" : "."));
  }
  return new Refus("INDISPONIBLE", "Le serveur n'a pas pu répondre : " + message);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function checkPassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < MOT_DE_PASSE_MIN) {
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
    if (email && /already|registered|exists/i.test(last)) {
      throw new Refus("CONFIG_INVALIDE", "Cette adresse e-mail sert déjà pour un autre calendrier : laisse le champ vide ou choisis-en une autre.");
    }
    if (!/email|invalid/i.test(last)) break;   // autre erreur : inutile d'essayer un autre domaine
  }
  throw new Refus("INDISPONIBLE", "Création du compte impossible : " + last);
}

async function creer(db: SupabaseClient, body: Record<string, unknown>, ipHash: string) {
  const password = checkPassword(body.motDePasse);
  const email = cleanEmail(body.email);
  const { data, error } = await db.rpc("salon_create", { p_config: body.config ?? null, p_ip_hash: ipHash });
  if (error) throw fromSql(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { salon_id: string; token: string };
  try {
    const acc = await createAccount(db, row.salon_id, "alexandre", password, email);
    const j = await db.rpc("salon_join", { p_salon: row.salon_id, p_user: acc.id, p_place: "alexandre" });
    if (j.error) { await db.auth.admin.deleteUser(acc.id); throw fromSql(j.error.message); }
    return { salonId: row.salon_id, jeton: row.token, email: acc.email };
  } catch (e) {
    await db.from("salons").delete().eq("id", row.salon_id);   // pas de salon sans créateur
    throw e;
  }
}

async function accepter(db: SupabaseClient, body: Record<string, unknown>) {
  const password = checkPassword(body.motDePasse);
  const email = cleanEmail(body.email);
  const jeton = typeof body.jeton === "string" ? body.jeton : "";
  const c = await db.rpc("salon_claim_invitation", { p_token: jeton });
  if (c.error) throw fromSql(c.error.message);
  const salonId = c.data as string;
  let userId: string | null = null;
  try {
    const acc = await createAccount(db, salonId, "flavie", password, email);
    userId = acc.id;
    const j = await db.rpc("salon_join", { p_salon: salonId, p_user: acc.id, p_place: "flavie" });
    if (j.error) throw fromSql(j.error.message);
    return { salonId, email: acc.email };
  } catch (e) {
    if (userId) await db.auth.admin.deleteUser(userId);
    await db.rpc("salon_release_invitation", { p_token: jeton });   // le lien resservira
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "INDISPONIBLE", message: "Méthode non permise." });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { code: "CONFIG_INVALIDE", message: "Requête illisible." }); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Appareil = adresse IP, gardée seulement hachée (avec la clé du serveur comme sel)
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "?";
  const ipHash = await sha256(ip + "|" + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""));

  try {
    if (body.action === "creer") return json(200, await creer(db, body, ipHash));
    if (body.action === "accepter") return json(200, await accepter(db, body));
    return json(400, { code: "CONFIG_INVALIDE", message: "Action inconnue." });
  } catch (e) {
    const r = e instanceof Refus ? e : new Refus("INDISPONIBLE", "Erreur du serveur : " + String((e as Error)?.message ?? e));
    if (r.code === "INDISPONIBLE") console.error("[salons]", r.message);
    return json(STATUS[r.code], { code: r.code, message: r.message });
  }
});
