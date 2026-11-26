/**
 * Jour 19 — Défi photo croisé : ta déco de Noël.
 *
 * Même jeu que le jour 3 (src/games/photo/), autre contenu. Contenu PAR DÉFAUT, générique, pour tous les salons.
 * Le contenu personnel d'un couple vit dans son salon (pour Alexandre et Flavie : src/data/salons/alexandre-flavie.ts).
 *
 * Décidé avec Alexandre (26 nov) :
 *  - la déco peut être n'importe où : chez soi, dans la rue, une vitrine, chez quelqu'un ;
 *  - questions : un mélange « coulisses » (où, qui l'a installée, combien de temps devant) et « souvenirs »
 *    (ce que ça rappelle, depuis quand on connaît l'endroit) — réponses invisibles sur la photo ;
 *  - mode démo : la photo de l'autre est un sapin décoré dessiné (src/games/photo/exemple.ts).
 *
 * Les champs sont expliqués dans photo-jour3.ts.
 */

import type { SchemaContenu } from "../../games/shared/contenu";
import type { PhotoContent } from "./photo-jour3";

export const PHOTO_JOUR19: PhotoContent = {
  emoji: "🎄",
  titre: "Ta déco de Noël",
  consigne:
    "Prends en photo la plus belle déco de Noël que tu croises aujourd'hui : chez toi, dans la rue, dans une vitrine… tout compte !",
  idees: [
    "Celle-ci m'a fait penser à toi",
    "Ma déco préférée du jour",
    "Imagine-nous devant, tous les deux",
  ],
  questions: [
    { id: "ou", texte: "Où est-ce que j'ai trouvé cette déco ?", options: ["Chez moi", "Dans la rue", "Dans un magasin", "Chez quelqu'un"] },
    { id: "qui", texte: "Qui l'a installée, d'après toi ?", options: ["Moi", "Quelqu'un que je connais", "Un inconnu", "La ville"] },
    { id: "temps", texte: "Combien de temps je suis resté·e devant ?", options: ["Quelques secondes", "Une minute", "Plusieurs minutes", "Je suis revenu·e exprès"] },
    { id: "rappelle", texte: "Qu'est-ce que ça me rappelle ?", options: ["Mon enfance", "Un Noël avec toi", "Un film de Noël", "Rien, c'est juste joli"] },
    { id: "depuis", texte: "Depuis quand je connais cet endroit ?", options: ["Je viens de le découvrir", "Quelques mois", "Des années", "Depuis toujours"] },
  ],
  exemple: { legende: "Il ne manque plus que toi sous le sapin 🎁", question: "rappelle", reponse: 1 },
};

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_PHOTO_JOUR19: SchemaContenu = {
  jour: 19,
  titre: "Jour 19 — Défi photo croisé",
  intro: "Chacun photographie une déco de Noël, choisit une question et donne sa vraie réponse ; l'autre la devine en découvrant la photo. Choisis des questions dont la réponse ne se voit pas sur la photo.",
  champs: [
    { type: "texte", cle: "emoji", label: "Emoji", max: 8, exemple: "🎄" },
    { type: "texte", cle: "titre", label: "Titre du défi", max: 40, exemple: "Ta déco de Noël" },
    { type: "texte", cle: "consigne", label: "Consigne", long: true, max: 160, exemple: "Prends en photo la plus belle déco de Noël que tu croises aujourd'hui." },
    { type: "textes", cle: "idees", label: "Idées de légende", aide: "Proposées en gris dans le champ.", min: 1, max: 6, maxLongueur: 80, exemple: "Ma déco préférée du jour" },
    {
      type: "liste", cle: "questions", label: "Questions à deviner", libelleElement: "Question", min: 2, max: 8, modele: { id: "" },
      champs: [
        { type: "texte", cle: "texte", label: "Question", max: 100, exemple: "Où est-ce que j'ai trouvé cette déco ?" },
        { type: "textes", cle: "options", label: "Réponses possibles", min: 2, max: 4, maxLongueur: 40, exemple: "Dans la rue" },
      ],
    },
  ],
};
