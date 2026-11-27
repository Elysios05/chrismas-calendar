// Edge Function « rappel-veille » (Deno, Supabase).
// Appelée chaque soir par pg_cron (voir supabase/cron_rappel.sql) : à 20 h, heure de Paris, prévient par
// notification l'auteur d'une case préparée du lendemain encore vide (« rappel ») ; à 22 h 30, relance
// si c'est toujours vide (« relance »). C'est la base qui décide du type selon l'heure de Paris.
//
// Secrets nécessaires (Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. https://<compte>.github.io/chrismas-calendar/),
//   CRON_SECRET (mot de passe partagé avec la tâche pg_cron).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
//
// Corps JSON facultatif (tests) : { "day": 16, "kind": "relance", "force": true, "dry": true }
//   day   : jour à traiter (sinon « demain », et seulement à l'heure du rappel) ; un test n'écrit pas dans le journal
//   kind  : "rappel" ou "relance" (sinon déduit de l'heure de Paris)
//   force : ignore l'heure et le journal des rappels déjà envoyés
//   dry   : n'envoie rien, renvoie seulement qui serait prévenu
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { reminderMessage, type Kind, type Who } from "./message.ts";

type Target = { day: number; who: Who; kind: Kind; endpoint: string; p256dh: string; auth: string;
  salon_id: string; prenom: string | null; prenom_autre: string | null };

/** Envois simultanés, et délai maximal d'un envoi (SEC-04 : un service lent ne bloque pas les autres). */
const LOT = 10;
const DELAI_MS = 5000;
/** Services de notification connus (même liste que push_endpoint_ok en SQL). */
const SERVICE_PUSH = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)(\/|$)/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json(401, { error: "non autorisé" });

  let opts: { day?: number; kind?: Kind; force?: boolean; dry?: boolean } = {};
  try { opts = await req.json(); } catch { /* corps vide */ }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json(500, { error: "clés VAPID manquantes" });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "https://github.com/", pub, priv);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc("reminder_targets", {
    p_day: opts.day ?? null, p_force: opts.force ?? false, p_kind: opts.kind ?? null,
  });
  if (error) { console.error("[rappel-veille]", error.message); return json(500, { error: "lecture des destinataires impossible" }); }
  const targets = ((data ?? []) as Target[]).filter((t) => SERVICE_PUSH.test(t.endpoint) && t.endpoint.length <= 1000);
  if (!targets.length) return json(200, { sent: 0, message: "personne à prévenir maintenant" });
  if (opts.dry) return json(200, { dry: true, targets: targets.map((t) => ({ salon: t.salon_id, day: t.day, who: t.who, kind: t.kind })) });

  // Un envoi de TEST (day ou force) ne s'inscrit pas au journal : sinon il bloquerait le vrai rappel du soir
  const isTest = opts.force === true || opts.day != null;
  const perWho = new Map<string, number>();
  const report: unknown[] = [];

  const envoyer = async (t: Target) => {
    const payload = JSON.stringify(reminderMessage(t.day, t.who, t.kind, { prenom: t.prenom, autre: t.prenom_autre, salonId: t.salon_id }));
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload,
        { TTL: 12 * 3600, urgency: "high", timeout: DELAI_MS });
      const key = `${t.salon_id}:${t.day}:${t.who}:${t.kind}`;
      perWho.set(key, (perWho.get(key) ?? 0) + 1);
      report.push({ who: t.who, kind: t.kind, ok: true });
      return key;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410 : l'abonnement n'existe plus (appli désinstallée, autorisation retirée…)
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
      report.push({ who: t.who, kind: t.kind, ok: false, code, error: String((e as Error).message ?? e).slice(0, 200) });
      return null;
    }
  };

  // Par lots de LOT envois en parallèle ; le journal est écrit après chaque lot (si la fonction est coupée
  // en route, ce qui est parti est noté et ne repartira pas)
  for (let i = 0; i < targets.length; i += LOT) {
    const keys = new Set((await Promise.all(targets.slice(i, i + LOT).map(envoyer))).filter((k): k is string => !!k));
    if (isTest) continue;
    for (const k of keys) {
      const [salon_id, day, who, kind] = k.split(":");
      const { error: le } = await db.from("reminder_log").upsert(
        { salon_id, day: Number(day), who, kind, devices: perWho.get(k), sent_at: new Date().toISOString() });
      if (le) console.error("[rappel-veille] journal :", le.message);
    }
  }
  return json(200, { sent: [...perWho.values()].reduce((a, b) => a + b, 0), report });
});
