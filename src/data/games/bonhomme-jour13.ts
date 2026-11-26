/**
 * Jour 13 — Bonhomme de neige à deux (en direct, ou chacun sa moitié).
 *
 * Règles décidées avec Alexandre (26 nov) :
 *  1. ROULER (30 s) : chacun roule sa boule dans la neige avec le doigt. Place 2 fait le corps, place 1 la tête.
 *     Pingou note l'empilement : taille, tailles assorties (la tête ≈ 2/3 du corps) et boules bien rondes.
 *  2. DÉCORER à deux le même bonhomme (carotte, charbon, écharpe, bonnet…), en voyant les objets de l'autre arriver.
 *  Fin : le bonhomme en souvenir + un score commun.
 *  Si l'autre n'est pas là : chacun fait sa moitié, l'autre termine le bonhomme plus tard.
 *
 * Jeu d'adresse : rien à personnaliser dans le salon. ALEXANDRE : tu peux régler les valeurs ici.
 */

export type TypeDeco =
  | "charbon" | "carotte" | "bouton" | "branche"
  | "echarpe" | "bonnet" | "chapeau" | "etoile" | "gant" | "noeud" | "clochette" | "lunettes";

export type Deco = {
  type: TypeDeco;
  nom: string;
  /** Emoji affiché (absent = dessiné par le jeu : charbon, branche, écharpe, bonnet) */
  emoji?: string;
  /** Taille, en fraction du rayon de la boule sur laquelle l'objet est posé */
  taille: number;
};

export type BonhommeContent = {
  /** Secondes pour rouler sa boule */
  secondesRouler: number;
  attenteAvantSolo: number;
  /** Même graine = même champ de neige pour vous deux */
  graine: number;
  /** Rayon (cm) d'une boule au départ, et rayon que permet une neige parfaite */
  rayonDepart: number;
  rayonMax: number;
  /** Rapport tête / corps idéal */
  rapportIdeal: number;
  /** Tête conseillée si la personne qui fait la tête roule avant que le corps existe */
  teteConseillee: number;
  /** Objets que chacun peut poser au plus */
  objetsParPersonne: number;
  /** Points (total 1 000) */
  points: { taille: number; assortiment: number; rondeur: number; parElement: number; aDeux: number };
  decos: Deco[];
};

export const BONHOMME_JOUR13: BonhommeContent = {
  secondesRouler: 30,
  attenteAvantSolo: 20,
  graine: 1312,
  rayonDepart: 8,
  rayonMax: 62,
  rapportIdeal: 0.66,
  teteConseillee: 28,
  objetsParPersonne: 14,
  // construction 500 (150 + 200 + 150) + décoration 500 (7 éléments × 60 + 80 si vous avez décoré tous les deux)
  points: { taille: 150, assortiment: 200, rondeur: 150, parElement: 60, aDeux: 80 },
  decos: [
    { type: "charbon", nom: "Charbon", taille: 0.11 },
    { type: "carotte", nom: "Carotte", emoji: "🥕", taille: 0.55 },
    { type: "bouton", nom: "Bouton", emoji: "🔴", taille: 0.16 },
    { type: "branche", nom: "Bras", taille: 0.9 },
    { type: "echarpe", nom: "Écharpe", taille: 1.05 },
    { type: "bonnet", nom: "Bonnet", taille: 0.8 },
    { type: "chapeau", nom: "Chapeau", emoji: "🎩", taille: 0.85 },
    { type: "gant", nom: "Moufle", emoji: "🧤", taille: 0.3 },
    { type: "noeud", nom: "Nœud", emoji: "🎀", taille: 0.3 },
    { type: "lunettes", nom: "Lunettes", emoji: "🕶️", taille: 0.6 },
    { type: "clochette", nom: "Clochette", emoji: "🔔", taille: 0.26 },
    { type: "etoile", nom: "Étoile", emoji: "⭐", taille: 0.3 },
  ],
};
