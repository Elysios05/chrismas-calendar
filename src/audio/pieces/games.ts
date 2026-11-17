/**
 * Musiques des jeux : calme (réflexion), action (adresse), victoire.
 */
import * as I from "../instruments";
import { bars, eachChord, ladder, mel, repeat, rootOf, voice, type Grid } from "../theory";
import type { Ev, PieceDef } from "../types";

function chordsHeld(grid: Grid, i: string, low: number, vel: number): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t, d) => out.push({ t, d: d - 0.1, n: voice(c, low), v: vel, i }));
  return out;
}

/* Calme : marimba qui berce, pour réfléchir (do majeur, 92) */
const calmGrid = bars(["C", "Am", "F", "G", "C", "Am", "Dm7", "G"], 4);

const calm: PieceDef = {
  id: "calm",
  bpm: 92,
  nightBpm: 80,
  beats: 32,
  gainDb: 5.9,
  reverb: { decay: 2.5, wet: 0.7 },
  tone: { day: 8000, night: 3000 },
  instruments: {
    bois: { make: I.marimba, vol: 5, rev: 0.35, pan: -0.15 },
    melodie: { make: I.celesta, vol: 3, rev: 0.5, pan: 0.2 },
    nappe: { make: I.pad, vol: -17, rev: 0.5 },
    basse: { make: I.subPad, vol: -22 },
  },
  events() {
    const arp: Ev[] = [];
    eachChord(calmGrid, (c, t0) => {
      const lad = ladder(c, 55, 6);
      [0, 2, 1, 3, 2, 4, 3, 2].forEach((ix, k) => arp.push({ t: t0 + k * 0.5, d: 0.6, n: [lad[ix]], v: k === 0 ? 0.6 : 0.42, i: "bois" }));
    });
    const tune = mel(`
      E5 - - - G5 - - - | C6 - - - . . . . | A5 - - - C6 - - - | B5 - - - . . . . |
      E5 - - - G5 - - - | E6 - - - D6 - C6 - | F5 - - - A5 - - - | G5 - - - . . . .`, 0.5, "melodie", 0.45);
    const bassEv: Ev[] = [];
    eachChord(calmGrid, (c, t) => bassEv.push({ t, d: 3.8, n: [rootOf(c, 36)], v: 0.6, i: "basse" }));
    return [...arp, ...tune, ...chordsHeld(calmGrid, "nappe", 57, 0.4), ...bassEv];
  },
};

/* Action : rebondissant et entraînant (la mineur, 140) */
const actionGrid = bars(["Am", "F", "C", "G", "Am", "F", "C", "G", "Am", "F", "C", "G", "Am", "F", "C", "G"], 4);

const action: PieceDef = {
  id: "action",
  bpm: 140,
  nightBpm: 124,
  beats: 64,
  gainDb: 4.6,
  reverb: { decay: 1.4, wet: 0.5 },
  tone: { day: 12000, night: 4000 },
  instruments: {
    pluck: { make: I.musicBox, vol: 0, rev: 0.25, pan: 0.15 },
    basse: { make: I.bass, vol: -14 },
    grosse: { make: I.kick, vol: -10, night: 0.6 },
    caisse: { make: I.brush, vol: 10, rev: 0.2, pan: -0.1 },
    shaker: { make: I.shaker, vol: -7, pan: -0.3 },
    nappe: { make: I.strings, vol: -16, rev: 0.4 },
  },
  events() {
    const a = mel(`
      A5 . C6 . E6 . C6 D6 | C6 . A5 . F5 . A5 C6 | G5 . E5 . G5 . C6 . | B5 . G5 . D5 . G5 B5`, 0.5, "pluck", 0.6);
    const b = mel(`
      E6 . E6 . D6 . C6 . | A5 . C6 . A5 . F5 . | G5 . C6 . E6 . G6 . | D6 . B5 . G5 . B5 D6`, 0.5, "pluck", 0.6);
    const melody = [...repeat(a, 16, 2), ...repeat(b, 16, 2).map((e) => ({ ...e, t: e.t + 32 }))];
    const bassEv: Ev[] = [];
    eachChord(actionGrid, (c, t0) => {
      for (let k = 0; k < 8; k++) bassEv.push({ t: t0 + k * 0.5, d: 0.35, n: [rootOf(c, 33, k === 6 ? 7 : 0) + (k % 2 ? 12 : 0)], v: k % 2 ? 0.5 : 0.75, i: "basse" });
    });
    const kicks: Ev[] = [];
    const snares: Ev[] = [];
    const hats: Ev[] = [];
    for (let t = 0; t < 64; t += 1) {
      if (t % 2 === 0) kicks.push({ t, d: 0.2, n: [36], v: 0.7, i: "grosse" });
      else snares.push({ t, d: 0.1, n: [60], v: 0.6, i: "caisse" });
      hats.push({ t: t + 0.5, d: 0.05, n: [60], v: 0.6, i: "shaker" });
    }
    return [...melody, ...bassEv, ...kicks, ...snares, ...hats, ...chordsHeld(actionGrid, "nappe", 57, 0.35)];
  },
};

/* Victoire : fanfare joyeuse (do majeur, 120) */
const victoryGrid = bars(["C", "F", "C", "G", "C", "F", "G", "C"], 4);

const victory: PieceDef = {
  id: "victory",
  bpm: 120,
  nightBpm: 104,
  beats: 32,
  gainDb: 5.1,
  reverb: { decay: 2.2, wet: 0.7 },
  tone: { day: 12000, night: 4000 },
  instruments: {
    cuivres: { make: I.brass, vol: -13, rev: 0.35 },
    glock: { make: I.glock, vol: -3, rev: 0.4, pan: 0.3 },
    cordes: { make: I.strings, vol: -14, rev: 0.5, pan: -0.2 },
    basse: { make: I.bass, vol: -12 },
    timbale: { make: I.timpani, vol: -13, rev: 0.3 },
    grelots: { make: I.sleigh, vol: -7, pan: -0.35, night: 0 },
  },
  events() {
    const melody = mel(`
      C5 . E5 . G5 . C6 - | - - A5 - C6 - A5 - | G5 - E5 - G5 - C6 - | D6 - - - B5 - G5 - |
      E6 - - - C6 - G5 - | A5 - C6 - F6 - - - | E6 - D6 - B5 - D6 - | C6 - - - . . . .`, 0.5, "cuivres", 0.65);
    const glk = melody.filter((e) => e.d >= 1).map((e) => ({ ...e, n: e.n.map((x) => x + 12), v: 0.45, i: "glock" }));
    const bassEv: Ev[] = [];
    const timp: Ev[] = [];
    eachChord(victoryGrid, (c, t0) => {
      bassEv.push({ t: t0, d: 0.9, n: [rootOf(c, 36)], v: 0.75, i: "basse" }, { t: t0 + 2, d: 0.9, n: [rootOf(c, 36, 7)], v: 0.65, i: "basse" });
      timp.push({ t: t0, d: 0.4, n: [rootOf(c, 38)], v: 0.6, i: "timbale" });
    });
    const sleighEv: Ev[] = [];
    for (let t = 0; t < 32; t += 0.5) sleighEv.push({ t, d: 0.05, n: [60], v: t % 1 ? 0.3 : 0.55, i: "grelots" });
    return [...melody, ...glk, ...chordsHeld(victoryGrid, "cordes", 57, 0.45), ...bassEv, ...timp, ...sleighEv];
  },
};

export const GAMES = { calm, action, victory } satisfies Record<string, PieceDef>;
