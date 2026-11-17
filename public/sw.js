/*
 * Service worker du calendrier : uniquement les notifications de rappel (pas de cache hors ligne).
 * Toutes les adresses sont relatives à self.registration.scope, pour marcher à la racine,
 * dans /chrismas-calendar/ (GitHub Pages) ou en local.
 *
 * Message attendu (JSON envoyé par supabase/functions/rappel-veille) :
 *   { "title": "...", "body": "...", "day": 16, "path": "./?case=16" }
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const abs = (p) => new URL(p, self.registration.scope).href;

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Pingou 🐧";
  const options = {
    body: data.body || "Une case t'attend dans le calendrier !",
    icon: abs("icons/icon-192.png"),
    badge: abs("icons/badge-96.png"),
    tag: data.day ? "rappel-case-" + data.day : "rappel",
    renotify: true,
    lang: "fr",
    data: { url: abs(data.path || "./") },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope) && "focus" in w) {
        await w.focus();
        if ("navigate" in w) { try { await w.navigate(url); } catch { /* page non contrôlée */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

// Abonnement renouvelé par le navigateur : la page le ré-enregistrera à la prochaine visite (reminderStatus).
self.addEventListener("pushsubscriptionchange", () => {});
