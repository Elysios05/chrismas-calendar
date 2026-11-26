/**
 * Jour 22 — Tri des cadeaux sur le tapis roulant de l'atelier (score à battre).
 *
 * ALEXANDRE : toute la difficulté se règle ici, sans toucher au code.
 * Les cadeaux sont tirés au sort à partir de `graine` : avec la même graine, les deux joueurs voient arriver
 * EXACTEMENT les mêmes cadeaux, dans le même ordre, au même moment. La comparaison des scores est donc juste.
 * La vitesse du tapis est en « largeurs de tapis par seconde » : même difficulté sur téléphone et sur ordinateur.
 */

export type TriCadeauxContent = {
  /** Change la graine = change la suite des cadeaux (la même pour les deux joueurs !) */
  graine: number;
  /** Durée de la partie, en secondes (elle s'arrête plus tôt si toutes les erreurs sont faites) */
  duree: number;
  /** Erreurs permises : mauvaise hotte, cadeau tombé du tapis, charbon dans une hotte */
  vies: number;
  /** Points d'un cadeau bien trié (multipliés par la série en cours) et d'un charbon jeté à la poubelle */
  pointsCadeau: number;
  pointsCharbon: number;
  /** Plafond du multiplicateur de série (chaque bon tri d'affilée ajoute ×0,1) */
  comboMax: number;
  /** Bonus par erreur non utilisée quand on tient jusqu'au bout */
  bonusVie: number;
  /** Cadeaux posés sur le tapis par seconde, au début et à la fin */
  cadenceDepart: number;
  cadenceFin: number;
  /** Vitesse du tapis au début et à la fin */
  vitesseDepart: number;
  vitesseFin: number;
  /** Part de charbon parmi les paquets */
  partCharbon: number;
  /** Seconde à laquelle la 4e hotte (cadeaux dorés) s'ouvre */
  quatriemeHotte: number;
};

export const TRI_CADEAUX_JOUR22: TriCadeauxContent = {
  graine: 2212,
  duree: 90,
  vies: 3,
  pointsCadeau: 10,
  pointsCharbon: 15,
  comboMax: 3,
  bonusVie: 150,
  cadenceDepart: 0.55,
  cadenceFin: 1.15,
  vitesseDepart: 0.11,
  vitesseFin: 0.21,
  partCharbon: 0.1,
  quatriemeHotte: 30,
};

/** Répliques de Pingou pendant et après la partie */
export const TRI_CADEAUX_LIGNES = {
  depart: "Les lutins comptent sur toi !",
  erreur: ["Oups, mauvaise hotte !", "Attention aux erreurs !", "Encore une et c'est fini…"],
  tombe: "Un cadeau est tombé !",
  charbonHotte: "Du charbon dans une hotte ?!",
  charbon: "Charbon à la poubelle !",
  nouvelleHotte: "Nouvelle hotte : les cadeaux dorés !",
  serie: "Série de {n} !",
  moitie: "Le tapis accélère…",
  finale: "Plus que 10 secondes !",
  depasse: "Tu viens de passer devant {autre} 😏",
  tenu: "Tous les cadeaux sont triés, bravo ! 🎉",
  perdu: "Trop d'erreurs… mais tu peux recommencer autant que tu veux 😊",
};
