/**
 * Jour 21 — règles pures du sapin : forme du sapin, coups du journal, état reconstruit.
 * Aucun dessin ici : testable et partagé entre le jeu et la miniature de la carte.
 *
 * Repère du sapin : x de -1 à 1 (la demi-largeur du bas des branches vaut 0,9),
 * y de 0 (la pointe) à 1 (le bas des branches). De 1 à 1,2 : le pied, où vont les cadeaux.
 */

import type { Who } from "../../core/contracts";
import type { TypeDeco } from "../../data/games/sapin-jour21";

/** Clé du journal dans l'état de la case 21 (le jeu et la miniature de la carte) */
export const CLE_SAPIN = "sapin";

export type TypePose = Exclude<TypeDeco, "guirlande">;

export type CoupSapin =
  /** une déco posée : c = indice de couleur dans la palette, r = petite inclinaison (radians) */
  | { k: "deco"; d: TypePose; c: number; x: number; y: number; r: number }
  /** une guirlande dessinée du doigt : p = [x0, y0, x1, y1, …] */
  | { k: "guirlande"; c: number; p: number[] }
  /** on enlève une de ses propres décos */
  | { k: "retire"; cible: string }
  /** l'étoile tenue pendant que l'autre n'était pas là */
  | { k: "veille" }
  /** l'étoile est posée (un seul coup, id « etoile ») */
  | { k: "etoile" };

export type Deco = { id: string; de: Who; le: number } & ({ k: "deco"; d: TypePose; c: number; x: number; y: number; r: number } | { k: "guirlande"; c: number; p: number[] });

export type EtatSapin = {
  /** Les décos en place, dans l'ordre où elles ont été posées */
  decos: Deco[];
  /** Décos en place par personne (guirlandes comprises) */
  nb: Record<Who, number>;
  guirlandes: Record<Who, number>;
  /** Qui a déjà tenu l'étoile seul */
  veille: Set<Who>;
  etoile: boolean;
};

type CoupJournal = { id: string; de: Who; le: number; t: CoupSapin };

/* ------------------------------------------------------------------ */
/* Forme                                                               */
/* ------------------------------------------------------------------ */

/** Trois étages : [haut, bas, demi-largeur en haut, demi-largeur en bas] */
export const ETAGES: [number, number, number, number][] = [
  [0, 0.4, 0.04, 0.42],
  [0.26, 0.7, 0.14, 0.66],
  [0.54, 1, 0.22, 0.9],
];
export const PIED = { haut: 1.03, bas: 1.2, demi: 1 };

export function demiLargeur(y: number): number {
  let w = 0;
  for (const [a, b, wa, wb] of ETAGES) {
    if (y >= a && y <= b) w = Math.max(w, wa + ((y - a) / (b - a)) * (wb - wa));
  }
  return w;
}

/** Le point est-il sur les branches (avec une marge pour que la déco ne déborde pas) ? */
export function surBranches(x: number, y: number, marge = 0.05): boolean {
  return y >= 0.07 && y <= 0.97 && Math.abs(x) <= demiLargeur(y) - marge;
}

export function auPied(x: number, y: number): boolean {
  return y >= PIED.haut && y <= PIED.bas && Math.abs(x) <= PIED.demi;
}

/** Ramène un point de guirlande sur les branches (la guirlande suit le sapin même si le doigt déborde) */
export function rabattre(x: number, y: number): [number, number] {
  const yy = Math.min(0.97, Math.max(0.07, y));
  const w = Math.max(0, demiLargeur(yy) - 0.02);
  return [Math.max(-w, Math.min(w, x)), yy];
}

/* ------------------------------------------------------------------ */
/* Journal → état                                                      */
/* ------------------------------------------------------------------ */

const arrondi = (v: number) => Math.round(v * 1000) / 1000;

