/*
 * Service worker du calendrier :
 *  1. MODE HORS LIGNE : garde l'application (page, scripts, styles, icônes, polices) pour qu'elle s'ouvre
 *     sans réseau ou avec un réseau faible. Les données privées (Supabase : comptes, lettres, photos) ne
 *     passent jamais par ce cache : seules les adresses du site lui-même et des polices Google sont gérées.
 *  2. NOTIFICATIONS de rappel (voir plus bas).
 * Toutes les adresses sont relatives à self.registration.scope, pour marcher à la racine,
 * dans /chrismas-calendar/ ou /chrismas-calendar/demo/ (chaque version a son propre cache).
 *
 * Mises à jour : la page est demandée au réseau d'abord (3 s max) ; si le réseau est lent, la version
 * gardée s'affiche et la nouvelle est rangée pour le prochain lancement. Les scripts ont un nom qui
 * change à chaque version (assets/index-XXXX.js) : ils sont gardés tels quels, les plus anciens sont
 * élagués. Changer CACHE_VERSION vide tout au prochain lancement.
 */
const CACHE_VERSION = "v1";
const SCOPE = self.registration.scope;
const SHELL = `cc-page-${CACHE_VERSION}|${SCOPE}`;
const ASSETS = `cc-fichiers-${CACHE_VERSION}|${SCOPE}`;
const MAX_ASSETS = 150;
const NETWORK_TIMEOUT_MS = 3000;
const SCOPE_PATH = new URL(SCOPE).pathname;
const SHELL_FILES = ["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/badge-96.png"];

const inScope = (url) => url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);
/** La page d'accueil de CETTE version (pas celle d'un sous-dossier comme /demo/). */
const isHome = (url) => inScope(url) && (url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + "index.html");
const isAsset = (url) => {
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return true;
  if (!inScope(url)) return false;
  const rest = url.pathname.slice(SCOPE_PATH.length);
  return !rest.includes("/") || rest.startsWith("assets/") || rest.startsWith("icons/");
};

async function trim() {
  const c = await caches.open(ASSETS);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await c.delete(k);
}

/** Range la page d'accueil et les fichiers qu'elle référence. */
async function cacheHome(response) {
  const shell = await caches.open(SHELL);
  await shell.put(SCOPE, response.clone());
  const html = await response.text();
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => new URL(m[1], SCOPE)).filter(isAsset);
  const assets = await caches.open(ASSETS);
  await Promise.all(refs.map(async (u) => {
    if (await assets.match(u.href)) return;
    try { const r = await fetch(u.href); if (r.ok || r.type === "opaque") await assets.put(u.href, r); } catch { /* hors ligne */ }
  }));
  await trim();
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const shell = await caches.open(SHELL);
      await shell.addAll(SHELL_FILES.map((f) => new URL(f, SCOPE).href));
      const r = await fetch(SCOPE, { cache: "no-cache" });
      if (r.ok) await cacheHome(r);
    } catch { /* hors ligne à l'installation : on rangera au prochain passage */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Supprime les caches des anciennes versions de CE site (pas ceux de /demo/, qui a sa propre portée)
    for (const name of await caches.keys()) {
      if (name.startsWith("cc-") && name.endsWith("|" + SCOPE) && name !== SHELL && name !== ASSETS) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || d.type !== "cache-urls" || !Array.isArray(d.urls)) return;
  event.waitUntil((async () => {
    const assets = await caches.open(ASSETS);
    for (const raw of d.urls) {
      let u; try { u = new URL(raw); } catch { continue; }
      if (!isAsset(u) || await assets.match(u.href)) continue;
      try { const r = await fetch(u.href); if (r.ok || r.type === "opaque") await assets.put(u.href, r); } catch { /* hors ligne */ }
    }
    await trim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page d'accueil : réseau d'abord (3 s max), sinon la version gardée
  if (req.mode === "navigate" && isHome(url)) {
    event.respondWith((async () => {
      const network = fetch(req).then(async (r) => {
        if (r.ok) await cacheHome(r.clone());
        return r;
      });
      const timeout = new Promise((res) => setTimeout(res, NETWORK_TIMEOUT_MS, null));
      try {
        const first = await Promise.race([network, timeout]);
        if (first) return first;
      } catch { /* réseau coupé */ }
      const cached = await caches.match(SCOPE, { cacheName: SHELL });
      if (cached) { event.waitUntil(network.catch(() => null)); return cached; }
      return network; // rien en cache : on attend le réseau
    })());
    return;
  }

  // Fichiers de l'application et polices : le cache d'abord, sinon le réseau (et on range)
  if (isAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: url.hostname !== "fonts.googleapis.com" });
      if (cached) {
        // Les feuilles de style Google Fonts peuvent changer : on rafraîchit en arrière-plan
        if (url.hostname === "fonts.googleapis.com") event.waitUntil(fetch(req).then((r) => caches.open(ASSETS).then((c) => c.put(req, r))).catch(() => null));
        return cached;
      }
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") {
        const copy = r.clone();
        event.waitUntil(caches.open(ASSETS).then((c) => c.put(req, copy)).then(trim));
      }
      return r;
    })());
  }
  // Tout le reste (Supabase, photos signées, autres sites) : jamais intercepté, jamais gardé.
});

/* ------------------------------------------------------------------ */
/* Notifications de rappel                                             */
/*
 * Message attendu (JSON envoyé par supabase/functions/rappel-veille) :
 *   { "title": "...", "body": "...", "day": 16, "path": "./?case=16" }
 */
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
