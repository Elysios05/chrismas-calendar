/**
 * Les instruments, tous synthétisés (aucun échantillon).
 * Règle d'or mobile : peu d'oscillateurs par voix, polyphonie plafonnée.
 */
import type * as ToneNS from "tone";
import { hz } from "./theory";
import type { AudioIn, Instr, InstrFactory, Tone } from "./types";

type Voice = typeof ToneNS.Synth | typeof ToneNS.FMSynth | typeof ToneNS.MonoSynth | typeof ToneNS.AMSynth;

/** PolySynth plafonné, éventuellement suivi d'une chaîne d'effets */
function poly(T: Tone, out: AudioIn, voice: Voice, opts: object, max: number, chain: ToneNS.ToneAudioNode[] = []): Instr {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = new T.PolySynth(voice as any, opts as any);
  s.maxPolyphony = max;
  const nodes = [s, ...chain];
  for (let k = 0; k < nodes.length - 1; k++) nodes[k].connect(nodes[k + 1]);
  nodes[nodes.length - 1].connect(out);
  return {
    play(time, notes, dur, vel) {
      s.triggerAttackRelease(notes.map(hz), dur, time, vel);
    },
    dispose() {
      nodes.forEach((n) => n.dispose());
    },
  };
}

/** Synthé monophonique (basse, flûte) : pas de clic au re-déclenchement */
function mono(T: Tone, out: AudioIn, opts: object, chain: ToneNS.ToneAudioNode[] = []): Instr {
  const s = new T.Synth(opts);
  const nodes = [s, ...chain];
  for (let k = 0; k < nodes.length - 1; k++) nodes[k].connect(nodes[k + 1]);
  nodes[nodes.length - 1].connect(out);
  return {
    play(time, notes, dur, vel) {
      s.triggerAttackRelease(hz(notes[0]), dur, time, vel);
    },
    dispose() {
      nodes.forEach((n) => n.dispose());
    },
  };
}

/* ---------------------------- Mélodiques ---------------------------- */

/** Boîte à musique : attaque métallique brève, puis un son presque pur qui chante */
export const musicBox: InstrFactory = (T, out) =>
  poly(T, out, T.FMSynth, {
    harmonicity: 4,
    modulationIndex: 7,
    oscillator: { type: "sine" },
    modulation: { type: "sine" },
    envelope: { attack: 0.002, decay: 1.6, sustain: 0, release: 1.4 },
    modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
  }, 6);

/** Célesta / clochette de verre, plus doux que la boîte à musique */
export const celesta: InstrFactory = (T, out) =>
  poly(T, out, T.FMSynth, {
    harmonicity: 3,
    modulationIndex: 3,
    oscillator: { type: "sine" },
    modulation: { type: "sine" },
    envelope: { attack: 0.004, decay: 2.2, sustain: 0, release: 2 },
    modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 },
  }, 5);

/** Glockenspiel / clochettes : partiels inharmoniques, brillant */
export const glock: InstrFactory = (T, out) =>
  poly(T, out, T.FMSynth, {
    harmonicity: 5.07,
    modulationIndex: 9,
    oscillator: { type: "sine" },
    modulation: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.8 },
    modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  }, 4);

/** Marimba / sonorité bois */
export const marimba: InstrFactory = (T, out) =>
  poly(T, out, T.FMSynth, {
    harmonicity: 4,
    modulationIndex: 1.6,
    oscillator: { type: "sine" },
    modulation: { type: "sine" },
    envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.4 },
    modulationEnvelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 },
  }, 4);

/** Accordéon : deux anches légèrement désaccordées, filtrées */
export const accordion: InstrFactory = (T, out) =>
  poly(T, out, T.Synth, {
    oscillator: { type: "fatsawtooth", count: 2, spread: 14 },
    envelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.12 },
  }, 4, [new T.Filter({ frequency: 1500, type: "lowpass", Q: 0.7 })]);

/** Nappe douce (triangle chorusé) */
export const pad: InstrFactory = (T, out) =>
  poly(T, out, T.Synth, {
    oscillator: { type: "fattriangle", count: 2, spread: 18 },
    envelope: { attack: 1.4, decay: 0.6, sustain: 0.8, release: 2.6 },
  }, 6, [new T.Filter({ frequency: 1600, type: "lowpass", Q: 0.5 })]);

/** Nappe sombre de la grotte */
export const darkPad: InstrFactory = (T, out) =>
  poly(T, out, T.Synth, {
    oscillator: { type: "fattriangle", count: 2, spread: 24 },
    envelope: { attack: 2.2, decay: 1, sustain: 0.8, release: 3.5 },
  }, 6, [new T.Filter({ frequency: 900, type: "lowpass", Q: 0.6 })]);

