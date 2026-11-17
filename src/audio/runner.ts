/**
 * Lecteur d'un morceau : construit ses instruments et sa réverbération,
 * puis programme les notes en boucle avec une petite avance (« lookahead »).
 * Chaque morceau a sa propre horloge : deux ambiances de tempos différents
 * peuvent se chevaucher pendant un fondu enchaîné.
 */
import type * as ToneNS from "tone";
import { rng } from "./theory";
import type { AudioIn, Ev, Instr, PieceDef, Tone } from "./types";

/** Réponse impulsionnelle synthétique : bruit stéréo à décroissance exponentielle */
export function makeImpulse(T: Tone, decay: number): ToneNS.ToneAudioBuffer {
  const ctx = T.getContext();
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * decay);
  const buf = ctx.createBuffer(2, len, rate);
  const rand = rng(7);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let k = 0; k < len; k++) {
      const x = k / len;
      // montée de 8 ms pour éviter un clic, puis décroissance
      const fadeIn = Math.min(1, k / (rate * 0.008));
      data[k] = (rand() * 2 - 1) * Math.pow(1 - x, 2.2) * Math.exp(-3 * x) * fadeIn;
    }
  }
  return new T.ToneAudioBuffer(buf);
}

export class PieceRunner {
  readonly def: PieceDef;
  readonly night: boolean;
  /** Gain de fondu (0..1) */
  readonly fade: ToneNS.Gain;
  private nodes: ToneNS.ToneAudioNode[] = [];
  private instr: Record<string, { inst: Instr; mult: number }> = {};
  private evs: Ev[];
  private spb: number;
  private loopLen: number;
  private origin = 0;
  private idx = 0;
  private loop = 0;
  private rand = rng(42);

  constructor(T: Tone, def: PieceDef, night: boolean, dest: AudioIn) {
    this.def = def;
    this.night = night;
    const bpm = night ? def.nightBpm : def.bpm;
    this.spb = 60 / bpm;
    this.loopLen = def.beats * this.spb;
    this.evs = def.events(night).slice().sort((a, b) => a.t - b.t);

    // Chaîne : instruments → bus → filtre de couleur → réglage → fondu → sortie
    this.fade = new T.Gain(0).connect(dest);
    const trim = new T.Gain(T.dbToGain(def.gainDb + (night ? -2 : 0))).connect(this.fade);
    const cutoff = def.tone ? (night ? def.tone.night : def.tone.day) : night ? 3200 : 14000;
    const color = new T.Filter({ type: "lowpass", frequency: cutoff, rolloff: -12 }).connect(trim);
    const bus = new T.Gain(1).connect(color);

    // Réverbération (convolution : peu coûteuse et native)
    const revIn = new T.Gain(1);
    const revDamp = new T.Filter({ type: "lowpass", frequency: 4500 });
    const conv = new T.Convolver(makeImpulse(T, def.reverb.decay * (night ? 1.2 : 1)));
    const revOut = new T.Gain(def.reverb.wet).connect(bus);
    revIn.chain(revDamp, conv, revOut);
    this.nodes.push(this.fade, trim, color, bus, revIn, revDamp, conv, revOut);

    // Écho optionnel
    let dlyIn: ToneNS.Gain | null = null;
    if (def.delay) {
      dlyIn = new T.Gain(1);
      const delay = new T.FeedbackDelay({ delayTime: def.delay.beats * this.spb, feedback: def.delay.feedback, wet: 1 });
      dlyIn.connect(delay);
      delay.connect(bus);
      delay.connect(revIn);
      this.nodes.push(dlyIn, delay);
    }

    for (const [key, spec] of Object.entries(def.instruments)) {
      const mult = night ? (spec.night ?? 1) : 1;
      if (mult <= 0) continue;
      const ch = new T.Gain(T.dbToGain(spec.vol ?? 0));
      this.nodes.push(ch);
      if (spec.pan) {
        const p = new T.Panner(spec.pan).connect(bus);
        ch.connect(p);
        this.nodes.push(p);
      } else ch.connect(bus);
      if (spec.rev) {
        const s = new T.Gain(spec.rev).connect(revIn);
        ch.connect(s);
        this.nodes.push(s);
      }
      if (spec.dly && dlyIn) {
        const s = new T.Gain(spec.dly).connect(dlyIn);
        ch.connect(s);
        this.nodes.push(s);
      }
      this.instr[key] = { inst: spec.make(T, ch), mult };
    }
  }

  /** Durée d'une boucle (s) */
  get loopSeconds() {
    return this.loopLen;
  }

  start(at: number, fadeIn = 0) {
    this.origin = at;
    this.idx = 0;
    this.loop = 0;
    const g = this.fade.gain;
    g.cancelScheduledValues(at);
    if (fadeIn > 0) {
      g.setValueAtTime(0, at);
      g.linearRampToValueAtTime(1, at + fadeIn);
    } else g.setValueAtTime(1, at);
  }

  fadeOut(at: number, dur: number) {
    const g = this.fade.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.getValueAtTime(at), at);
    g.linearRampToValueAtTime(0, at + dur);
  }

  /** Programme toutes les notes qui tombent avant `horizon` (s, horloge audio) */
  pump(horizon: number, now: number) {
    const evs = this.evs;
    if (!evs.length) return;
    for (let guard = 0; guard < 2000; guard++) {
      const e = evs[this.idx];
      const time = this.origin + this.loop * this.loopLen + e.t * this.spb;
      if (time >= horizon) return;
      if (time >= now) {
        const slot = this.instr[e.i];
        if (slot) {
          // légère humanisation de la vélocité
          const v = e.v * slot.mult * (this.night ? 0.82 : 1) * (0.94 + this.rand() * 0.12);
          slot.inst.play(time, e.n, Math.max(0.03, e.d * this.spb * 0.98), Math.min(1, v));
        }
      }
      this.idx++;
      if (this.idx >= evs.length) {
        this.idx = 0;
        this.loop++;
      }
    }
  }

  dispose() {
    for (const { inst } of Object.values(this.instr)) inst.dispose();
    for (const n of this.nodes) n.dispose();
    this.instr = {};
    this.nodes = [];
  }
}
