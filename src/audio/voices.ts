/**
 * Programmation sûre des notes (ticket #68).
 *
 * Pourquoi : Tone.PolySynth ne programme pas ses notes tout de suite. Il les garde dans une minuterie
 * et ne les donne aux voix qu'au dernier moment, depuis sa propre boucle (hors de nos try/catch).
 * Quand le fil principal est en retard (téléphone chargé, rendu logiciel SwiftShader…), ces notes
 * arrivent avec une heure déjà passée : Tone la ramène à « maintenant », plusieurs notes tombent au
 * même instant sur la même voix, et Tone lève « Start time must be strictly greater than previous
 * start time » ou « The time must be greater than or equal to the last scheduled time ».
 *
 * Ici, tout est programmé immédiatement, avec des heures toujours dans le futur et strictement
 * croissantes par voix. Le son est le même (mêmes voix Tone, même volume de sortie).
 */
import type * as ToneNS from "tone";
import type { Tone } from "./types";

/** marge minimale devant l'horloge audio (s) */
const LEAD = 0.004;
/** écart minimal entre deux attaques d'une même voix (s) */
const GAP = 0.002;
/** une note plus en retard que ça est sautée plutôt que jouée de travers (s) */
const LATE = 0.1;

/** Compteur global des exceptions rattrapées : doit rester à 0 (lu par les tests) */
export const audioErrors = { count: 0 };

/** Heure de départ sûre, ou null si la note est trop en retard */
export function safeTime(now: number, last: number, t: number): number | null {
  const min = Math.max(now + LEAD, last + GAP);
  if (t >= min) return t;
  if (min - t > LATE) return null;
  return min;
}

type Ctx = { context: { currentTime: number } };

/**
 * Garde pour un synthé monophonique : `g(t, at => …)` exécute la programmation à une heure sûre
 * (jamais passée, strictement après l'attaque précédente) et ne lève jamais d'exception.
 * Renvoie l'heure réellement utilisée, ou null si la note est sautée.
 */
export function guard(s: Ctx): (t: number, fn: (at: number) => void) => number | null {
  let last = -Infinity;
  return (t, fn) => {
    const at = safeTime(s.context.currentTime, last, t);
    if (at === null) return null;
    last = at;
    try {
      fn(at);
      return at;
    } catch {
      audioErrors.count++;
      return null;
    }
  };
}

type Mono = ToneNS.Synth | ToneNS.FMSynth | ToneNS.MonoSynth | ToneNS.AMSynth;
type MonoCtor = typeof ToneNS.Synth | typeof ToneNS.FMSynth | typeof ToneNS.MonoSynth | typeof ToneNS.AMSynth;
type Env = { attack?: unknown; decay?: unknown; sustain?: number; release?: unknown };

const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);

/**
 * Remplaçant de Tone.PolySynth : un petit groupe de voix, programmées tout de suite.
 * Même règle que PolySynth : une voix se libère quand son oscillateur s'arrête
 * (fin attaque + déclin si le maintien est nul, sinon fin du relâchement) ; s'il n'y a plus
 * de voix libre, la note est sautée.
 */
export class VoicePool {
  readonly output: ToneNS.Volume;
  maxPolyphony: number;
  private voices: { s: Mono; last: number; free: number }[] = [];
  private Voice: MonoCtor;
  private opts: object;
  /** la voix s'arrête d'elle-même après attaque + déclin (maintien nul) */
  private ring: number | null;
  private release: number;

  constructor(T: Tone, Voice: MonoCtor, opts: object, max = 8) {
    this.Voice = Voice;
    this.opts = opts;
    this.output = new T.Volume(0);
    this.maxPolyphony = max;
    const env: Env = (opts as { envelope?: Env }).envelope ?? {};
    this.release = num(env.release, 1);
    this.ring = (env.sustain ?? 0.3) === 0 ? num(env.attack, 0.005) + num(env.decay, 0.1) : null;
  }

  get volume() {
    return this.output.volume;
  }

  connect(dest: ToneNS.InputNode) {
    this.output.connect(dest);
    return this;
  }

  /** durée pendant laquelle une voix reste occupée par une note de durée `dur` */
  private busyFor(dur: number) {
    return this.ring !== null ? Math.min(this.ring, dur + this.release) : dur + this.release;
  }

  private pick(t: number) {
    let best: (typeof this.voices)[number] | null = null;
    for (const v of this.voices) {
      if (v.free <= t && v.last + GAP < t && (!best || v.free < best.free)) best = v;
    }
    if (best) return best;
    if (this.voices.length >= this.maxPolyphony) return null; // comme PolySynth : note sautée
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = new (this.Voice as any)(this.opts) as Mono;
    s.connect(this.output);
    const v = { s, last: -Infinity, free: -Infinity };
    this.voices.push(v);
    return v;
  }

  /** Joue une note ou un accord (fréquences en Hz) */
  triggerAttackRelease(freqs: number | number[], dur: number, time: number, vel = 1) {
    const t = safeTime(this.output.context.currentTime, -Infinity, time);
    if (t === null) return;
    for (const f of Array.isArray(freqs) ? freqs : [freqs]) {
      const v = this.pick(t);
      if (!v) continue;
      v.last = t;
      v.free = t + this.busyFor(dur);
      try {
        v.s.triggerAttackRelease(f, dur, t, vel);
      } catch {
        audioErrors.count++;
      }
    }
  }

  dispose() {
    for (const v of this.voices) v.s.dispose();
    this.voices = [];
    this.output.dispose();
  }
}

/** Raccourci : `new VoicePool(T, …)` */
export const pool = (T: Tone, Voice: MonoCtor, opts: object, max?: number) => new VoicePool(T, Voice, opts, max);
