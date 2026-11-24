/**
 * Un dessin = une suite d'éléments horodatés, pour pouvoir le **rejouer** chez l'autre
 * (en direct trait par trait, ou plus tard en différé, au même rythme).
 *
 * Coordonnées entières de 0 à 1000 (tableau carré), temps en ms depuis le début de la manche :
 * c'est compact (≈ 15 Ko pour une minute de dessin) et indépendant de la taille de l'écran.
 */

export type Trait = {
  /** Indice dans PALETTE, -1 = gomme */
  c: number;
  /** Indice dans EPAISSEURS */
  e: number;
  /** x, y, t, x, y, t… */
  p: number[];
};
/** « Tout effacer » */
export type Effacer = { x: 1; t: number };
export type Element = Trait | Effacer;

export const PALETTE = ["#1b2747", "#d9354b", "#2fa37a", "#2f6fd6", "#f2b632", "#8a4b2a", "#9b59d0", "#f28cb8"];
export const NOMS_COULEURS = ["Noir", "Rouge", "Vert", "Bleu", "Jaune", "Marron", "Violet", "Rose"];
export const EPAISSEURS = [6, 14, 30];
export const GOMME = -1;
export const FOND = "#ffffff";

export const estEffacer = (e: Element | undefined): e is Effacer => !!e && "x" in e;

/**
 * Dessine les éléments sur un contexte 2D de côté `taille` px.
 * `jusqua` (ms) : ne montre que ce qui avait été tracé à cet instant (rejeu).
 */
export function peindre(cx: CanvasRenderingContext2D, taille: number, elements: (Element | undefined)[], jusqua = Infinity) {
  const k = taille / 1000;
  cx.fillStyle = FOND;
  cx.fillRect(0, 0, taille, taille);
  cx.lineCap = "round";
  cx.lineJoin = "round";
  for (const el of elements) {
    if (!el) continue;
    if (estEffacer(el)) {
      if (el.t <= jusqua) { cx.fillStyle = FOND; cx.fillRect(0, 0, taille, taille); }
      continue;
    }
    const p = el.p;
    if (p.length < 3 || p[2] > jusqua) continue;
    cx.strokeStyle = el.c === GOMME ? FOND : PALETTE[el.c] ?? PALETTE[0];
    cx.fillStyle = cx.strokeStyle;
    const largeur = (EPAISSEURS[el.e] ?? EPAISSEURS[0]) * (el.c === GOMME ? 1.8 : 1) * k;
    cx.lineWidth = largeur;
    if (p.length === 3 || p[5] > jusqua) {
      // un simple point
      cx.beginPath();
      cx.arc(p[0] * k, p[1] * k, largeur / 2, 0, Math.PI * 2);
      cx.fill();
      continue;
    }
    cx.beginPath();
    cx.moveTo(p[0] * k, p[1] * k);
    for (let i = 3; i < p.length; i += 3) {
      if (p[i + 2] > jusqua) break;
      cx.lineTo(p[i] * k, p[i + 1] * k);
    }
    cx.stroke();
  }
}

/** Instant du dernier point (durée « utile » du dessin) */
export function dureeDessin(elements: Element[]): number {
  let fin = 0;
  for (const el of elements) {
    if (estEffacer(el)) fin = Math.max(fin, el.t);
    else if (el.p.length >= 3) fin = Math.max(fin, el.p[el.p.length - 1]);
  }
  return fin;
}

/** Petite image (data URL) d'un dessin fini, pour la galerie de fin */
export function vignette(elements: Element[], taille = 160): string {
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  const cx = c.getContext("2d");
  if (!cx) return "";
  peindre(cx, taille, elements);
  return c.toDataURL("image/png");
}
