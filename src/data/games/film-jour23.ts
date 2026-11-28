/**
 * Jour 23 — Film de Noël lancé au même moment (activité synchronisée).
 *
 * Contenu PAR DÉFAUT, générique, pour tous les salons. Le contenu propre à un couple vit dans son salon
 * (éditeur du salon ; jamais dans le dépôt, voir docs/salons.md).
 *
 * Règles décidées avec Alexandre (28 nov) :
 *  - vote à deux : chaque personne coche les films qui lui plaisent (et peut en ajouter un) ;
 *    un film coché des deux côtés gagne, Pingou tire au sort en cas d'égalité ;
 *  - 3-2-1 pour appuyer sur lecture ensemble, chrono commun, pause commune (la reprise refait un 3-2-1),
 *    réactions en emojis qui s'envolent chez l'autre ;
 *  - à la fin, chaque personne note le film (1 à 5 étoiles + une phrase) ; on découvre la note de l'autre
 *    après avoir donné la sienne. Sans l'autre : on regarde et on note, l'autre la verra plus tard.
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `films`     : titre, emoji, durée en minutes, une ligne pour donner envie.
 *  - `reactions` : les emojis qu'on peut envoyer pendant le film.
 */

import type { SchemaContenu } from "../../games/shared/contenu";

export type Film = {
  emoji: string;
  titre: string;
  /** durée en minutes (pour le chrono et « fini vers 22 h 40 ») */
  minutes: number;
  /** une ligne pour donner envie */
  pitch: string;
};

export type FilmContent = {
  emoji: string;
  titre: string;
  intro: string;
  films: Film[];
  reactions: string[];
};

export const FILM_JOUR23: FilmContent = {
  emoji: "🎬",
  titre: "Ciné de Noël à distance",
  intro: "Ce soir, cinéma ! Choisissez le film, appuyez sur lecture au même moment et regardez-le ensemble, même de loin.",
  films: [
    { emoji: "🏠", titre: "Maman, j'ai raté l'avion !", minutes: 103, pitch: "Un enfant seul à la maison contre deux cambrioleurs. Le classique." },
    { emoji: "💌", titre: "Love Actually", minutes: 135, pitch: "Dix histoires d'amour à Londres, quelques semaines avant Noël." },
    { emoji: "🏡", titre: "The Holiday", minutes: 136, pitch: "Deux femmes échangent leur maison pour les fêtes, et leur vie avec." },
    { emoji: "🧝", titre: "Elfe", minutes: 97, pitch: "Un humain élevé par les elfes du Père Noël débarque à New York." },
    { emoji: "💚", titre: "Le Grinch", minutes: 86, pitch: "Le grincheux vert qui voulait voler Noël (version animée)." },
    { emoji: "🚂", titre: "Le Pôle Express", minutes: 100, pitch: "Un train magique en route pour le pôle Nord, la nuit de Noël." },
    { emoji: "📮", titre: "Klaus", minutes: 96, pitch: "Un facteur exilé dans le Grand Nord invente sans le vouloir le Père Noël." },
    { emoji: "🎃", titre: "L'Étrange Noël de Monsieur Jack", minutes: 76, pitch: "Le roi d'Halloween découvre Noël et décide de s'en occuper." },
  ],
  reactions: ["🍿", "😂", "😭", "❤️", "😱", "🥰", "🎄", "😴"],
};

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_FILM_JOUR23: SchemaContenu = {
  jour: 23,
  titre: "Jour 23 — Ciné de Noël à distance",
  intro: "Les films proposés au vote. Chaque personne coche ceux qui lui plaisent, un film choisi des deux côtés gagne. Mettez des films que vous pouvez regarder à deux (même plateforme, ou DVD de chaque côté).",
  facultatif: true,
  champs: [
    { type: "texte", cle: "intro", label: "Phrase d'accueil", long: true, max: 180, exemple: "Ce soir, cinéma !" },
    {
      type: "liste", cle: "films", label: "Films proposés", libelleElement: "Film", min: 2, max: 12,
      modele: { minutes: 100 },
      champs: [
        { type: "texte", cle: "emoji", label: "Emoji", max: 8, exemple: "🎄" },
        { type: "texte", cle: "titre", label: "Titre", max: 60, exemple: "Maman, j'ai raté l'avion !" },
        { type: "nombre", cle: "minutes", label: "Durée (minutes)", min: 20, max: 240 },
        { type: "texte", cle: "pitch", label: "Une ligne pour donner envie", max: 120, exemple: "Le classique de Noël." },
      ],
    },
    { type: "textes", cle: "reactions", label: "Réactions pendant le film (emojis)", min: 2, max: 8, maxLongueur: 8, exemple: "🍿" },
  ],
};
