/**
 * Faux backend, UNIQUEMENT pour les maquettes de l'équipe Interface.
 * À supprimer dès que `createBackend()` (mode démo) arrive de la branche backend/socle.
 */
import type { BackendApi, DayNumber, PreparedResult, Progress, RealtimeRoom, Who } from "../../core/contracts";

const FAUSSE_LETTRE = `Il est six heures et il fait encore nuit ici, alors je t'écris avec la lampe de la cuisine.
Je repense à ce soir de février où on a raté le dernier bus et marché une heure sous la neige en riant comme des idiots. Tu avais les cheveux pleins de flocons.
Plus que douze jours. Je compte.`;

/** Petites images dessinées en SVG : pas de fichiers à charger dans les maquettes. */
const photo = (ciel: string, sol: string, forme: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${ciel}"/><path d="M0 84h120v36H0z" fill="${sol}"/>${forme}</svg>`,
  );

const FAUSSES_PHOTOS = [
  photo("#9cc5e8", "#f2f7fc", '<path d="M18 86 46 40 74 86z" fill="#d8e7f4"/><path d="M46 40 60 63 40 63z" fill="#fff"/><circle cx="92" cy="30" r="12" fill="#ffe9a8"/>'),
  photo("#30406e", "#e9f0f8", '<circle cx="86" cy="32" r="13" fill="#fff5d6"/><path d="M20 86 32 54 44 86z" fill="#1f5f4d"/><path d="M56 86 70 48 84 86z" fill="#27705a"/>'),
  photo("#f3c9b0", "#fff", '<rect x="34" y="34" width="52" height="52" rx="6" fill="#fff" stroke="#d9354b" stroke-width="5"/><path d="M60 46v28M46 60h28" stroke="#d9354b" stroke-width="5"/>'),
];

export function fakeBackend(
  opts: { me?: Who | null; motDePasse?: string; prepared?: "ready" | "empty" } = {},
): BackendApi {
  let depose = 0;
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
    async getPrepared(day, to): Promise<PreparedResult> {
      await new Promise((r) => setTimeout(r, 200));
      if (opts.prepared === "empty") return { status: "empty" };
      return {
        status: "ready",
        content: {
          day,
          from: to === "alexandre" ? "flavie" : "alexandre",
          to,
          message: FAUSSE_LETTRE,
          photos: FAUSSES_PHOTOS,
          updatedAt: new Date().toISOString(),
        },
      };
    },
    async savePrepared() {},
    async uploadPhoto() {
      await new Promise((r) => setTimeout(r, 300));
      return FAUSSES_PHOTOS[depose++ % FAUSSES_PHOTOS.length]!;
    },
    async getGameState<T>(day: DayNumber, key: string) { return (etats.get(`${day}/${key}`) as T) ?? null; },
    async setGameState<T>(day: DayNumber, key: string, value: T) { etats.set(`${day}/${key}`, value); },
    joinRoom(): RealtimeRoom {
      return { send() {}, on() { return () => {}; }, presence() { return () => {}; }, leave() {} };
    },
  };
}