/** Vérifie et nettoie un coup reçu (le dépôt peut contenir n'importe quoi) */
export function coupValide(t: unknown, nCouleurs: number): t is CoupSapin {
  if (!t || typeof t !== "object") return false;
  const c = t as Record<string, unknown>;
  const couleur = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < nCouleurs;
  const nombre = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  switch (c.k) {
    case "deco":
      return ["boule", "sucre", "coeur", "cloche", "noeud", "cadeau"].includes(c.d as string)
        && couleur(c.c) && nombre(c.x) && nombre(c.y) && nombre(c.r);
    case "guirlande":
      return couleur(c.c) && Array.isArray(c.p) && c.p.length >= 4 && c.p.length <= 80 && c.p.every(nombre);
    case "retire": return typeof c.cible === "string";
    case "veille": case "etoile": return true;
    default: return false;
  }
}

export function etatDuJournal(coups: CoupJournal[], nCouleurs: number): EtatSapin {
  const parId = new Map<string, Deco>();
  const veille = new Set<Who>();
  let etoile = false;
  for (const { id, de, le, t } of coups) {
    if (!coupValide(t, nCouleurs)) continue;
    if (t.k === "deco" || t.k === "guirlande") parId.set(id, { id, de, le, ...t });
    else if (t.k === "retire") {
      // on ne retire que ses propres décos
      if (parId.get(t.cible)?.de === de) parId.delete(t.cible);
    } else if (t.k === "veille") veille.add(de);
    else etoile = true;
  }
  const decos = [...parId.values()];
  const nb: Record<Who, number> = { alexandre: 0, flavie: 0 };
  const guirlandes: Record<Who, number> = { alexandre: 0, flavie: 0 };
  for (const d of decos) {
    nb[d.de]++;
    if (d.k === "guirlande") guirlandes[d.de]++;
  }
  return { decos, nb, guirlandes, veille, etoile };
}

/** L'étoile peut-elle apparaître ? (chacun a posé assez de décos) */
export const etoilePrete = (e: EtatSapin, seuil: number) => e.etoile || (e.nb.alexandre >= seuil && e.nb.flavie >= seuil);

/** Un coup de déco prêt à jouer, coordonnées arrondies (l'état de la case reste léger) */
export function coupDeco(d: TypePose, c: number, x: number, y: number, r: number): CoupSapin {
  return { k: "deco", d, c, x: arrondi(x), y: arrondi(y), r: arrondi(r) };
}

/** Une guirlande : on garde un point tous les ~0,04 et au plus 40 points */
export function coupGuirlande(c: number, points: [number, number][]): CoupSapin | null {
  const gardes: [number, number][] = [];
  for (const p of points) {
    const q = gardes[gardes.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.04) gardes.push(p);
  }
  const dernier = points[points.length - 1];
  if (dernier && gardes[gardes.length - 1] !== dernier) gardes.push(dernier);
  if (gardes.length > 40) {
    // trop long : on garde 40 points régulièrement espacés, premier et dernier compris
    const n = gardes.length;
    const choisis = Array.from({ length: 40 }, (_, i) => gardes[Math.round((i * (n - 1)) / 39)]);
    gardes.splice(0, n, ...choisis);
  }
  let longueur = 0;
  for (let i = 1; i < gardes.length; i++) longueur += Math.hypot(gardes[i][0] - gardes[i - 1][0], gardes[i][1] - gardes[i - 1][1]);
  if (gardes.length < 2 || longueur < 0.25) return null;
  return { k: "guirlande", c, p: gardes.flatMap(([x, y]) => [arrondi(x), arrondi(y)]) };
}

/* ------------------------------------------------------------------ */
/* Miniature de la carte                                               */
/* ------------------------------------------------------------------ */

/** Ce que la carte du monde dessine à côté du cadeau 21 (même forme que `SapinCarte` de src/world) */
export type ResumeCarte = { points: { x: number; y: number; couleur: number }[]; guirlandes: number[]; etoile: boolean; total: number };

export function resumeCarte(e: EtatSapin, palette: number[]): ResumeCarte {
  const points: ResumeCarte["points"] = [];
  const guirlandes: number[] = [];
  for (const d of e.decos) {
    if (d.k === "guirlande") guirlandes.push(palette[d.c] ?? 0xf2b632);
    else if (d.d !== "cadeau") points.push({ x: d.x, y: d.y, couleur: palette[d.c] ?? 0xd9354b });
  }
  return { points: points.slice(-30), guirlandes: guirlandes.slice(-4), etoile: e.etoile, total: e.decos.length };
}
