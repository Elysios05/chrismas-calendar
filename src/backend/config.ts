/**
 * Réglages du backend, regroupés ici pour être faciles à changer.
 * Les valeurs marquées « À VALIDER » attendent la confirmation d'Alexandre.
 *
 * ⚠️ Les réglages d'ouverture des cases (fuseau, heure) existent AUSSI côté serveur,
 * dans la table `app_settings` (voir supabase/migrations/0001_init.sql). C'est le serveur
 * qui fait foi en mode Supabase ; ces constantes servent au mode démo.
 */
import type { DayNumber, SalonConfig, SalonErreurCode, Who } from "../core/contracts";

/** Fuseau horaire de référence pour l'ouverture des cases (Paris = Ljubljana, même fuseau). */
export const TIMEZONE = "Europe/Paris";

/** Heure (0–23, heure de Paris) à laquelle la case du jour s'ouvre : 7 h (décision d'Alexandre).
 *  Avant 7 h, on est encore « la veille ». Doit rester égal à app_settings.open_hour côté serveur. */
export const OPEN_HOUR = 7;

/** Jour simulé par la démo quand on n'est pas en décembre. */
export const DEMO_DAY_OUTSIDE_DECEMBER = 9;

/** Jours des cases préparées par chacun pour l'autre. */
export const PREPARED_DAYS: readonly DayNumber[] = [4, 8, 12, 16, 20, 24];

/** Taille maximale d'une photo APRÈS compression (octets). Doit rester ≤ à celle du bucket (10 Mo). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Plus grand côté (px) d'une photo après redimensionnement côté navigateur. */
export const PHOTO_MAX_DIMENSION = 2000;
/** Idem en mode démo (les photos sont stockées dans localStorage, ~5 Mo en tout). */
export const DEMO_PHOTO_MAX_DIMENSION = 640;

/** Durée de validité des URLs signées renvoyées par uploadPhoto (secondes) : 60 jours, couvre tout décembre. */
export const UPLOAD_URL_TTL_SECONDS = 60 * 24 * 3600;
/** Durée de validité des URLs signées renvoyées par getPrepared (secondes). */
export const READ_URL_TTL_SECONDS = 24 * 3600;

/**
 * Adresses e-mail des deux comptes. JAMAIS en dur dans le dépôt : elles viennent des variables
 * VITE_EMAIL_ALEXANDRE / VITE_EMAIL_FLAVIE (.env.local en local, secrets GitHub au déploiement).
 * ⚠️ Elles restent lisibles dans le JavaScript publié de la version privée.
 */
export const ACCOUNT_EMAILS: Record<Who, string | undefined> = {
  alexandre: (import.meta.env.VITE_EMAIL_ALEXANDRE as string | undefined) || undefined,
  flavie: (import.meta.env.VITE_EMAIL_FLAVIE as string | undefined) || undefined,
};

export function emailOf(who: Who): string {
  const e = ACCOUNT_EMAILS[who];
  if (!e) throw new Error(`Adresse e-mail de ${who} non configurée (variable VITE_EMAIL_${who.toUpperCase()}).`);
  return e;
}

/** Message d'erreur quand l'auteur veut modifier une case que le destinataire a déjà ouverte. */
export const FROZEN_MESSAGE = "Cette case a déjà été ouverte : elle ne peut plus être modifiée.";

export const WHO_LIST: readonly Who[] = ["alexandre", "flavie"];
export const partnerOf = (w: Who): Who => (w === "alexandre" ? "flavie" : "alexandre");
export const isWho = (v: unknown): v is Who => v === "alexandre" || v === "flavie";

/**
 * Numéro de la case du jour pour une date donnée (même règle que la fonction SQL advent_today) :
 * on recule de OPEN_HOUR heures (avant 7 h = la veille), puis
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

/* ------------------------------------------------------------------ */
/* Salons (docs/salons.md)                                             */
/* ------------------------------------------------------------------ */

/**
 * Configuration du salon fictif de la démo, et du premier salon (Alexandre et Flavie).
 * Couleurs identiques à PLAYERS (src/world/actors.ts) pour que rien ne change à l'écran.
 */
export const SALON_DEMO_CONFIG: SalonConfig = {
  joueurs: {
    alexandre: { prenom: "Alexandre", couleurs: { coat: 0x2f6fb5, hat: 0x1f3d6b, pompom: 0xffffff, hair: 0x4a2e1f, longHair: false } },
    flavie: { prenom: "Flavie", couleurs: { coat: 0xd9354b, hat: 0xffffff, pompom: 0xd9354b, hair: 0x6b3a22, longHair: true } },
  },
  contenu: {},
};

