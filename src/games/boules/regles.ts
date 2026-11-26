/**
 * Règles du duel des forts, sans affichage : vol des boules, forts, touches, décompte.
 *
 * Repères (« terrain ») : x de 0 à 640, Alexandre à gauche, Flavie à droite ; y vers le HAUT, 0 = le sol.
 * Le temps est en ms depuis le début de la manche, avancé par pas fixes de 10 ms : avec les mêmes coups,
 * les deux téléphones trouvent exactement le même résultat (que des additions et multiplications, et le vent
 * de chaque boule est enregistré avec le tir, pas recalculé).
 *
 * Décompte (identique en direct et contre un fantôme) : on rejoue les tirs des deux joueurs contre la posture
 * (debout / baissé) de l'autre, enregistrée tous les 100 ms. Le score affiché pendant le direct n'est donc
 * qu'un aperçu ; celui qui compte est recalculé à partir des deux coups déposés.
 */

import type { Who } from "../../core/contracts";
import type { BoulesContent } from "../../data/games/boules-jour18";
import { creerAlea } from "../shared/alea";

/* ---------- géométrie du terrain ---------- */
export const LARGEUR = 640;
export const X: Record<Who, number> = { alexandre: 70, flavie: 570 };
export const MUR: Record<Who, number> = { alexandre: 148, flavie: 492 };
export const SENS: Record<Who, number> = { alexandre: 1, flavie: -1 };
/** Baissé, on se plaque contre son fort : seule une cloche très haute peut encore retomber derrière */
export const X_BAISSE: Record<Who, number> = { alexandre: 148 - 36, flavie: 492 + 36 };
/** Où se tient un joueur */
export const xDe = (qui: Who, baisse: boolean) => (baisse ? X_BAISSE[qui] : X[qui]);
export const DEMI_CORPS = 20;
export const HAUT_DEBOUT = 104;
export const HAUT_BAISSE = 44;
export const DEMI_MUR = 20;
/** Hauteur d'une rangée de neige du fort */
export const RANGEE = 22;
export const RAYON = 7;
/** D'où part la boule (main levée) */
export const MAIN_DX = 22;
export const MAIN_Y = 94;

/* ---------- lancer ---------- */
export const GRAVITE = 1000;
export const V_MIN = 300;
export const V_MAX = 900;
export const A_MIN = 0.14;
export const A_MAX = 1.45;
export const PAS = 10;
/** Pas d'échantillonnage de la posture, en ms */
export const PAS_TRACE = 100;
/** Après la fin de la manche, on laisse retomber les boules encore en l'air */
export const RETOMBEE = 2500;

/** Un tir : instant, vitesse, angle (rad, au-dessus de l'horizontale) et vent subi par la boule */
export type Tir = { t: number; v: number; a: number; w: number };
/** Ce qu'un joueur dépose à la fin d'une manche ; trace : 1 = baissé, tous les 100 ms */
export type CoupManche = { m: number; tirs: Tir[]; trace: number[]; direct: boolean };
/** L'autre n'a pas encore joué : score provisoire contre quelqu'un qui reste debout */
export const PERSONNE = (m: number): CoupManche => ({ m, tirs: [], trace: [0], direct: false });

export const idManche = (qui: Who, m: number) => `manche:${qui}:${m}`;
export const autreQue = (qui: Who): Who => (qui === "alexandre" ? "flavie" : "alexandre");

/** Vent du moment (positif : souffle vers Flavie). Arrondi : il est enregistré avec chaque tir. */
export function ventA(c: BoulesContent, m: number, t: number): number {
  const amp = c.vent[Math.min(m, c.vent.length - 1)] ?? 0;
  if (!amp) return 0;
  const phase = creerAlea(c.graine + m * 31).reel() * Math.PI * 2;
  return Math.round(amp * Math.sin((t / 9000) * Math.PI * 2 + phase));
}

export const borner = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/* ---------- la bataille, pas à pas ---------- */

export type Issue = "touche" | "mur" | "sol" | "loin";
export type Boule = {
  qui: Who; tir: Tir; x: number; y: number; vx: number; vy: number; t: number;
  /** Faux pour les boules du lutin (entraînement en solo) : elles ne rapportent rien */
  compte: boolean;
  fin: Issue | null;
};
export type Evenement = { boule: Boule; issue: Issue; cible: Who };

export class Bataille {
  t = 0;
  hp: Record<Who, number>;
  points: Record<Who, number> = { alexandre: 0, flavie: 0 };
  touches: Record<Who, number> = { alexandre: 0, flavie: 0 };
  boules: Boule[] = [];
  private attente: Boule[] = [];
  private cumul: Record<Who, number> = { alexandre: 0, flavie: 0 };

  private c: BoulesContent;
  /** Posture d'un joueur à un instant (vrai = baissé) */
  private baisse: (qui: Who, t: number) => boolean;
  private surEvenement?: (e: Evenement) => void;

  constructor(c: BoulesContent, baisse: (qui: Who, t: number) => boolean, surEvenement?: (e: Evenement) => void) {
    this.c = c;
    this.baisse = baisse;
    this.surEvenement = surEvenement;
    this.hp = { alexandre: c.rangees, flavie: c.rangees };
  }

