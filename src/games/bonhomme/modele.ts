/**
 * Jour 13 — modèle commun : coups du journal, rôles, géométrie du bonhomme et décompte des points.
 * Tout ce qui est ici est pur (pas de React, pas de DOM) : le même calcul sert en direct et en différé.
 */

import type { Who } from "../../core/contracts";
import type { BonhommeContent, TypeDeco } from "../../data/games/bonhomme-jour13";

/** Une boule roulée : rayon en cm, et rondeur 0 (boudin) → 1 (parfaite) */
export type Boule = { r: number; rondeur: number };

export type Partie = "tete" | "corps";

/** Un objet posé : sa position est relative à la boule qui le porte (u, v en rayons depuis le centre) */
export type Objet = { id: string; type: TypeDeco; sur: Partie; u: number; v: number };

export type CoupBonhomme =
  | { k: "boule"; boule: Boule }
  | { k: "deco"; objets: Objet[] };

export const idBoule = (qui: Who) => `boule:${qui}`;
export const idDeco = (qui: Who) => `deco:${qui}`;

/** Place 2 roule le corps, place 1 la tête (décision d'Alexandre) */
export const roleDe = (qui: Who): Partie => (qui === "flavie" ? "corps" : "tete");

const borne = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Vérifie un objet reçu (journal ou direct) : un objet abîmé est ignoré */
export function objetValide(o: unknown, types: Set<string>): o is Objet {
  const x = o as Objet;
  return !!x && typeof x.id === "string" && types.has(x.type) && (x.sur === "tete" || x.sur === "corps")
    && Number.isFinite(x.u) && Number.isFinite(x.v) && Math.abs(x.u) < 4 && Math.abs(x.v) < 4;
}

export function bouleValide(b: unknown): b is Boule {
  const x = b as Boule;
  return !!x && Number.isFinite(x.r) && x.r > 0 && x.r < 200 && Number.isFinite(x.rondeur);
}

/* ------------------------------------------------------------------ */
/* Géométrie : où dessiner les deux boules dans la scène (300 × 400)   */
/* ------------------------------------------------------------------ */

export const SCENE = { l: 300, h: 400, sol: 368 };

export type Geo = { cx: number; cy: number; r: number; rx: number; ry: number; connue: boolean };

/** Aplatissement d'une boule peu ronde : plus large que haute (un boudin couché) */
const forme = (r: number, rondeur: number) => {
  const d = 1 - borne(rondeur);
  return { rx: r * (1 + 0.38 * d), ry: r * (1 - 0.22 * d) };
};

export function geometrie(c: BonhommeContent, corps: Boule | null, tete: Boule | null) {
  const rc = corps?.r ?? Math.max(c.teteConseillee / c.rapportIdeal, 40);
  const rt = tete?.r ?? rc * c.rapportIdeal;
  // hauteur totale en cm (avec un chapeau) → échelle pour tenir dans la scène
  const haut = rc * 1.9 + rt * 1.85 + rt * 0.95;
  const s = Math.min(3.4, (SCENE.sol - 22) / haut, 270 / (2.6 * Math.max(rc, rt)));
  const fc = forme(rc * s, corps?.rondeur ?? 1);
  const ft = forme(rt * s, tete?.rondeur ?? 1);
  const cyc = SCENE.sol - fc.ry * 0.96;
  const cyt = cyc - fc.ry * 0.86 - ft.ry * 0.86;
  return {
    corps: { cx: SCENE.l / 2, cy: cyc, r: rc * s, ...fc, connue: !!corps } as Geo,
    tete: { cx: SCENE.l / 2, cy: cyt, r: rt * s, ...ft, connue: !!tete } as Geo,
  };
}

/** Rattache un point de la scène à la boule la plus proche (en rayons) */
export function rattacher(geo: { corps: Geo; tete: Geo }, x: number, y: number): { sur: Partie; u: number; v: number } {
  const d = (g: Geo) => Math.hypot(x - g.cx, y - g.cy) / g.r;
  const sur: Partie = d(geo.tete) <= d(geo.corps) ? "tete" : "corps";
  const g = geo[sur];
  return { sur, u: borne((x - g.cx) / g.r, -2.4, 2.4), v: borne((y - g.cy) / g.r, -2.4, 2.4) };
}

