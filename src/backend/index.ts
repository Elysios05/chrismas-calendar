/**
 * Point d'entrée du backend : `await createBackend()`.
 * - Supabase si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies (version privée) ;
 * - sinon le mode démo, entièrement dans le navigateur (version publique).
 * Le paquet Supabase n'est chargé (import dynamique) que si on en a besoin.
 */
import type { BackendApi, Who } from "../core/contracts";
import { DemoBackend } from "./demo";

export { DemoBackend };
export * from "./config";
export { LiveGame, joinLive, dayRoomId, LEADER, type LiveOptions, type LivePhase } from "./realtime";

/**
 * Méthodes EN PLUS du contrat (facultatives), implémentées par les deux backends :
 * « mot de passe oublié ». Usage : `const b = (await createBackend()) as BackendApi & PasswordRecovery`.
 */
export interface PasswordRecovery {
  /** Envoie un e-mail avec un lien pour choisir un nouveau mot de passe. */
  resetPassword(who: Who): Promise<void>;
  /** Vrai si la page a été ouverte depuis ce lien : il faut alors demander un nouveau mot de passe. */
  inPasswordRecovery(): boolean;
  /** Enregistre le nouveau mot de passe (l'utilisateur est connecté par le lien). */
  updatePassword(newPassword: string): Promise<void>;
}

export function hasPasswordRecovery(b: BackendApi): b is BackendApi & PasswordRecovery {
  return typeof (b as Partial<PasswordRecovery>).resetPassword === "function";
}

let instance: Promise<BackendApi> | null = null;

export function backendConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/** Crée (une seule fois) le backend de l'application. */
export function createBackend(): Promise<BackendApi> {
  if (instance) return instance;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  instance = url && key
    ? import("./supabase").then(({ SupabaseBackend }) => new SupabaseBackend(url, key))
    : Promise.resolve(new DemoBackend());
  return instance;
}
