/**
 * Airs de Noël traditionnels, tous du DOMAINE PUBLIC (mélodies seules, sans paroles).
 * Écrits dans leur tonalité de référence, octave « voix » ; chaque morceau transpose.
 * Un jeton par pas (`step` indiqué), "-" prolonge, "." silence.
 */
import { mel } from "../theory";
import type { Ev } from "../types";

/**
 * « Mon beau sapin » / O Tannenbaum (mélodie populaire allemande, publiée en 1824).
 * Fa majeur, 3/4, pas = double croche. 12 mesures ; la levée (do grave) est en fin de 12e mesure.
 */
export const TANNENBAUM = `
  F4 - - F4 F4 - - - - - G4 - | A4 - - A4 A4 - - - - - A4 - | G4 - A4 - Bb4 - - - E4 - - - | G4 - - - F4 - - - C5 - - - |
  C5 - A4 - D5 - - - - - C5 - | C5 - Bb4 - Bb4 - - - - - Bb4 - | Bb4 - G4 - C5 - - - - - Bb4 - | Bb4 - - - A4 - - - C4 - - - |
  F4 - - F4 F4 - - - - - G4 - | A4 - - A4 A4 - - - - - A4 - | G4 - A4 - Bb4 - - - E4 - - - | G4 - - - F4 - - - C4 - - -`;
export const TANNENBAUM_GRID = ["F", "F", "C7", "C7~F~F", "F", "C7", "C7", "C7~F~F", "F", "Dm", "C7", "C7~F~F"];
export const tannenbaum = (i: string, vel: number, start = 0) => mel(TANNENBAUM, 0.25, i, vel, start);

/**
 * « Douce nuit » / Stille Nacht (Franz Gruber, 1818).
 * Écrit en do majeur, 6/8 (= 3 noires par mesure), pas = double croche. 12 mesures.
 */
export const STILLE_NACHT = `
  G4 - - A4 G4 - E4 - - - - - | G4 - - A4 G4 - E4 - - - - - | D5 - - - D5 - B4 - - - - - | C5 - - - C5 - G4 - - - - - |
  A4 - - - A4 - C5 - - B4 A4 - | G4 - - A4 G4 - E4 - - - - - | A4 - - - A4 - C5 - - B4 A4 - | G4 - - A4 G4 - E4 - - - - - |
  D5 - - - D5 - F5 - - D5 B4 - | C5 - - - - - E5 - - - - - | C5 - G4 - E4 - G4 - - F4 D4 - | C4 - - - - - - - - - - -`;
export const STILLE_NACHT_GRID = ["C", "C", "G7", "C", "F", "C", "F", "C", "G7", "C", "C~G7", "C"];
export const stilleNacht = (i: string, vel: number, start = 0) => mel(STILLE_NACHT, 0.25, i, vel, start);

/**
 * « Vive le vent » = mélodie de Jingle Bells (James Lord Pierpont, 1857).
 * Do majeur, 4/4, pas = croche. Couplet (16 mesures) puis refrain (16 mesures).
 */
export const JINGLE_VERSE = `
  G4 - E5 - D5 - C5 - | G4 - - - - - G4 G4 | G4 - E5 - D5 - C5 - | A4 - - - - - - A4 |
  A4 - F5 - E5 - D5 - | B4 - - - - - - - | G5 - G5 - F5 - D5 - | E5 - - - - - - - |
  G4 - E5 - D5 - C5 - | G4 - - - - - G4 G4 | G4 - E5 - D5 - C5 - | A4 - - - - - A4 A4 |
  A4 - F5 - E5 - D5 - | G5 - G5 - G5 - G5 - | A5 - G5 - F5 - D5 - | C5 - - - G5 - - -`;
export const JINGLE_VERSE_GRID = ["C", "C", "C", "F", "Dm", "G", "G7", "C", "C", "C", "C", "F", "Dm", "G7", "F~G7", "C"];
export const JINGLE_CHORUS = `
  E5 - E5 - E5 - - - | E5 - E5 - E5 - - - | E5 - G5 - C5 - - D5 | E5 - - - - - - - |
  F5 - F5 - F5 - - F5 | F5 - E5 - E5 - E5 E5 | E5 - D5 - D5 - E5 - | D5 - - - G5 - - - |
  E5 - E5 - E5 - - - | E5 - E5 - E5 - - - | E5 - G5 - C5 - - D5 | E5 - - - - - - - |
  F5 - F5 - F5 - F5 - | F5 - E5 - E5 - E5 E5 | G5 - G5 - F5 - D5 - | C5 - - - - - - - `;
