/**
 * Jour 7 — Rébus en emojis.
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `emojis`   : la suite d'emojis affichée en grand (2 à 4, c'est le plus lisible)
 *  - `reponse`  : écris-la normalement, avec accents et article. La correction est tolérante :
 *                 accents, majuscules, article (le/la/les/un/du…), tirets, apostrophes et espaces
 *                 en trop sont pardonnés. « Buche de noel » est accepté pour « la bûche de Noël ».
 *  - `variantes`: autres façons de dire la même chose, si tu en vois (facultatif)
 *  - `indice`   : la phrase que Pingou lâche si on sèche vraiment (facultatif)
 *
 * Les quatre dernières sont « à vous deux » : c'est là que tu mets vos souvenirs et vos private jokes.
 * Évite les réponses de plus de quatre mots : on les tape au doigt sur un téléphone.
 */

import type { SchemaContenu } from "../../games/shared/contenu";
export type Rebus = {
  id: string;
  emojis: string;
  reponse: string;
  variantes?: string[];
  indice?: string;
};

export type RebusContent = {
  /** Points pour une réponse trouvée sans aide */
  pointsTrouve: number;
  /** Points retirés par lettre révélée (jamais en dessous de `pointsMini`) */
  coutLettre: number;
  pointsMini: number;
  enigmes: Rebus[];
};

export const REBUS_JOUR7: RebusContent = {
  pointsTrouve: 100,
  coutLettre: 20,
  pointsMini: 20,
  enigmes: [
    // --- Noël ---
    { id: "buche", emojis: "🍫🪵", reponse: "la bûche de Noël", variantes: ["bûche"], indice: "Ça se mange, et ça ne brûle pas." },
    { id: "etoile", emojis: "⭐🌲", reponse: "l'étoile du sapin", variantes: ["étoile de Noël"], indice: "Tout en haut, et c'est toujours la galère à poser." },
    { id: "chaussette", emojis: "🧦🔥", reponse: "la chaussette sur la cheminée", variantes: ["chaussette de Noël", "la chaussette"], indice: "On l'accroche la veille, on la vide le matin." },
    { id: "bonhomme", emojis: "☃️🥕", reponse: "le nez du bonhomme de neige", variantes: ["le bonhomme de neige", "carotte"], indice: "Un légume qui sert de visage." },

    // --- À vous deux (à remplacer par vos vraies histoires) ---
    { id: "distance", emojis: "✈️💻❤️", reponse: "l'amour à distance", variantes: ["amour longue distance", "la distance"], indice: "C'est toute notre année, ça." },
    { id: "raclette", emojis: "🧀🥔♨️", reponse: "la raclette", variantes: ["soirée raclette"], indice: "Le plat qui vous réconcilie avec l'hiver." },
    { id: "film", emojis: "🎬🛋️🍿", reponse: "la soirée film", variantes: ["soirée cinéma", "notre soirée film"], indice: "Chacun chez soi, mais on appuie sur « lecture » en même temps." },
    { id: "appel", emojis: "📞🌙", reponse: "l'appel du soir", variantes: ["le coup de fil du soir", "appel du soir"], indice: "Tous les jours, et souvent trop court." },
  ],
};

/** Mots de Pingou selon le nombre de rébus trouvés sur 8 */
export const REBUS_VERDICTS: { min: number; ligne: string }[] = [
  { min: 8, ligne: "Les huit ! Chez vous, on parle emoji couramment 🧩" },
  { min: 6, ligne: "Joli score ! Il en reste deux pour te vexer tranquillement." },
  { min: 4, ligne: "La moitié : honorable. Les autres, c'était un peu tordu, je l'avoue." },
  { min: 1, ligne: "C'est un début… Pingou te laisse une revanche quand tu veux." },
  { min: 0, ligne: "Zéro. Même moi je suis gêné. On recommence ? 🐧" },
];

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_REBUS_JOUR7: SchemaContenu = {
  jour: 7,
  titre: "Jour 7 — Rébus en emojis",
  intro: "Une suite d'emojis, une réponse à taper. Mets-y vos souvenirs et vos private jokes ; la correction pardonne accents, majuscules et articles.",
  champs: [
    {
      type: "liste", cle: "enigmes", label: "Rébus", libelleElement: "Rébus", min: 3, max: 20, modele: { id: "" },
      champs: [
        { type: "texte", cle: "emojis", label: "Emojis", aide: "2 à 4, c'est le plus lisible.", max: 24, exemple: "🍫🪵" },
        { type: "texte", cle: "reponse", label: "Réponse", aide: "Quatre mots au plus : on la tape au doigt.", max: 40, exemple: "la bûche de Noël" },
        { type: "textes", cle: "variantes", label: "Autres réponses acceptées", min: 0, max: 6, maxLongueur: 40, exemple: "bûche" },
        { type: "texte", cle: "indice", label: "Indice de Pingou", max: 100, facultatif: true, exemple: "Ça se mange, et ça ne brûle pas." },
      ],
    },
  ],
};
