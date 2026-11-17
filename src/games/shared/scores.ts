/**
 * Enregistrement des scores « à battre » via le contrat BackendApi.
 * Clé : `meilleur:<qui>` dans l'état de jeu du jour. Rien de spécifique à un jeu ici.
 */

import type { BackendApi, DayNumber, Who } from "../../core/contracts";

export type Meilleur = { score: number; details?: Record<string, number>; le: string };

const cle = (qui: Who) => `meilleur:${qui}`;

export async function lireMeilleur(backend: BackendApi, jour: DayNumber, qui: Who): Promise<Meilleur | null> {
  try { return await backend.getGameState<Meilleur>(jour, cle(qui)); } catch { return null; }
}

/** N'écrit que si le score est meilleur. Renvoie vrai si c'est un nouveau record. */
export async function enregistrerMeilleur(
  backend: BackendApi, jour: DayNumber, qui: Who, score: number, details?: Record<string, number>,
): Promise<boolean> {
  try {
    const actuel = await lireMeilleur(backend, jour, qui);
    if (actuel && actuel.score >= score) return false;
    await backend.setGameState<Meilleur>(jour, cle(qui), { score, details, le: new Date().toISOString() });
    return true;
  } catch {
    return false; // hors ligne : la partie compte quand même, on ne bloque pas le joueur
  }
}
