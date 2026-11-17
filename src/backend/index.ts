/**
 * Point d'entrée du backend : `await createBackend()`.
 * - Supabase si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies (version privée) ;
 * - sinon le mode démo, entièrement dans le navigateur (version publique).
 * Le paquet Supabase n'est chargé (import dynamique) que si on en a besoin.
 */
import type { BackendApi } from "../core/contracts";
import { DemoBackend } from "./demo";

export { DemoBackend };
export * from "./config";

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
