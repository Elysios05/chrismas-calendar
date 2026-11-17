/**
 * Rendu hors ligne (Tone.Offline) d'une ambiance ou des effets, en WAV.
 * Sert à la page de démo et à fabriquer les extraits à faire écouter.
 */
import * as T from "tone";
import type { Sfx } from "../core/contracts";
import { GAMES } from "./pieces/games";
import { WORLDS } from "./pieces/worlds";
import { PieceRunner } from "./runner";
import { SfxBank, SFX_LIST } from "./sfx";
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

/** Rend les effets à la suite, un toutes les `gap` secondes */
export async function renderSfx(list: Sfx[] = SFX_LIST, gap = 1.1): Promise<AudioBuffer> {
  const buf = await T.Offline(() => {
    const limiter = new T.Limiter(-1.5).toDestination();
    const bank = new SfxBank(T, limiter);
    list.forEach((s, k) => bank.play(s, 0.2 + k * gap));
  }, 0.4 + list.length * gap, 2, 44100);
  return buf.get() as AudioBuffer;
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
