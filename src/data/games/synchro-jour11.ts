/**
 * Jour 11 — Quiz « Sommes-nous synchro ? » (en direct, ou chacun son tour).
 *
 * Contenu PAR DÉFAUT, générique, pour tous les salons. Le contenu personnel d'un couple vit dans son salon
 * (éditeur du salon ; pour Alexandre et Flavie : src/data/salons/alexandre-flavie.ts).
 *
 * Ce n'est pas un quiz de connaissances : vous répondez tous les deux à la même question,
 * sans voir l'autre, et **même réponse = +1 synchro**.
 *
 * ALEXANDRE : deux sortes de questions, mélangées.
 *  - `type: "choix"` : tu écris 4 options. Synchro si vous choisissez la même.
 *  - `type: "qui"`   : pas d'options à écrire, le jeu propose vos deux prénoms,
 *                      « Les deux » et « Aucun des deux ». Attention : la question doit se lire
 *                      pareil des deux côtés, donc écris « Qui… » et jamais « toi » ou « moi ».
 *
 * `pingou` (facultatif) : ce que la mascotte lance quand vous n'êtes PAS d'accord.
 */

import type { SchemaContenu } from "../../games/shared/contenu";
export type QuestionSynchro = {
  id: string;
  type: "choix" | "qui";
  texte: string;
  emoji: string;
  options?: string[];
  pingou?: string;
};

export type SynchroContent = {
  /** Questions posées (les premières de la liste) */
  nombre: number;
  /** Secondes d'attente avant de proposer « jouer quand même » */
  attenteAvantSolo: number;
  questions: QuestionSynchro[];
};

export const SYNCHRO_JOUR11: SynchroContent = {
  nombre: 12,
  attenteAvantSolo: 20,
  questions: [
    { id: "weekend", type: "choix", emoji: "🛌", texte: "Un week-end entier libre, rien que nous deux. On fait quoi ?",
      options: ["Grasse matinée et rien d'autre", "Une randonnée", "Un musée et un bon restaurant", "On improvise"],
      pingou: "Ah. Vous n'avez pas prévu le même week-end du tout 😅" },
    { id: "sapin", type: "choix", emoji: "🎄", texte: "Le sapin, on le décore comment ?",
      options: ["Rouge et or, classique", "Bleu et blanc, givré", "N'importe comment, c'est plus drôle", "Pas de sapin"],
      pingou: "Il va falloir négocier avant le 24…" },
    { id: "jetaime", type: "qui", emoji: "📞", texte: "Qui dit « je t'aime » en premier au téléphone ?",
      pingou: "Vous n'êtes même pas d'accord là-dessus ? 🐧" },
    { id: "loto", type: "choix", emoji: "💸", texte: "On gagne au loto demain. Premier réflexe ?",
      options: ["On change de vie", "On achète une maison", "On voyage un an", "On ne dit rien à personne"],
      pingou: "Deux plans différents pour le même magot." },
    { id: "retard", type: "qui", emoji: "⏰", texte: "Qui est systématiquement en retard ?",
      pingou: "Curieusement, personne ne se désigne soi-même…" },
    { id: "soir", type: "choix", emoji: "🌙", texte: "La soirée parfaite, c'est…",
      options: ["Un film sous un plaid", "Parler pendant des heures", "Jouer ensemble", "Sortir danser"],
      pingou: "Pas la même soirée parfaite. Il y a des indices à prendre, là." },
    { id: "cuisine", type: "qui", emoji: "🍳", texte: "Qui cuisine le mieux, honnêtement ?",
      pingou: "L'honnêteté avait ses limites, visiblement." },
    { id: "noel", type: "choix", emoji: "🎁", texte: "Le meilleur moment de Noël ?",
      options: ["Ouvrir les cadeaux", "Le repas", "La déco et la musique", "Ne rien faire du tout"],
      pingou: "Chacun son Noël, finalement." },
    { id: "vacances", type: "choix", emoji: "🏔️", texte: "Prochaines vacances à deux :",
      options: ["La montagne sous la neige", "Une grande ville", "La mer, même en hiver", "Un endroit qu'on ne connaît pas"],
      pingou: "Deux destinations. Ça promet pour la réservation." },
    { id: "bordel", type: "qui", emoji: "🧺", texte: "Qui laisse traîner ses affaires partout ?",
      pingou: "Chacun accuse l'autre. Classique." },
    { id: "pardon", type: "qui", emoji: "🤝", texte: "Qui s'excuse en premier après une dispute ?",
      pingou: "Pas d'accord non plus. Au moins vous êtes constants." },
    { id: "dans5ans", type: "choix", emoji: "🔮", texte: "Dans cinq ans, on se voit…",
      options: ["Exactement comme maintenant", "À l'étranger, ensemble", "Avec un chat et trop de plantes", "Aucune idée, et c'est bien"],
      pingou: "Deux avenirs différents… il faudra en reparler 💞" },
  ],
};

/** Mots de Pingou selon le score de synchro, en pourcentage */
export const SYNCHRO_VERDICTS: { min: number; ligne: string }[] = [
  { min: 90, ligne: "Vous répondez comme une seule personne. C'est beau et un peu effrayant 💞" },
  { min: 70, ligne: "Très synchro ! Quelques surprises, mais rien de grave." },
  { min: 50, ligne: "Une moitié d'accord : de quoi discuter au prochain appel 😄" },
  { min: 25, ligne: "Aïe. Vous vous êtes découverts ce soir, on dirait." },
  { min: 0, ligne: "Pas une seule réponse commune. Au moins, vous ne vous ennuierez jamais 🐧" },
];

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_SYNCHRO_JOUR11: SchemaContenu = {
  jour: 11,
  titre: "Jour 11 — Sommes-nous synchro ?",
  intro: "Vous répondez chacun à la même question sans voir l'autre : même réponse = un point de synchro. Une question « Qui de vous deux ? » propose vos deux prénoms, « Les deux » et « Aucun des deux ».",
  champs: [
    { type: "nombre", cle: "nombre", label: "Nombre de questions posées", aide: "Les premières de la liste.", min: 3, max: 20 },
    {
      type: "liste", cle: "questions", label: "Questions", libelleElement: "Question", min: 3, max: 30,
      modele: { id: "", type: "choix", emoji: "❓" },
      champs: [
        { type: "choix", cle: "type", label: "Sorte de question", options: [
          { valeur: "choix", label: "Des réponses au choix" },
          { valeur: "qui", label: "Qui de vous deux ?" },
        ] },
        { type: "texte", cle: "emoji", label: "Emoji", max: 8, exemple: "🎄" },
        { type: "texte", cle: "texte", label: "Question", aide: "Elle doit se lire pareil des deux côtés : pas de « toi » ni de « moi ».", max: 120, exemple: "Le sapin, on le décore comment ?" },
        { type: "textes", cle: "options", label: "Réponses possibles", aide: "Seulement pour « des réponses au choix ».", min: 0, max: 4, maxLongueur: 50, exemple: "Rouge et or, classique" },
        { type: "texte", cle: "pingou", label: "Ce que dit Pingou si vous n'êtes pas d'accord", max: 120, facultatif: true, exemple: "Il va falloir négocier avant le 24…" },
      ],
    },
  ],
};

/** Une question « au choix » sans au moins 2 réponses est retirée */
export function reparerSynchro(c: SynchroContent): SynchroContent {
  const questions = c.questions.filter((q) => q.type === "qui" || (q.options?.length ?? 0) >= 2);
  return questions.length ? { ...c, questions } : SYNCHRO_JOUR11;
}
