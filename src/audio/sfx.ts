/**
 * Effets sonores courts et mignons, synthétisés.
 * Une petite banque d'instruments partagés, créée une seule fois.
 */
import type * as ToneNS from "tone";
import type { Sfx } from "../core/contracts";
import { makeImpulse } from "./runner";
import { hz, midi } from "./theory";
import type { AudioIn, Tone } from "./types";

/**
 * Effets en plus du contrat (à ajouter au type `Sfx`) :
 * - tap     : bouton de l'interface
 * - select  : clic sur une case du calendrier
 * - hover   : approche / survol d'un cadeau (scintillement très discret)
 * - talk    : « blip » de Pingou, par réplique ou par lettre (hauteur variable, très discret)
 * - pingou  : petit cri mignon quand Pingou apparaît
 * - day / night : passage au jour / à la nuit
 * - unlock  : une nouvelle case est disponible
 * - photo   : déclic d'appareil photo
 * - send    : message, photo ou dessin envoyé
 * - notify  : l'autre est connecté / a répondu
 * - jingle  : petit coup de grelots
 * - snow    : « pouf » de neige (boule de neige, chute)
 */
export type ExtraSfx = "tap" | "select" | "hover" | "talk" | "pingou" | "day" | "night" | "unlock" | "photo" | "send" | "notify" | "jingle" | "snow";
export type SfxName = Sfx | ExtraSfx;

export const SFX_LIST: SfxName[] = [
  "open", "good", "bad", "pop", "win", "locked", "step", "whoosh",
  "tap", "select", "hover", "talk", "pingou", "day", "night", "unlock", "photo", "send", "notify", "jingle", "snow",
];

const TALK_NOTES = [76, 79, 81, 84, 86, 88]; // pentatonique : la voix de Pingou reste toujours jolie

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
  private talkCount = 0;
  private chirp: ToneNS.Synth;
  private jingleNoise: ToneNS.NoiseSynth;
  private jingleFilter: ToneNS.Filter;

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

    this.chirp = new T.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.04 } });
    this.chirp.volume.value = -6;
    this.chirp.connect(bus);

    this.jingleFilter = new T.Filter({ type: "bandpass", frequency: 8500, Q: 1.4 });
    this.jingleNoise = new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.04 } });
    this.jingleNoise.volume.value = 4;
    this.jingleNoise.connect(this.jingleFilter);
    this.jingleFilter.connect(bus);
    this.jingleFilter.connect(rev);

    this.nodes.push(this.chirp, this.jingleNoise, this.jingleFilter);
    this.nodes.push(bus, rev, revGain, this.bell, this.blip, this.noise, this.noiseFilter, this.knock, this.wind, this.windFilter);
  }

  play(name: SfxName, t: number) {
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
      case "tap": {
        this.knock.triggerAttackRelease(420, 0.03, t, 0.35);
        break;
      }
      case "select": {
        this.knock.triggerAttackRelease(300, 0.04, t, 0.4);
        this.bell.triggerAttackRelease(n("G6"), 0.12, t + 0.02, 0.35);
        break;
      }
      case "hover": {
        this.bell.triggerAttackRelease(n("E7"), 0.1, t, 0.14);
        this.bell.triggerAttackRelease(n("B7"), 0.1, t + 0.06, 0.1);
        break;
      }
      case "talk": {
        const m = TALK_NOTES[(this.talkCount++ * 7 + 3) % TALK_NOTES.length];
        this.chirp.triggerAttackRelease(hz(m), 0.035, t, 0.22);
        break;
      }
      case "pingou": {
        // « pouic ! » qui monte puis redescend un peu
        this.chirp.triggerAttackRelease(700, 0.16, t, 0.5);
        this.chirp.frequency.exponentialRampToValueAtTime(1500, t + 0.08);
        this.chirp.frequency.exponentialRampToValueAtTime(1200, t + 0.16);
        this.chirp.triggerAttackRelease(1100, 0.08, t + 0.2, 0.4);
        this.chirp.frequency.exponentialRampToValueAtTime(1600, t + 0.27);
        break;
      }
      case "day": {
        ["C6", "D6", "G6", "C7"].forEach((s, k) => this.bell.triggerAttackRelease(n(s), 0.3, t + k * 0.09, 0.35));
        break;
      }
      case "night": {
        ["C7", "G6", "E6", "C6"].forEach((s, k) => this.bell.triggerAttackRelease(n(s), 0.4, t + k * 0.12, 0.28));
        break;
      }
      case "unlock": {
        ["G5", "B5", "D6", "G6", "B6", "D7", "G7"].forEach((s, k) => this.bell.triggerAttackRelease(n(s), 0.2, t + k * 0.04, 0.25 + k * 0.03));
        this.jingleNoise.triggerAttackRelease(0.05, t + 0.3, 0.5);
        break;
      }
      case "photo": {
        this.noiseFilter.frequency.setValueAtTime(3500, t);
        this.noise.triggerAttackRelease(0.02, t, 0.9);
        this.knock.triggerAttackRelease(600, 0.02, t + 0.01, 0.4);
        this.noise.triggerAttackRelease(0.02, t + 0.09, 0.6);
        break;
      }
      case "send": {
        const fq = this.windFilter.frequency;
        fq.cancelScheduledValues(t);
        fq.setValueAtTime(500, t);
        fq.exponentialRampToValueAtTime(4000, t + 0.3);
        this.wind.triggerAttackRelease(0.15, t, 0.6);
        this.bell.triggerAttackRelease(n("A6"), 0.3, t + 0.3, 0.4);
        break;
      }
      case "notify": {
        this.bell.triggerAttackRelease(n("A5"), 0.2, t, 0.35);
        this.bell.triggerAttackRelease(n("E6"), 0.4, t + 0.14, 0.35);
        break;
      }
      case "jingle": {
        for (let k = 0; k < 6; k++) this.jingleNoise.triggerAttackRelease(0.03, t + k * 0.07, 0.7 - k * 0.08);
        break;
      }
      case "snow": {
        this.noiseFilter.frequency.setValueAtTime(900, t);
        this.noise.triggerAttackRelease(0.12, t, 0.8);
        this.knock.triggerAttackRelease(90, 0.1, t, 0.3);
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
