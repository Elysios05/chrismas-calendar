/**
 * Jingles d'arrivée dans un monde (2 à 3 s) : le début de l'air du monde,
 * suivi d'un accord final qui résonne. Joués une seule fois (pas de boucle).
 */
import type { ZoneId } from "../../core/contracts";
import * as I from "../instruments";
import { as, mel, tr, voice } from "../theory";
import type { Ev, InstrSpec, PieceDef } from "../types";

/** Un jingle = un PieceDef joué une fois ; `beats` couvre la résonance finale */
function jingle(id: string, bpm: number, beats: number, gainDb: number, instruments: Record<string, InstrSpec>, events: Ev[], reverb = 2.2): PieceDef {
  return { id: `jingle-${id}`, bpm, nightBpm: bpm, beats, gainDb, reverb: { decay: reverb, wet: 0.8 }, instruments, events: () => events };
}

const chord = (t: number, d: number, name: string, low: number, i: string, v: number): Ev => ({ t, d, n: voice(name, low), v, i });

export const JINGLES: Record<ZoneId, PieceDef> = {
  /* « Mon beau sapin » : levée + deux mesures */
  montagnes: jingle("montagnes", 150, 11, 1.4, {
    boite: { make: I.musicBox, vol: 2, rev: 0.5 },
    glock: { make: I.glock, vol: -4, rev: 0.6, pan: 0.3 },
    choeur: { make: I.choir, vol: -12, rev: 0.6 },
    grelots: { make: I.sleigh, vol: -4, pan: -0.3 },
  }, [
    ...tr(mel(`C4 - - - | F4 - - F4 F4 - - - - - G4 - | A4 - - A4 A4 - - - - - - -`, 0.25, "boite", 0.7), 12),
    { t: 7, d: 3, n: [81, 84], v: 0.45, i: "glock" },
    chord(7, 3, "F", 57, "choeur", 0.45),
    ...[0, 0.5, 1, 1.5, 7, 7.25, 7.5].map((t): Ev => ({ t, d: 0.05, n: [60], v: 0.6, i: "grelots" })),
  ]),

  /* « Il est né le divin enfant » : quatre premières mesures, puis la cloche du village */
  "saint-nicolas": jingle("saint-nicolas", 180, 12, 2.5, {
    bois: { make: I.marimba, vol: 4, rev: 0.3 },
    clochette: { make: I.glock, vol: -3, rev: 0.4, pan: 0.3 },
    accordeon: { make: I.accordion, vol: -12, rev: 0.3, pan: -0.2 },
    cloche: { make: I.churchBell, vol: -6, rev: 0.9, pan: -0.3 },
  }, [
    ...tr(mel(`D4 - G4 - | G4 - B4 G4 | D4 - G4 - | G4 - - -`, 0.5, "bois", 0.75), 12),
    ...as(tr(mel(`. . . . | . . . . | . . . . | G4 - - -`, 0.5, "x", 0.5), 24), "clochette"),
    chord(6, 3, "G", 59, "accordeon", 0.5),
    { t: 6, d: 4, n: [55], v: 0.55, i: "cloche" },
  ]),

  /* « Douce nuit » : « Stille Nacht, heilige Nacht » en ré */
  lac: jingle("lac", 120, 9, -1.5, {
    celesta: { make: I.celesta, vol: 2, rev: 0.7 },
    choeur: { make: I.choir, vol: -6, rev: 0.7 },
  }, tr([
    ...tr(mel(`G4 - - A4 G4 - E4 - - - - - | G4 - - A4 G4 - E4 - - - - -`, 0.25, "celesta", 0.65), 12),
    chord(0, 6, "C", 55, "choeur", 0.4),
    { t: 6, d: 2.5, n: [84, 88, 91], v: 0.35, i: "celesta" },
  ], 2), 4),

  /* « Vive le vent » : « Jingle bells, jingle bells, jingle all the way » en double vitesse */
  marche: jingle("marche", 150, 10, 1.5, {
    cuivres: { make: I.brass, vol: -9, rev: 0.35 },
    glock: { make: I.glock, vol: -4, rev: 0.4, pan: 0.3 },
    grelots: { make: I.sleigh, vol: -2, pan: -0.3 },
    caisse: { make: I.brush, vol: 6 },
  }, [
    ...mel(`E5 E5 E5 - E5 E5 E5 - E5 G5 C5 - D5 E5 - - - -`, 0.5, "cuivres", 0.7),
    ...tr(mel(`. . . . . . . . . . . . . C5+E5+G5 - - - -`, 0.5, "glock", 0.45), 12),
    ...Array.from({ length: 14 }, (_, k): Ev => ({ t: k * 0.5, d: 0.05, n: [60], v: k % 2 ? 0.4 : 0.7, i: "grelots" })),
    { t: 6.5, d: 0.1, n: [60], v: 0.7, i: "caisse" },
  ]),

  /* « God Rest Ye Merry Gentlemen » : première phrase, verre et chœur */
  grotte: jingle("grotte", 170, 13, 2.2, {
    verre: { make: I.glass, vol: -1, rev: 0.9 },
    celesta: { make: I.celesta, vol: 0, rev: 0.9, pan: 0.3 },
    choeur: { make: I.choir, vol: -8, rev: 0.9 },
  }, [
    ...tr(mel(`E4 | E4 B4 B4 A4 | G4 F#4 E4 - - -`, 1, "verre", 0.6), 12),
    chord(7, 4, "Em", 52, "choeur", 0.45),
    { t: 7, d: 3, n: [88, 95], v: 0.3, i: "celesta" },
  ], 5),

  /* « We Wish You a Merry Christmas » : « we wish you a merry Christmas… and a happy New Year » */
  "pole-nord": jingle("pole-nord", 150, 12, 1.8, {
    cuivres: { make: I.brass, vol: -9, rev: 0.35 },
    glock: { make: I.glock, vol: -3, rev: 0.4, pan: 0.3 },
    timbale: { make: I.timpani, vol: -10, rev: 0.3 },
    cloche: { make: I.churchBell, vol: -8, rev: 0.9, pan: -0.3 },
    grelots: { make: I.sleigh, vol: -4, pan: -0.3 },
  }, [
    ...tr(mel(`D4 - G4 - G4 A4 G4 F#4 E4 - A4 - F#4 - G4 - - -`, 0.5, "cuivres", 0.7), 12),
    ...tr(mel(`. . . . . . . . . . . . . . G5+B5+D6 - - -`, 0.5, "glock", 0.45), 12),
    { t: 7, d: 1, n: [43], v: 0.7, i: "timbale" },
    { t: 7, d: 4, n: [55], v: 0.5, i: "cloche" },
    ...Array.from({ length: 16 }, (_, k): Ev => ({ t: k * 0.5, d: 0.05, n: [60], v: k % 2 ? 0.35 : 0.6, i: "grelots" })),
  ]),
};
