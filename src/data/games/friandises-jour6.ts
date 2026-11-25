/**
 * Jour 6 — Duel de Saint-Nicolas : attrape les friandises (en direct, ou contre le fantôme de l'autre).
 *
 * Règles décidées avec Alexandre (24 nov) : les deux hottes sous la MÊME pluie, on se dispute
 * les friandises (la première hotte qui la touche la garde) ; le charbon fait perdre un point et
 * ralentit la hotte ; les étoiles dorées ne comptent que si vous les attrapez TOUS LES DEUX
 * (il faut se rejoindre dessous) ; 3 manches de 45 secondes.
 *
 * ALEXANDRE : tu peux régler les valeurs et la difficulté ici, rien d'autre à écrire.
 */

export type TypeFriandise = "sucre" | "papillote" | "pain" | "charbon" | "etoile";

export type FriandisesContent = {
  manches: number;
  /** Secondes par manche */
  secondes: number;
  /** Secondes de pause entre deux manches en direct (scores de la manche) */
  pause: number;
  attenteAvantSolo: number;
  /** Même graine = même pluie pour vous deux */
  graine: number;
  /** Une friandise toutes les N secondes au début, puis toutes les M secondes à la fin */
  intervalleDebut: number;
  intervalleFin: number;
  /** Temps de chute (s) au début et à la fin : la pluie accélère */
  chuteDebut: number;
  chuteFin: number;
  /** Probabilités relatives de chaque friandise */
  frequences: Record<TypeFriandise, number>;
  /** Points ; l'étoile donne ses points à CHACUN, seulement si vous l'avez attrapée tous les deux */
  points: Record<TypeFriandise, number>;
  /** Secondes de ralentissement après un charbon */
  ralentissement: number;
  noms: Record<TypeFriandise, string>;
};

export const FRIANDISES_JOUR6: FriandisesContent = {
  manches: 3,
  secondes: 45,
  pause: 6,
  attenteAvantSolo: 20,
  graine: 20261206,
  intervalleDebut: 0.62,
  intervalleFin: 0.34,
  chuteDebut: 3.4,
  chuteFin: 2.3,
  frequences: { sucre: 34, papillote: 28, pain: 14, charbon: 16, etoile: 8 },
  points: { sucre: 1, papillote: 1, pain: 2, charbon: -1, etoile: 5 },
  ralentissement: 1.5,
  noms: { sucre: "Sucre d'orge", papillote: "Papillote", pain: "Pain d'épices", charbon: "Charbon", etoile: "Étoile dorée" },
};
