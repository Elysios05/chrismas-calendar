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
