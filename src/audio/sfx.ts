/**
 * Effets sonores courts et mignons, synthétisés.
 * Une petite banque d'instruments partagés, créée une seule fois.
 */
import type * as ToneNS from "tone";
import type { Sfx } from "../core/contracts";
import { makeImpulse } from "./runner";
import { hz, midi } from "./theory";
import type { AudioIn, Tone } from "./types";

export const SFX_LIST: Sfx[] = ["open", "good", "bad", "pop", "win", "locked", "step", "whoosh"];

export class SfxBank {
  private nodes: ToneNS.ToneAudioNode[] = [];
  private bell: ToneNS.PolySynth<ToneNS.FMSynth>;
  private blip: ToneNS.Synth;
  private noise: ToneNS.NoiseSynth;
  private noiseFilter: ToneNS.Filter;
  private knock: ToneNS.MembraneSynth;
  private wind: ToneNS.NoiseSynth;
  private windFilter: ToneNS.Filter;
  private stepCount = 0;

  constructor(T: Tone, out: AudioIn) {
    // volumes calés pour un pic momentané de -12 à -24 LUFS selon l'effet
    const bus = new T.Gain(T.dbToGain(-3)).connect(out);
    const rev = new T.Convolver(makeImpulse(T, 1.4));
    const revGain = new T.Gain(0.35).connect(bus);
    rev.connect(revGain);

    this.bell = new T.PolySynth(T.FMSynth, {
      harmonicity: 3,
      modulationIndex: 4,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 },
      modulationEnvelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    });
    this.bell.maxPolyphony = 8;
    this.bell.volume.value = 6;
    this.bell.connect(bus);
    this.bell.connect(rev);

    this.blip = new T.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.003, decay: 0.12, sustain: 0.2, release: 0.08 } });
    this.blip.volume.value = 4;
    this.blip.connect(bus);
    this.blip.connect(rev);

    this.noiseFilter = new T.Filter({ type: "bandpass", frequency: 1800, Q: 0.9 });
    this.noise = new T.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.04 } });
    this.noise.volume.value = 18;
    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(bus);

    this.knock = new T.MembraneSynth({ pitchDecay: 0.012, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } });
    this.knock.volume.value = 2;
    this.knock.connect(bus);

    this.windFilter = new T.Filter({ type: "bandpass", frequency: 600, Q: 1.2 });
    this.wind = new T.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.15, decay: 0.3, sustain: 0, release: 0.15 } });
    this.wind.volume.value = 13;
    this.wind.connect(this.windFilter);
    this.windFilter.connect(bus);

    this.nodes.push(bus, rev, revGain, this.bell, this.blip, this.noise, this.noiseFilter, this.knock, this.wind, this.windFilter);
  }

  play(name: Sfx, t: number) {
    const n = (s: string) => hz(midi(s));
    switch (name) {
      case "open": {
        // arpège qui scintille vers le haut
        ["C6", "E6", "G6", "C7", "E7"].forEach((s, k) => this.bell.triggerAttackRelease(n(s), 0.25, t + k * 0.055, 0.55 - k * 0.04));
        break;
      }
      case "good": {
        this.bell.triggerAttackRelease(n("E6"), 0.15, t, 0.6);
        this.bell.triggerAttackRelease(n("B6"), 0.3, t + 0.09, 0.65);
        break;
      }
      case "bad": {
        // « bwoum » doux qui descend, pas punitif
        this.blip.oscillator.type = "triangle";
        this.blip.triggerAttackRelease(330, 0.22, t, 0.5);
        this.blip.frequency.exponentialRampToValueAtTime(196, t + 0.2);
        this.blip.triggerAttackRelease(220, 0.25, t + 0.24, 0.45);
        this.blip.frequency.exponentialRampToValueAtTime(140, t + 0.45);
        break;
      }
      case "pop": {
        this.blip.oscillator.type = "sine";
        this.blip.triggerAttackRelease(520, 0.05, t, 0.7);
        this.blip.frequency.exponentialRampToValueAtTime(1300, t + 0.05);
        break;
      }
      case "win": {
        ["C6", "E6", "G6"].forEach((s, k) => this.bell.triggerAttackRelease(n(s), 0.15, t + k * 0.1, 0.55));
        this.bell.triggerAttackRelease(["C6", "E6", "G6", "C7"].map(n), 0.9, t + 0.32, 0.42);
        this.bell.triggerAttackRelease(n("G7"), 0.6, t + 0.5, 0.3);
        break;
      }
      case "locked": {
        // toc-toc : porte fermée
        this.knock.triggerAttackRelease(160, 0.08, t, 0.8);
        this.knock.triggerAttackRelease(150, 0.08, t + 0.13, 0.7);
        break;
      }
      case "step": {
        // crissement de neige : filtre qui varie un peu à chaque pas
        this.stepCount++;
        const f = 1500 + ((this.stepCount * 523) % 900);
        this.noiseFilter.frequency.setValueAtTime(f, t);
        this.noise.triggerAttackRelease(0.04, t, 0.6);
        break;
      }
      case "whoosh": {
        const fq = this.windFilter.frequency;
        fq.cancelScheduledValues(t);
        fq.setValueAtTime(300, t);
        fq.exponentialRampToValueAtTime(3200, t + 0.22);
        fq.exponentialRampToValueAtTime(700, t + 0.5);
        this.wind.triggerAttackRelease(0.2, t, 0.9);
        break;
      }
    }
  }

  dispose() {
    this.nodes.forEach((x) => x.dispose());
  }
}
