/**
 * Rendu hors ligne (Tone.Offline) d'une ambiance ou des effets, en WAV.
 * Sert à la page de démo et à fabriquer les extraits à faire écouter.
 */
import * as T from "tone";
import type { ZoneId } from "../core/contracts";
import { AmbienceRunner } from "./ambience";
import { GAMES } from "./pieces/games";
import { JINGLES } from "./pieces/jingles";
import { WORLDS } from "./pieces/worlds";
import { PieceRunner } from "./runner";
import { SfxBank, SFX_LIST, type SfxName } from "./sfx";
import type { PieceDef } from "./types";

export const ALL_PIECES: Record<string, PieceDef> = { ...WORLDS, ...GAMES };

/** Rend `seconds` secondes d'un morceau (avec un fondu de sortie de 2 s) */
export async function renderPiece(id: string, night: boolean, seconds: number, fadeOut = 2, solo?: string[]): Promise<AudioBuffer> {
  const base = ALL_PIECES[id];
  // `solo` : n'écouter que certains instruments (aide au mixage)
  const def: PieceDef = solo
    ? { ...base, instruments: Object.fromEntries(Object.entries(base.instruments).filter(([k]) => solo.includes(k))) }
    : base;
  const buf = await T.Offline(() => {
    const limiter = new T.Limiter(-1.5).toDestination();
    const runner = new PieceRunner(T, def, night, limiter);
    runner.start(0, 0);
    if (fadeOut > 0) runner.fadeOut(seconds - fadeOut, fadeOut);
    runner.pump(seconds, 0);
  }, seconds, 2, 44100);
  return buf.get() as AudioBuffer;
}

/** Rend un jingle d'arrivée (une seule fois, avec sa résonance) */
export async function renderJingle(zone: ZoneId): Promise<AudioBuffer> {
  const def = JINGLES[zone];
  const len = (def.beats * 60) / def.bpm;
  const buf = await T.Offline(() => {
    const limiter = new T.Limiter(-1.5).toDestination();
    const runner = new PieceRunner(T, def, false, limiter);
    runner.start(0.05, 0);
    runner.pump(0.05 + len, 0);
  }, len + 0.3, 2, 44100);
  return buf.get() as AudioBuffer;
}

/** Rend les effets à la suite, un toutes les `gap` secondes */
export async function renderSfx(list: SfxName[] = SFX_LIST, gap = 1.1): Promise<AudioBuffer> {
  const buf = await T.Offline(() => {
    const limiter = new T.Limiter(-1.5).toDestination();
    const bank = new SfxBank(T, limiter);
    list.forEach((s, k) => bank.play(s, 0.2 + k * gap));
  }, 0.4 + list.length * gap, 2, 44100);
  return buf.get() as AudioBuffer;
}

/** Rend les bruitages d'ambiance seuls (avec un fondu d'entrée et de sortie) */
export async function renderAmbience(zone: ZoneId, night: boolean, seconds: number, storm = false, wind = 0.5): Promise<AudioBuffer> {
  const buf = await T.Offline(() => {
    const limiter = new T.Limiter(-1.5).toDestination();
    const amb = new AmbienceRunner(T, zone, night, limiter, { storm, wind });
    amb.start(0, 1);
    amb.fadeOut(seconds - 1.5, 1.5);
    amb.pump(seconds, 0);
  }, seconds, 2, 44100);
  return buf.get() as AudioBuffer;
}

/**
 * Test de robustesse (ticket #30) : rejoue `count` fois l'effet `name` en `span` secondes.
 * Renvoie le nombre d'effets joués, ignorés, et d'exceptions (rattrapées ou non).
 */
export async function stressSfx(name: SfxName, count = 50, span = 0.1) {
  let played = 0;
  let skipped = 0;
  let thrown = 0;
  let caught = 0;
  await T.Offline(() => {
    const bank = new SfxBank(T, T.getDestination());
    for (let k = 0; k < count; k++) {
      try {
        // comme dans le jeu : plusieurs appels dans la même image (16 ms) ont la même heure
        const t = 0.05 + Math.floor((k * span) / count / 0.016) * 0.016;
        if (bank.play(name, t) === null) skipped++;
        else played++;
      } catch {
        thrown++;
      }
    }
    caught = bank.errors;
  }, 0.05 + span + 1.5, 1, 22050);
  return { played, skipped, thrown, caught };
}

/** AudioBuffer → WAV 16 bits */
export function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o: number, s: string) => [...s].forEach((c, k) => data.setUint8(o + k, c.charCodeAt(0)));
  w(0, "RIFF");
  data.setUint32(4, 36 + len * ch * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  w(36, "data");
  data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let k = 0; k < len; k++)
    for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, chans[c][k]));
      data.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  return new Blob([data], { type: "audio/wav" });
}

/** Pour l'automatisation (navigateur sans écran) : WAV en base64 */
export async function wavBase64(buf: AudioBuffer): Promise<string> {
  const bytes = new Uint8Array(await toWav(buf).arrayBuffer());
  let s = "";
  for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(s);
}
