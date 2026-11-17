/**
 * Jour 1 — Quiz « Est-ce que tu me connais ? »
 *
 * ALEXANDRE : c'est ici que tu remplaces tout. Rien d'autre à toucher.
 *  - `surMoi`    : la question telle qu'on te la pose à toi (« … toi ? »)
 *  - `surAutre`  : la même question posée sur l'autre, {autre} est remplacé par son prénom
 *  - `options`   : 4 réponses possibles (garde-en 4 pour la mise en page)
 *  - `exemple`   : la réponse « de secours » de chacun (indice dans `options`, 0 = la première).
 *                  Elle sert en mode démo et tant que l'autre n'a pas encore rempli ses réponses.
 */

import type { Who } from "../../core/contracts";

export type QuizQuestion = {
  id: string;
  emoji: string;
  surMoi: string;
  surAutre: string;
  options: string[];
  exemple: Record<Who, number>;
};

export type QuizContent = {
  /** Nombre de questions posées (si tu en écris plus, les premières sont prises) */
  nombre: number;
  questions: QuizQuestion[];
};

export const QUIZ_JOUR1: QuizContent = {
  nombre: 10,
  questions: [
    {
      id: "film",
      emoji: "🎬",
      surMoi: "Le film de Noël que tu remets chaque année, c'est…",
      surAutre: "Le film de Noël que {autre} remet chaque année, c'est…",
      options: ["Le Grinch", "Love Actually", "Maman j'ai raté l'avion", "Le Pôle Express"],
      exemple: { alexandre: 0, flavie: 2 },
    },
    {
      id: "gourmandise",
      emoji: "🍪",
      surMoi: "Tout décembre, tu ne manges plus qu'une seule chose :",
      surAutre: "Tout décembre, {autre} ne mange plus qu'une seule chose :",
      options: ["du pain d'épices", "de la raclette", "des clémentines", "du chocolat chaud"],
      exemple: { alexandre: 1, flavie: 0 },
    },
    {
      id: "coucher",
      emoji: "🌙",
      surMoi: "En vacances, tu t'endors vraiment vers…",
      surAutre: "En vacances, {autre} s'endort vraiment vers…",
      options: ["22 h", "23 h 30", "1 h du matin", "3 h du matin"],
      exemple: { alexandre: 1, flavie: 2 },
    },
    {
      id: "peur",
      emoji: "😱",
      surMoi: "Ce qui te fait le plus peur :",
      surAutre: "Ce qui fait le plus peur à {autre} :",
      options: ["les araignées", "le vide", "parler devant du monde", "les films d'horreur"],
      exemple: { alexandre: 1, flavie: 0 },
    },
    {
      id: "cadeau",
      emoji: "🎁",
      surMoi: "Le cadeau dont tu rêves en secret :",
      surAutre: "Le cadeau dont {autre} rêve en secret :",
      options: ["un billet d'avion", "une console", "un appareil photo", "un chat"],
      exemple: { alexandre: 0, flavie: 3 },
    },
    {
      id: "matin",
      emoji: "☕",
      surMoi: "Le matin, la première chose que tu fais :",
      surAutre: "Le matin, la première chose que fait {autre} :",
      options: ["regarder son téléphone", "un café", "se rendormir 20 minutes", "une douche"],
      exemple: { alexandre: 2, flavie: 0 },
    },
    {
      id: "chanson",
      emoji: "🎵",
      surMoi: "La chanson de Noël que tu chantes (faux) :",
      surAutre: "La chanson de Noël que {autre} chante (faux) :",
      options: ["All I Want for Christmas", "Petit Papa Noël", "Last Christmas", "Vive le vent"],
      exemple: { alexandre: 2, flavie: 0 },
    },
    {
      id: "hiver",
      emoji: "🧣",
      surMoi: "Quand il fait -5 °C dehors, tu veux…",
      surAutre: "Quand il fait -5 °C dehors, {autre} veut…",
      options: ["sortir marcher", "rester sous la couverture", "aller boire un vin chaud", "faire de la luge"],
      exemple: { alexandre: 0, flavie: 1 },
    },
    {
      id: "serie",
      emoji: "📺",
      surMoi: "Si tu dois lancer une série pour la 4ᵉ fois :",
      surAutre: "Si {autre} doit lancer une série pour la 4ᵉ fois :",
      options: ["Friends", "Kaamelott", "The Office", "Brooklyn Nine-Nine"],
      exemple: { alexandre: 1, flavie: 0 },
    },
    {
      id: "voyage",
      emoji: "✈️",
      surMoi: "Le prochain endroit où tu veux qu'on aille :",
      surAutre: "Le prochain endroit où {autre} veut qu'on aille :",
      options: ["la Laponie", "Venise à Noël", "New York", "un chalet en montagne"],
      exemple: { alexandre: 3, flavie: 1 },
    },
  ],
};

/** Petits mots de Pingou selon le score sur 10 (du plus faible au plus fort) */
export const QUIZ_VERDICTS: { min: number; ligne: string }[] = [
  { min: 10, ligne: "10 sur 10. C'est presque inquiétant, vous lisez dans les pensées 🔮" },
  { min: 8, ligne: "Très fort ! Il reste juste un ou deux petits secrets… c'est mieux comme ça 😌" },
  { min: 6, ligne: "Bien joué ! Vous vous connaissez bien, mais il y a de la marge pour les 23 jours qui viennent 😄" },
  { min: 4, ligne: "Pas mal… mais là, il va falloir s'appeler un peu plus souvent 📞" },
  { min: 0, ligne: "Aïe. Bon. On va dire que c'est la distance, hein ? 🐧" },
];
