/**
 * Les six ambiances des mondes, arrangées autour d'airs de Noël du domaine public
 * (voir carols.ts). Tout est joué par des synthés : aucun enregistrement.
 *
 * Variante nuit (générique, voir runner.ts) : plus lent, filtre plus sombre,
 * percussions coupées ; ici on allège en plus l'accompagnement → version berceuse.
 */
import * as I from "../instruments";
import { as, bars, eachChord, ladder, mel, rootOf, rng, tr, voice, type Grid } from "../theory";
import type { Ev, PieceDef } from "../types";
import * as C from "./carols";

/* ------------------------------------------------------------------ */
/* Outils d'accompagnement                                             */
/* ------------------------------------------------------------------ */

/** Accords tenus (nappe, chœur), un par case de la grille */
function sustained(grid: Grid, i: string, low: number, vel: number, from = 0, to = Infinity): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t, d) => {
    if (t >= from && t < to) out.push({ t, d: d - 0.1, n: voice(c, low), v: vel, i });
  });
  return out;
}

/** Arpège : indices dans l'échelle de l'accord montant depuis `low` */
function arpeggio(grid: Grid, i: string, low: number, step: number, pattern: number[], vel: number, accent = 1.2): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t0, d) => {
    const lad = ladder(c, low, 8);
    const n = Math.round(d / step);
    for (let k = 0; k < n; k++) {
      const idx = pattern[k % pattern.length];
      if (idx < 0) continue;
      out.push({ t: t0 + k * step, d: step * 1.5, n: [lad[idx]], v: k === 0 ? vel * accent : vel, i });
    }
  });
  return out;
}

/** Basse : [temps dans l'accord, intervalle (0 fond., 7 quinte), durée] */
function bassLine(grid: Grid, i: string, floor: number, hits: [number, number, number][], vel: number): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t0, d) => {
    for (const [dt, iv, dur] of hits) if (dt < d - 1e-6) out.push({ t: t0 + dt, d: dur, n: [rootOf(c, floor, iv)], v: vel, i });
  });
  return out;
}

/** Accords piqués aux temps donnés de chaque case */
function stabs(grid: Grid, i: string, low: number, at: number[], dur: number, vel: number): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t0, d) => {
    for (const dt of at) if (dt < d - 1e-6) out.push({ t: t0 + dt, d: dur, n: voice(c, low), v: vel, i });
  });
  return out;
}

/** Grelots de traîneau : croches, accent sur le premier temps de chaque mesure */
function sleighBells(total: number, beatsPerBar: number, vel: number, i = "grelots"): Ev[] {
  const out: Ev[] = [];
  for (let t = 0; t < total - 1e-6; t += 0.5) {
    const onBar = Math.abs(t % beatsPerBar) < 1e-6;
    const onBeat = Math.abs(t % 1) < 1e-6;
    out.push({ t, d: 0.1, n: [60], v: vel * (onBar ? 1.25 : onBeat ? 0.8 : 0.5), i });
  }
  return out;
}

/** Notes longues d'une mélodie (pour doubler au glockenspiel / célesta) */
const longNotes = (evs: Ev[], min: number) => evs.filter((e) => e.d >= min - 1e-6);

/* ------------------------------------------------------------------ */
/* 1. Montagnes — « Mon beau sapin », boîte à musique + grelots        */
/* ------------------------------------------------------------------ */

const montagnesGrid = bars([...C.TANNENBAUM_GRID, ...C.TANNENBAUM_GRID], 3);

