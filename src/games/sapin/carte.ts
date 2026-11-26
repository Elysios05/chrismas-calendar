/**
 * Jour 21 — le sapin en miniature sur la carte du monde.
 * Pour le chef (`App.tsx`) : `lireSapinCarte(backend).then((s) => scene.setSapin(s))`,
 * au démarrage et à la fermeture de la fenêtre de la case 21. Léger : une lecture de l'état de la case.
 */

import type { BackendApi } from "../../core/contracts";
import { SAPIN_JOUR21 } from "../../data/games/sapin-jour21";
import { CLE_SAPIN, etatDuJournal, resumeCarte, type ResumeCarte } from "./regles";

export async function lireSapinCarte(backend: BackendApi): Promise<ResumeCarte | null> {
  try {
    const coups = await backend.getGameState<Parameters<typeof etatDuJournal>[0]>(21, CLE_SAPIN);
    if (!Array.isArray(coups) || !coups.length) return null;
    const palette = SAPIN_JOUR21.couleurs.map((c) => c.hex);
    const r = resumeCarte(etatDuJournal(coups, palette.length), palette);
    return r.total ? r : null;
  } catch {
    return null;
  }
}
