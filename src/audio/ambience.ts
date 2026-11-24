/**
 * Bruitages d'ambiance par monde, en couche séparée de la musique.
 * Tout est synthétisé : bruits filtrés (vent, eau, brouhaha) et petits évènements
 * aléatoires (oiseaux, craquements, gouttes, cloches, grelots qui passent).
 *
 * CPU : 2 à 4 sources de bruit continues par monde + quelques synthés réutilisés ;
 * une seule réverbération par ambiance.
 */
import type * as ToneNS from "tone";
import type { ZoneId } from "../core/contracts";
import { churchBell } from "./instruments";
import { makeImpulse } from "./runner";
import { rng } from "./theory";
import type { AudioIn, Instr, Tone } from "./types";
import { audioErrors, safeTime, VoicePool } from "./voices";

type Node = { dispose(): unknown };

/** Réglage par monde (dB) : chaque ambiance ≈ -24 LUFS à plein volume, sous la musique (-16) */
const AMB_TRIM: Record<ZoneId, number> = {
  montagnes: 2.3,
  "saint-nicolas": 3.4,
  lac: 2,
  marche: 0.5,
  grotte: 1.9,
  "pole-nord": 4.1,
};
type Gen = { min: number; max: number; next: number; fire: (t: number) => void };

export class AmbienceRunner {
  readonly zone: ZoneId;
  readonly night: boolean;
  readonly fade: ToneNS.Gain;
  private T: Tone;
  private nodes: Node[] = [];
  private sources: (ToneNS.Noise | ToneNS.LFO)[] = [];
  private gens: Gen[] = [];
  private rand = rng(99);
  private bus: ToneNS.Gain;
  private rev: ToneNS.Gain;
  /** Niveau du vent principal (montagnes, pôle Nord) et du vent de tempête */
  private windLevel: ToneNS.Gain | null = null;
  private stormLevel: ToneNS.Gain;
  private windBase = 0;
  private started = false;

  constructor(T: Tone, zone: ZoneId, night: boolean, dest: AudioIn, opts: { storm?: boolean; wind?: number } = {}) {
    this.T = T;
    this.zone = zone;
    this.night = night;
    this.fade = new T.Gain(0).connect(dest);
    this.bus = new T.Gain(T.dbToGain(AMB_TRIM[zone])).connect(this.fade);
    const conv = new T.Convolver(makeImpulse(T, zone === "grotte" ? 5 : 2.5));
    this.rev = new T.Gain(1);
    const revOut = new T.Gain(zone === "grotte" ? 0.9 : 0.5).connect(this.bus);
    this.rev.connect(conv);
    conv.connect(revOut);
    this.nodes.push(this.fade, this.bus, conv, this.rev, revOut);

    // Vent de tempête, présent partout (muet hors tempête)
    this.stormLevel = this.wind(0.9, 900, 0.6, 0.23, 0);
    this.wind(0.5, 2600, 6, 0.13, 1, this.stormLevel); // sifflement de la tempête
    this.setStorm(!!opts.storm, 0);
    this.build(opts.wind ?? 0.5);
  }

  /* ------------------------------ Couches ------------------------------ */

  private add<N extends Node>(n: N): N {
    this.nodes.push(n);
    return n;
  }

  /** Bruit filtré qui ondule : vent, eau, brouhaha. Renvoie le gain de niveau. */
  private wind(level: number, freq: number, q: number, gust: number, initial: number, out: AudioIn = this.bus, type: "pink" | "brown" | "white" = "pink", depth = 0.75): ToneNS.Gain {
    const T = this.T;
    const noise = new T.Noise(type);
    const filt = this.add(new T.Filter({ type: "bandpass", frequency: freq, Q: q }));
    const amp = this.add(new T.Gain(0));
    const lvl = this.add(new T.Gain(initial));
    const lfoF = new T.LFO({ frequency: gust * 0.7, min: freq * 0.6, max: freq * 1.6 });
    const lfoA = new T.LFO({ frequency: gust, min: level * (1 - depth), max: level, phase: this.rand() * 360 });
    lfoF.connect(filt.frequency);
    lfoA.connect(amp.gain);
    noise.chain(filt, amp, lvl, out);
    this.sources.push(noise, lfoF, lfoA);
    this.nodes.push(noise, lfoF, lfoA);
    return lvl;
  }

  /** Programme un évènement aléatoire toutes les min..max secondes */
  private every(min: number, max: number, fire: (t: number) => void) {
    this.gens.push({ min, max, next: min * this.rand(), fire });
  }

  private panned(pan: number): ToneNS.Panner {
    const p = this.add(new this.T.Panner(pan));
    p.connect(this.bus);
    p.connect(this.rev);
    return p;
  }

  /* ----------------------------- Évènements ----------------------------- */

