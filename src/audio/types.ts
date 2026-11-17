/**
 * Types internes de l'équipe Audio.
 * Tone.js est chargé paresseusement : on ne manipule que son *type* ici.
 */
import type * as ToneNS from "tone";

export type Tone = typeof ToneNS;
export type AudioIn = ToneNS.InputNode;

/** Un instrument joué par le séquenceur maison */
export interface Instr {
  /** notes en numéros MIDI, durée et heure en secondes, vélocité 0..1 */
  play(time: number, notes: number[], dur: number, vel: number): void;
  dispose(): void;
}

/** Fabrique d'instrument : se branche sur `out` */
export type InstrFactory = (T: Tone, out: AudioIn) => Instr;

export type InstrSpec = {
  make: InstrFactory;
  /** volume de l'instrument (dB) */
  vol?: number;
  /** part envoyée dans la réverbération (0..1) */
  rev?: number;
  /** part envoyée dans l'écho (0..1, si le morceau en a un) */
  dly?: number;
  /** panoramique -1..1 */
  pan?: number;
  /** multiplicateur de volume la nuit (0 = coupé) */
  night?: number;
};

/** Un évènement du séquenceur. Temps et durées en temps (noires). */
export type Ev = { t: number; d: number; n: number[]; v: number; i: string };

export type PieceDef = {
  id: string;
  bpm: number;
  nightBpm: number;
  /** longueur de la boucle, en temps */
  beats: number;
  /** réglage de gain global (dB), calé pour viser ≈ -16 LUFS */
  gainDb: number;
  /** réglage supplémentaire la nuit (dB, défaut -2), calé pour viser ≈ -19 LUFS */
  nightGainDb?: number;
  reverb: { decay: number; wet: number };
  /** écho optionnel : durée en temps, réinjection */
  delay?: { beats: number; feedback: number };
  /** fréquence de coupure du filtre général jour / nuit (Hz) */
  tone?: { day: number; night: number };
  instruments: Record<string, InstrSpec>;
  events(night: boolean): Ev[];
};
