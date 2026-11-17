/**
 * Les six ambiances des mondes. Tout est écrit ici, note par note :
 * musique originale, donc libre de droits.
 *
 * Chaque morceau est une boucle de 35 à 60 s ; la variante nuit
 * ralentit, adoucit le filtre, coupe les percussions et allège l'accompagnement.
 */
import * as I from "../instruments";
import { bars, eachChord, gridAt, ladder, mel, rootOf, voice, rng, type Grid } from "../theory";
import type { Ev, PieceDef } from "../types";

/* ------------------------------------------------------------------ */
/* Outils d'accompagnement                                             */
/* ------------------------------------------------------------------ */

/** Accords tenus (nappe), un par case de la grille */
function sustained(grid: Grid, i: string, low: number, vel: number): Ev[] {
  const out: Ev[] = [];
  eachChord(grid, (c, t, d) => out.push({ t, d: d - 0.1, n: voice(c, low), v: vel, i }));
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

/** Basse : fondamentale (et quinte) à des temps donnés dans chaque accord */
function bassLine(grid: Grid, i: string, floor: number, hits: [number, number, number][], vel: number): Ev[] {
  // hits : [temps dans l'accord, intervalle (0 fond., 7 quinte), durée]
  const out: Ev[] = [];
  eachChord(grid, (c, t0, d) => {
    for (const [dt, iv, dur] of hits) if (dt < d - 1e-6) out.push({ t: t0 + dt, d: dur, n: [rootOf(c, floor, iv)], v: vel, i });
  });
  return out;
}

/** Frappes régulières (percussions) */
function pulse(total: number, step: number, i: string, vel: number, accents: (k: number) => number = () => 1, note = 60): Ev[] {
  const out: Ev[] = [];
  for (let k = 0; k * step < total - 1e-6; k++) {
    const a = accents(k);
    if (a > 0) out.push({ t: k * step, d: 0.1, n: [note], v: vel * a, i });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1. Montagnes — boîte à musique aérienne (fa majeur, 84 bpm)         */
/* ------------------------------------------------------------------ */

const montagnesGrid = bars(
  ["F", "C", "Dm", "Bb", "F", "Bb", "Gm", "C", "Dm", "Bb", "F", "C", "Bb", "C", "F", "C"],
  4,
);

const montagnes: PieceDef = {
  id: "montagnes",
  bpm: 84,
  nightBpm: 70,
  beats: 64,
  gainDb: 6.6,
  reverb: { decay: 3.2, wet: 0.9 },
  tone: { day: 9000, night: 3000 },
  instruments: {
    melodie: { make: I.musicBox, vol: 2, rev: 0.45, pan: 0.1 },
    arpege: { make: I.musicBox, vol: -4, rev: 0.5, pan: -0.25 },
    nappe: { make: I.pad, vol: -19, rev: 0.6, night: 0.9 },
    etoile: { make: I.celesta, vol: -4, rev: 0.8, pan: 0.35, night: 0 },
  },
  events(night) {
    const melody = mel(`
      A5 - C6 - A5 - G5 F5 | G5 - - - E5 - C5 - | D5 - F5 - A5 - D6 - | C6 - Bb5 - A5 - - - |
      A5 - C6 - F6 - E6 D6 | D6 - - C6 Bb5 - D6 - | C6 - Bb5 - A5 - G5 - | G5 - - - . . . . |
      F5 - A5 - D6 - C6 - | D6 - - - Bb5 - F5 - | A5 - C6 - A5 - F5 - | G5 - - - E5 - G5 - |
      F5 - D5 - F5 - Bb5 - | A5 - G5 - E5 - G5 - | F5 - - - . . . . | . . . . C6 - Bb5 G5`, 0.5, "melodie", 0.62);
    const arp = night
      ? arpeggio(montagnesGrid, "arpege", 53, 1, [0, 2, 4, 2], 0.5)
      : arpeggio(montagnesGrid, "arpege", 53, 0.5, [0, 2, 3, 4, 5, 4, 3, 2], 0.45);
    const sparkle: Ev[] = [0, 16, 32, 48].map((t) => ({ t, d: 2, n: ladder(gridAt(montagnesGrid, t), 84, 2), v: 0.4, i: "etoile" }));
    return [...melody, ...arp, ...sustained(montagnesGrid, "nappe", 57, 0.45), ...sparkle];
  },
};

/* ------------------------------------------------------------------ */
/* 2. Village de Saint-Nicolas — bois, accordéon, clochettes (sol, 104) */
/* ------------------------------------------------------------------ */

const nicolasGrid = bars(
  ["G", "C", "D", "G", "Em", "C", "D7", "G", "C", "G", "Am", "D", "G", "C", "D7", "G"],
  4,
);

const saintNicolas: PieceDef = {
  id: "saint-nicolas",
  bpm: 104,
  nightBpm: 88,
  beats: 64,
  gainDb: 5.4,
  reverb: { decay: 1.8, wet: 0.7 },
  tone: { day: 10000, night: 3200 },
  instruments: {
    bois: { make: I.marimba, vol: 4, rev: 0.25, pan: 0.15 },
    accordeon: { make: I.accordion, vol: -13, rev: 0.25, pan: -0.2, night: 0.7 },
    basse: { make: I.bass, vol: -14, rev: 0.05 },
    clochette: { make: I.glock, vol: -2, rev: 0.4, pan: 0.3, night: 0.6 },
    grelots: { make: I.sleigh, vol: -4, rev: 0.2, pan: -0.35, night: 0 },
  },
  events(night) {
    const melodyText = `
      B4 - D5 - G5 - D5 - | E5 - G5 - E5 - C5 - | D5 - F#5 - A5 - F#5 - | G5 - - - . . D5 - |
      E5 - G5 - B5 - G5 - | A5 - G5 - E5 - C5 - | D5 - E5 F#5 A5 - C6 - | B5 - - - . . . . |
      C6 - B5 - A5 - G5 - | B5 - A5 - G5 - D5 - | E5 - A5 - C6 - A5 - | F#5 - - - A5 - - - |
      G5 - B5 - D6 - B5 - | C6 - - B5 A5 - G5 - | F#5 - A5 - C6 - F#5 - | G5 - - - . . D5 -`;
    const melody = mel(melodyText, 0.5, "bois", 0.7);
    // Clochettes : la première note de chaque mesure, une octave plus haut
    const bells: Ev[] = melody
      .filter((e) => Math.abs(e.t % 4) < 1e-6)
      .filter((_, k) => !night || k % 2 === 0)
      .map((e) => ({ ...e, n: e.n.map((x) => x + 12), v: 0.45, i: "clochette" }));
    // « Oum-pa » : basse sur 1 et 3, accordéon sur 2 et 4
    const bassEv = bassLine(nicolasGrid, "basse", 43, [[0, 0, 0.9], [2, 7, 0.9]], 0.75);
    const acc: Ev[] = [];
    eachChord(nicolasGrid, (c, t0) => {
      for (const dt of night ? [1, 3] : [1, 3]) acc.push({ t: t0 + dt, d: night ? 0.9 : 0.45, n: voice(c, 59), v: 0.5, i: "accordeon" });
    });
    const sleighEv = pulse(64, 0.5, "grelots", 0.5, (k) => (k % 4 === 2 ? 1.3 : k % 2 ? 0.55 : 0.8));
    return [...melody, ...bells, ...bassEv, ...acc, ...sleighEv];
  },
};

/* ------------------------------------------------------------------ */
/* 3. Forêt et lac gelé — nappes douces, cristallin (ré lydien, 72)    */
/* ------------------------------------------------------------------ */

const lacGrid: Grid = [
  ["Dmaj7", 8], ["Bm7", 8], ["Gmaj7", 8], ["Asus4", 8],
  ["Dmaj7", 8], ["F#m7", 8], ["Em7", 8], ["Asus4", 8],
];

const lac: PieceDef = {
  id: "lac",
  bpm: 72,
  nightBpm: 60,
  beats: 64,
  gainDb: 6.3,
  reverb: { decay: 4.5, wet: 1 },
  delay: { beats: 0.75, feedback: 0.38 },
  tone: { day: 8000, night: 2800 },
  instruments: {
    nappe: { make: I.pad, vol: -15, rev: 0.6 },
    cristal: { make: I.celesta, vol: 0, rev: 0.6, dly: 0.35, pan: 0.2 },
    chant: { make: I.glass, vol: -1, rev: 0.7, dly: 0.2, pan: -0.15 },
    basse: { make: I.subPad, vol: -23 },
  },
  events(night) {
    const r = rng(3);
    const crystal: Ev[] = [];
    const slots = night ? [0, 3, 6] : [0, 1.5, 3, 4.5, 6];
    eachChord(lacGrid, (c, t0) => {
      const lad = ladder(c, 74, 6);
      for (const s of slots) crystal.push({ t: t0 + s, d: 1.5, n: [lad[Math.floor(r() * lad.length)]], v: 0.4 + r() * 0.2, i: "cristal" });
    });
    const song = mel(`
      A5 - - - F#5 - E5 - | C#6 - - - A5 - - - | B5 - - - G5 - F#5 - | E5 - - - - - . .`, 1, "chant", 0.55, 32);
    const bassEv = bassLine(lacGrid, "basse", 38, [[0, 0, 7.6]], 0.6);
    return [...sustained(lacGrid, "nappe", 57, 0.5), ...crystal, ...song, ...bassEv];
  },
};

/* ------------------------------------------------------------------ */
/* 4. Marché de Noël — valse joyeuse à 3 temps (do majeur, 150)        */
/* ------------------------------------------------------------------ */

const marcheGrid = bars(
  [
    "C", "C", "G7", "G7", "G7", "G7", "C", "C",
    "C", "C", "F", "F", "G7", "G7", "C", "C",
    "F", "F", "C", "C", "D7", "D7", "G", "G7",
    "C", "C", "F", "F", "C", "G7", "C", "C",
  ],
  3,
);

const marche: PieceDef = {
  id: "marche",
  bpm: 150,
  nightBpm: 126,
  beats: 96,
  gainDb: 6.1,
  reverb: { decay: 1.6, wet: 0.6 },
  tone: { day: 10000, night: 3000 },
  instruments: {
    flute: { make: I.flute, vol: -12, rev: 0.3, pan: 0.1 },
    glock: { make: I.glock, vol: -5, rev: 0.35, pan: 0.3, night: 0.5 },
    tuba: { make: I.tuba, vol: -13, rev: 0.05 },
    accordeon: { make: I.accordion, vol: -11, rev: 0.2, pan: -0.25 },
    grelots: { make: I.sleigh, vol: -3, rev: 0.2, pan: -0.3, night: 0 },
  },
  events(night) {
    const melody = mel(`
      G4 C5 E5 | G5 - E5 | F5 - D5 | B4 - G4 | B4 D5 F5 | A5 - G5 | E5 - C5 | C5 - - |
      G5 - E5 | C6 - G5 | A5 - F5 | C6 - A5 | G5 - F5 | D5 E5 F5 | E5 - D5 | C5 - - |
      A5 - C6 | A5 - F5 | G5 - E5 | C5 - E5 | F#5 - A5 | C6 - A5 | B5 - G5 | F5 - D5 |
      E5 - G5 | C6 - E6 | D6 - C6 | A5 - F5 | E5 - G5 | D5 - B4 | C5 - - | . E4 F4`, 1, "flute", 0.6);
    // Le glockenspiel double les temps forts des phrases 2 et 4
    const glk = melody
      .filter((e) => ((e.t >= 24 && e.t < 48) || e.t >= 72) && Math.abs(e.t % 3) < 1e-6)
      .map((e) => ({ ...e, d: 1, n: e.n.map((x) => x + 12), v: 0.5, i: "glock" }));
    const tubaEv = bassLine(marcheGrid, "tuba", 36, [[0, 0, 0.8]], 0.8).map((e, k) =>
      k % 2 ? { ...e, n: [e.n[0] + 7 > 47 ? e.n[0] - 5 : e.n[0] + 7] } : e,
    );
    const acc: Ev[] = [];
    eachChord(marcheGrid, (c, t0) => {
      for (const dt of [1, 2]) acc.push({ t: t0 + dt, d: night ? 0.8 : 0.4, n: voice(c, 60), v: 0.5, i: "accordeon" });
    });
    const sleighEv = pulse(96, 1, "grelots", 0.55, (k) => (k % 3 === 0 ? 1 : 0.45));
    return [...melody, ...glk, ...tubaEv, ...acc, ...sleighEv];
  },
};

/* ------------------------------------------------------------------ */
/* 5. Grotte de glace — verre, réverbéré, mystérieux (la mineur, 66)   */
/* ------------------------------------------------------------------ */

const grotteGrid: Grid = [
  ["Am", 8], ["F", 8], ["Dm", 8], ["Esus4", 4], ["E", 4],
  ["Am", 8], ["C", 8], ["F", 8], ["E", 8],
];

const grotte: PieceDef = {
  id: "grotte",
  bpm: 66,
  nightBpm: 56,
  beats: 64,
  gainDb: 7.0,
  reverb: { decay: 7, wet: 1.1 },
  delay: { beats: 1.5, feedback: 0.42 },
  tone: { day: 7000, night: 2600 },
  instruments: {
    bourdon: { make: I.subPad, vol: -22 },
    nappe: { make: I.darkPad, vol: -15, rev: 0.7 },
    verre: { make: I.celesta, vol: 0, rev: 0.9, dly: 0.45, pan: 0.3 },
    chant: { make: I.glass, vol: -1, rev: 0.9, dly: 0.25, pan: -0.2 },
    goutte: { make: I.drip, vol: -7, rev: 1, dly: 0.3, pan: -0.4, night: 0.6 },
  },
  events(night) {
    const r = rng(11);
    const glassEv: Ev[] = [];
    const slots = night ? [0, 4] : [0, 2.5, 4, 5.5];
    eachChord(grotteGrid, (c, t0, d) => {
      const lad = ladder(c.replace("sus4", ""), 76, 5);
      for (const s of slots) if (s < d) glassEv.push({ t: t0 + s, d: 2, n: [lad[Math.floor(r() * lad.length)]], v: 0.35 + r() * 0.2, i: "verre" });
    });
    const song = mel(`
      E5 - - - B5 - C6 - | G5 - - - E5 - - - | A5 - - - C6 - B5 - | G#5 - - - - - . .`, 1, "chant", 0.5, 32);
    const drops: Ev[] = [3.5, 13, 22.75, 37.5, 51.25].map((t, k) => ({ t, d: 0.1, n: [86 + (k % 3) * 3], v: 0.5, i: "goutte" }));
    const drone = bassLine(grotteGrid, "bourdon", 33, [[0, 0, 7.8]], 0.65).map((e) => ({ ...e, d: Math.min(e.d, 7.8) }));
    return [...drone, ...sustained(grotteGrid, "nappe", 55, 0.45), ...glassEv, ...song, ...drops];
  },
};

/* ------------------------------------------------------------------ */
/* 6. Pôle Nord — grand thème final festif (ré majeur, 112)            */
/* ------------------------------------------------------------------ */

const poleGrid: Grid = [
  ["D", 4], ["A", 4], ["Bm", 4], ["G", 4], ["D", 4], ["G", 4], ["Em", 2], ["A", 2], ["D", 4],
  ["G", 4], ["A", 4], ["F#m", 4], ["Bm", 4], ["G", 4], ["A", 4], ["D", 4], ["D7", 4],
  ["G", 4], ["Gm", 4], ["D", 4], ["B7", 4], ["Em", 4], ["A7", 4], ["D", 4], ["A", 4],
];

const poleNord: PieceDef = {
  id: "pole-nord",
  bpm: 112,
  nightBpm: 94,
  beats: 96,
  gainDb: 5.3,
  reverb: { decay: 2.4, wet: 0.75 },
  tone: { day: 11000, night: 3400 },
  instruments: {
    cuivres: { make: I.brass, vol: -10, rev: 0.35, pan: 0.05, night: 0.7 },
    cordes: { make: I.strings, vol: -14, rev: 0.5, pan: -0.15 },
    glock: { make: I.glock, vol: -2, rev: 0.4, pan: 0.35 },
    basse: { make: I.bass, vol: -14, rev: 0.05 },
    timbale: { make: I.timpani, vol: -13, rev: 0.3, night: 0 },
    grelots: { make: I.sleigh, vol: -4, rev: 0.2, pan: -0.35, night: 0 },
  },
  events(night) {
    const melody = mel(`
      A4 - D5 - F#5 - A5 - | A5 - G5 F#5 E5 - - - | F#5 - D5 - B4 - D5 - | G5 - - - B5 - - - |
      A5 - F#5 - D5 - F#5 - | B5 - - - D6 - B5 - | G5 - B5 - A5 - G5 - | F#5 - - - D5 - - - |
      B5 - - - D6 - B5 - | C#6 - - - E6 - C#6 - | A5 - - - F#5 - A5 - | D6 - - - B5 - - - |
      G5 - B5 - D6 - B5 - | A5 - C#6 - E6 - - - | D6 - - - A5 - F#5 - | C6 - - - A5 - F#5 - |
      B5 - - - G5 - B5 - | Bb5 - - - G5 - D5 - | A5 - - - F#5 - A5 - | A5 - - - F#5 - D#5 - |
      E5 - G5 - B5 - E6 - | C#6 - - - A5 - G5 - | F#5 - A5 - D6 - - - | E5 - - - . . . .`, 0.5, "cuivres", 0.62);
    const lead = night ? melody.map((e) => ({ ...e, n: e.n.map((x) => x - 12) })) : melody;
    // Glockenspiel : double la mélodie dans la dernière partie
    const glk = melody.filter((e) => e.t >= 64 && e.d >= 1).map((e) => ({ ...e, n: e.n.map((x) => x + 12), v: 0.45, i: "glock" }));
    const strEv = sustained(poleGrid, "cordes", 57, 0.5);
    const bassEv = bassLine(poleGrid, "basse", 38, [[0, 0, 0.9], [1, 0, 0.4], [2, 7, 0.9], [3, 7, 0.4]], 0.7);
    const timp: Ev[] = [];
    eachChord(poleGrid, (c, t0, d) => {
      if (d >= 4) timp.push({ t: t0, d: 0.5, n: [rootOf(c, 38)], v: 0.6, i: "timbale" });
    });
    timp.push({ t: 94, d: 0.3, n: [45], v: 0.5, i: "timbale" }, { t: 94.5, d: 0.3, n: [45], v: 0.6, i: "timbale" }, { t: 95, d: 0.3, n: [45], v: 0.75, i: "timbale" });
    const sleighEv = pulse(96, 0.5, "grelots", 0.5, (k) => (k % 2 ? 0.5 : 0.9));
    return [...lead, ...(night ? [] : glk), ...strEv, ...bassEv, ...timp, ...sleighEv];
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
