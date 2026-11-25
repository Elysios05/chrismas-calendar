/**
 * Jour 5 — Pictionary de Noël (en direct, ou chacun son tour).
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `noel`  : mots de Noël, faciles à dessiner.
 *  - `nous`  : vos mots à vous (souvenirs, private jokes). Ils sont annoncés « À vous deux »
 *              à celui qui devine, pour qu'il ne cherche pas un mot de Noël.
 *  - `variantes` (facultatif) : autres réponses acceptées (« bonhomme » pour « bonhomme de neige »).
 * À chaque manche, celui qui dessine choisit entre un mot de Noël et un mot « à vous deux ».
 * Il faut au moins 6 mots dans chaque liste (3 dessins chacun). Les accents, majuscules,
 * articles et tirets sont pardonnés quand on devine.
 */

import type { SchemaContenu } from "../../games/shared/contenu";
export type MotADessiner = { mot: string; variantes?: string[] };

export type PictionaryContent = {
  /** Dessins par joueur (manches = 2 × dessins) */
  dessinsParJoueur: number;
  /** Secondes pour dessiner et deviner */
  secondes: number;
  /** Secondes pour choisir son mot (après quoi Pingou choisit le mot de Noël) */
  secondesChoix: number;
  /** Secondes d'attente de l'autre avant de proposer « Jouer quand même » */
  attenteAvantSolo: number;
  /** Même graine = même distribution des mots pour vous deux */
  graine: number;
  noel: MotADessiner[];
  nous: MotADessiner[];
};

export const PICTIONARY_JOUR5: PictionaryContent = {
  dessinsParJoueur: 3,
  secondes: 60,
  secondesChoix: 15,
  attenteAvantSolo: 20,
  graine: 20261205,
  noel: [
    { mot: "Renne", variantes: ["rennes", "caribou"] },
    { mot: "Bonhomme de neige", variantes: ["bonhomme", "bonhomme neige"] },
    { mot: "Cheminée", variantes: ["feu de cheminée"] },
    { mot: "Sucre d'orge", variantes: ["sucre dorge", "canne en sucre"] },
    { mot: "Traîneau", variantes: ["luge"] },
    { mot: "Couronne de l'Avent", variantes: ["couronne"] },
    { mot: "Chaussette", variantes: ["chaussettes", "chaussette de noel"] },
    { mot: "Boule de Noël", variantes: ["boule", "boules"] },
  ],
  // ⚠️ Exemples à remplacer par vos souvenirs et private jokes
  nous: [
    { mot: "Train de nuit", variantes: ["train"] },
    { mot: "Appel vidéo", variantes: ["visio", "facetime", "appel"] },
    { mot: "Valise" },
    { mot: "Aéroport", variantes: ["avion"] },
    { mot: "Carte postale", variantes: ["carte"] },
    { mot: "Pizza du dimanche", variantes: ["pizza"] },
    { mot: "Plaid sur le canapé", variantes: ["plaid", "canape"] },
    { mot: "Billet de retour", variantes: ["billet"] },
  ],
};

const CHAMPS_MOT: SchemaContenu["champs"] = [
  { type: "texte", cle: "mot", label: "Mot à dessiner", max: 40, exemple: "Train de nuit" },
  { type: "textes", cle: "variantes", label: "Autres réponses acceptées", aide: "Facultatif. Accents, majuscules et articles sont déjà pardonnés.", min: 0, max: 6, maxLongueur: 40, exemple: "train" },
];

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_PICTIONARY_JOUR5: SchemaContenu = {
  jour: 5,
  titre: "Jour 5 — Pictionary de Noël",
  intro: "À chaque dessin, on choisit entre un mot de Noël et un mot « à vous deux » (souvenirs, private jokes). Il faut au moins 6 mots dans chaque liste.",
  champs: [
    { type: "liste", cle: "nous", label: "Vos mots à vous", libelleElement: "Mot", min: 6, max: 30, modele: {}, champs: CHAMPS_MOT },
    { type: "liste", cle: "noel", label: "Mots de Noël", libelleElement: "Mot", min: 6, max: 30, modele: {}, champs: CHAMPS_MOT },
  ],
};
