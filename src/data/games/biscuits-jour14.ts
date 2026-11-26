/**
 * Jour 14 — Biscuits de Noël, chacun chez soi, en même temps.
 *
 * Contenu PAR DÉFAUT, générique, pour tous les salons. Le contenu personnel d'un couple vit dans son salon
 * (éditeur du salon ; pour Alexandre et Flavie : src/data/salons/alexandre-flavie.ts).
 *
 * Règles décidées avec Alexandre (26 nov) :
 *  - chacun choisit SA recette (il y en a avec et sans four : Alexandre n'a pas de four, Flavie si) ;
 *  - on cuisine en même temps, étape par étape, et on voit où en est l'autre ;
 *  - les minuteurs (frigo, four…) se voient des deux côtés ;
 *  - à la fin, chacun prend sa fournée en photo ; on découvre celle de l'autre après avoir posté la sienne,
 *    et Pingou décerne un titre à chacun ;
 *  - si l'autre n'est pas là : chacun son tour, la photo l'attend.
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `recettes` : nom, emoji, avec ou sans four, ingrédients, étapes. Une étape qui finit par « [30 min] »
 *                 propose un minuteur de 30 minutes, visible par l'autre.
 *  - `titres`   : les titres que Pingou décerne à la fin (deux différents, un pour chacun).
 *  - `idees`    : exemples de légende pour la photo.
 */

import type { SchemaContenu } from "../../games/shared/contenu";

export type Recette = {
  id: string;
  emoji: string;
  nom: string;
  /** vrai = il faut un four */
  four: boolean;
  /** « 1 h 15 » */
  duree: string;
  /** « une trentaine de sablés » */
  portions: string;
  ingredients: string[];
  /** Une étape qui finit par « [30 min] » propose un minuteur partagé */
  etapes: string[];
};

export type BiscuitsContent = {
  emoji: string;
  titre: string;
  intro: string;
  recettes: Recette[];
  titres: string[];
  idees: string[];
};

