/**
 * Répliques de Pingou — la mascotte parle ici, et nulle part ailleurs.
 * Personnalité retenue (à valider avec Alexandre) : « copain taquin mais tendre ».
 * Voir docs/agents/interface.md § Journal pour les options proposées.
 *
 * Règles d'écriture :
 *  - une phrase courte par bulle, 150 caractères maximum (bulle lisible sur mobile) ;
 *  - Pingou tutoie, dit « vous » quand il parle du couple ;
 *  - au maximum un emoji par bulle, jamais au milieu d'une phrase ;
 *  - il taquine, il ne juge jamais : pas de « tu as perdu », plutôt « on retente ? » ;
 *  - il ne dit jamais « Alexandre » et « Flavie » à la place de l'autre : on passe par les prénoms en paramètre.
 */

export type Expression = "neutre" | "content" | "surpris" | "triste" | "clin";

/** Une bulle : du texte, et l'expression de Pingou pendant qu'il la dit. */
export type PingouLine = string | { text: string; face: Expression };

export const faceOf = (l: PingouLine): Expression => (typeof l === "string" ? "neutre" : l.face);
export const textOf = (l: PingouLine): string => (typeof l === "string" ? l : l.text);

/** Choisit une réplique au hasard dans une liste (pour que Pingou ne se répète pas). */
export const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */

export const PINGOU_LOGIN = {
  /** Écran de connexion, avant de choisir un profil */
  accueil: (): PingouLine[] => [
    { text: "Bonsoir ! Portier officiel du calendrier, c'est moi. Tu es lequel des deux ?", face: "content" },
  ],
  /** Profil choisi, champ mot de passe affiché */
  demandeMotDePasse: (prenom: string): PingouLine[] => [
    { text: `${prenom} ! Le mot de passe, et je te laisse entrer.`, face: "clin" },
  ],
  mauvaisMotDePasse: (): PingouLine[] => [
    pick([
      { text: "Raté. Je fais semblant de ne pas avoir vu, retente.", face: "surpris" } as const,
      { text: "Ce n'est pas ça… et j'ai bonne mémoire, tu sais.", face: "surpris" } as const,
      { text: "Non. Un pingouin incorruptible, voilà ce que je suis.", face: "neutre" } as const,
    ]),
  ],
  bienvenue: (prenom: string): PingouLine[] => [
    { text: `Entre, ${prenom}, il fait meilleur dedans 🐧`, face: "content" },
  ],
  /** Tout premier lancement : ce que voit Flavie (ou Alexandre) la première fois */
  premierLancement: (prenom: string, autre: string): PingouLine[] => [
    { text: `Coucou ${prenom} ! Moi c'est Pingou, et cette route, c'est la vôtre.`, face: "content" },
    "Chaque jour de décembre, une case s'ouvre un peu plus loin sur le chemin.",
    { text: `${autre} marche de son côté. Rien d'obligé… mais je compte les points.`, face: "clin" },
    "Allez. Le cadeau qui brille, c'est aujourd'hui.",
  ],
  /** Lancements suivants */
  retour: (prenom: string, jour: number): PingouLine[] => [
    pick([
      { text: `Te voilà, ${prenom}. On est le ${jour}, et ça brille là-bas.`, face: "content" } as const,
      { text: `${jour} décembre. J'ai déneigé la route pendant la nuit, de rien.`, face: "neutre" } as const,
      { text: `Pile à l'heure, ${prenom}. Enfin, à peu près.`, face: "clin" } as const,
    ]),
  ],
  deconnexion: (): PingouLine[] => [{ text: "Je garde ta place au chaud. À demain !", face: "content" }],
} as const;

/* ------------------------------------------------------------------ */
/* La route et les cases                                               */
/* ------------------------------------------------------------------ */

