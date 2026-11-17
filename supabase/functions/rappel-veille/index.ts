// Edge Function « rappel-veille » (Deno, Supabase).
// Appelée chaque soir par pg_cron (voir supabase/cron_rappel.sql) : à 20 h, heure de Paris, prévient par
// notification l'auteur d'une case préparée du lendemain encore vide.
//
// Secrets nécessaires (Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. https://<compte>.github.io/chrismas-calendar/),
//   CRON_SECRET (mot de passe partagé avec la tâche pg_cron).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
//
// Corps JSON facultatif (tests) : { "day": 16, "force": true, "dry": true }
//   day   : jour à traiter (sinon « demain », et seulement à l'heure du rappel)
//   force : ignore l'heure et le journal des rappels déjà envoyés
//   dry   : n'envoie rien, renvoie seulement qui serait prévenu
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reminderMessage, type Who } from "./message.ts";

type Target = { day: number; who: Who; endpoint: string; p256dh: string; auth: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json(401, { error: "non autorisé" });

  let opts: { day?: number; force?: boolean; dry?: boolean } = {};
  try { opts = await req.json(); } catch { /* corps vide */ }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json(500, { error: "clés VAPID manquantes" });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "https://github.com/", pub, priv);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc("reminder_targets", { p_day: opts.day ?? null, p_force: opts.force ?? false });
  if (error) return json(500, { error: error.message });
  const targets = (data ?? []) as Target[];
  if (!targets.length) return json(200, { sent: 0, message: "personne à prévenir maintenant" });
  if (opts.dry) return json(200, { dry: true, targets: targets.map((t) => ({ day: t.day, who: t.who })) });

  const perWho = new Map<string, number>();
  const report: unknown[] = [];
  for (const t of targets) {
    const payload = JSON.stringify(reminderMessage(t.day, t.who));
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload,
        { TTL: 12 * 3600, urgency: "high" });
      perWho.set(`${t.day}:${t.who}`, (perWho.get(`${t.day}:${t.who}`) ?? 0) + 1);
      report.push({ who: t.who, ok: true });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410 : l'abonnement n'existe plus (appli désinstallée, autorisation retirée…)
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
      report.push({ who: t.who, ok: false, code, error: String((e as Error).message ?? e) });
    }
  }
  for (const [k, devices] of perWho) {
    const [day, who] = k.split(":");
    await db.from("reminder_log").upsert({ day: Number(day), who, devices, sent_at: new Date().toISOString() });
  }
  return json(200, { sent: [...perWho.values()].reduce((a, b) => a + b, 0), report });
});