export const BISCUITS_JOUR14: BiscuitsContent = {
  emoji: "🍪",
  titre: "Biscuits de Noël, chacun chez soi",
  intro: "Même moment, deux cuisines : on prépare chacun sa fournée et on se tient au courant, étape par étape.",
  recettes: [
    {
      id: "sables",
      emoji: "⭐",
      nom: "Sablés de Noël",
      four: true,
      duree: "1 h 15",
      portions: "une trentaine de sablés",
      ingredients: [
        "250 g de farine",
        "125 g de beurre mou",
        "100 g de sucre",
        "1 œuf",
        "1 sachet de sucre vanillé",
        "1 pincée de sel",
        "100 g de sucre glace (glaçage)",
        "1 c. à soupe de jus de citron (glaçage)",
      ],
      etapes: [
        "Mélange le beurre mou, le sucre, le sucre vanillé et le sel jusqu'à ce que ce soit crémeux.",
        "Ajoute l'œuf, puis la farine petit à petit. Forme une boule sans trop pétrir.",
        "Emballe la pâte dans du film et laisse-la reposer au frigo. [30 min]",
        "Préchauffe le four à 180 °C. Étale la pâte sur 4 mm entre deux feuilles de papier cuisson.",
        "Découpe des étoiles, des sapins, des cœurs… et pose-les sur la plaque.",
        "Enfourne : ils sont prêts quand les bords dorent à peine. [10 min]",
        "Laisse-les refroidir complètement sur une grille. [15 min]",
        "Glaçage : mélange le sucre glace et le citron, puis décore tes sablés !",
      ],
    },
    {
      id: "truffes",
      emoji: "🍫",
      nom: "Truffes au chocolat",
      four: false,
      duree: "1 h 30 (surtout du frigo)",
      portions: "une vingtaine de truffes",
      ingredients: [
        "200 g de chocolat noir",
        "10 cl de crème liquide entière",
        "30 g de beurre",
        "3 c. à soupe de cacao en poudre",
        "Pour l'enrobage, au choix : noix de coco râpée, noisettes concassées, sucre glace",
      ],
      etapes: [
        "Hache le chocolat en petits morceaux et mets-le dans un saladier.",
        "Fais chauffer la crème jusqu'aux premiers frémissements (casserole, ou 1 min au micro-ondes).",
        "Verse la crème chaude sur le chocolat, attends une minute, puis mélange doucement du centre vers les bords.",
        "Ajoute le beurre en morceaux et mélange jusqu'à ce que ce soit bien lisse et brillant.",
        "Couvre et laisse prendre au frigo. [60 min]",
        "Prélève des petites cuillerées de ganache et roule-les vite entre tes paumes.",
        "Roule-les dans le cacao, la coco ou les noisettes : invente ta truffe « signature » !",
        "Encore un petit tour au frigo avant de goûter. [15 min]",
      ],
    },
  ],
  titres: [
    "Toque d'or du Pôle Nord",
    "Prix de la plus belle fournée",
    "Médaille d'or du goûter",
    "Record de farine sur le nez",
    "Prix spécial du jury… gourmand",
    "Grand maître du glaçage",
    "Prix de l'audace sucrée",
    "Diplôme de la cuisine la plus propre (presque)",
  ],
  idees: [
    "Tadaaa ! Ma fournée du jour",
    "Il en reste… pour l'instant 😋",
    "Fait avec amour (et un peu de farine partout)",
  ],
};

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_BISCUITS_JOUR14: SchemaContenu = {
  jour: 14,
  titre: "Jour 14 — Biscuits de Noël, chacun chez soi",
  intro: "Chacun choisit une recette et la prépare chez lui, en même temps que l'autre. Mettez au moins une recette sans four si l'un de vous n'en a pas. Finir une étape par « [30 min] » ajoute un minuteur que l'autre voit aussi.",
  facultatif: true,
  champs: [
    { type: "texte", cle: "intro", label: "Phrase d'accueil", long: true, max: 160, exemple: "Même moment, deux cuisines." },
    {
      type: "liste", cle: "recettes", label: "Recettes", libelleElement: "Recette", min: 1, max: 4,
      modele: { id: "", four: false },
      champs: [
        { type: "texte", cle: "emoji", label: "Emoji", max: 8, exemple: "🍪" },
        { type: "texte", cle: "nom", label: "Nom de la recette", max: 40, exemple: "Sablés de Noël" },
        { type: "case", cle: "four", label: "Il faut un four" },
        { type: "texte", cle: "duree", label: "Durée totale", max: 30, exemple: "1 h 15" },
        { type: "texte", cle: "portions", label: "Quantité", max: 40, exemple: "une trentaine de sablés" },
        { type: "textes", cle: "ingredients", label: "Ingrédients", min: 1, max: 16, maxLongueur: 90, exemple: "250 g de farine" },
        {
          type: "textes", cle: "etapes", label: "Étapes", min: 1, max: 14, maxLongueur: 200,
          aide: "Une étape qui finit par « [30 min] » propose un minuteur de 30 minutes.",
          exemple: "Laisse reposer la pâte au frigo. [30 min]",
        },
      ],
    },
    { type: "textes", cle: "titres", label: "Titres décernés par Pingou", aide: "Un pour chacun, tiré au hasard à la fin.", min: 2, max: 12, maxLongueur: 60, exemple: "Médaille d'or du goûter" },
    { type: "textes", cle: "idees", label: "Idées de légende pour la photo", min: 1, max: 6, maxLongueur: 80, exemple: "Tadaaa ! Ma fournée du jour" },
  ],
};

/** « Laisse reposer… [30 min] » → { texte: « Laisse reposer… », minutes: 30 } */
export function lireEtape(etape: string): { texte: string; minutes: number | null } {
  const m = /\s*\[\s*(\d{1,3})\s*min\s*\]\s*$/i.exec(etape);
  if (!m) return { texte: etape.trim(), minutes: null };
  const minutes = Math.min(240, Math.max(1, Number(m[1])));
  return { texte: etape.slice(0, m.index).trim(), minutes };
}
