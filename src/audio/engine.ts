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
import type { Sfx, SoundApi, ZoneId } from "../core/contracts";
import { GAMES } from "./pieces/games";
import { WORLDS } from "./pieces/worlds";
import { PieceRunner } from "./runner";
import { SfxBank } from "./sfx";
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
  private volume = 0.8;
  private zone: ZoneId = "montagnes";
  private night = false;
  private mood: GameMood | null = null;

  private master: ToneNS.Gain | null = null;
  private music: ToneNS.Gain | null = null;
  private sfx: SfxBank | null = null;
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

  play(sfx: Sfx): void {
    if (!this.enabled || !this.T || !this.sfx || this.raw?.state !== "running") return;
    this.sfx.play(sfx, this.T.immediate() + 0.01);
  }

  /* ------------------------------ En plus ------------------------------- */

  /** Volume général 0..1 */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
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
      this.sfx = new SfxBank(T, this.master);
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

  private tick() {
    const T = this.T;
    if (!T) return;
    const now = T.immediate();
    this.current?.runner.pump(now + LOOKAHEAD, now);
    // les morceaux qui s'éteignent continuent de jouer pendant leur fondu
    for (const f of this.fading) f.runner.pump(now + LOOKAHEAD, now);
  }

  private applyVolume() {
    const T = this.T;
    if (!T || !this.master) return;
    const target = this.enabled ? this.volume * this.volume : 0; // courbe perçue plus naturelle
    const g = this.master.gain;
    const now = T.immediate();
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.getValueAtTime(now), now);
    g.linearRampToValueAtTime(target, now + 0.3);
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

/** Instance unique pour toute l'application */
export const sound = new SoundEngine();