export const JINGLE_CHORUS_GRID = ["C", "C", "C", "C", "F", "F~C", "D7", "G", "C", "C", "C", "C", "F", "F~C", "G7", "C"];

/**
 * « Il est né le divin enfant » (noël populaire français, XIXe s.).
 * Sol majeur, 2/4, pas = croche. Refrain (16 mesures) et couplet (16 mesures).
 */
export const IL_EST_NE_REFRAIN = `
  D4 - G4 - | G4 - B4 G4 | D4 - G4 - | G4 - - - | G4 - G4 A4 | B4 - C5 B4 | A4 - G4 - | A4 F#4 D4 - |
  D4 - G4 - | G4 - B4 G4 | D4 - G4 - | G4 - - - | G4 - A4 - | B4 - C5 B4 | A4 - D5 - | G4 - - -`;
export const IL_EST_NE_REFRAIN_GRID = ["G", "G", "G", "G", "C", "G", "D7~G", "D", "G", "G", "G", "G", "C~D7", "G", "D7", "G"];
export const IL_EST_NE_COUPLET = `
  B4 - C5 - | D5 - C5 B4 | C5 - E5 - | D5 - - - | B4 - C5 - | D5 - E5 D5 | C5 - B4 - | B4 - A4 - |
  B4 - C5 - | D5 - C5 B4 | C5 - E5 - | D5 - - - | B4 - C5 - | D5 - E5 D5 | C5 - B4 - | A4 - - -`;
export const IL_EST_NE_COUPLET_GRID = ["G~C", "G", "C", "G", "G~C", "G~C", "Am~G", "G~D", "G~C", "G", "C", "G", "G~C", "G~C", "Am~G", "D"];

/**
 * « God Rest Ye Merry, Gentlemen » (air traditionnel anglais, XVIIIe s.).
 * Mi mineur, 4/4, pas = croche. 19 mesures ; la levée (mi) est en fin de 19e mesure.
 */
export const GOD_REST = `
  E4 - B4 - B4 - A4 - | G4 - F#4 - E4 - D4 - | E4 - F#4 - G4 - A4 - | B4 - - - - - E4 - |
  E4 - B4 - B4 - A4 - | G4 - F#4 - E4 - D4 - | E4 - F#4 - G4 - A4 - | B4 - - - - - B4 - |
  C5 - A4 - B4 - C5 - | D5 - E5 - B4 - A4 - | G4 - E4 - F#4 - G4 - | A4 - - - G4 - A4 - |
  B4 - - - C5 - B4 - | B4 - A4 - G4 - F#4 - | E4 - - - G4 F#4 E4 - | A4 - - - G4 - A4 - |
  B4 - C5 - D5 - E5 - | B4 - A4 - G4 - F#4 - | E4 - - - - - E4 -`;
export const GOD_REST_GRID = [
  "Em", "Em", "Em~Am7", "B7", "Em", "Em", "Em~Am7", "B7",
  "Am~G", "G", "Em~D", "D~G", "G~Am", "Em~B7", "Em", "D~G", "Em~C", "Em~B7", "Em",
];

/**
 * « We Wish You a Merry Christmas » (air traditionnel anglais).
 * Sol majeur, 3/4, pas = croche. 8 mesures ; la levée (ré) est en fin de 8e mesure.
 */
export const WE_WISH = `
  G4 - G4 A4 G4 F#4 | E4 - E4 - E4 - | A4 - A4 B4 A4 G4 | F#4 - D4 - D4 - |
  B4 - B4 C5 B4 A4 | G4 - E4 - D4 D4 | E4 - A4 - F#4 - | G4 - - - D4 -`;
export const WE_WISH_GRID = ["G", "C", "D", "D", "Em", "C", "C~D7~D7", "G"];
/** Dernière phrase seule (« …a merry Christmas and a happy New Year ») */
export const WE_WISH_LAST = `B4 - B4 C5 B4 A4 | G4 - E4 - D4 D4 | E4 - A4 - F#4 - | G4 - - - - -`;
export const WE_WISH_LAST_GRID = ["Em", "C", "C~D7~D7", "G"];

export const tune = (text: string, step: number, i: string, vel: number, start = 0): Ev[] => mel(text, step, i, vel, start);

/**
 * « Deck the Halls » (air gallois traditionnel, XVIIIe s.) : première phrase avec ses « fa la la ».
 * Do majeur, 4/4, pas = croche. 4 mesures.
 */
export const DECK = `
  G5 - - F5 E5 - D5 - | C5 - D5 - E5 - C5 - | D5 E5 F5 D5 E5 - - D5 | C5 - B4 - C5 - - -`;
export const DECK_GRID = ["C", "C", "G7~C", "C~G7"];