/** Cordes (scie douce, filtrée) */
export const strings: InstrFactory = (T, out) =>
  poly(T, out, T.Synth, {
    oscillator: { type: "fatsawtooth", count: 2, spread: 16 },
    envelope: { attack: 0.35, decay: 0.4, sustain: 0.75, release: 1.2 },
  }, 6, [new T.Filter({ frequency: 1900, type: "lowpass", Q: 0.5 })]);

/** Cuivres festifs : filtre qui s'ouvre à chaque note */
export const brass: InstrFactory = (T, out) =>
  poly(T, out, T.MonoSynth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.03, decay: 0.25, sustain: 0.7, release: 0.25 },
    filter: { Q: 1, type: "lowpass", rolloff: -12 },
    filterEnvelope: { attack: 0.04, decay: 0.3, sustain: 0.45, release: 0.3, baseFrequency: 500, octaves: 2.6 },
  }, 3);

/** Flûte (triangle + vibrato léger) */
export const flute: InstrFactory = (T, out) =>
  mono(T, out, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.75, release: 0.25 },
    portamento: 0.015,
  }, [new T.Vibrato({ frequency: 5, depth: 0.08 })]);

/** Verre frotté (grotte) : attaque lente, partiel à l'octave */
export const glass: InstrFactory = (T, out) =>
  poly(T, out, T.FMSynth, {
    harmonicity: 2,
    modulationIndex: 1.2,
    oscillator: { type: "sine" },
    modulation: { type: "triangle" },
    envelope: { attack: 0.25, decay: 1.5, sustain: 0.4, release: 2.5 },
    modulationEnvelope: { attack: 0.5, decay: 1, sustain: 0.6, release: 2 },
  }, 4);

/* ------------------------------ Basses ------------------------------ */

/** Basse ronde (contrebasse pincée) */
export const bass: InstrFactory = (T, out) =>
  mono(T, out, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.35, sustain: 0.4, release: 0.25 },
  }, [new T.Filter({ frequency: 700, type: "lowpass" })]);

/** Tuba de valse */
export const tuba: InstrFactory = (T, out) =>
  mono(T, out, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.15 },
  }, [new T.Filter({ frequency: 450, type: "lowpass", Q: 0.8 })]);

/** Basse/bourdon sinusoïdal, très doux */
export const subPad: InstrFactory = (T, out) =>
  mono(T, out, {
    oscillator: { type: "sine" },
    envelope: { attack: 1.5, decay: 0.5, sustain: 0.9, release: 2.5 },
  });

/* ---------------------------- Percussions --------------------------- */

function noiseHit(T: Tone, out: AudioIn, filter: object, env: object, type: "white" | "pink" = "white"): Instr {
  const f = new T.Filter(filter);
  const n = new T.NoiseSynth({ noise: { type }, envelope: env });
  n.connect(f);
  f.connect(out);
  return {
    play(time, _notes, dur, vel) {
      n.triggerAttackRelease(Math.min(dur, 0.05), time, vel);
    },
    dispose() {
      n.dispose();
      f.dispose();
    },
  };
}

/** Grelots de traîneau */
export const sleigh: InstrFactory = (T, out) =>
  noiseHit(T, out, { type: "bandpass", frequency: 8500, Q: 1.4 }, { attack: 0.003, decay: 0.14, sustain: 0, release: 0.05 });

/** Shaker léger */
export const shaker: InstrFactory = (T, out) =>
  noiseHit(T, out, { type: "highpass", frequency: 6000 }, { attack: 0.004, decay: 0.05, sustain: 0, release: 0.03 });

/** Balai de caisse claire, doux */
export const brush: InstrFactory = (T, out) =>
  noiseHit(T, out, { type: "bandpass", frequency: 2600, Q: 0.7 }, { attack: 0.005, decay: 0.12, sustain: 0, release: 0.05 }, "pink");

function membrane(T: Tone, out: AudioIn, opts: object): Instr {
  const m = new T.MembraneSynth(opts);
  m.connect(out);
  return {
    play(time, notes, dur, vel) {
      m.triggerAttackRelease(hz(notes[0]), dur, time, vel);
    },
    dispose() {
      m.dispose();
    },
  };
}

/** Grosse caisse douce */
export const kick: InstrFactory = (T, out) =>
  membrane(T, out, { pitchDecay: 0.03, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } });

/** Timbales */
export const timpani: InstrFactory = (T, out) =>
  membrane(T, out, { pitchDecay: 0.09, octaves: 1.2, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.4 } });

/** Goutte d'eau qui tombe dans la grotte (sinus qui monte) */
export const drip: InstrFactory = (T, out) => {
  const s = new T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 } });
  s.connect(out);
  return {
    play(time, notes, _dur, vel) {
      const f = hz(notes[0]);
      s.triggerAttackRelease(f, 0.06, time, vel);
      s.frequency.exponentialRampToValueAtTime(f * 1.9, time + 0.07);
    },
    dispose() {
      s.dispose();
    },
  };
};
