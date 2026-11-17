/**
 * Faux backend, UNIQUEMENT pour les maquettes de l'équipe Interface.
 * À supprimer dès que `createBackend()` (mode démo) arrive de la branche backend/socle.
 */
import type { BackendApi, DayNumber, PreparedResult, Progress, RealtimeRoom, Who } from "../../core/contracts";

export function fakeBackend(opts: { me?: Who | null; motDePasse?: string } = {}): BackendApi {
  let moi: Who | null = opts.me ?? null;
  const attendu = opts.motDePasse ?? "noel";
  const abonnes = new Set<(w: Who | null) => void>();
  const etats = new Map<string, unknown>();
  const progress: Record<Who, Progress> = {
    alexandre: { opened: [1, 2, 3, 4, 5, 6], completed: [1, 2, 3, 4, 5] },
    flavie: { opened: [1, 2, 3, 4, 5, 6, 7], completed: [1, 2, 3, 4, 5, 6, 7] },
  };

  return {
    mode: "demo",
    async me() { return moi; },
    async signIn(who, password) {
      await new Promise((r) => setTimeout(r, 250));
      if (password !== attendu) throw new Error("mot de passe incorrect");
      moi = who;
      abonnes.forEach((cb) => cb(moi));
    },
    async signOut() { moi = null; abonnes.forEach((cb) => cb(null)); },
    onAuthChange(cb) { abonnes.add(cb); return () => abonnes.delete(cb); },
    async today() { return 12 as DayNumber; },
    async getProgress(who) { return progress[who]; },
    async markOpened(day) { if (moi) progress[moi].opened = [...new Set([...progress[moi].opened, day])]; },
    async markCompleted(day) { if (moi) progress[moi].completed = [...new Set([...progress[moi].completed, day])]; },
    async getPrepared(): Promise<PreparedResult> { return { status: "empty" }; },
    async savePrepared() {},
    async uploadPhoto() { return "data:image/gif;base64,R0lGODlhAQABAAAAACw="; },
    async getGameState<T>(day: DayNumber, key: string) { return (etats.get(`${day}/${key}`) as T) ?? null; },
    async setGameState<T>(day: DayNumber, key: string, value: T) { etats.set(`${day}/${key}`, value); },
    joinRoom(): RealtimeRoom {
      return { send() {}, on() { return () => {}; }, presence() { return () => {}; }, leave() {} };
    },
  };
}
