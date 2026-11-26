/**
 * Jour 10 — Attrape-flocons dans la tempête (score à battre).
 *
 * ALEXANDRE : toute la difficulté se règle ici, sans toucher au code.
 * Le ciel est tiré au sort à partir de `graine` : avec la même graine, les deux joueurs voient tomber
 * EXACTEMENT les mêmes flocons, glaçons et rafales, au même moment. La comparaison des scores est donc juste.
 * Les vitesses sont en « hauteurs d'écran par seconde » et les rafales en « largeurs par seconde » :
 * la partie a la même difficulté sur téléphone et sur ordinateur.
 */

export type FloconsContent = {
  /** Change la graine = change la tempête (la même pour les deux joueurs !) */
  graine: number;
  /** Durée de la partie, en secondes (elle s'arrête plus tôt si toutes les vies sont perdues) */
  duree: number;
  /** Glaçons qu'on peut attraper avant la fin de la partie */
  vies: number;
  /** Points d'un flocon et d'un flocon doré (multipliés par la série en cours) */
  pointsFlocon: number;
  pointsDore: number;
  /** Plafond du multiplicateur de série (chaque flocon attrapé d'affilée ajoute ×0,1) */
  comboMax: number;
  /** Bonus par vie restante quand on tient jusqu'au bout */
  bonusVie: number;
  /** Nombre d'objets qui tombent par seconde, au début et à la fin (la tempête monte) */
  cadenceDepart: number;
  cadenceFin: number;
  /** Vitesse de chute au début et à la fin */
  vitesseDepart: number;
  vitesseFin: number;
  /** Part de glaçons parmi les objets, au début et à la fin */
  partGlaconsDepart: number;
  partGlaconsFin: number;
  /** Part de flocons dorés (rares, et ils tombent plus vite) */
  partDores: number;
  /** Rafales : combien dans la partie, combien de temps chacune (s), et leur force */
  rafales: number;
  dureeRafale: number;
  forceRafale: number;
};

export const FLOCONS_JOUR10: FloconsContent = {
  graine: 1012,
  duree: 90,
  vies: 3,
  pointsFlocon: 10,
  pointsDore: 80,
  comboMax: 3,
  bonusVie: 150,
  cadenceDepart: 1.3,
  cadenceFin: 3.1,
  vitesseDepart: 0.24,
  vitesseFin: 0.46,
  partGlaconsDepart: 0.1,
  partGlaconsFin: 0.3,
  partDores: 0.045,
  rafales: 6,
  dureeRafale: 3.2,
  forceRafale: 0.2,
};

/** Répliques de Pingou pendant et après la partie */
export const FLOCONS_LIGNES = {
  depart: "Panier en main… c'est parti !",
  rafale: "Rafale !",
  glacon: ["Aïe, un glaçon !", "Pas les glaçons !", "Encore un et c'est fini…"],
  dore: "Flocon doré !",
  serie: "Série de {n} !",
  moitie: "La tempête se lève…",
  finale: "Plus que 10 secondes !",
  depasse: "Tu viens de passer devant {autre} 😏",
  tenu: "Tu as tenu toute la tempête, bravo ! 🎉",
  perdu: "Trop de glaçons… mais tu peux recommencer autant que tu veux 😊",
};
