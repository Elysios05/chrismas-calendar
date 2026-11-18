/**
 * Jour 15 — Le pendu du bonhomme qui fond.
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `mot`    : en majuscules ou non, peu importe. Les accents sont gérés : taper E révèle les É et È,
 *               donc « PAIN D'ÉPICES » se joue sans piège. Les espaces et apostrophes sont offerts.
 *  - `indice` : la phrase que Pingou lâche après 3 erreurs. Garde-la courte et utile.
 *  - `perso`  : vrai pour vos mots à vous (le jeu annonce « à vous deux » plutôt que « mot de Noël »,
 *               pour qu'on ne cherche pas un mot de Noël pendant trois minutes).
 *
 * Évite les mots de plus de 18 lettres : la grille devient illisible sur un téléphone.
 */

export type MotPendu = { mot: string; indice: string; perso?: boolean };

export type PenduContent = {
  /** Morceaux du bonhomme = nombre d'erreurs permises */
  morceaux: number;
  /** Mots tirés par partie */
  motsParPartie: number;
  /** Même graine = mêmes mots pour vous deux, donc scores comparables */
  graine: number;
  /** Points d'un mot trouvé, moins ce que coûte chaque erreur */
  pointsMot: number;
  coutErreur: number;
  /** Après combien d'erreurs Pingou donne l'indice */
  erreursAvantIndice: number;
  mots: MotPendu[];
};

export const PENDU_JOUR15: PenduContent = {
  morceaux: 7,
  motsParPartie: 3,
  graine: 1512,
  pointsMot: 100,
  coutErreur: 15,
  erreursAvantIndice: 3,
  mots: [
    // --- Noël ---
    { mot: "GUIRLANDE", indice: "Ça clignote et ça s'emmêle toujours." },
    { mot: "PAIN D'ÉPICES", indice: "Ça sent la cannelle et le miel." },
    { mot: "BOULE À NEIGE", indice: "On la secoue et il neige dedans." },
    { mot: "TRAÎNEAU", indice: "Il décolle le 24 au soir." },
    { mot: "CHOCOLAT CHAUD", indice: "La boisson des doigts gelés." },
    { mot: "PATINOIRE", indice: "On y tombe élégamment." },
    { mot: "CASSE-NOISETTE", indice: "Un ballet, et un soldat en bois." },
    { mot: "MARRONS CHAUDS", indice: "Ça se vend au coin de la rue en décembre." },

    // --- À vous deux (à remplacer par vos vrais mots) ---
    { mot: "LJUBLJANA", indice: "Là où l'un de vous se réveille le matin.", perso: true },
    { mot: "NOTRE PREMIER NOËL", indice: "Ce que vous fêtez cette année.", perso: true },
    { mot: "APPEL DU SOIR", indice: "Tous les jours, et toujours trop court.", perso: true },
    { mot: "VALISE", indice: "L'objet des retrouvailles… et des départs.", perso: true },
    { mot: "RACLETTE", indice: "Le plat qui vous réconcilie avec l'hiver.", perso: true },
    { mot: "DÉCALAGE", indice: "Une heure de trop entre vous deux.", perso: true },
  ],
};

/** Mots de Pingou à la fin, selon le nombre de mots trouvés */
export const PENDU_VERDICTS: { min: number; ligne: string }[] = [
  { min: 3, ligne: "Trois sur trois, et pas une goutte d'eau. Le bonhomme te remercie ⛄" },
  { min: 2, ligne: "Deux sur trois ! Il a un peu fondu, mais il tient debout." },
  { min: 1, ligne: "Un mot sauvé. Le bonhomme, lui, a connu des jours meilleurs…" },
  { min: 0, ligne: "Une flaque. Il ne reste qu'une flaque. Bravo 🫠" },
];