export const PINGOU_ROUTE = {
  caseVerrouillee: (jour: number): PingouLine[] => [
    pick([
      { text: `Hé, pas si vite ! Celle-là s'ouvre le ${jour} décembre.`, face: "surpris" } as const,
      { text: `Interdit. Le ${jour}, pas avant. Je surveille.`, face: "neutre" } as const,
      { text: `J'ai bien vu ce que tu essaies de faire. Rendez-vous le ${jour}.`, face: "clin" } as const,
    ]),
  ],
  caseEnRetard: (jour: number): PingouLine[] => [
    { text: `La case ${jour} t'attend encore, elle ne va pas fondre. Enfin, pas tout de suite.`, face: "clin" },
  ],
  ouverture: (jour: number): PingouLine[] => [
    pick([
      { text: `Case ${jour} ouverte 🎉`, face: "content" } as const,
      { text: `Et voilà la ${jour} ! Un pas de plus vers le traîneau.`, face: "content" } as const,
    ]),
  ],
  avance: (n: number, autre: string): PingouLine[] => [
    { text: `${n} case${n > 1 ? "s" : ""} d'avance sur ${autre}. Je ne dis rien, mais je note.`, face: "clin" },
  ],
  retard: (n: number, autre: string): PingouLine[] => [
    { text: `${autre} a ${n} case${n > 1 ? "s" : ""} d'avance. On va dire que c'est stratégique ?`, face: "surpris" },
  ],
  egalite: (autre: string): PingouLine[] => [
    { text: `À égalité avec ${autre}. Insupportable, ces deux-là 💞`, face: "content" },
  ],
  finDeJournee: (): PingouLine[] => [
    { text: "C'est tout pour aujourd'hui. Va lui écrire un message, ça compte aussi.", face: "content" },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Fenêtre d'une case : jeux, scores, cases préparées                  */
/* ------------------------------------------------------------------ */

export const PINGOU_CASE = {
  avantJeu: (titre: string): PingouLine[] => [
    { text: `Aujourd'hui : ${titre}. Je t'explique, puis je me tais.`, face: "content" },
  ],
  encouragement: (): PingouLine[] => [
    pick([
      { text: "Joli !", face: "content" } as const,
      { text: "Continue comme ça.", face: "content" } as const,
      { text: "Bon, là j'applaudirais si j'avais des mains.", face: "clin" } as const,
    ]),
  ],
  rate: (): PingouLine[] => [
    pick([
      { text: "Aïe. On retente ?", face: "triste" } as const,
      { text: "Pas grave. Même moi je glisse, parfois.", face: "triste" } as const,
    ]),
  ],
  termine: (): PingouLine[] => [{ text: "Terminé ! Tu peux la revoir quand tu veux.", face: "content" }],
  scoreAEgaler: (score: number, autre: string): PingouLine[] => [
    { text: `${autre} a fait ${score}. Je te laisse réfléchir à ça.`, face: "clin" },
  ],
  scoreBattu: (autre: string): PingouLine[] => [
    { text: `Battu ! Je vais prévenir ${autre} tout de suite 🏆`, face: "content" },
  ],
  attendLautre: (autre: string): PingouLine[] => [
    { text: `C'est au tour de ${autre}. Je te préviens dès que c'est joué.`, face: "neutre" },
  ],
  /** Case préparée, côté celui qui reçoit */
  prepareeAvant: (autre: string): PingouLine[] => [
    { text: `${autre} a laissé quelque chose ici. Je n'ai pas regardé. Presque pas.`, face: "clin" },
  ],
  prepareeVide: (autre: string): PingouLine[] => [
    { text: `Rien dans la boîte… ${autre} a dû être pris de court. Repasse plus tard ?`, face: "triste" },
  ],
  prepareeApres: (): PingouLine[] => [
    { text: "Je vous laisse tous les deux. Je serai dehors, dans la neige.", face: "content" },
  ],
  /** Rappel la veille, côté celui qui prépare */
  rappelVeille: (jour: number, autre: string): PingouLine[] => [
    { text: `Demain c'est la case ${jour}, et elle est encore vide.`, face: "surpris" },
    { text: `${autre} l'ouvrira à 7 h. Deux lignes et une photo, ça suffit, promis.`, face: "content" },
  ],
  prepareeEnvoyee: (autre: string): PingouLine[] => [
    { text: `C'est dans la boîte. ${autre} ne verra rien avant le jour J, parole de pingouin 🤐`, face: "clin" },
  ],
  jour24: (autre: string): PingouLine[] => [
    { text: "Dernière case. Le traîneau est chargé, les rennes s'impatientent.", face: "content" },
    { text: `Vous avez fait tout ce chemin chacun de votre côté, et vous êtes arrivés ensemble.`, face: "content" },
    { text: `Joyeux Noël, toi et ${autre} 🌟`, face: "content" },
  ],
} as const;