/** Identifiant du salon fictif de la démo. */
export const DEMO_SALON_ID = "demo";

/** Garde-fous (mêmes valeurs côté serveur, migration des salons). */
export const SALON_PRENOM_MAX = 30;
/** Taille maximale de la config JSON d'un salon (contenu des jeux compris), en octets. */
export const SALON_CONFIG_MAX_BYTES = 200 * 1024;
/** Nombre de salons qu'un même appareil peut créer par heure. */
export const SALON_CREATIONS_PAR_HEURE = 5;
/** Longueur minimale d'un mot de passe (minimum de Supabase Auth). */
export const MOT_DE_PASSE_MIN = 6;

/** Erreur des salons : message en français prêt à afficher + code (voir SalonErreurCode). */
export class SalonError extends Error {
  readonly code: SalonErreurCode;
  constructor(code: SalonErreurCode, message: string) {
    super(message);
    this.name = "SalonError";
    this.code = code;
  }
}

const MESSAGES: Record<SalonErreurCode, string> = {
  INVITATION_INVALIDE: "Ce lien d'invitation n'est pas (ou plus) valable. Demande un nouveau lien.",
  INVITATION_UTILISEE: "Ce lien d'invitation a déjà servi : connecte-toi avec ton mot de passe.",
  LIMITE_CREATION: "Trop de calendriers créés depuis cet appareil. Réessaie dans une heure.",
  NON_AUTORISE: "Tu n'as pas accès à ce calendrier.",
  SALON_INCONNU: "Ce calendrier n'existe pas (ou plus).",
  MOT_DE_PASSE_FAIBLE: `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`,
  CONFIG_INVALIDE: "Réglages du calendrier invalides.",
  INDISPONIBLE: "Cette fonction n'est pas encore disponible.",
};
export const salonError = (code: SalonErreurCode, message?: string) => new SalonError(code, message ?? MESSAGES[code]);

export function checkMotDePasse(pw: string) {
  if (typeof pw !== "string" || pw.length < MOT_DE_PASSE_MIN) throw salonError("MOT_DE_PASSE_FAIBLE");
}

/** Vérifie une config de salon et la renvoie nettoyée (prénoms rognés). Lève CONFIG_INVALIDE. */
export function checkSalonConfig(config: SalonConfig): SalonConfig {
  const bad = (m: string) => salonError("CONFIG_INVALIDE", m);
  if (!config || typeof config !== "object" || !config.joueurs) throw bad("Réglages du calendrier manquants.");
  const joueurs = {} as SalonConfig["joueurs"];
  for (const w of WHO_LIST) {
    const j = config.joueurs[w];
    const prenom = typeof j?.prenom === "string" ? j.prenom.trim() : "";
    if (!prenom) throw bad("Il manque un prénom.");
    if (prenom.length > SALON_PRENOM_MAX) throw bad(`Prénom trop long (${SALON_PRENOM_MAX} caractères maximum).`);
    const c = j.couleurs;
    const isColor = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xffffff;
    if (!c || ![c.coat, c.hat, c.pompom, c.hair].every(isColor) || typeof c.longHair !== "boolean") {
      throw bad("Couleurs du personnage invalides.");
    }
    joueurs[w] = { prenom, couleurs: { coat: c.coat, hat: c.hat, pompom: c.pompom, hair: c.hair, longHair: c.longHair } };
  }
  const contenu = config.contenu ?? {};
  if (typeof contenu !== "object" || Array.isArray(contenu)) throw bad("Contenu des jeux invalide.");
  for (const k of Object.keys(contenu)) {
    if (!/^([1-9]|1\d|2[0-4])$/.test(k)) throw bad(`Jour de jeu invalide : ${k}.`);
  }
  const out: SalonConfig = { joueurs, contenu: JSON.parse(JSON.stringify(contenu)) as SalonConfig["contenu"] };
  if (new Blob([JSON.stringify(out)]).size > SALON_CONFIG_MAX_BYTES) {
    throw bad(`Contenu trop volumineux (${SALON_CONFIG_MAX_BYTES / 1024} Ko maximum).`);
  }
  return out;
}

/** Adresse de base du site (racine ou /demo/), sans paramètres : sert à fabriquer les liens. */
export function siteBaseUrl(): string {
  if (typeof location === "undefined") return "";
  return location.origin + location.pathname;
}
export const lienSalonUrl = (id: string) => `${siteBaseUrl()}?salon=${encodeURIComponent(id)}`;
export const lienInvitationUrl = (jeton: string) => `${siteBaseUrl()}?invitation=${encodeURIComponent(jeton)}`;

/** Jeton aléatoire (URL-safe), pour les invitations et les identifiants de salon en démo. */
export function randomToken(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
