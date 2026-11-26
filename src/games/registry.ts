/**
 * Registre des jeux : un jour → un GameModule, chargé à la demande.
 *
 * Côté interface / chef de projet, l'usage est :
 *   const module = await chargerJeu(jour);
 *   if (module) { const nettoyer = module.mount(el, ctx); }
 * avec `ctx.content = salon.config.contenu[String(jour)]` (ou undefined : chaque jeu a son contenu par défaut)
 * et `ctx.prenoms` = les prénoms du salon.
 *
 * Éditeur de contenu du salon (Interface) : `schemasDesJeux()` donne, jour par jour, les champs qu'un couple
 * peut personnaliser (forme décrite dans shared/contenu.ts) et `contenuDuJour(jour)` le contenu par défaut
 * qui sert de point de départ. L'éditeur n'enregistre que les champs du schéma.
 */

import type { DayNumber, GameModule } from "../core/contracts";
import type { SchemaContenu } from "./shared/contenu";

export type { SchemaContenu, ChampContenu } from "./shared/contenu";
import { QUIZ_JOUR1, SCHEMA_QUIZ_JOUR1 } from "../data/games/quiz-jour1";
import { LUGE_JOUR2 } from "../data/games/luge-jour2";
import { REBUS_JOUR7, SCHEMA_REBUS_JOUR7 } from "../data/games/rebus-jour7";
import { PENDU_JOUR15, SCHEMA_PENDU_JOUR15 } from "../data/games/pendu-jour15";
import { MOTSCROISES_JOUR17, SCHEMA_MOTSCROISES_JOUR17 } from "../data/games/motscroises-jour17";
import { SYNCHRO_JOUR11, SCHEMA_SYNCHRO_JOUR11 } from "../data/games/synchro-jour11";
import { PHOTO_JOUR3, SCHEMA_PHOTO_JOUR3 } from "../data/games/photo-jour3";
import { PICTIONARY_JOUR5, SCHEMA_PICTIONARY_JOUR5 } from "../data/games/pictionary-jour5";
import { FRIANDISES_JOUR6 } from "../data/games/friandises-jour6";
import { DESSIN_JOUR9, SCHEMA_DESSIN_JOUR9 } from "../data/games/dessin-jour9";
import { FLOCONS_JOUR10 } from "../data/games/flocons-jour10";
import { BONHOMME_JOUR13 } from "../data/games/bonhomme-jour13";
import { TRI_CADEAUX_JOUR22 } from "../data/games/tri-cadeaux-jour22";

type Chargeur = () => Promise<GameModule>;

const JEUX: Partial<Record<DayNumber, Chargeur>> = {
  1: () => import("./quiz/index").then((m) => m.quizJour1),
  2: () => import("./luge/index").then((m) => m.lugeJour2),
  3: () => import("./photo/index").then((m) => m.defiPhotoJour3),
  5: () => import("./pictionary/index").then((m) => m.pictionaryJour5),
  6: () => import("./friandises/index").then((m) => m.friandisesJour6),
  7: () => import("./rebus/index").then((m) => m.rebusJour7),
  9: () => import("./dessin/index").then((m) => m.dessinJour9),
  10: () => import("./flocons/index").then((m) => m.floconsJour10),
  11: () => import("./synchro/index").then((m) => m.synchroJour11),
  13: () => import("./bonhomme/index").then((m) => m.bonhommeJour13),
  15: () => import("./pendu/index").then((m) => m.penduJour15),
  17: () => import("./motscroises/index").then((m) => m.motsCroisesJour17),
  22: () => import("./tri-cadeaux/index").then((m) => m.triCadeauxJour22),
  // les autres jours : à venir (défis photo, en direct, pendu, mots croisés…)
};

/** Contenu par défaut d'un jour (src/data), à passer dans `GameContext.content`. */
const CONTENU: Partial<Record<DayNumber, unknown>> = {
  1: QUIZ_JOUR1,
  2: LUGE_JOUR2,
  3: PHOTO_JOUR3,
  5: PICTIONARY_JOUR5,
  6: FRIANDISES_JOUR6,
  7: REBUS_JOUR7,
  9: DESSIN_JOUR9,
  10: FLOCONS_JOUR10,
  11: SYNCHRO_JOUR11,
  13: BONHOMME_JOUR13,
  15: PENDU_JOUR15,
  17: MOTSCROISES_JOUR17,
  22: TRI_CADEAUX_JOUR22,
};

/** Ce qu'un couple peut personnaliser, par jour. Absent = rien à personnaliser (jeux d'adresse : 2, 6, 10, 13). */
const SCHEMAS: Partial<Record<DayNumber, SchemaContenu>> = {
  1: SCHEMA_QUIZ_JOUR1,
  3: SCHEMA_PHOTO_JOUR3,
  5: SCHEMA_PICTIONARY_JOUR5,
  7: SCHEMA_REBUS_JOUR7,
  9: SCHEMA_DESSIN_JOUR9,
  11: SCHEMA_SYNCHRO_JOUR11,
  15: SCHEMA_PENDU_JOUR15,
  17: SCHEMA_MOTSCROISES_JOUR17,
};

export const schemaDuJour = (jour: DayNumber): SchemaContenu | null => SCHEMAS[jour] ?? null;

/** Tous les schémas, dans l'ordre des cases */
export const schemasDesJeux = (): SchemaContenu[] =>
  (Object.keys(SCHEMAS).map(Number) as DayNumber[]).sort((a, b) => a - b).map((j) => SCHEMAS[j]!);

export const joursAvecJeu = (): DayNumber[] => Object.keys(JEUX).map(Number).sort((a, b) => a - b);

export const aUnJeu = (jour: DayNumber): boolean => jour in JEUX;

export const contenuDuJour = (jour: DayNumber): unknown => CONTENU[jour] ?? null;

export async function chargerJeu(jour: DayNumber): Promise<GameModule | null> {
  const chargeur = JEUX[jour];
  if (!chargeur) return null;
  return await chargeur();
}
