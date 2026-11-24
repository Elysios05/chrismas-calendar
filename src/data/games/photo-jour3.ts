/**
 * Jour 3 — Défi photo croisé : la vue de ta fenêtre.
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `consigne`   : ce que Pingou demande de photographier
 *  - `idees`      : exemples de légende proposés en gris dans le champ (un au hasard)
 *  - `questions`  : la devinette. L'auteur de la photo en choisit UNE et donne sa vraie réponse ;
 *                   l'autre doit la deviner en découvrant la photo. Choisis des questions dont la
 *                   réponse ne se voit PAS sur la photo (sinon c'est trop facile). 2 à 4 options.
 *  - `exemple`    : en mode démo seulement, ce que « l'autre » est censé avoir posté.
 *
 * Le même jeu sert au jour 19 (« ta déco de Noël ») avec un autre fichier de contenu.
 */

export type QuestionPhoto = { id: string; texte: string; options: string[] };

export type PhotoContent = {
  emoji: string;
  titre: string;
  consigne: string;
  idees: string[];
  questions: QuestionPhoto[];
  /** Mode démo : ce qu'a « posté » l'autre (la photo est dessinée par le jeu) */
  exemple: { legende: string; question: string; reponse: number };
};

export const PHOTO_JOUR3: PhotoContent = {
  emoji: "🪟",
  titre: "La vue de ta fenêtre",
  consigne: "Prends en photo ce que tu vois de ta fenêtre, là, maintenant. Pas de mise en scène !",
  idees: [
    "Ce que je regarde quand je pense à toi…",
    "Mon petit bout de ciel aujourd'hui",
    "Il manque juste toi dans ce cadre",
  ],
  questions: [
    { id: "heure", texte: "À quel moment de la journée j'ai pris cette photo ?", options: ["Le matin", "L'après-midi", "Le soir", "En pleine nuit"] },
    { id: "bruit", texte: "Qu'est-ce que j'entends en ce moment ?", options: ["Le silence", "Des voitures", "Des voisins", "De la musique"] },
    { id: "temperature", texte: "Il fait combien dehors ?", options: ["Moins de 0 °C", "Entre 0 et 5 °C", "Entre 5 et 10 °C", "Plus de 10 °C"] },
    { id: "boisson", texte: "Qu'est-ce que j'ai dans la main (à part le téléphone) ?", options: ["Un café", "Un thé", "Un chocolat chaud", "Rien du tout"] },
    { id: "prefere", texte: "Ce que je préfère dans cette vue ?", options: ["La lumière", "Le calme", "Le ciel", "Rien : tu n'y es pas"] },
  ],
  exemple: { legende: "Les toits sous la neige, et toi trop loin 💙", question: "boisson", reponse: 2 },
};
