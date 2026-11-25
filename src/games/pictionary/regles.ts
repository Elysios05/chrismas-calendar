/**
 * Règles du Pictionary, sans affichage : lecture du journal, scores, ordre des manches.
 *
 * Le journal contient deux sortes de coups :
 *  - `dessin:<qui>:<k>` : le k-ième dessin de <qui> (mot, éléments horodatés) ;
 *  - `devine:<qui>:<k>` : <qui> a deviné (ou non) le k-ième dessin de l'autre.
 * Une manche est finie quand les deux existent. En direct, les manches alternent ;
 * chacun son tour, on devine d'abord ce que l'autre a laissé, puis on dessine les siens.
 */

import type { Who } from "../../core/contracts";
import type { Coup } from "../shared/partie";
import { creerAlea } from "../shared/alea";
import type { MotADessiner, PictionaryContent } from "../../data/games/pictionary-jour5";
import type { Element } from "./dessin";

export type Theme = "noel" | "nous";
export type MotPropose = MotADessiner & { theme: Theme };

export type CoupDessin = { type: "dessin"; k: number; mot: string; theme: Theme; elements: Element[]; direct: boolean };
export type CoupDevine = { type: "devine"; k: number; trouve: boolean; secondes: number; essais: number };
export type CoupPic = CoupDessin | CoupDevine;

export const idDessin = (qui: Who, k: number) => `dessin:${qui}:${k}`;
/** `qui` devine le k-ième dessin de l'autre */
export const idDevine = (qui: Who, k: number) => `devine:${qui}:${k}`;

/** En direct, c'est Flavie qui ouvre le bal */
export const PREMIER: Who = "flavie";
const autre = (q: Who): Who => (q === "alexandre" ? "flavie" : "alexandre");

export type Bilan = {
  dessins: Record<Who, (CoupDessin | undefined)[]>;
  devines: Record<Who, (CoupDevine | undefined)[]>;
  scores: Record<Who, number>;
  /** Manches finies (dessin + devinette) */
  finies: number;
  complet: boolean;
};

/** Points d'un dessin trouvé : plus c'est rapide, plus les deux gagnent */
export function points(secondes: number, total: number) {
  const restantes = Math.max(0, Math.round(total - secondes));
  return { devineur: 100 + 2 * restantes, dessinateur: 50 + restantes };
}

export function lireJournal(coups: Coup<CoupPic>[], n: number, total: number): Bilan {
  const vide = () => Array.from({ length: n }, () => undefined);
  const b: Bilan = {
    dessins: { alexandre: vide(), flavie: vide() },
    devines: { alexandre: vide(), flavie: vide() },
    scores: { alexandre: 0, flavie: 0 },
    finies: 0,
    complet: false,
  };
  for (const c of coups) {
    const t = c.t;
    if (!t || t.k < 0 || t.k >= n) continue;
    if (t.type === "dessin") b.dessins[c.de][t.k] = t;
    else if (t.type === "devine") b.devines[c.de][t.k] = t;
  }
  for (const devineur of ["alexandre", "flavie"] as Who[]) {
    const dessinateur = autre(devineur);
    for (let k = 0; k < n; k++) {
      const d = b.devines[devineur][k];
      if (!d || !b.dessins[dessinateur][k]) continue;
      b.finies++;
      if (!d.trouve) continue;
      const p = points(d.secondes, total);
      b.scores[devineur] += p.devineur;
      b.scores[dessinateur] += p.dessinateur;
    }
  }
  b.complet = b.finies === 2 * n;
  return b;
}

export type Manche = { r: number; k: number; dessinateur: Who; devineur: Who };

/** Ordre du direct : Flavie, Alexandre, Flavie… ; renvoie la première manche pas finie */
export function mancheDirecte(b: Bilan, n: number): Manche | null {
  for (let r = 0; r < 2 * n; r++) {
    const dessinateur = r % 2 === 0 ? PREMIER : autre(PREMIER);
    const devineur = autre(dessinateur);
    const k = Math.floor(r / 2);
    if (!b.dessins[dessinateur][k] || !b.devines[devineur][k]) return { r, k, dessinateur, devineur };
  }
  return null;
}

export type Tache = { role: "devine" | "dessine"; k: number };

/** Chacun son tour : deviner ce que l'autre a laissé, puis dessiner les siens */
export function tacheSeul(b: Bilan, moi: Who, n: number): Tache | null {
  const lui = autre(moi);
  for (let k = 0; k < n; k++) if (b.dessins[lui][k] && !b.devines[moi][k]) return { role: "devine", k };
  for (let k = 0; k < n; k++) if (!b.dessins[moi][k]) return { role: "dessine", k };
  return null;
}

/** Les deux mots proposés pour le k-ième dessin de <qui> : un de Noël, un « à vous deux » */
export function motsProposes(c: PictionaryContent, qui: Who, k: number): [MotPropose, MotPropose] {
  const melanger = <T,>(liste: T[], graine: number) => {
    const a = creerAlea(graine);
    const l = liste.slice();
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(a.reel() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  };
  // une seule distribution pour les deux : Alexandre prend les indices pairs, Flavie les impairs
  const i = 2 * k + (qui === "alexandre" ? 0 : 1);
  const noel = melanger(c.noel, c.graine);
  const nous = melanger(c.nous, c.graine + 1);
  return [
    { ...noel[i % noel.length], theme: "noel" },
    { ...nous[i % nous.length], theme: "nous" },
  ];
}

/** État partagé en direct : la manche en cours (fixée par celui qui dessine) */
export type EtatLive = { r: number; debut: number; mot: string; theme: Theme; rejeu: boolean };

export function lireEtatLive(s: unknown): EtatLive | null {
  if (!s || typeof s !== "object") return null;
  const e = s as Partial<EtatLive>;
  if (typeof e.r !== "number" || typeof e.debut !== "number" || typeof e.mot !== "string") return null;
  return { r: e.r, debut: e.debut, mot: e.mot, theme: e.theme === "nous" ? "nous" : "noel", rejeu: !!e.rejeu };
}
