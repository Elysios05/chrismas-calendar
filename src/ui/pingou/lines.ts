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
    { text: "Bonsoir ! Portier officiel du calendrier, c'est moi. C'est qui, ce soir ?", face: "content" },
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
  /** Le réseau ne répond pas : rien à voir avec le mot de passe */
  reseauCoupe: (): PingouLine[] => [
    { text: "Rien ne passe, le réseau a dû geler. Vérifie ta connexion et retente.", face: "triste" },
  ],
  /** Autre souci côté serveur : le détail s'affiche sous le champ */
  connexionImpossible: (): PingouLine[] => [
    { text: "Là, ce n'est pas toi : la porte coince de notre côté. Le détail est juste en dessous.", face: "surpris" },
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
  /** Bouton « Voir la démo » de la version publique */
  demo: (): PingouLine[] => [
    { text: "Visite guidée ! Tout est inventé ici, mais la route est la vraie.", face: "clin" },
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
    { text: "Je vous laisse en tête-à-tête. Je serai dehors, dans la neige.", face: "content" },
  ],
  /** Rappel la veille, côté celui qui prépare */
  rappelVeille: (jour: number, autre: string): PingouLine[] => [
    { text: `Demain c'est la case ${jour}, et elle est encore vide.`, face: "surpris" },
    { text: `${autre} l'ouvrira à 7 h. Deux lignes et une photo, ça suffit, promis.`, face: "content" },
  ],
  /** Éditeur ouvert, rien d'écrit encore */
  editeurVide: (jour: number, autre: string): PingouLine[] => [
    { text: `La case ${jour}, c'est toi qui l'écris. ${autre} l'ouvrira sans que je puisse rien y changer.`, face: "content" },
  ],
  /** Brouillon déjà enregistré, on revient le modifier */
  editeurRepris: (autre: string): PingouLine[] => [
    { text: `Tu peux encore tout changer. Jusqu'à ce que ${autre} l'ouvre, c'est à toi.`, face: "clin" },
  ],
  /** La case est figée : l'autre l'a déjà lue */
  editeurFige: (autre: string): PingouLine[] => [
    { text: `Trop tard, ${autre} l'a déjà lue. Ce qui est dit est dit 🤍`, face: "surpris" },
  ],
  prepareeEnvoyee: (autre: string): PingouLine[] => [
    { text: `C'est dans la boîte. ${autre} ne verra rien avant le jour J, parole de pingouin 🤐`, face: "clin" },
  ],
  jour24: (autre: string): PingouLine[] => [
    { text: "Dernière case. Le traîneau est chargé, les rennes s'impatientent.", face: "content" },
    { text: `Vous avez fait tout ce chemin à distance, et vous voilà au bout, ensemble.`, face: "content" },
    { text: `Joyeux Noël, toi et ${autre} 🌟`, face: "content" },
  ],
} as const;

