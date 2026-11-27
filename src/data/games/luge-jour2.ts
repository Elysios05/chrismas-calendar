/**
 * Jour 2 — Descente en luge (score à battre).
 *
 * ALEXANDRE : tu peux régler toute la difficulté ici, sans toucher au code.
 * La piste est tirée au sort à partir de `graine` : avec la même graine, Flavie et toi
 * descendez EXACTEMENT la même piste. C'est ce qui rend la comparaison des scores juste.
 */

export type LugeContent = {
  /** Change la graine = change la piste (garde la même pour vous deux !) */
  graine: number;
  /** Longueur de la descente, en mètres */
  longueur: number;
  /** Vitesse de départ et vitesse maximale, en mètres par seconde */
  vitesseDepart: number;
  vitesseMax: number;
  /** Temps (secondes) pour atteindre la vitesse maximale */
  tempsAcceleration: number;
  /** Nombre de chocs permis avant la fin de la partie */
  chocsPermis: number;
  /** Points par cadeau ramassé, et plafond du combo */
  pointsCadeau: number;
  comboMax: number;
  /** Bonus d'arrivée, et bonus par choc épargné */
  bonusArrivee: number;
  bonusVie: number;
  /** Distance entre deux rangées d'obstacles au début / à la fin (mètres) */
  ecartRangeeDepart: number;
  ecartRangeeFin: number;
};

export const LUGE_JOUR2: LugeContent = {
  graine: 2512,
  longueur: 1900,
  vitesseDepart: 11,
  vitesseMax: 23,
  tempsAcceleration: 95,
  chocsPermis: 3,
  pointsCadeau: 100,
  comboMax: 3,
  bonusArrivee: 300,
  bonusVie: 200,
  ecartRangeeDepart: 34,
  ecartRangeeFin: 21,
};

/** Répliques de Pingou pendant et après la descente */
export const LUGE_LIGNES = {
  regles: [
    "La route du col s'arrête ici : à partir de maintenant, on descend 🛷",
    "Glisse ton doigt (ou les flèches ←→) pour diriger la luge. Évite les sapins et les rochers, ramasse les cadeaux !",
    "Tu as droit à trois chocs. Au troisième, la luge finit dans la poudreuse… et la partie s'arrête.",
  ],
  depart: "Accroche-toi !",
  choc: ["Aïe !", "Attention aux sapins !", "Encore un comme ça et c'est fini…"],
  dernierChoc: "Plus de luge. Mais tu peux recommencer autant que tu veux 😊",
  arrivee: "Te voilà en bas sans une égratignure, bravo ! 🎉",
  depasse: "Tu viens de passer devant {autre} 😏",
  moitie: "Moitié de la descente ! Ça va vite, hein ?",
};
