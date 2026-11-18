/**
 * Jour 17 — Mots croisés de votre histoire.
 *
 * ALEXANDRE : la grille n'est PAS dessinée à la main. Le code la construit à partir de cette liste,
 * en cherchant les croisements. Tu peux donc remplacer les mots sans rien casser.
 *  - `mot`        : un seul mot, sans espace ni tiret. Les accents sont ignorés dans la grille
 *                   (NOËL se joue NOEL), tu peux donc l'écrire normalement.
 *  - `definition` : courte, elle s'affiche en entier sur un téléphone.
 *  - `perso`      : vrai pour vos mots à vous. Le tirage alterne un mot de Noël, un mot à vous.
 *
 * Donne-moi au moins 12 mots pour que la grille ait le choix : 8 seulement seront retenus,
 * et des mots de 4 à 9 lettres se croisent beaucoup mieux que des mots très longs ou très courts.
 */

export type MotCroise = { mot: string; definition: string; perso?: boolean };

export type MotsCroisesContent = {
  /** Mots retenus pour une grille */
  motsParGrille: number;
  /** Même graine = même grille pour vous deux, donc scores comparables */
  graine: number;
  /** Points par mot trouvé et coût d'une lettre révélée */
  pointsMot: number;
  coutLettre: number;
  mots: MotCroise[];
};

export const MOTSCROISES_JOUR17: MotsCroisesContent = {
  motsParGrille: 8,
  graine: 1712,
  pointsMot: 100,
  coutLettre: 25,
  mots: [
    // --- Noël ---
    { mot: "GUIRLANDE", definition: "Elle clignote et s'emmêle" },
    { mot: "CANNELLE", definition: "L'épice qui sent décembre" },
    { mot: "TRAINEAU", definition: "Il décolle le 24 au soir" },
    { mot: "SAPIN", definition: "On le décore, il perd ses aiguilles" },
    { mot: "PATINS", definition: "Pour glisser sur le lac gelé" },
    { mot: "MARRONS", definition: "Chauds, au coin de la rue" },
    { mot: "ETOILE", definition: "Tout en haut du sapin" },
    { mot: "NEIGE", definition: "Ce qu'on espère le 25 au matin" },

    // --- À vous deux (à remplacer par vos vrais mots) ---
    { mot: "LJUBLJANA", definition: "La ville où l'un se réveille", perso: true },
    { mot: "TRAIN", definition: "Ce qu'on prend pour se retrouver", perso: true },
    { mot: "JUILLET", definition: "Le mois de votre rencontre", perso: true },
    { mot: "RACLETTE", definition: "Le plat des retrouvailles", perso: true },
    { mot: "MINUIT", definition: "L'heure de l'appel qui s'éternise", perso: true },
    { mot: "VALISE", definition: "Toujours à moitié défaite", perso: true },
    { mot: "DECALAGE", definition: "L'heure de trop entre vous", perso: true },
  ],
};

/** Mots de Pingou à la fin, selon le nombre de mots trouvés */
export const MOTSCROISES_VERDICTS: { min: number; ligne: string }[] = [
  { min: 8, ligne: "Grille entière, et sans y passer la nuit. Chapeau 🎩" },
  { min: 6, ligne: "Presque tout ! Il en restait deux pour la forme." },
  { min: 4, ligne: "La moitié de la grille : honnête, mais il reste du travail." },
  { min: 1, ligne: "Un début de grille… la prochaine fois, prends un chocolat chaud avec." },
  { min: 0, ligne: "Grille vide. Même moi j'aurais trouvé « SAPIN » 🐧" },
];