/** Salons (#84, piste B « Pingou » choisie par Alexandre le 25 nov) : une question par écran. */
export const PINGOU_SALON = {
  accueil: (): PingouLine => ({ text: "Salut ! Je fabrique des calendriers de l'Avent pour deux. On fait le vôtre ?", face: "content" }),
  dejaUnCalendrier: (): PingouLine => ({ text: "Ouvre le lien de connexion que tu as gardé en créant le calendrier, et je te retrouve tout de suite.", face: "clin" }),
  monPrenom: (): PingouLine => ({ text: "Super ! Pour commencer, comment tu t'appelles ?", face: "content" }),
  monManteau: (prenom: string): PingouLine => ({ text: `Enchanté, ${prenom} ! Tu veux quel manteau pour traverser la neige ?`, face: "content" }),
  sonPrenom: (): PingouLine => ({ text: "Et ce calendrier, c'est pour qui ?", face: "clin" }),
  sonManteau: (prenom: string): PingouLine => ({ text: `Joli prénom. Et pour ${prenom}, quel manteau ?`, face: "content" }),
  contenu: (prenom: string): PingouLine => ({ text: `Les jeux ont déjà leurs questions. Tu pourras les remplacer par les vôtres plus tard, sans que ${prenom} le sache.`, face: "clin" }),
  motDePasse: (): PingouLine => ({ text: "Dernière chose : un mot de passe, pour que personne d'autre n'entre chez vous.", face: "neutre" }),
  fabrication: (): PingouLine => ({ text: "Je découpe les cases, je plie les enveloppes… presque fini !", face: "content" }),
  lien: (prenom: string): PingouLine => ({ text: `Voilà le lien pour ${prenom}. Je garde la porte entrouverte jusqu'à son arrivée 😉`, face: "clin" }),
  copie: (): PingouLine => ({ text: "Copié ! Colle-le dans un message, et le tour est joué.", face: "content" }),
  souci: (): PingouLine => ({ text: "Oups, ça coince. Le détail est juste en dessous.", face: "surpris" }),
  /** Page d'invitation (?invitation=…) */
  invitation: (invite: string, createur: string): PingouLine => ({ text: `Salut ${invite} ! ${createur} t'a préparé un calendrier de l'Avent. Choisis juste un mot de passe, et c'est parti.`, face: "content" }),
  invitationUtilisee: (invite: string): PingouLine => ({ text: `Ce lien a déjà servi, ${invite}. Tu as ton mot de passe : entre par la porte habituelle.`, face: "clin" }),
  /** Réglages du salon (Réglages → Notre calendrier) — validées par Alexandre le 25 nov */
  reglages: (): PingouLine => ({ text: "Ici, tout se règle : vos prénoms, vos manteaux, et les liens pour entrer.", face: "content" }),
  changerPrenom: (pourMoi: boolean, actuel: string): PingouLine => ({ text: pourMoi ? `On garde « ${actuel} », ou tu préfères autre chose ?` : `Comment on écrit son prénom, finalement ? Pour l'instant, c'est « ${actuel} ».`, face: "clin" }),
  changerManteau: (prenom: string): PingouLine => ({ text: `Et le manteau de ${prenom}, on le change ?`, face: "content" }),
  reglagesEnregistres: (): PingouLine => ({ text: "C'est noté ! Tout le calendrier suit, jusqu'aux personnages sur la route.", face: "content" }),
  lienGarde: (): PingouLine => ({ text: "Copié ! Garde-le bien au chaud : il ouvre votre calendrier sur n'importe quel appareil.", face: "clin" }),
  nouveauLien: (prenom: string): PingouLine => ({ text: `Voilà un lien tout neuf pour ${prenom}. L'ancien ne marche plus.`, face: "content" }),
  // Éditeur de contenu des jeux (Réglages → Notre calendrier → Les jeux)
  contenuListe: (): PingouLine => ({ text: "Choisis une case : tu peux remplacer mes questions par les vôtres. Motus, je ne dirai rien 🤫", face: "clin" }),
  contenuCase: (): PingouLine => ({ text: "Touche une carte pour l'ouvrir. Rien ne part avant « Enregistrer ».", face: "content" }),
  contenuEnregistre: (): PingouLine => ({ text: "C'est rangé dans l'enveloppe ! Le jeu prendra vos mots à vous.", face: "content" }),
  contenuOriginal: (): PingouLine => ({ text: "Revoilà mes questions d'origine. Enregistre si tu veux les garder.", face: "clin" }),
  contenuQuitter: (): PingouLine => ({ text: "Tu pars sans enregistrer ? Tes changements vont fondre comme neige.", face: "surpris" }),
  contenuSurprise: (prenom: string): PingouLine => ({ text: `${prenom} a préparé les questions des jeux. C'est une surprise 🤫`, face: "clin" }),
  contenuIncomplet: (): PingouLine => ({ text: "Presque ! Il reste un souci dans les cartes marquées en rouge.", face: "surpris" }),
  invitationIllisible: (): PingouLine => ({ text: "Je n'arrive pas à lire ton lien : le réseau a dû geler. Vérifie ta connexion, puis réessaie.", face: "surpris" }),
  invitationInvalide: (): PingouLine => ({ text: "Ce lien ne marche plus. Demande un nouveau lien à la personne qui te l'a envoyé.", face: "triste" }),
  // Ouverture au public (27 nov) — « complet » validée par Alexandre ; les deux autres à faire valider
  complet: (): PingouLine => ({ text: "Oh non… tous mes calendriers sont déjà distribués !", face: "triste" }),
  supprimer: (prenom: string): PingouLine => ({ text: `Vraiment ? Si tu effaces tout, ${prenom} et toi ne pourrez plus revenir. Même moi, je ne pourrai rien retrouver.`, face: "triste" }),
  supprimerSouci: (): PingouLine => ({ text: "Je n'ai pas réussi à tout effacer. Rien n'est perdu : réessaie dans un instant.", face: "surpris" }),
} as const;
