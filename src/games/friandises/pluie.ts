/**
 * Règles du duel, sans affichage : la pluie (tirée d'une graine) et le décompte des points.
 *
 * Repères : x de 0 à 1000 (largeur du terrain), t en ms depuis le début de la manche.
 * Une friandise apparaît à `t0` en haut et touche la ligne des hottes à `t0 + chute`.
 *
 * Décompte (identique en direct et contre un fantôme) : pour chaque friandise, la PREMIÈRE
 * hotte qui la touche la garde ; l'étoile ne compte que si les deux hottes l'ont touchée.
 */

import type { Who } from "../../core/contracts";
import { creerAlea } from "../shared/alea";
import type { FriandisesContent, TypeFriandise } from "../../data/games/friandises-jour6";

export type Friandise = { id: string; x: number; t0: number; chute: number; type: TypeFriandise };
export type Prise = { id: string; t: number };
/** Ce qu'un joueur dépose à la fin d'une manche */
export type CoupManche = { m: number; prises: Prise[]; trace: number[]; direct: boolean };

/** Hauteur de la ligne des hottes (fraction de la chute) et demi-largeur d'une hotte */
export const LIGNE = 0.86;
export const DEMI_HOTTE = 80;
/** Pas d'échantillonnage de la trace (position de la hotte), en ms */
export const PAS_TRACE = 100;

export const idManche = (qui: Who, m: number) => `manche:${qui}:${m}`;

export function pluie(c: FriandisesContent, m: number): Friandise[] {
  const a = creerAlea(c.graine + m * 101);
  const duree = c.secondes * 1000;
  const total = Object.values(c.frequences).reduce((s, v) => s + v, 0);
  const tirerType = (): TypeFriandise => {
    let r = a.reel() * total;
    for (const [type, f] of Object.entries(c.frequences) as [TypeFriandise, number][]) { if ((r -= f) < 0) return type; }
    return "sucre";
  };
  const l: Friandise[] = [];
  let t = 900;
  let x = 500;
  for (let i = 0; ; i++) {
    const avance = Math.min(1, t / duree);
    const chute = (c.chuteDebut + (c.chuteFin - c.chuteDebut) * avance) * 1000;
    // on s'arrête quand la friandise n'aurait plus le temps d'arriver en bas
    if (t + chute * LIGNE > duree) break;
    // pas trop loin de la précédente au début, n'importe où ensuite (rebond sur les bords :
    // une simple butée collerait la pluie contre un côté)
    const ecart = 250 + 450 * avance;
    x += (a.reel() * 2 - 1) * ecart;
    while (x < 60 || x > 940) x = x < 60 ? 120 - x : 1880 - x;
    x = Math.round(x);
    l.push({ id: `${m}:${i}`, x, t0: Math.round(t), chute: Math.round(chute), type: tirerType() });
    t += (c.intervalleDebut + (c.intervalleFin - c.intervalleDebut) * avance) * 1000 * (0.7 + a.reel() * 0.6);
  }
  return l;
}

export type Decompte = {
  points: Record<Who, number>;
  /** Friandises gardées par chacun (hors charbon et étoiles) */
  gardees: Record<Who, number>;
  charbons: Record<Who, number>;
  /** Étoiles attrapées à deux */
  etoiles: number;
};

export function decompter(c: FriandisesContent, l: Friandise[], prises: Record<Who, Prise[]>): Decompte {
  const types = new Map(l.map((f) => [f.id, f.type]));
  const d: Decompte = {
    points: { alexandre: 0, flavie: 0 },
    gardees: { alexandre: 0, flavie: 0 },
    charbons: { alexandre: 0, flavie: 0 },
    etoiles: 0,
  };
  const qui = new Map<string, { a?: number; f?: number }>();
  for (const p of prises.alexandre) { const e = qui.get(p.id) ?? {}; e.a = Math.min(e.a ?? Infinity, p.t); qui.set(p.id, e); }
  for (const p of prises.flavie) { const e = qui.get(p.id) ?? {}; e.f = Math.min(e.f ?? Infinity, p.t); qui.set(p.id, e); }
  for (const [id, e] of qui) {
    const type = types.get(id);
    if (!type) continue;
    if (type === "etoile") {
      if (e.a !== undefined && e.f !== undefined) {
        d.etoiles++;
        d.points.alexandre += c.points.etoile;
        d.points.flavie += c.points.etoile;
      }
      continue;
    }
    // la première hotte garde la friandise (égalité : Alexandre, au hasard fixe)
    const gagnant: Who = e.f === undefined || (e.a !== undefined && e.a <= e.f) ? "alexandre" : "flavie";
    d.points[gagnant] += c.points[type];
    if (type === "charbon") d.charbons[gagnant]++;
    else d.gardees[gagnant]++;
  }
  return d;
}
