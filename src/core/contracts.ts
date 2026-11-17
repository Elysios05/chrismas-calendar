/**
 * Contrats partagés entre les équipes (monde, interface, backend, jeux, audio).
 * Ce fichier appartient au chef de projet : toute modification passe par lui.
 * Chaque équipe code CONTRE ces interfaces, jamais contre l'implémentation d'une autre.
 */

export type Who = "alexandre" | "flavie";
export type DayNumber = number; // 1..24
export type ZoneId = "montagnes" | "saint-nicolas" | "lac" | "marche" | "grotte" | "pole-nord";
export type DayKind = "jeu" | "direct" | "differe" | "prepare" | "photo" | "synchro" | "score";

/* ------------------------------------------------------------------ */
/* Backend (Supabase, ou mode démo en mémoire / localStorage)          */
/* ------------------------------------------------------------------ */

export type PreparedContent = {
  day: DayNumber;
  from: Who;
  to: Who;
  message: string;            // mot doux / lettre
  photos: string[];           // URLs (signées) des photos
  updatedAt: string;
};

export type Progress = { opened: DayNumber[]; completed: DayNumber[] };

/** locked = pas encore le jour J ; empty = rien d'écrit ; ready = contenu disponible */
export type PreparedResult =
  | { status: "locked" }
  | { status: "empty" }
  | { status: "ready"; content: PreparedContent };

export type RealtimeRoom = {
  send: (event: string, payload: unknown) => void;
  on: (event: string, cb: (payload: unknown, from: Who) => void) => () => void;
  presence: (cb: (online: Who[]) => void) => () => void;
  leave: () => void;
};

/** Obtenu via `await createBackend()` (src/backend/index.ts) : asynchrone car Supabase est chargé à la demande */
export interface BackendApi {
  readonly mode: "demo" | "supabase";
  /** Utilisateur connecté (null si personne) */
  me(): Promise<Who | null>;
  signIn(who: Who, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Prévient quand la session change (connexion, déconnexion, expiration) */
  onAuthChange(cb: (who: Who | null) => void): () => void;

  /** Date « serveur » utilisée pour déverrouiller les cases */
  today(): Promise<DayNumber>;

  getProgress(who: Who): Promise<Progress>;
  markOpened(day: DayNumber): Promise<void>;
  markCompleted(day: DayNumber): Promise<void>;

  /** Case préparée : lecture refusée par le serveur avant le jour J (heure d'ouverture : 7 h, Paris) */
  getPrepared(day: DayNumber, to: Who): Promise<PreparedResult>;
  /** Refusé (erreur) si le destinataire a déjà ouvert la case : elle est alors figée */

  savePrepared(day: DayNumber, content: Pick<PreparedContent, "message" | "photos">): Promise<void>;
  uploadPhoto(file: Blob): Promise<string>;

  /** Scores à battre, résultats de jeux, dessins envoyés… (JSON libre par jeu) */
  getGameState<T>(day: DayNumber, key: string): Promise<T | null>;
  setGameState<T>(day: DayNumber, key: string, value: T): Promise<void>;

  /** Salle temps réel pour les jeux en direct */
  joinRoom(roomId: string): RealtimeRoom;
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export type Sfx = "open" | "good" | "bad" | "pop" | "win" | "locked" | "step" | "whoosh";

export interface SoundApi {
  setEnabled(on: boolean): void;
  /** Change d'ambiance musicale (fondu) */
  setZone(zone: ZoneId, night: boolean): void;
  /** Musique spéciale pendant un jeu (null = retour à l'ambiance) */
  setGameMusic(mood: "calm" | "action" | "victory" | null): void;
  play(sfx: Sfx): void;
}

/* ------------------------------------------------------------------ */
/* Jeux                                                                */
/* ------------------------------------------------------------------ */

export type GameResult = { success: boolean; score?: number; data?: unknown };

export type GameContext = {
  day: DayNumber;
  me: Who;
  partner: Who;
  backend: BackendApi;
  sound: SoundApi;
  /** Fait parler Pingou (bulle de dialogue) */
  say: (lines: string[]) => void;
  /** Contenu du jeu (questions, mots…) venant de src/data */
  content: unknown;
  /** À appeler quand le jeu est terminé */
  complete: (result: GameResult) => void;
};

export interface GameModule {
  id: string;
  title: string;
  /** Monte le jeu dans un élément DOM ; renvoie une fonction de nettoyage */
  mount(el: HTMLElement, ctx: GameContext): () => void;
}