  lancer(qui: Who, tir: Tir, compte = true) {
    const s = SENS[qui];
    const b: Boule = {
      qui, tir, compte, fin: null, t: tir.t,
      x: X[qui] + s * MAIN_DX, y: MAIN_Y,
      vx: s * tir.v * Math.cos(tir.a), vy: tir.v * Math.sin(tir.a),
    };
    // rangée par heure de départ (un tir reçu en retard passe devant les plus récents)
    let i = this.attente.length;
    while (i > 0 && this.attente[i - 1].t > b.t) i--;
    this.attente.splice(i, 0, b);
  }

  /** Avance la bataille jusqu'à l'instant `jusqua` (ms) */
  avancer(jusqua: number) {
    while (this.t + PAS <= jusqua) {
      this.t += PAS;
      while (this.attente.length && this.attente[0].t <= this.t) this.boules.push(this.attente.shift()!);
      for (const b of this.boules) {
        while (!b.fin && b.t + PAS <= this.t) this.pas(b);
      }
      this.boules = this.boules.filter((b) => !b.fin);
      this.reparer();
    }
  }

  private reparer() {
    for (const qui of ["alexandre", "flavie"] as Who[]) {
      if (!this.baisse(qui, this.t)) { this.cumul[qui] = 0; continue; }
      this.cumul[qui] += PAS;
      if (this.cumul[qui] >= this.c.reparation * 1000) {
        this.cumul[qui] = 0;
        if (this.hp[qui] < this.c.rangees) this.hp[qui]++;
      }
    }
  }

  private pas(b: Boule) {
    const dt = PAS / 1000;
    b.vx += b.tir.w * dt;
    b.vy -= GRAVITE * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.t += PAS;
    const cible = autreQue(b.qui);
    let issue: Issue | null = null;
    const hp = this.hp[cible];
    if (hp > 0 && Math.abs(b.x - MUR[cible]) <= DEMI_MUR + RAYON && b.y <= hp * RANGEE + RAYON) {
      issue = "mur";
      this.hp[cible] = hp - 1;
      this.cumul[cible] = 0;
    } else {
      const baisse = this.baisse(cible, b.t);
      const h = baisse ? HAUT_BAISSE : HAUT_DEBOUT;
      if (Math.abs(b.x - xDe(cible, baisse)) <= DEMI_CORPS + RAYON && b.y <= h + RAYON) {
        issue = "touche";
        if (b.compte) { this.points[b.qui] += this.c.points; this.touches[b.qui]++; }
      } else if (b.y < 0) issue = "sol";
      else if (b.x < -80 || b.x > LARGEUR + 80) issue = "loin";
    }
    if (issue) {
      b.fin = issue;
      this.surEvenement?.({ boule: b, issue, cible });
    }
  }
}

/** Posture lue dans une trace (1 = baissé). Au-delà de la fin : la dernière posture. */
export function postureDans(trace: number[] | undefined, t: number): boolean {
  if (!trace || !trace.length) return false;
  return trace[borner(Math.floor(t / PAS_TRACE), 0, trace.length - 1)] === 1;
}

export type Decompte = { points: Record<Who, number>; touches: Record<Who, number>; tirs: Record<Who, number> };

/** Le score d'une manche jouée par les deux (en direct ou contre un fantôme) */
export function decompter(c: BoulesContent, coups: Record<Who, CoupManche>): Decompte {
  const sim = new Bataille(c, (qui, t) => postureDans(coups[qui].trace, t));
  for (const qui of ["alexandre", "flavie"] as Who[]) for (const tir of coups[qui].tirs) sim.lancer(qui, tir);
  sim.avancer(c.secondes * 1000 + RETOMBEE);
  return {
    points: sim.points,
    touches: sim.touches,
    tirs: { alexandre: coups.alexandre.tirs.length, flavie: coups.flavie.tirs.length },
  };
}

/* ---------- le lutin (entraînement quand on joue le premier, seul) ---------- */

/** Où retombe une boule (à la hauteur du ventre de la cible), sans obstacle */
function portee(qui: Who, v: number, a: number, w: number): number {
  const s = SENS[qui];
  let x = X[qui] + s * MAIN_DX, y = MAIN_Y, vx = s * v * Math.cos(a), vy = v * Math.sin(a);
  const dt = PAS / 1000;
  for (let i = 0; i < 600; i++) {
    vx += w * dt; vy -= GRAVITE * dt; x += vx * dt; y += vy * dt;
    if (vy < 0 && y <= 60) break;
  }
  return x;
}

/** Les tirs du lutin, placé chez `lanceur`, visant `cible` : réglés pour tomber près d'elle */
export function tirsLutin(c: BoulesContent, m: number, lanceur: Who): Tir[] {
  const a = creerAlea(c.graine + 7 + m * 53);
  const cible = X[autreQue(lanceur)];
  const fin = c.secondes * 1000 - 1500;
  const tirs: Tir[] = [];
  for (let t = 2200; t < fin; t += c.lutinIntervalle * 1000 * (0.7 + a.reel() * 0.6)) {
    const angle = 0.55 + a.reel() * 0.5;
    const w = ventA(c, m, t);
    // on cherche la vitesse qui tombe sur la cible, puis on se trompe un peu
    let lo = V_MIN, hi = V_MAX;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      const d = (portee(lanceur, mid, angle, w) - X[lanceur]) * SENS[lanceur];
      if (d < Math.abs(cible - X[lanceur])) lo = mid; else hi = mid;
    }
    const v = Math.round(borner(lo * (0.86 + a.reel() * 0.28), V_MIN, V_MAX));
    tirs.push({ t: Math.round(t), v, a: Math.round(angle * 1000) / 1000, w });
  }
  return tirs;
}
