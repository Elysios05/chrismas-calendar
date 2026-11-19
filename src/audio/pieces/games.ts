/**
 * Musiques des jeux, sur des airs de Noël du domaine public :
 * calme = « Mon beau sapin » en berceuse, action = « Vive le vent » rapide,
 * victoire = dernière phrase de « We Wish You a Merry Christmas ».
 */
import * as I from "../instruments";
import { as, bars, eachChord, ladder, mel, rng, rootOf, tr, voice, type Grid } from "../theory";
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

/* Duel (jeux en direct à deux, compétitifs) : « Deck the Halls » énergique (do majeur, 152) */
const duelGrid = bars([...C.DECK_GRID, ...C.DECK_GRID, ...C.DECK_GRID, ...C.DECK_GRID], 4);

const duel: PieceDef = {
  id: "duel",
  bpm: 152,
  nightBpm: 136,
  beats: 64,
  gainDb: 3.5,
  reverb: { decay: 1.4, wet: 0.5 },
  tone: { day: 12000, night: 4000 },
  instruments: {
    pluck: { make: I.musicBox, vol: 0, rev: 0.25, pan: 0.15 },
    cuivres: { make: I.brass, vol: -14, rev: 0.3, pan: -0.15 },
    glock: { make: I.glock, vol: -5, rev: 0.3, pan: 0.3 },
    basse: { make: I.bass, vol: -14 },
    grosse: { make: I.kick, vol: -10 },
    caisse: { make: I.brush, vol: 10, rev: 0.2 },
    grelots: { make: I.sleigh, vol: -5, pan: -0.3 },
  },
  events() {
    const phrase = (start: number, i: string, v: number) => mel(C.DECK, 0.5, i, v, start);
    const melody = [...phrase(0, "pluck", 0.62), ...phrase(16, "pluck", 0.62), ...tr(phrase(32, "pluck", 0.62), 12), ...tr(phrase(48, "pluck", 0.62), 12)];
    const glk = tr(as([...phrase(32, "x", 0.4), ...phrase(48, "x", 0.4)], "glock"), 12);
    const stabs: Ev[] = [];
    const bassEv: Ev[] = [];
    eachChord(duelGrid, (c, t0, d) => {
      for (let k = 0; k * 0.5 < d; k++) bassEv.push({ t: t0 + k * 0.5, d: 0.35, n: [rootOf(c, 36) + (k % 2 ? 12 : 0)], v: k % 2 ? 0.5 : 0.75, i: "basse" });
      if (t0 >= 16) for (const dt of [1, 3]) if (dt < d) stabs.push({ t: t0 + dt, d: 0.3, n: voice(c, 60), v: 0.5, i: "cuivres" });
    });
    const perc: Ev[] = [];
    for (let t = 0; t < 64; t += 1) {
      perc.push(t % 2 === 0 ? { t, d: 0.2, n: [36], v: 0.7, i: "grosse" } : { t, d: 0.1, n: [60], v: 0.6, i: "caisse" });
      perc.push({ t, d: 0.05, n: [60], v: 0.6, i: "grelots" }, { t: t + 0.5, d: 0.05, n: [60], v: 0.35, i: "grelots" });
    }
    return [...melody, ...glk, ...stabs, ...bassEv, ...perc];
  },
};

/* Cosy (créations à deux : dessin, sapin, bonhomme) : « We Wish You » en valse douce, au coin du feu (sol, 3/4, 92) */
const cosyGrid = bars([...C.WE_WISH_GRID, ...C.WE_WISH_GRID], 3);

const cosy: PieceDef = {
  id: "cosy",
  bpm: 92,
  nightBpm: 80,
  beats: 48,
  gainDb: 7,
  reverb: { decay: 2.6, wet: 0.7 },
  tone: { day: 7000, night: 3000 },
  instruments: {
    celesta: { make: I.celesta, vol: 2, rev: 0.5, pan: 0.15 },
    choeur: { make: I.choir, vol: -10, rev: 0.6, pan: -0.1 },
    bois: { make: I.marimba, vol: 0, rev: 0.35, pan: -0.2 },
    nappe: { make: I.pad, vol: -18, rev: 0.5 },
    basse: { make: I.subPad, vol: -22 },
    feu: { make: I.crackle, vol: -6, pan: 0.4 },
  },
  events() {
    const first = tr(mel(C.WE_WISH, 0.5, "celesta", 0.5), 12);
    const second = mel(C.WE_WISH, 0.5, "choeur", 0.4, 24);
    const sparkle = tr(as(mel(C.WE_WISH, 0.5, "x", 0.32, 24).filter((e) => e.d >= 1), "celesta"), 24);
    const waltz: Ev[] = [];
    eachChord(cosyGrid, (c, t0, d) => {
      waltz.push({ t: t0, d: 0.9, n: [rootOf(c, 43)], v: 0.5, i: "bois" });
      for (const dt of [1, 2]) if (dt < d) waltz.push({ t: t0 + dt, d: 0.7, n: voice(c, 59), v: 0.3, i: "bois" });
    });
    const bassEv: Ev[] = [];
    eachChord(cosyGrid, (c, t, d) => bassEv.push({ t, d: d - 0.1, n: [rootOf(c, 31)], v: 0.6, i: "basse" }));
    // crépitements irréguliers, déterministes (mêmes à chaque boucle)
    const r = rng(5);
    const fire: Ev[] = [];
    for (let t = 0; t < 48; t += 0.15 + r() * 0.9) fire.push({ t, d: 0.02, n: [60], v: 0.25 + r() * 0.6, i: "feu" });
    return [...first, ...second, ...sparkle, ...waltz, ...chordsHeld(cosyGrid, "nappe", 57, 0.35), ...bassEv, ...fire];
  },
};

export const GAMES = { calm, action, victory, duel, cosy } satisfies Record<string, PieceDef>;
