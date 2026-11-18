/**
 * Moteur audio du calendrier : implémente SoundApi avec Tone.js.
 *
 * - Tone.js est chargé paresseusement (import dynamique, morceau séparé).
 * - Le son démarre au premier geste de l'utilisateur (contrainte des navigateurs).
 *   L'AudioContext est créé et réveillé *pendant* le geste (synchrone, exigé par iOS),
 *   puis confié à Tone une fois celui-ci chargé.
 * - Fondus enchaînés entre ambiances ; chaque ambiance a sa propre horloge.
 * - Le contexte est mis en pause quand l'onglet est caché ou le son coupé (batterie).
 */
import type * as ToneNS from "tone";
import type { SoundApi, ZoneId } from "../core/contracts";
import { AmbienceRunner } from "./ambience";
import { GAMES } from "./pieces/games";
import { WORLDS } from "./pieces/worlds";
import { PieceRunner } from "./runner";
import { SfxBank, type SfxName } from "./sfx";
import type { Tone } from "./types";

export type GameMood = "calm" | "action" | "victory";

/** Durée des fondus (s) */
const FADE_ZONE = 2.5;
const FADE_GAME = 1.2;
/** Avance de programmation des notes (s) */
const LOOKAHEAD = 0.3;
const TICK = 0.05;

type Live = { key: string; runner: PieceRunner };

export class SoundEngine implements SoundApi {
  private T: Tone | null = null;
  private raw: AudioContext | null = null;
  private starting: Promise<void> | null = null;
  private enabled = true;
  private volume = 1;
  /** Volumes par défaut voulus par Alexandre : musique 50 %, effets 60 % */
  private musicVolume = 0.5;
  private sfxVolume = 0.6;
  private storm = false;
  private windAmount = 0.5;
  private zone: ZoneId = "montagnes";
  private night = false;
  private mood: GameMood | null = null;

  private master: ToneNS.Gain | null = null;
  private music: ToneNS.Gain | null = null;
  private sfxBus: ToneNS.Gain | null = null;
  /** Bus « ambiance » : suit le volume des effets, baissé pendant les jeux */
  private ambBus: ToneNS.Gain | null = null;
  private sfx: SfxBank | null = null;
  private amb: AmbienceRunner | null = null;
  private ambFading: AmbienceRunner[] = [];
  private current: Live | null = null;
  private fading: Live[] = [];
  private suspendTimer = 0;

  constructor(opts: { autoUnlock?: boolean } = {}) {
    if (typeof window === "undefined") return;
    if (opts.autoUnlock !== false) {
      const onGesture = () => {
        if (!this.enabled) return; // on attendra setEnabled(true), lui-même appelé depuis un geste
        this.unlock();
        for (const ev of GESTURES) window.removeEventListener(ev, onGesture, true);
      };
      for (const ev of GESTURES) window.addEventListener(ev, onGesture, true);
    }
    document.addEventListener("visibilitychange", () => this.syncSuspend());
  }

