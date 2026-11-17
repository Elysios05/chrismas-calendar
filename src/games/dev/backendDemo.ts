/**
 * Faux backend, UNIQUEMENT pour l'atelier de test des jeux (jeux.html).
 * Le vrai mode démo est le travail de l'équipe Backend (src/backend/) : on code contre
 * l'interface BackendApi, ce fichier n'existe que pour pouvoir jouer avant qu'il soit prêt.
 */

import type { BackendApi, DayNumber, PreparedResult, RealtimeRoom, Who } from "../../core/contracts";

const CLE = "jeux-atelier";

type Donnees = { etats: Record<string, unknown>; progres: Record<string, DayNumber[]> };

function lire(): Donnees {
  try { return JSON.parse(localStorage.getItem(CLE) ?? "") as Donnees; } catch { return { etats: {}, progres: {} }; }
}
function ecrire(d: Donnees) {
  try { localStorage.setItem(CLE, JSON.stringify(d)); } catch { /* stockage indisponible */ }
}

export function creerBackendAtelier(moi: Who): BackendApi {
  return {
    mode: "demo",
    me: async () => moi,
    signIn: async () => { /* rien à faire en atelier */ },
    signOut: async () => { /* rien à faire en atelier */ },
    onAuthChange: () => () => { /* pas de changement de session */ },
    today: async () => 24,
    getProgress: async (qui) => {
      const d = lire();
      return { opened: d.progres[`o:${qui}`] ?? [], completed: d.progres[`c:${qui}`] ?? [] };
    },
    markOpened: async (jour) => {
      const d = lire(); const k = `o:${moi}`;
      d.progres[k] = [...new Set([...(d.progres[k] ?? []), jour])]; ecrire(d);
    },
    markCompleted: async (jour) => {
      const d = lire(); const k = `c:${moi}`;
      d.progres[k] = [...new Set([...(d.progres[k] ?? []), jour])]; ecrire(d);
    },
    getPrepared: async (): Promise<PreparedResult> => ({ status: "empty" }),
    savePrepared: async () => { /* hors sujet pour les jeux */ },
    uploadPhoto: async () => "",
    getGameState: async <T>(jour: DayNumber, cle: string) => (lire().etats[`${jour}/${cle}`] as T) ?? null,
    setGameState: async (jour, cle, valeur) => {
      const d = lire(); d.etats[`${jour}/${cle}`] = valeur; ecrire(d);
    },
    joinRoom: (): RealtimeRoom => ({
      send: () => { /* pas de temps réel en atelier */ },
      on: () => () => { /* rien */ },
      presence: (cb) => { cb([moi]); return () => { /* rien */ }; },
      leave: () => { /* rien */ },
    }),
  };
}

/** Efface les scores et réponses enregistrés par l'atelier */
export function viderAtelier() {
  try { localStorage.removeItem(CLE); } catch { /* stockage indisponible */ }
}
