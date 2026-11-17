/**
 * Musiques des jeux, sur des airs de Noël du domaine public :
 * calme = « Mon beau sapin » en berceuse, action = « Vive le vent » rapide,
 * victoire = dernière phrase de « We Wish You a Merry Christmas ».
 */
import * as I from "../instruments";
import { as, bars, eachChord, ladder, mel, rootOf, tr, voice, type Grid } from "../theory";
import type { Ev, PieceDef } from "../types";
import * as C from "./carols";

function chordsHeld(grid: Grid, i: string, low: number, vel: number): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t, d) => out.push({ t, d: d - 0.1, n: voice(c, low), v: vel, i }));
  return out;
}

/* Calme : « Mon beau sapin » en berceuse (fa majeur, 3/4, 80) */
const calmGrid = bars(C.TANNENBAUM_GRID, 3);

const calm: PieceDef = {
  id: "calm",
  bpm: 80,
  nightBpm: 70,
  beats: 36,
  gainDb: 6.5,
  reverb: { decay: 2.5, wet: 0.7 },
  tone: { day: 8000, night: 3000 },
  instruments: {
    melodie: { make: I.celesta, vol: 1, rev: 0.5, pan: 0.2 },
    bois: { make: I.marimba, vol: 1, rev: 0.35, pan: -0.15 },
    nappe: { make: I.pad, vol: -17, rev: 0.5 },
    basse: { make: I.subPad, vol: -22 },
  },
  events() {
    const arp: Ev[] = [];
    eachChord(calmGrid, (c, t0) => {
      const lad = ladder(c, 53, 6);
      [0, 2, 4, 2, 3, 2].forEach((ix, k) => arp.push({ t: t0 + k * 0.5, d: 0.6, n: [lad[ix]], v: k === 0 ? 0.55 : 0.38, i: "bois" }));
    });
    const bassEv: Ev[] = [];
    eachChord(calmGrid, (c, t) => bassEv.push({ t, d: 2.8, n: [rootOf(c, 36)], v: 0.6, i: "basse" }));
    return [...tr(C.tannenbaum("melodie", 0.5), 12), ...arp, ...chordsHeld(calmGrid, "nappe", 57, 0.4), ...bassEv];
  },
};

/* Action : refrain de « Vive le vent » à toute allure (do majeur, 168) */
const actionGrid = bars(C.JINGLE_CHORUS_GRID, 4);

const action: PieceDef = {
  id: "action",
  bpm: 168,
  nightBpm: 148,
  beats: 64,
  gainDb: 4.6,
  reverb: { decay: 1.4, wet: 0.5 },
  tone: { day: 12000, night: 4000 },
  instruments: {
    pluck: { make: I.musicBox, vol: 0, rev: 0.25, pan: 0.15 },
    glock: { make: I.glock, vol: -3, rev: 0.3, pan: -0.25 },
    basse: { make: I.bass, vol: -14 },
    grosse: { make: I.kick, vol: -10, night: 0.6 },
    caisse: { make: I.brush, vol: 10, rev: 0.2, pan: -0.1 },
    grelots: { make: I.sleigh, vol: -6, pan: -0.3 },
    nappe: { make: I.strings, vol: -16, rev: 0.4 },
  },
  events() {
    const melody = mel(C.JINGLE_CHORUS, 0.5, "pluck", 0.62);
    const bassEv: Ev[] = [];
    eachChord(actionGrid, (c, t0) => {
      for (let k = 0; k < 8; k++) bassEv.push({ t: t0 + k * 0.5, d: 0.35, n: [rootOf(c, 36, k === 6 ? 7 : 0) + (k % 2 ? 12 : 0)], v: k % 2 ? 0.5 : 0.75, i: "basse" });
    });
    const perc: Ev[] = [];
    for (let t = 0; t < 64; t += 1) {
      perc.push(t % 2 === 0 ? { t, d: 0.2, n: [36], v: 0.7, i: "grosse" } : { t, d: 0.1, n: [60], v: 0.6, i: "caisse" });
      perc.push({ t, d: 0.05, n: [60], v: 0.7, i: "grelots" }, { t: t + 0.5, d: 0.05, n: [60], v: 0.4, i: "grelots" });
    }
    return [...melody, ...tr(as(melody.filter((e) => e.t >= 32), "glock", 0.4), 12), ...bassEv, ...perc, ...chordsHeld(actionGrid, "nappe", 57, 0.35)];
  },
};

/* Victoire : « …a merry Christmas and a happy New Year! » (sol majeur, 3/4, 120) */
const victoryGrid = bars([...C.WE_WISH_LAST_GRID, "G", "C", "D7", "G"], 3);

const victory: PieceDef = {
  id: "victory",
  bpm: 120,
  nightBpm: 104,
  beats: 24,
  gainDb: 5.3,
  reverb: { decay: 2.2, wet: 0.7 },
  tone: { day: 12000, night: 4000 },
  instruments: {
    cuivres: { make: I.brass, vol: -14, rev: 0.35 },
    glock: { make: I.glock, vol: -2, rev: 0.4, pan: 0.3 },
    choeur: { make: I.choir, vol: -16, rev: 0.6 },
    cordes: { make: I.strings, vol: -14, rev: 0.5, pan: -0.2 },
    basse: { make: I.bass, vol: -12 },
    timbale: { make: I.timpani, vol: -13, rev: 0.3 },
    grelots: { make: I.sleigh, vol: -7, pan: -0.35, night: 0 },
  },
  events() {
    const phrase = mel(C.WE_WISH_LAST, 0.5, "cuivres", 0.68);
    // réponse au glockenspiel : la même phrase, une octave au-dessus, en écho
    const echo = as(mel(C.WE_WISH_LAST, 0.5, "x", 0.45, 12), "glock");
    const bassEv: Ev[] = [];
    const timp: Ev[] = [];
    eachChord(victoryGrid, (c, t0) => {
      bassEv.push({ t: t0, d: 0.9, n: [rootOf(c, 36)], v: 0.75, i: "basse" }, { t: t0 + 1, d: 0.4, n: [rootOf(c, 36, 7)], v: 0.55, i: "basse" }, { t: t0 + 2, d: 0.4, n: [rootOf(c, 36, 7)], v: 0.55, i: "basse" });
      timp.push({ t: t0, d: 0.4, n: [rootOf(c, 38)], v: 0.6, i: "timbale" });
    });
    const sleighEv: Ev[] = [];
    for (let t = 0; t < 24; t += 0.5) sleighEv.push({ t, d: 0.05, n: [60], v: t % 1 ? 0.3 : 0.55, i: "grelots" });
    return [
      ...tr(phrase, 12),
      ...tr(echo, 24),
      ...chordsHeld(victoryGrid, "cordes", 57, 0.45),
      ...chordsHeld(victoryGrid, "choeur", 55, 0.35).filter((e) => e.t >= 12),
      ...bassEv,
      ...timp,
      ...sleighEv,
    ];
  },
};

export const GAMES = { calm, action, victory } satisfies Record<string, PieceDef>;
