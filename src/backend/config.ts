/**
 * Réglages du backend, regroupés ici pour être faciles à changer.
 * Les valeurs marquées « À VALIDER » attendent la confirmation d'Alexandre.
 *
 * ⚠️ Les réglages d'ouverture des cases (fuseau, heure) existent AUSSI côté serveur,
 * dans la table `app_settings` (voir supabase/migrations/0001_init.sql). C'est le serveur
 * qui fait foi en mode Supabase ; ces constantes servent au mode démo.
 */
import type { DayNumber, Who } from "../core/contracts";

/** Fuseau horaire de référence pour l'ouverture des cases. À VALIDER (Paris = Ljubljana, même fuseau). */
export const TIMEZONE = "Europe/Paris";

/** Heure (0–23) à laquelle la case du jour s'ouvre. 0 = minuit. À VALIDER. */
export const OPEN_HOUR = 0;

/** Jour simulé par la démo quand on n'est pas en décembre. */
export const DEMO_DAY_OUTSIDE_DECEMBER = 9;

/** Jours des cases préparées par chacun pour l'autre. */
export const PREPARED_DAYS: readonly DayNumber[] = [4, 8, 12, 16, 20, 24];

/** Taille maximale d'une photo APRÈS compression (octets). À VALIDER. Doit rester ≤ à celle du bucket. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Plus grand côté (px) d'une photo après redimensionnement côté navigateur. */
export const PHOTO_MAX_DIMENSION = 2000;
/** Idem en mode démo (les photos sont stockées dans localStorage, ~5 Mo en tout). */
export const DEMO_PHOTO_MAX_DIMENSION = 640;

/** Durée de validité des URLs signées renvoyées par uploadPhoto (secondes) : 60 jours, couvre tout décembre. */
export const UPLOAD_URL_TTL_SECONDS = 60 * 24 * 3600;
/** Durée de validité des URLs signées renvoyées par getPrepared (secondes). */
export const READ_URL_TTL_SECONDS = 24 * 3600;

/** Adresses e-mail des deux comptes (surchargeables par VITE_EMAIL_ALEXANDRE / VITE_EMAIL_FLAVIE). */
export const ACCOUNT_EMAILS: Record<Who, string> = {
  alexandre: (import.meta.env.VITE_EMAIL_ALEXANDRE as string | undefined) || "alexandre@example.com",
  flavie: (import.meta.env.VITE_EMAIL_FLAVIE as string | undefined) || "flavie@example.com",
};

export const WHO_LIST: readonly Who[] = ["alexandre", "flavie"];
export const partnerOf = (w: Who): Who => (w === "alexandre" ? "flavie" : "alexandre");
export const isWho = (v: unknown): v is Who => v === "alexandre" || v === "flavie";

/**
 * Numéro de la case du jour pour une date donnée (même règle que la fonction SQL advent_today) :
 * décembre → jour du mois (max 24) ; janvier–juin → 24 (tout reste ouvert après Noël) ; sinon 0.
 * `outsideDecember` permet à la démo de renvoyer un jour fictif hors saison.
 */
export function adventDayFor(date: Date, outsideDecember?: DayNumber): DayNumber {
  const shifted = new Date(date.getTime() - OPEN_HOUR * 3600_000);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, month: "numeric", day: "numeric" }).formatToParts(shifted);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (month === 12) return Math.min(day, 24);
  if (outsideDecember !== undefined) return outsideDecember;
  return month <= 6 ? 24 : 0;
}

/** Redimensionne et recompresse une image en JPEG dans le navigateur. */
export async function compressImage(file: Blob, maxDim: number, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Ce fichier n'est pas une image.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // format non décodable (ex. HEIC sur certains navigateurs) : on envoie tel quel
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!out) return file;
  return out.size < file.size || file.type !== "image/jpeg" ? out : file;
}

export function checkPhotoSize(b: Blob) {
  if (b.size > MAX_PHOTO_BYTES) {
    throw new Error(`Photo trop lourde (${(b.size / 1048576).toFixed(1)} Mo, max ${MAX_PHOTO_BYTES / 1048576} Mo).`);
  }
}