  /* ------------------------------ SoundApi ------------------------------ */

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on && !this.raw) this.unlock();
    this.applyVolume();
    this.syncSuspend();
  }

  setZone(zone: ZoneId, night: boolean): void {
    this.zone = zone;
    this.night = night;
    this.apply();
  }

  setGameMusic(mood: GameMood | null): void {
    this.mood = mood;
    this.apply();
  }

  /** Joue un effet (ceux du contrat, plus ceux de `ExtraSfx`) */
  play(sfx: SfxName): void {
    if (!this.enabled || !this.T || !this.sfx || this.raw?.state !== "running") return;
    try {
      this.sfx.play(sfx, this.T.immediate() + 0.01);
    } catch {
      // jamais d'exception vers l'appelant
    }
  }

  /* ------------------------------ En plus ------------------------------- */

  /** Volume général 0..1 */
  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.applyVolume();
  }

  /** Volume de la musique 0..1 (défaut 0,5) */
  setMusicVolume(v: number): void {
    this.musicVolume = clamp01(v);
    this.applyVolume();
  }

  /** Volume des effets et des bruitages d'ambiance 0..1 (défaut 0,6) */
  setSfxVolume(v: number): void {
    this.sfxVolume = clamp01(v);
    this.applyVolume();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  /** Météo : tempête de neige (jour 10) = vent fort dans l'ambiance */
  setWeather(storm: boolean): void {
    this.storm = storm;
    if (this.T && this.amb) this.amb.setStorm(storm, this.T.immediate());
  }

  /** Intensité du vent 0..1 (montagnes : 1 en approchant du col ; pôle Nord) */
  setWind(x: number): void {
    this.windAmount = clamp01(x);
    if (this.T && this.amb) this.amb.setWind(this.windAmount, this.T.immediate());
  }

  getVolume(): number {
    return this.volume;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Réveille l'audio. À appeler depuis un geste (clic, toucher) ;
   * fait automatiquement au premier geste si autoUnlock.
   */
  unlock(): Promise<void> {
    if (this.starting) return this.starting;
    // 1. Synchrone, dans le geste : contexte audio + son muet (iOS)
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const raw = new Ctor({ latencyHint: "balanced" });
    this.raw = raw;
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback"; // ignore le bouton silencieux d'iOS
    void raw.resume();
    const silent = raw.createBufferSource();
    silent.buffer = raw.createBuffer(1, 1, raw.sampleRate);
    silent.connect(raw.destination);
    silent.start();
    // 2. Asynchrone : chargement de Tone et construction du graphe
    this.starting = import("tone").then((T) => {
      T.setContext(new T.Context({ context: raw, lookAhead: 0.05 }));
      this.T = T;
      const limiter = new T.Limiter(-1.5).toDestination();
      this.master = new T.Gain(0).connect(limiter);
      this.music = new T.Gain(1).connect(this.master);
      this.sfxBus = new T.Gain(1).connect(this.master);
      this.ambBus = new T.Gain(1).connect(this.sfxBus);
      this.sfx = new SfxBank(T, this.sfxBus);
      T.getContext().setInterval(() => this.tick(), TICK);
      this.applyVolume();
      this.apply();
      this.syncSuspend();
    });
    return this.starting;
  }

  /* ------------------------------ Interne ------------------------------- */

  private desiredKey(): string {
    return this.mood ? `jeu:${this.mood}` : `${this.zone}:${this.night ? "nuit" : "jour"}`;
  }

  private apply() {
    this.applyAmbience();
    this.applyGameDuck();
    const T = this.T;
    if (!T || !this.music) return;
    const key = this.desiredKey();
    if (this.current?.key === key) return;
    const def = this.mood ? GAMES[this.mood] : WORLDS[this.zone];
    const night = this.mood ? false : this.night;
    const fade = this.mood || this.current?.key.startsWith("jeu:") ? FADE_GAME : FADE_ZONE;
    const at = T.immediate() + 0.05;

    if (this.current) {
      const old = this.current;
      old.runner.fadeOut(at, fade);
      this.fading.push(old);
      const tail = (fade + old.runner.def.reverb.decay + 0.5) * 1000;
      window.setTimeout(() => {
        old.runner.dispose();
        this.fading = this.fading.filter((f) => f !== old);
      }, tail);
    }
    const runner = new PieceRunner(T, def, night, this.music);
    runner.start(at, this.current ? fade : 1.5);
    this.current = { key, runner };
    this.tick();
  }

  /** Bruitages du monde : fondu enchaîné quand on change de monde ou de jour/nuit */
  private applyAmbience() {
    const T = this.T;
    if (!T || !this.ambBus) return;
    if (this.amb && this.amb.zone === this.zone && this.amb.night === this.night) return;
    const at = T.immediate() + 0.05;
    if (this.amb) {
      const old = this.amb;
      old.fadeOut(at, FADE_ZONE);
      this.ambFading.push(old);
      window.setTimeout(() => {
        old.dispose();
        this.ambFading = this.ambFading.filter((a) => a !== old);
      }, (FADE_ZONE + 6) * 1000);
    }
    this.amb = new AmbienceRunner(T, this.zone, this.night, this.ambBus, { storm: this.storm, wind: this.windAmount });
    this.amb.start(at, FADE_ZONE);
  }

  /** Pendant un jeu, l'ambiance s'efface à moitié pour laisser la place */
  private applyGameDuck() {
    const T = this.T;
    if (!T || !this.ambBus) return;
    const g = this.ambBus.gain;
    const now = T.immediate();
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.getValueAtTime(now), now);
    g.linearRampToValueAtTime(this.mood ? 0.5 : 1, now + 1);
  }

  private tick() {
    const T = this.T;
    if (!T) return;
    const now = T.immediate();
    this.current?.runner.pump(now + LOOKAHEAD, now);
    // les morceaux qui s'éteignent continuent de jouer pendant leur fondu
    for (const f of this.fading) f.runner.pump(now + LOOKAHEAD, now);
    this.amb?.pump(now + LOOKAHEAD, now);
    for (const a of this.ambFading) a.pump(now + LOOKAHEAD, now);
  }

  private applyVolume() {
    const T = this.T;
    if (!T || !this.master) return;
    const now = T.immediate();
    const ramp = (p: ToneNS.Param<"gain">, v: number) => {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.getValueAtTime(now), now);
      p.linearRampToValueAtTime(v, now + 0.3);
    };
    ramp(this.master.gain, this.enabled ? this.volume * this.volume : 0); // courbe perçue plus naturelle
    if (this.music) ramp(this.music.gain, this.musicVolume);
    if (this.sfxBus) ramp(this.sfxBus.gain, this.sfxVolume);
  }

  /** Met le contexte en pause si coupé ou onglet caché (économise la batterie) */
  private syncSuspend() {
    const raw = this.raw;
    if (!raw || !this.T) return;
    window.clearTimeout(this.suspendTimer);
    const wantRun = this.enabled && document.visibilityState === "visible";
    if (wantRun) void raw.resume();
    else this.suspendTimer = window.setTimeout(() => void raw.suspend(), this.enabled ? 0 : 400);
  }
}

const GESTURES = ["pointerdown", "keydown", "touchend"] as const;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Instance unique pour toute l'application */
export const sound = new SoundEngine();
