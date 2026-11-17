/**
 * Notifications push (rappel la veille d'une case préparée) — partie navigateur.
 * Le service worker est public/sw.js ; l'envoi se fait côté serveur (supabase/functions/rappel-veille).
 */
import type { ReminderStatus } from "../core/contracts";

/** Clé publique VAPID (la privée reste dans les secrets de l'Edge Function). */
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches)
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Statut sans toucher au serveur : null = le navigateur sait faire, à préciser avec l'abonnement. */
export function browserStatus(): ReminderStatus | null {
  if (typeof window === "undefined") return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!ok) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  if (!VAPID_PUBLIC_KEY) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null;
}

/** URL du service worker, relative au site (marche à la racine, dans /chrismas-calendar/ ou /demo/). */
function swUrl(): string {
  return new URL("sw.js", new URL(import.meta.env.BASE_URL || "./", location.href)).href;
}

export async function registration(create: boolean): Promise<ServiceWorkerRegistration | null> {
  const url = swUrl();
  const scope = new URL("./", url).href;
  const existing = await navigator.serviceWorker.getRegistration(scope);
  if (existing || !create) return existing ?? null;
  await navigator.serviceWorker.register(url, { scope });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration(false);
  return reg ? reg.pushManager.getSubscription() : null;
}

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Demande l'autorisation (DOIT être appelée dans un geste utilisateur : c'est le tout premier `await`)
 * puis abonne l'appareil. Renvoie l'abonnement, ou le statut d'échec.
 */
export async function subscribe(): Promise<PushSubscription | ReminderStatus> {
  const pre = browserStatus();
  if (pre) return pre;
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm === "denied") return "denied";
  if (perm !== "granted") return "off";
  const reg = await registration(true);
  if (!reg) return "unsupported";
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
}

export function subscriptionKeys(sub: PushSubscription) {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" };
}