  private birds(out: AudioIn) {
    const s = this.add(new this.T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.03 } }));
    s.volume.value = -5;
    s.connect(out);
    return (t: number) => {
      const f0 = 2600 + this.rand() * 1800;
      const n = 2 + Math.floor(this.rand() * 4);
      for (let k = 0; k < n; k++) {
        const tk = t + k * (0.08 + this.rand() * 0.04);
        const f = f0 * (1 + (k % 2) * 0.12);
        s.triggerAttackRelease(f, 0.05, tk, 0.6);
        s.frequency.exponentialRampToValueAtTime(f * 1.3, tk + 0.05);
      }
    };
  }

  private owl(out: AudioIn) {
    const s = this.add(new this.T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.06, decay: 0.1, sustain: 0.7, release: 0.15 } }));
    s.volume.value = -6;
    s.connect(out);
    return (t: number) => {
      [[0, 0.35], [0.6, 0.15], [0.8, 0.4]].forEach(([dt, d]) => {
        s.triggerAttackRelease(390, d, t + dt, 0.5);
        s.frequency.linearRampToValueAtTime(350, t + dt + d);
      });
    };
  }

  private crack(out: AudioIn, low: number) {
    const n = this.add(new this.T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 } }));
    const f = this.add(new this.T.Filter({ type: "bandpass", frequency: 1600, Q: 0.8 }));
    const m = this.add(new this.T.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } }));
    n.volume.value = 2;
    m.volume.value = -4;
    n.connect(f);
    f.connect(out);
    m.connect(out);
    return (t: number) => {
      n.triggerAttackRelease(0.02, t, 0.8);
      n.triggerAttackRelease(0.02, t + 0.05 + this.rand() * 0.05, 0.5);
      m.triggerAttackRelease(low, 0.1, t, 0.5);
    };
  }

  /** Craquement de glace lointain : le célèbre « piou » dispersif */
  private iceCrack(out: AudioIn) {
    const s = this.add(new this.T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.2 } }));
    s.volume.value = -5;
    s.connect(out);
    return (t: number) => {
      const f = 1800 + this.rand() * 1400;
      s.triggerAttackRelease(f, 0.4, t, 0.6);
      s.frequency.exponentialRampToValueAtTime(110, t + 0.45);
    };
  }

  private plop(out: AudioIn, base: number, vol: number) {
    const s = this.add(new this.T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.05 } }));
    s.volume.value = vol;
    s.connect(out);
    return (t: number) => {
      const f = base * (1 + this.rand() * 0.8);
      s.triggerAttackRelease(f, 0.05, t, 0.6);
      s.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06);
    };
  }

  private bells(out: AudioIn, vol: number) {
    const ch = this.add(new this.T.Gain(this.T.dbToGain(vol)));
    ch.connect(out);
    const b: Instr = churchBell(this.T, ch);
    this.nodes.push({ dispose: () => b.dispose() } as unknown as Node);
    return (t: number) => {
      const notes = [55, 50, 52, 47];
      const n = 2 + Math.floor(this.rand() * 3);
      for (let k = 0; k < n; k++) b.play(t + k * 1.1, [notes[k % notes.length]], 2, 0.5 - k * 0.06);
    };
  }

  /** Traîneau qui passe : grelots qui approchent puis s'éloignent, de gauche à droite */
  private sleighPass(vol: number) {
    const T = this.T;
    const n = this.add(new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.04 } }));
    const f = this.add(new T.Filter({ type: "bandpass", frequency: 8000, Q: 1.3 }));
    const p = this.panned(-0.8);
    n.volume.value = vol;
    n.chain(f, p);
    return (t: number) => {
      const dur = 5;
      p.pan.setValueAtTime(-0.8, t);
      p.pan.linearRampToValueAtTime(0.8, t + dur);
      for (let k = 0; k * 0.14 < dur; k++) {
        const x = (k * 0.14) / dur;
        const env = Math.sin(Math.PI * x) ** 2;
        n.triggerAttackRelease(0.03, t + k * 0.14 + this.rand() * 0.03, 0.15 + 0.85 * env);
      }
    };
  }

  /** Tintement de verres (vin chaud) */
  private clink(out: AudioIn) {
    const s = this.add(new VoicePool(this.T, this.T.FMSynth, {
      harmonicity: 5.5, modulationIndex: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    }));
    s.maxPolyphony = 3;
    s.volume.value = -9;
    s.connect(out);
    return (t: number) => {
      const f = 2400 + this.rand() * 900;
      s.triggerAttackRelease(f, 0.2, t, 0.5);
      s.triggerAttackRelease(f * 1.07, 0.2, t + 0.07, 0.4);
    };
  }

  /* ------------------------------ Mondes ------------------------------ */

  private build(windIntensity: number) {
    const night = this.night;
    const left = this.panned(-0.6);
    const right = this.panned(0.6);
    switch (this.zone) {
      case "montagnes": {
        this.windBase = 0.55;
        this.windLevel = this.wind(1, 700, 0.7, 0.11, 0);
        this.wind(0.35, 1900, 9, 0.07, 1, this.windLevel); // sifflement des crêtes
        this.setWind(windIntensity, 0);
        this.every(18, 40, this.crack(left, 70)); // neige qui craque, pierre qui roule
        break;
      }
      case "saint-nicolas": {
        this.wind(0.35, 650, 0.8, 0.31, night ? 0.4 : 1, this.bus, "pink", 0.4); // brouhaha grave
        this.wind(0.2, 1500, 1.4, 0.43, night ? 0.3 : 1, this.bus, "pink", 0.5); // voix plus claires
        this.wind(0.25, 500, 0.6, 0.09, 0.6); // petit vent
        this.every(25, 45, this.bells(this.rev, 0));
        this.every(20, 40, this.sleighPass(-4));
        break;
      }
      case "lac": {
        this.wind(0.35, 2200, 0.5, 0.17, 0.6, this.bus, "pink", 0.6); // bruissement de la forêt
        this.wind(0.3, 320, 1, 0.37, 1, this.bus, "brown", 0.45); // eau sous la glace
        this.wind(0.15, 500, 2, 0.83, 1, this.bus, "brown", 0.6); // clapotis plus vif
        this.every(1.5, 5, this.plop(right, 280, -10));
        this.every(9, 22, this.iceCrack(this.rev));
        if (night) this.every(20, 40, this.owl(left));
        else this.every(4, 10, this.birds(left));
        this.every(45, 90, this.crack(right, 90)); // branche qui casse
        break;
      }
      case "marche": {
        this.wind(0.55, 650, 0.8, 0.29, night ? 0.4 : 1, this.bus, "pink", 0.4);
        this.wind(0.35, 1500, 1.4, 0.41, night ? 0.3 : 1, this.bus, "pink", 0.5);
        this.every(6, 14, this.clink(right));
        this.every(15, 30, this.sleighPass(-4));
        this.every(40, 70, this.bells(this.rev, -2));
        break;
      }
      case "grotte": {
        this.wind(0.35, 260, 0.7, 0.05, 1, this.bus, "brown"); // souffle de la grotte
        const delay = this.add(new this.T.FeedbackDelay({ delayTime: 0.37, feedback: 0.45, wet: 1 }));
        delay.connect(this.rev);
        delay.connect(this.bus);
        const drip = this.plop(delay, 900, -3);
        this.every(1, 3.5, drip);
        this.every(6, 12, this.plop(left, 1400, -8));
        this.every(30, 60, this.crack(this.rev, 60));
        break;
      }
      case "pole-nord": {
        this.windBase = 0.35;
        this.windLevel = this.wind(0.8, 800, 0.7, 0.09, 0);
        this.setWind(windIntensity, 0);
        this.every(14, 26, this.sleighPass(-3));
        this.every(30, 55, this.bells(this.rev, 0));
        break;
      }
    }
  }

  /* ------------------------------ Pilotage ------------------------------ */

  start(at: number, fadeIn: number) {
    if (this.started) return;
    this.started = true;
    for (const s of this.sources) s.start(at);
    for (const g of this.gens) g.next += at;
    const gain = this.fade.gain;
    gain.setValueAtTime(0, at);
    gain.linearRampToValueAtTime(1, at + Math.max(0.01, fadeIn));
  }

  fadeOut(at: number, dur: number) {
    const g = this.fade.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.getValueAtTime(at), at);
    g.linearRampToValueAtTime(0, at + dur);
  }

  /** Tempête de neige : vent fort partout */
  setStorm(on: boolean, at: number) {
    const g = this.stormLevel.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.getValueAtTime(at), at);
    g.linearRampToValueAtTime(on ? 1 : 0, at + 3);
  }

  /** Intensité du vent 0..1 (ex. 1 en approchant du col) */
  setWind(x: number, at: number) {
    if (!this.windLevel) return;
    const g = this.windLevel.gain;
    const v = this.windBase * (0.4 + 1.6 * Math.max(0, Math.min(1, x)));
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.getValueAtTime(at), at);
    g.linearRampToValueAtTime(v, at + 2);
  }

  pump(horizon: number, now: number) {
    for (const g of this.gens) {
      while (g.next < horizon) {
        // jamais dans le passé (fil principal en retard) ; un bruitage ne doit jamais lever d'exception
        if (g.next >= now && safeTime(this.T.getContext().currentTime, -Infinity, g.next) === g.next) {
          try {
            g.fire(g.next);
          } catch {
            audioErrors.count++;
          }
        }
        g.next += g.min + (g.max - g.min) * this.rand();
      }
    }
  }

  dispose() {
    if (this.started) for (const s of this.sources) s.stop();
    for (const n of this.nodes) n.dispose();
    this.nodes = [];
    this.sources = [];
  }
}

