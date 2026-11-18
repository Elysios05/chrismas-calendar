/**
 * Construction automatique d'une grille de mots croisés à partir d'une liste de mots.
 *
 * Pourquoi automatique : Alexandre doit pouvoir remplacer les mots de `src/data` sans
 * redessiner quoi que ce soit. On place le plus long mot au centre, puis chaque mot suivant
 * sur le meilleur croisement possible, en refusant tout ce qui créerait des mots parasites
 * (deux lettres côte à côte qui ne forment pas un mot de la liste).
 *
 * Déterministe : même liste + même graine = même grille pour les deux joueurs.
 */

import type { MotCroise } from "../../data/games/motscroises-jour17";
import { creerAlea } from "../shared/alea";

export type Entree = {
  num: number;
  dir: "h" | "v";
  ligne: number;
  col: number;
  mot: string;          // lettres de la grille (sans accent ni espace)
  affiche: string;      // le mot tel qu'écrit par Alexandre
  definition: string;
  perso?: boolean;
};

export type Grille = {
  lignes: number;
  colonnes: number;
  /** null = case noire ; sinon la bonne lettre */
  solution: (string | null)[][];
  /** numéro affiché dans le coin de la case, s'il y en a un */
  numeros: (number | null)[][];
  entrees: Entree[];
};

/** Lettres de grille : majuscules, sans accents, sans espaces ni tirets */
export const lettresDe = (mot: string) =>
  mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

type Pose = { mot: MotCroise; lettres: string; ligne: number; col: number; dir: "h" | "v" };

const cle = (l: number, c: number) => `${l},${c}`;

function peutPoser(plan: Map<string, string>, poses: Pose[], lettres: string, ligne: number, col: number, dir: "h" | "v") {
  const dl = dir === "v" ? 1 : 0;
  const dc = dir === "h" ? 1 : 0;
  // une case libre doit précéder et suivre le mot
  if (plan.has(cle(ligne - dl, col - dc))) return -1;
  if (plan.has(cle(ligne + dl * lettres.length, col + dc * lettres.length))) return -1;

  let croisements = 0;
  const ajoutees = new Set<string>();
  for (let i = 0; i < lettres.length; i++) {
    const l = ligne + dl * i;
    const c = col + dc * i;
    const presente = plan.get(cle(l, c));
    if (presente) {
      if (presente !== lettres[i]) return -1;
      croisements++;
      continue;
    }
    ajoutees.add(cle(l, c));
    // pas de voisin perpendiculaire : sinon on fabrique un mot parasite
    const vl = dir === "h" ? 1 : 0;
    const vc = dir === "h" ? 0 : 1;
    if (plan.has(cle(l - vl, c - vc)) || plan.has(cle(l + vl, c + vc))) return -1;
  }
  // un mot entièrement recouvert par d'autres n'apporte rien et donnerait deux définitions
  // pour les mêmes cases (« TRAIN » posé sur « TRAINEAU »)
  if (!ajoutees.size) return -1;
  // et on ne doit pas rallonger un mot déjà posé dans le même sens (« TRAINEAU » qui prolonge « TRAIN »)
  for (const p of poses) {
    if (p.dir !== dir) continue;
    const pdl = p.dir === "v" ? 1 : 0;
    const pdc = p.dir === "h" ? 1 : 0;
    const avant = cle(p.ligne - pdl, p.col - pdc);
    const apres = cle(p.ligne + pdl * p.lettres.length, p.col + pdc * p.lettres.length);
    if (ajoutees.has(avant) || ajoutees.has(apres)) return -1;
  }
  return croisements;
}