const montagnes: PieceDef = {
  id: "montagnes",
  bpm: 96,
  nightBpm: 76,
  beats: 72,
  gainDb: 6.4,
  nightGainDb: 0.7,
  reverb: { decay: 3.2, wet: 0.9 },
  tone: { day: 9000, night: 3000 },
  instruments: {
    melodie: { make: I.musicBox, vol: 0, rev: 0.45, pan: 0.1 },
    arpege: { make: I.musicBox, vol: -5, rev: 0.5, pan: -0.25 },
    nappe: { make: I.pad, vol: -19, rev: 0.6, night: 0.9 },
    celesta: { make: I.celesta, vol: -6, rev: 0.7, pan: 0.3, night: 0.7 },
    choeur: { make: I.choir, vol: -17, rev: 0.7, pan: -0.1 },
    grelots: { make: I.sleigh, vol: -1, rev: 0.25, pan: -0.35, night: 0 },
  },
  events(night) {
    // deux passages de l'air : boîte à musique seule, puis avec célesta et chœur
    const melody = [...C.tannenbaum("melodie", 0.62), ...C.tannenbaum("melodie", 0.62, 36)];
    const sparkle = as(longNotes(C.tannenbaum("x", 0.4, 36), 0.75), "celesta", 0.42);
    const arp = night
      ? arpeggio(montagnesGrid, "arpege", 53, 1, [0, 2, 4], 0.5)
      : arpeggio(montagnesGrid, "arpege", 53, 0.5, [0, 2, 3, 4, 3, 2], 0.45);
    return [
      ...tr(melody, 12),
      ...tr(sparkle, 24),
      ...arp,
      ...sustained(montagnesGrid, "nappe", 57, 0.45),
      ...sustained(montagnesGrid, "choeur", 57, 0.4, 36),
      ...sleighBells(72, 3, 0.5),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* 2. Village de Saint-Nicolas — « Il est né le divin enfant »          */
/*    marimba, accordéon en polka, clochettes, cloche du village        */
/* ------------------------------------------------------------------ */

const nicolasGrid = bars([...C.IL_EST_NE_REFRAIN_GRID, ...C.IL_EST_NE_COUPLET_GRID, ...C.IL_EST_NE_REFRAIN_GRID], 2);

const saintNicolas: PieceDef = {
  id: "saint-nicolas",
  bpm: 108,
  nightBpm: 88,
  beats: 96,
  gainDb: 6.4,
  nightGainDb: -0.4,
  reverb: { decay: 1.8, wet: 0.7 },
  tone: { day: 10000, night: 3200 },
  instruments: {
    bois: { make: I.marimba, vol: 2, rev: 0.25, pan: 0.15 },
    accordeon: { make: I.accordion, vol: -13, rev: 0.25, pan: -0.2, night: 0.7 },
    basse: { make: I.bass, vol: -14, rev: 0.05 },
    clochette: { make: I.glock, vol: -2, rev: 0.4, pan: 0.3, night: 0.6 },
    cloche: { make: I.churchBell, vol: -5, rev: 0.9, pan: -0.4 },
    choeur: { make: I.choir, vol: -15, rev: 0.6, pan: 0.1 },
    grelots: { make: I.sleigh, vol: -6, rev: 0.2, pan: -0.35, night: 0 },
  },
  events(night) {
    const refrain = (start: number) => mel(C.IL_EST_NE_REFRAIN, 0.5, "bois", 0.7, start);
    const melody = [...refrain(0), ...mel(C.IL_EST_NE_COUPLET, 0.5, "bois", 0.66, 32), ...refrain(64)];
    // Clochettes : doublent les notes longues du dernier refrain
    const bells = as(longNotes(refrain(64), 1), "clochette", 0.45);
    // Polka : basse (fondamentale / quinte) sur les temps, accordéon sur les contretemps
    const bassEv = bassLine(nicolasGrid, "basse", 43, [[0, 0, 0.45], [1, 7, 0.45]], 0.75);
    const acc = night ? stabs(nicolasGrid, "accordeon", 59, [1], 0.8, 0.5) : stabs(nicolasGrid, "accordeon", 59, [0.5, 1.5], 0.35, 0.5);
    const village: Ev[] = [
      { t: 0, d: 3, n: [55], v: 0.55, i: "cloche" },
      { t: 64, d: 3, n: [55], v: 0.5, i: "cloche" },
      { t: 66, d: 3, n: [50], v: 0.45, i: "cloche" },
    ];
    return [
      ...tr(melody, 12),
      ...tr(bells, 24),
      ...bassEv,
      ...acc,
      ...village,
      ...sustained(nicolasGrid, "choeur", 59, 0.35, 32, 64),
      ...sleighBells(96, 2, 0.45),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* 3. Forêt et lac gelé — « Douce nuit », célesta et nappes            */
/* ------------------------------------------------------------------ */

const lacGrid = bars([...C.STILLE_NACHT_GRID, ...C.STILLE_NACHT_GRID].map((c) => (c === "C" ? "Cadd9" : c)), 3);
const LAC_KEY = 2; // ré majeur

const lac: PieceDef = {
  id: "lac",
  bpm: 76,
  nightBpm: 64,
  beats: 72,
  gainDb: 5.6,
  nightGainDb: -2.4,
  reverb: { decay: 4.5, wet: 1 },
  delay: { beats: 1.5, feedback: 0.3 },
  tone: { day: 8000, night: 2800 },
  instruments: {
    celesta: { make: I.celesta, vol: 1, rev: 0.6, dly: 0.3, pan: 0.15 },
    choeur: { make: I.choir, vol: -11, rev: 0.7, pan: -0.1 },
    nappe: { make: I.pad, vol: -16, rev: 0.6 },
    cristal: { make: I.glock, vol: 0, rev: 0.7, dly: 0.35, pan: 0.35, night: 0.6 },
    basse: { make: I.subPad, vol: -23 },
  },
  events(night) {
    const r = rng(3);
    // 1er passage : célesta ; 2e passage : le chœur chante, la célesta l'auréole une octave plus haut
    const first = C.stilleNacht("celesta", 0.6);
    const second = [...C.stilleNacht("choeur", 0.55, 36), ...as(longNotes(C.stilleNacht("x", 0.32, 36), 1.5), "celesta", 0.35).map((e) => ({ ...e, n: e.n.map((x) => x + 12) }))];
    const crystal: Ev[] = [];
    eachChord(lacGrid, (c, t0) => {
      if (night && t0 % 6) return;
      const lad = ladder(c.replace("add9", ""), 79, 4);
      crystal.push({ t: t0 + 1.5, d: 1, n: [lad[Math.floor(r() * lad.length)]], v: 0.3 + r() * 0.15, i: "cristal" });
    });
    return [
      ...tr(first, LAC_KEY + 12),
      ...tr(second, LAC_KEY),
      ...tr(crystal, LAC_KEY),
      ...tr(sustained(lacGrid, "nappe", 55, 0.5), LAC_KEY),
      ...tr(bassLine(lacGrid, "basse", 36, [[0, 0, 2.9]], 0.6), LAC_KEY),
    ];
  },
};

/* ------------------------------------------------------------------ */
/* 4. Marché de Noël — « Vive le vent », fanfare et grelots (4/4)      */
/* ------------------------------------------------------------------ */

const marcheGrid = bars([...C.JINGLE_CHORUS_GRID, ...C.JINGLE_VERSE_GRID], 4);

const marche: PieceDef = {
  id: "marche",
  bpm: 138,
  nightBpm: 112,
  beats: 128,
  gainDb: 5.5,
  nightGainDb: -1.1,
  reverb: { decay: 1.6, wet: 0.6 },
  tone: { day: 10000, night: 3000 },
  instruments: {
    flute: { make: I.flute, vol: -12, rev: 0.3, pan: 0.1 },
    cuivres: { make: I.brass, vol: -11, rev: 0.35, pan: -0.05, night: 0.7 },
    glock: { make: I.glock, vol: -5, rev: 0.35, pan: 0.3, night: 0.5 },
    tuba: { make: I.tuba, vol: -13, rev: 0.05 },
    accordeon: { make: I.accordion, vol: -11, rev: 0.2, pan: -0.25 },
    caisse: { make: I.brush, vol: 8, rev: 0.2, pan: 0.1, night: 0 },
    grelots: { make: I.sleigh, vol: -1, rev: 0.2, pan: -0.3, night: 0 },
  },
  events(night) {
    // le refrain d'abord (c'est lui qu'on reconnaît), puis le couplet
    const chorus = mel(C.JINGLE_CHORUS, 0.5, night ? "flute" : "cuivres", 0.64);
    const verse = mel(C.JINGLE_VERSE, 0.5, "flute", 0.62, 64);
    const glk = as(chorus, "glock", 0.4);
    const tubaEv = bassLine(marcheGrid, "tuba", 36, [[0, 0, 0.8], [2, 7, 0.8]], 0.8);
    const acc = stabs(marcheGrid, "accordeon", 60, night ? [1, 3] : [1, 3], night ? 0.9 : 0.4, 0.5);
    const snare: Ev[] = [];
    for (let t = 1; t < 128; t += 2) snare.push({ t, d: 0.1, n: [60], v: 0.55, i: "caisse" });
    return [...verse, ...chorus, ...tr(glk, 12), ...tubaEv, ...acc, ...snare, ...sleighBells(128, 4, 0.55)];
  },
};

/* ------------------------------------------------------------------ */
/* 5. Grotte de glace — « God Rest Ye Merry Gentlemen », verre et écho  */
/* ------------------------------------------------------------------ */

const grotteGrid = bars(C.GOD_REST_GRID, 4);

const grotte: PieceDef = {
  id: "grotte",
  bpm: 76,
  nightBpm: 64,
  beats: 76,
  gainDb: 5.8,
  nightGainDb: -1.4,
  reverb: { decay: 6, wet: 1.1 },
  delay: { beats: 1.5, feedback: 0.38 },
  tone: { day: 7000, night: 2600 },
  instruments: {
    chant: { make: I.glass, vol: -4, rev: 0.8, dly: 0.25, pan: -0.1 },
    bourdon: { make: I.subPad, vol: -22 },
    nappe: { make: I.darkPad, vol: -15, rev: 0.7 },
    choeur: { make: I.choir, vol: -17, rev: 0.9, pan: 0.15 },
    verre: { make: I.celesta, vol: -1, rev: 0.9, dly: 0.45, pan: 0.3 },
    goutte: { make: I.drip, vol: -7, rev: 1, dly: 0.3, pan: -0.4, night: 0.6 },
  },
  events(night) {
    const r = rng(11);
    const melody = mel(C.GOD_REST, 0.5, "chant", 0.55);
    const glassEv: Ev[] = [];
    eachChord(grotteGrid, (c, t0) => {
      if (night && (t0 / 4) % 2) return;
      const lad = ladder(c, 76, 5);
      glassEv.push({ t: t0 + 2.5, d: 2, n: [lad[Math.floor(r() * lad.length)]], v: 0.3 + r() * 0.15, i: "verre" });
    });
    const drops: Ev[] = [3.5, 13, 22.75, 37.5, 51.25, 66.5].map((t, k) => ({ t, d: 0.1, n: [86 + (k % 3) * 3], v: 0.5, i: "goutte" }));
    return [
      ...tr(melody, 12),
      ...bassLine(grotteGrid, "bourdon", 28, [[0, 0, 3.9]], 0.65),
      ...sustained(grotteGrid, "nappe", 52, 0.45),
      // le chœur entre sur « O tidings of comfort and joy »
      ...sustained(grotteGrid, "choeur", 52, 0.4, 44),
      ...glassEv,
      ...drops,
    ];
  },
};

/* ------------------------------------------------------------------ */
/* 6. Pôle Nord — grand final « We Wish You a Merry Christmas »        */
/*    avec des rappels des airs des autres mondes                      */
/* ------------------------------------------------------------------ */

/* 3/4 : 8 mesures We Wish · 4 Mon beau sapin · 4 Douce nuit · 4 Vive le vent · 8 We Wish (final) */
const poleGrid = bars(
  [
    ...C.WE_WISH_GRID,
    "G", "G", "D7", "G",
    "G", "G", "D7", "G",
    "G", "G", "C", "G",
    ...C.WE_WISH_GRID,
  ],
  3,
);
/* « Vive le vent » ramené à 3 temps, en sol */
const JINGLE_WALTZ = `B4 - B4 - B4 - | B4 - B4 - B4 - | B4 - D5 - G4 A4 | B4 - - - - -`;

const poleNord: PieceDef = {
  id: "pole-nord",
  bpm: 126,
  nightBpm: 100,
  beats: 84,
  gainDb: 5.4,
  nightGainDb: 0.8,
  reverb: { decay: 2.4, wet: 0.75 },
  tone: { day: 11000, night: 3400 },
  instruments: {
    cuivres: { make: I.brass, vol: -11, rev: 0.35, pan: 0.05, night: 0.7 },
    boite: { make: I.musicBox, vol: -1, rev: 0.5, pan: 0.2 },
    celesta: { make: I.celesta, vol: -3, rev: 0.6, pan: -0.2 },
    glock: { make: I.glock, vol: -2, rev: 0.4, pan: 0.35 },
    choeur: { make: I.choir, vol: -13, rev: 0.6 },
    cordes: { make: I.strings, vol: -14, rev: 0.5, pan: -0.15 },
    basse: { make: I.bass, vol: -14, rev: 0.05 },
    timbale: { make: I.timpani, vol: -13, rev: 0.3, night: 0 },
    cloche: { make: I.churchBell, vol: -5, rev: 0.9, pan: -0.4 },
    grelots: { make: I.sleigh, vol: -5, rev: 0.2, pan: -0.35, night: 0 },
  },
  events(night) {
    const weWish = (start: number, vel: number) => mel(C.WE_WISH, 0.5, "cuivres", vel, start);
    const lead = [...weWish(0, 0.6), ...weWish(60, 0.66)];
    const leadOct = night ? tr(lead, -12) : lead;
    const finaleGlock = as(longNotes(weWish(60, 0.45), 1), "glock", 0.45);
    // rappels : sapin (fa → sol), douce nuit (do → sol), vive le vent
    const sapin = tr(mel(C.TANNENBAUM.split("|").slice(0, 4).join("|"), 0.25, "boite", 0.6, 24), 2 + 12);
    const nuit = tr(mel(C.STILLE_NACHT.split("|").slice(0, 4).join("|"), 0.25, "celesta", 0.6, 36), 7 + 12);
    const nuitChoeur = tr(mel(C.STILLE_NACHT.split("|").slice(0, 4).join("|"), 0.25, "choeur", 0.4, 36), 7);
    const vent = tr(mel(JINGLE_WALTZ, 0.5, "glock", 0.55, 48), 12);
    const bassEv = bassLine(poleGrid, "basse", 38, [[0, 0, 0.9], [1, 7, 0.4], [2, 7, 0.4]], 0.7);
    const strEv = sustained(poleGrid, "cordes", 57, 0.45);
    const timp: Ev[] = [];
    eachChord(poleGrid, (c, t0) => {
      if (t0 < 24 || t0 >= 60) timp.push({ t: t0, d: 0.5, n: [rootOf(c, 38)], v: 0.6, i: "timbale" });
    });
    for (const [t, v] of [[82, 0.5], [82.5, 0.6], [83, 0.7], [83.5, 0.8]]) timp.push({ t, d: 0.3, n: [38], v, i: "timbale" });
    const bells: Ev[] = [{ t: 0, d: 3, n: [55], v: 0.5, i: "cloche" }, { t: 60, d: 3, n: [55], v: 0.5, i: "cloche" }, { t: 61.5, d: 3, n: [50], v: 0.45, i: "cloche" }];
    return [
      ...tr(leadOct, 12),
      ...tr(finaleGlock, 24),
      ...sapin,
      ...nuit,
      ...nuitChoeur,
      ...vent,
      ...sustained(poleGrid, "choeur", 55, 0.35, 60),
      ...strEv,
      ...bassEv,
      ...timp,
      ...bells,
      ...sleighBells(84, 3, 0.5).filter((e) => e.t < 24 || e.t >= 48),
    ];
  },
};

export const WORLDS = {
  montagnes,
  "saint-nicolas": saintNicolas,
  lac,
  marche,
  grotte,
  "pole-nord": poleNord,
} satisfies Record<string, PieceDef>;
