/**
 * Jour 11 — Quiz « Sommes-nous synchro ? » (en direct, ou chacun son tour).
 *
 * Ce n'est pas un quiz de connaissances : vous répondez tous les deux à la même question,
 * sans voir l'autre, et **même réponse = +1 synchro**.
 *
 * ALEXANDRE : deux sortes de questions, mélangées.
 *  - `type: "choix"` : tu écris 4 options. Synchro si vous choisissez la même.
 *  - `type: "qui"`   : pas d'options à écrire, le jeu propose « Alexandre », « Flavie »,
 *                      « Les deux » et « Ni l'un ni l'autre ». Attention : la question doit se lire
 *                      pareil des deux côtés, donc écris « Qui… » et jamais « toi » ou « moi ».
 *
 * `pingou` (facultatif) : ce que la mascotte lance quand vous n'êtes PAS d'accord.
 */

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
    { id: "weekend", type: "choix", emoji: "🛌", texte: "Un week-end entier libre, tous les deux. On fait quoi ?",
      options: ["Grasse matinée et rien d'autre", "Une randonnée", "Un musée et un bon restaurant", "On improvise"],
      pingou: "Ah. Vous n'avez pas prévu le même week-end du tout 😅" },
    { id: "sapin", type: "choix", emoji: "🎄", texte: "Le sapin, on le décore comment ?",
      options: ["Rouge et or, classique", "Bleu et blanc, givré", "N'importe comment, c'est plus drôle", "Pas de sapin"],
      pingou: "Il va falloir négocier avant le 24…" },
    { id: "jetaime", type: "qui", emoji: "📞", texte: "Qui dit « je t'aime » en premier au téléphone ?",
      pingou: "Vous n'êtes même pas d'accord là-dessus ? 🐧" },
    { id: "loto", type: "choix", emoji: "💸", texte: "On gagne au loto demain. Premier réflexe ?",
      options: ["On vit enfin ensemble", "On achète un appartement", "On voyage un an", "On ne dit rien à personne"],
      pingou: "Deux plans différents pour le même magot." },
    { id: "retard", type: "qui", emoji: "⏰", texte: "Qui est systématiquement en retard ?",
      pingou: "Curieusement, personne ne se désigne soi-même…" },
    { id: "soir", type: "choix", emoji: "🌙", texte: "La soirée parfaite à distance, c'est…",
      options: ["Un film lancé en même temps", "Un appel qui dure des heures", "Jouer ensemble", "Chacun son truc, mais en visio"],
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
      options: ["Dans la même ville, enfin", "À l'étranger tous les deux", "Avec un chat et trop de plantes", "Aucune idée, et c'est bien"],
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
