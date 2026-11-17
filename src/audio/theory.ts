/**
 * Petits outils de solfège pour écrire la musique en code :
 * notes, accords, mélodies en texte, arpèges.
 */
import type { Ev } from "./types";

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#5" → 78 (MIDI) */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Note invalide : ${name}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return PC[m[1]] + acc + (Number(m[3]) + 1) * 12;
}

export const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "6": [0, 4, 7, 9],
  m7b5: [0, 3, 6, 10],
};

/** "Bbmaj7" → { root: 10, tones: [0,4,7,11] } */
export function parseChord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m || !(m[3] in QUALITIES)) throw new Error(`Accord inconnu : ${name}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return { root: (PC[m[1]] + acc + 12) % 12, tones: QUALITIES[m[3]] };
}

/** Basse : fondamentale de l'accord dans l'octave qui commence à `floor` */
export function rootOf(name: string, floor: number, interval = 0): number {
  const { root } = parseChord(name);
  const pc = (root + interval) % 12;
  return floor + ((pc - floor) % 12 + 12) % 12;
}

/** Notes de l'accord (classes de hauteur) */
function pcs(name: string): number[] {
  const { root, tones } = parseChord(name);
  return tones.map((t) => (root + t) % 12);
}

/** Accord en position serrée : chaque note dans [low, low+12) */
export function voice(name: string, low: number): number[] {
  return pcs(name)
    .map((pc) => low + ((pc - low) % 12 + 12) % 12)
    .sort((a, b) => a - b);
}

/** Notes de l'accord, en montant depuis `low`, sur `count` notes */
export function ladder(name: string, low: number, count: number): number[] {
  const set = new Set(pcs(name));
  const out: number[] = [];
  for (let n = low; out.length < count && n < low + 60; n++) if (set.has(((n % 12) + 12) % 12)) out.push(n);
  return out;
}

/** Grille d'accords : [nom, durée en temps] → accord en cours à chaque instant */
export type Grid = [string, number][];

export function gridAt(grid: Grid, t: number): string {
  let acc = 0;
  for (const [c, d] of grid) {
    if (t < acc + d - 1e-6) return c;
    acc += d;
  }
  return grid[grid.length - 1][0];
}

/** Une grille « un accord par mesure » ; "C~G7" partage la mesure en parts égales */
export const bars = (chords: string[], beatsPerBar: number): Grid =>
  chords.flatMap((c) => {
    const parts = c.split("~");
    return parts.map((p) => [p, beatsPerBar / parts.length] as [string, number]);
  });

/** Parcourt la grille : (accord, début, durée) */
export function eachChord(grid: Grid, fn: (chord: string, start: number, dur: number) => void) {
  let t = 0;
  for (const [c, d] of grid) {
    fn(c, t, d);
    t += d;
  }
}

/**
 * Mélodie écrite en texte.
 * Jetons séparés par des espaces ; "|" est ignoré (lisibilité).
 *  - "A5"        une note           - "C5+E5"  plusieurs notes
 *  - "-"         prolonge la précédente
 *  - "."         silence
 *  - suffixe "!" accent, suffixe "?" note douce
 */
export function mel(text: string, step: number, i: string, vel = 0.7, start = 0): Ev[] {
  const toks = text.split(/\s+/).filter((t) => t && t !== "|");
  const out: Ev[] = [];
  let cur: Ev | null = null;
  toks.forEach((tok, k) => {
    const t = start + k * step;
    if (tok === "-") {
      if (cur) cur.d += step;
      return;
    }
    cur = null;
    if (tok === ".") return;
    let v = vel;
    let body = tok;
    if (body.endsWith("!")) { v = Math.min(1, vel * 1.25); body = body.slice(0, -1); }
    else if (body.endsWith("?")) { v = vel * 0.65; body = body.slice(0, -1); }
    cur = { t, d: step, n: body.split("+").map(midi), v, i };
    out.push(cur);
  });
  return out;
}

/** Décale des évènements dans le temps */
export const shift = (evs: Ev[], dt: number): Ev[] => evs.map((e) => ({ ...e, t: e.t + dt }));

/** Répète un motif `times` fois tous les `every` temps */
export function repeat(evs: Ev[], every: number, times: number): Ev[] {
  const out: Ev[] = [];
  for (let k = 0; k < times; k++) out.push(...shift(evs, k * every));
  return out;
}

/** Petit générateur pseudo-aléatoire déterministe (mêmes boucles à chaque écoute) */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Transpose des évènements de `semis` demi-tons */
export const tr = (evs: Ev[], semis: number): Ev[] => evs.map((e) => ({ ...e, n: e.n.map((x) => x + semis) }));

/** Change d'instrument (et éventuellement de vélocité) */
export const as = (evs: Ev[], i: string, vel?: number): Ev[] => evs.map((e) => ({ ...e, i, v: vel ?? e.v }));
