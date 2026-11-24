/**
 * Registre des jeux : un jour → un GameModule, chargé à la demande.
 *
 * Côté interface / chef de projet, l'usage est :
 *   const module = await chargerJeu(jour);
 *   if (module) { const nettoyer = module.mount(el, ctx); }
 * avec `ctx.content = contenuDuJour(jour)` (ou null : chaque jeu a son contenu par défaut).
 */

import type { DayNumber, GameModule } from "../core/contracts";
import { QUIZ_JOUR1 } from "../data/games/quiz-jour1";
import { LUGE_JOUR2 } from "../data/games/luge-jour2";
import { REBUS_JOUR7 } from "../data/games/rebus-jour7";
import { PENDU_JOUR15 } from "../data/games/pendu-jour15";
import { MOTSCROISES_JOUR17 } from "../data/games/motscroises-jour17";
import { SYNCHRO_JOUR11 } from "../data/games/synchro-jour11";
import { PICTIONARY_JOUR5 } from "../data/games/pictionary-jour5";

type Chargeur = () => Promise<GameModule>;

const JEUX: Partial<Record<DayNumber, Chargeur>> = {
  1: () => import("./quiz/index").then((m) => m.quizJour1),
  2: () => import("./luge/index").then((m) => m.lugeJour2),
  5: () => import("./pictionary/index").then((m) => m.pictionaryJour5),
  7: () => import("./rebus/index").then((m) => m.rebusJour7),
  11: () => import("./synchro/index").then((m) => m.synchroJour11),
  15: () => import("./pendu/index").then((m) => m.penduJour15),
  17: () => import("./motscroises/index").then((m) => m.motsCroisesJour17),
  // les autres jours : à venir (défis photo, en direct, pendu, mots croisés…)
};

/** Contenu par défaut d'un jour (src/data), à passer dans `GameContext.content`. */
const CONTENU: Partial<Record<DayNumber, unknown>> = {
  1: QUIZ_JOUR1,
  2: LUGE_JOUR2,
  5: PICTIONARY_JOUR5,
  7: REBUS_JOUR7,
  11: SYNCHRO_JOUR11,
  15: PENDU_JOUR15,
  17: MOTSCROISES_JOUR17,
};

export const joursAvecJeu = (): DayNumber[] => Object.keys(JEUX).map(Number).sort((a, b) => a - b);

export const aUnJeu = (jour: DayNumber): boolean => jour in JEUX;

export const contenuDuJour = (jour: DayNumber): unknown => CONTENU[jour] ?? null;

export async function chargerJeu(jour: DayNumber): Promise<GameModule | null> {
  const chargeur = JEUX[jour];
  if (!chargeur) return null;
  return await chargeur();
}