export function construireGrille(
  mots: MotCroise[],
  combien: number,
  graine: number,
): Grille {
  const alea = creerAlea(graine);

  // mélange puis alterne « à vous deux » et Noël, en prenant les mots les plus croisables d'abord
  const melange = <T,>(liste: T[]) => {
    const l = [...liste];
    for (let i = l.length - 1; i > 0; i--) { const j = alea.entier(0, i); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  };
  const perso = melange(mots.filter((m) => m.perso));
  const noel = melange(mots.filter((m) => !m.perso));
  const choisis: MotCroise[] = [];
  for (let i = 0; choisis.length < combien && (perso.length || noel.length); i++) {
    const source = i % 2 === 0 ? (noel.length ? noel : perso) : (perso.length ? perso : noel);
    const m = source.shift();
    if (m) choisis.push(m);
  }
  // les plus longs d'abord : ils offrent le plus de croisements
  choisis.sort((a, b) => lettresDe(b.mot).length - lettresDe(a.mot).length);

  /**
   * Une tentative de grille pour un ordre de mots donné. On en essaie plusieurs et on garde
   * la plus compacte : placer les mots dans l'ordre reçu donne souvent une grille étirée.
   */
  const tenter = (ordre: MotCroise[]) => {
    const plan = new Map<string, string>();
    const poses: Pose[] = [];

    const poser = (p: Pose) => {
      const dl = p.dir === "v" ? 1 : 0;
      const dc = p.dir === "h" ? 1 : 0;
      for (let i = 0; i < p.lettres.length; i++) plan.set(cle(p.ligne + dl * i, p.col + dc * i), p.lettres[i]);
      poses.push(p);
    };

    for (const mot of ordre) {
    const lettres = lettresDe(mot.mot);
    if (!lettres) continue;
    if (!poses.length) { poser({ mot, lettres, ligne: 0, col: 0, dir: "h" }); continue; }

    let meilleur: { pose: Pose; note: number } | null = null;
    for (const pose of poses) {
      const dirNouvelle = pose.dir === "h" ? "v" : "h";
      for (let i = 0; i < pose.lettres.length; i++) {
        for (let j = 0; j < lettres.length; j++) {
          if (pose.lettres[i] !== lettres[j]) continue;
          const lCroix = pose.ligne + (pose.dir === "v" ? i : 0);
          const cCroix = pose.col + (pose.dir === "h" ? i : 0);
          const ligne = dirNouvelle === "v" ? lCroix - j : lCroix;
          const col = dirNouvelle === "h" ? cCroix - j : cCroix;
          const croisements = peutPoser(plan, poses, lettres, ligne, col, dirNouvelle);
          if (croisements < 1) continue;

          // on préfère beaucoup de croisements et une grille qui reste compacte
          let minL = ligne, maxL = ligne + (dirNouvelle === "v" ? lettres.length - 1 : 0);
          let minC = col, maxC = col + (dirNouvelle === "h" ? lettres.length - 1 : 0);
          for (const [k] of plan) {
            const [kl, kc] = k.split(",").map(Number);
            minL = Math.min(minL, kl); maxL = Math.max(maxL, kl);
            minC = Math.min(minC, kc); maxC = Math.max(maxC, kc);
          }
          // on préfère les croisements, et surtout une grille compacte et carrée
          const h = maxL - minL + 1, w = maxC - minC + 1;
          const note = croisements * 10 - (h + w) * 2 - Math.abs(h - w);
          if (!meilleur || note > meilleur.note) meilleur = { pose: { mot, lettres, ligne, col, dir: dirNouvelle }, note };
        }
      }
    }
      if (meilleur) poser(meilleur.pose);
      // sinon : mot ignoré, aucun croisement possible (le jeu s'adapte au nombre réel de mots)
    }

    let minL = Infinity, maxL = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const [k] of plan) {
      const [l, c] = k.split(",").map(Number);
      minL = Math.min(minL, l); maxL = Math.max(maxL, l);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }
    const h = maxL - minL + 1, w = maxC - minC + 1;
    // beaucoup de mots placés d'abord, puis la grille la plus petite et la plus carrée
    const qualite = poses.length * 1000 - h * w - Math.abs(h - w) * 3;
    return { plan, poses, qualite };
  };

  // plusieurs ordres essayés : le premier mot et l'ordre changent beaucoup le résultat
  let meilleureTentative = tenter(choisis);
  for (let essai = 0; essai < 60; essai++) {
    const ordre = melange(choisis);
    // un mot long en premier sert de colonne vertébrale
    ordre.sort((a, b) => (a === ordre[0] ? -1 : b === ordre[0] ? 1 : 0));
    const t = tenter(ordre);
    if (t.qualite > meilleureTentative.qualite) meilleureTentative = t;
  }
  const { plan, poses } = meilleureTentative;

  // recadrage sur le contenu réel
  let minL = Infinity, maxL = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const [k] of plan) {
    const [l, c] = k.split(",").map(Number);
    minL = Math.min(minL, l); maxL = Math.max(maxL, l);
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
  }
  const lignes = maxL - minL + 1;
  const colonnes = maxC - minC + 1;
  const solution: (string | null)[][] = Array.from({ length: lignes }, () => Array(colonnes).fill(null));
  for (const [k, v] of plan) {
    const [l, c] = k.split(",").map(Number);
    solution[l - minL][c - minC] = v;
  }

  // numérotation classique : on balaie de haut en bas, de gauche à droite
  const numeros: (number | null)[][] = Array.from({ length: lignes }, () => Array(colonnes).fill(null));
  let n = 0;
  for (let l = 0; l < lignes; l++) {
    for (let c = 0; c < colonnes; c++) {
      if (!solution[l][c]) continue;
      const debutH = (c === 0 || !solution[l][c - 1]) && c + 1 < colonnes && !!solution[l][c + 1];
      const debutV = (l === 0 || !solution[l - 1][c]) && l + 1 < lignes && !!solution[l + 1][c];
      if (debutH || debutV) numeros[l][c] = ++n;
    }
  }

  const entrees: Entree[] = poses.map((p) => {
    const ligne = p.ligne - minL;
    const col = p.col - minC;
    return {
      num: numeros[ligne][col] ?? 0,
      dir: p.dir,
      ligne,
      col,
      mot: p.lettres,
      affiche: p.mot.mot,
      definition: p.mot.definition,
      perso: p.mot.perso,
    };
  }).sort((a, b) => a.num - b.num || (a.dir === "h" ? -1 : 1));

  return { lignes, colonnes, solution, numeros, entrees };
}
