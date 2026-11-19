/**
 * Mode hors ligne : enregistre le service worker (public/sw.js) dès le démarrage, en production seulement.
 * Le service worker garde l'application (page, scripts, styles, icônes, polices) pour qu'elle s'ouvre sans
 * réseau ou avec un réseau faible. Les données privées (Supabase, photos) ne sont JAMAIS mises en cache.
 */
import { registration } from "./push";

let started = false;

export function registerOfflineShell(): void {
  if (started || !import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  started = true;
  const go = async () => {
    try {
      if (!(await registration(true))) return;
      const reg = await navigator.serviceWorker.ready;
      // Fichiers déjà chargés avant que le service worker ne prenne la main (premier lancement)
      const urls = performance.getEntriesByType("resource").map((e) => e.name);
      reg.active?.postMessage({ type: "cache-urls", urls });
    } catch (e) {
      console.warn("[hors ligne] service worker non enregistré :", e);
    }
  };
  if (document.readyState === "complete") void go();
  else window.addEventListener("load", () => void go(), { once: true });
}