export const position = (geo: { corps: Geo; tete: Geo }, o: Pick<Objet, "sur" | "u" | "v">) => {
  const g = geo[o.sur];
  return { x: g.cx + o.u * g.r, y: g.cy + o.v * g.r, r: g.r };
};

/* ------------------------------------------------------------------ */
/* Points                                                              */
/* ------------------------------------------------------------------ */

export type Construction = { taille: number; assortiment: number; rondeur: number; complet: boolean };

export function noterConstruction(c: BonhommeContent, corps: Boule | null, tete: Boule | null): Construction {
  const P = c.points;
  // taille : le corps compte (c'est lui qui fait la hauteur) ; plein à 48 cm de rayon
  const taille = corps ? Math.round(P.taille * borne((corps.r - 15) / 33)) : 0;
  let assortiment = 0;
  if (corps && tete) {
    const ecart = Math.abs(tete.r / corps.r - c.rapportIdeal);
    assortiment = Math.round(P.assortiment * (ecart <= 0.08 ? 1 : borne(1 - (ecart - 0.08) / 0.32)));
  }
  const rondeurs = [corps, tete].filter((b): b is Boule => !!b).map((b) => borne((b.rondeur - 0.35) / 0.55));
  // une boule manquante compte pour zéro dans la moyenne : le score n'est complet qu'à deux
  const rondeur = Math.round(P.rondeur * (rondeurs.reduce((a, b) => a + b, 0) / 2));
  return { taille, assortiment, rondeur, complet: !!corps && !!tete };
}

export type Element = { cle: string; label: string; ok: boolean };

/** Les sept éléments d'un vrai bonhomme, vérifiés à leur place */
export function noterDecoration(objets: Objet[]): Element[] {
  const sur = (p: Partie, t: TypeDeco) => objets.filter((o) => o.sur === p && o.type === t);
  const yeux = sur("tete", "charbon").filter((o) => o.v < 0 && Math.abs(o.u) < 0.9).length >= 2;
  const bouche = sur("tete", "charbon").filter((o) => o.v >= 0.05 && Math.abs(o.u) < 0.9).length >= 2;
  const nez = sur("tete", "carotte").some((o) => Math.abs(o.u) < 0.6 && o.v > -0.45 && o.v < 0.6);
  const chef = [...sur("tete", "bonnet"), ...sur("tete", "chapeau")].some((o) => o.v < -0.5 && Math.abs(o.u) < 0.7);
  const echarpe = sur("tete", "echarpe").some((o) => o.v > 0.3) || sur("corps", "echarpe").some((o) => o.v < -0.4);
  const boutons = sur("corps", "bouton").filter((o) => Math.abs(o.u) < 0.6).length >= 2;
  const bras = sur("corps", "branche").some((o) => Math.abs(o.u) > 0.55);
  return [
    { cle: "yeux", label: "Deux yeux", ok: yeux },
    { cle: "nez", label: "Un nez en carotte", ok: nez },
    { cle: "bouche", label: "Un sourire", ok: bouche },
    { cle: "chef", label: "Bonnet ou chapeau", ok: chef },
    { cle: "echarpe", label: "Une écharpe", ok: echarpe },
    { cle: "boutons", label: "Des boutons", ok: boutons },
    { cle: "bras", label: "Des bras", ok: bras },
  ];
}

export type Bilan = {
  construction: Construction;
  elements: Element[];
  deco: number;
  aDeux: boolean;
  total: number;
};

export function bilan(c: BonhommeContent, corps: Boule | null, tete: Boule | null, objets: Record<Who, Objet[]>): Bilan {
  const construction = noterConstruction(c, corps, tete);
  const elements = noterDecoration([...objets.alexandre, ...objets.flavie]);
  const aDeux = objets.alexandre.length > 0 && objets.flavie.length > 0;
  const deco = elements.filter((e) => e.ok).length * c.points.parElement + (aDeux ? c.points.aDeux : 0);
  return { construction, elements, deco, aDeux, total: construction.taille + construction.assortiment + construction.rondeur + deco };
}
