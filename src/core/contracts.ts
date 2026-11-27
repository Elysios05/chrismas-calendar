/**
 * Contrats partagés entre les équipes (monde, interface, backend, jeux, audio).
 * Ce fichier appartient au chef de projet : toute modification passe par lui.
 * Chaque équipe code CONTRE ces interfaces, jamais contre l'implémentation d'une autre.
 */

export type Who = "alexandre" | "flavie";
export type DayNumber = number; // 1..24
export type ZoneId = "montagnes" | "saint-nicolas" | "lac" | "marche" | "grotte" | "pole-nord";
export type DayKind = "jeu" | "direct" | "differe" | "prepare" | "photo" | "synchro" | "score";

/* ------------------------------------------------------------------ */
/* Backend (Supabase, ou mode démo en mémoire / localStorage)          */
/* ------------------------------------------------------------------ */

export type PreparedContent = {
  day: DayNumber;
  from: Who;
  to: Who;
  message: string;            // mot doux / lettre
  photos: string[];           // URLs (signées) des photos
  updatedAt: string;
};

export type Progress = { opened: DayNumber[]; completed: DayNumber[] };

/** locked = pas encore le jour J ; empty = rien d'écrit ; ready = contenu disponible */
export type PreparedResult =
  | { status: "locked" }
  | { status: "empty" }
  | { status: "ready"; content: PreparedContent };

export type RealtimeRoom = {
  send: (event: string, payload: unknown) => void;
  on: (event: string, cb: (payload: unknown, from: Who) => void) => () => void;
  presence: (cb: (online: Who[]) => void) => () => void;
  leave: () => void;
};

/**
 * État des rappels par notification (la veille d'une case préparée encore vide, à 20 h, Paris) :
 * active = abonné sur cet appareil ; off = possible mais pas activé ; denied = notifications refusées
 * dans le navigateur ; unsupported = navigateur incompatible ; needs-install = iPhone/iPad : il faut
 * d'abord ajouter le site à l'écran d'accueil (iOS 16.4 minimum).
 */
export type ReminderStatus = "active" | "off" | "denied" | "unsupported" | "needs-install";

/** Obtenu via `await createBackend()` (src/backend/index.ts) : asynchrone car Supabase est chargé à la demande */
export interface BackendApi {
  readonly mode: "demo" | "supabase";
  /** Utilisateur connecté (null si personne) */
  me(): Promise<Who | null>;
  /** rester = garder la session après fermeture du navigateur (par défaut : oui) */
  signIn(who: Who, password: string, options?: { rester?: boolean }): Promise<void>;
  signOut(): Promise<void>;
  /** Prévient quand la session change (connexion, déconnexion, expiration) */
  onAuthChange(cb: (who: Who | null) => void): () => void;

  /** Date « serveur » utilisée pour déverrouiller les cases */
  today(): Promise<DayNumber>;

  getProgress(who: Who): Promise<Progress>;
  markOpened(day: DayNumber): Promise<void>;
  markCompleted(day: DayNumber): Promise<void>;

  /** Case préparée : lecture refusée par le serveur avant le jour J (heure d'ouverture : 7 h, Paris) */
  getPrepared(day: DayNumber, to: Who): Promise<PreparedResult>;
  /** Refusé (erreur) si le destinataire a déjà ouvert la case : elle est alors figée */

  savePrepared(day: DayNumber, content: Pick<PreparedContent, "message" | "photos">): Promise<void>;
  uploadPhoto(file: Blob): Promise<string>;

  /** Scores à battre, résultats de jeux, dessins envoyés… (JSON libre par jeu) */
  getGameState<T>(day: DayNumber, key: string): Promise<T | null>;
  setGameState<T>(day: DayNumber, key: string, value: T): Promise<void>;

  /** Salle temps réel pour les jeux en direct */
  joinRoom(roomId: string): RealtimeRoom;

  /**
   * Rappels par notification sur CET appareil (voir ReminderStatus).
   * Facultatives pour l'instant, le temps que les faux backends d'atelier (src/games/dev, src/ui/dev)
   * les ajoutent : DemoBackend et SupabaseBackend les fournissent. Usage : `backend.reminderStatus?.() ?? "unsupported"`.
   */
  reminderStatus?(): Promise<ReminderStatus>;
  /** Demande l'autorisation et abonne l'appareil. À appeler DANS un geste de l'utilisateur (clic). */
  enableReminders?(): Promise<ReminderStatus>;

  /**
   * Salons (voir docs/salons.md et SalonApi plus bas). Fourni par DemoBackend et SupabaseBackend ;
   * facultatif seulement pour les faux backends d'atelier. Usage : `const salon = await backend.salons?.getSalon()`.
   * Toutes les autres méthodes (progression, cases préparées, jeux, temps réel, rappels) portent
   * automatiquement sur le SALON COURANT : rien ne change pour les équipes qui les appellent déjà.
   */
  readonly salons?: SalonApi;
}

/* ------------------------------------------------------------------ */
/* Salons : un calendrier par couple (docs/salons.md)                  */
/* ------------------------------------------------------------------ */
/*
 * Rappel : `Who` désigne une PLACE dans le salon, pas une personne.
 *   "alexandre" = place 1, le créateur du salon ; "flavie" = place 2, la personne invitée.
 * Aucun texte affiché ne doit utiliser ces clés : le prénom est dans `salon.config.joueurs[who].prenom`.
 *
 * Parcours type :
 *   1. Créateur : `creerSalon({ config, motDePasse })` → il est connecté (place "alexandre") et reçoit
 *      `lienConnexion` (à garder) et `lienInvitation` (à envoyer à l'autre).
 *   2. Invité·e : ouvre le lien d'invitation → `lireInvitation()` (prénoms pour l'accueil) →
 *      `accepterInvitation(jeton, motDePasse)` → connecté·e (place "flavie"). Le jeton ne sert qu'une fois.
 *   3. Ensuite, chacun revient par le lien de connexion (ou simplement le site : le dernier salon est retenu)
 *      → si la session est encore ouverte, `me()` répond directement ; sinon `signIn(who, motDePasse)`
 *      comme avant, dans le salon courant.
 *
 * Erreurs : les méthodes lèvent une `Error` dont le `message` est en français, prêt à afficher, et dont
 * la propriété `code` (type SalonErreurCode) permet de réagir finement.
 */

/** Identifiant d'un salon (texte opaque, à ne pas interpréter). */
export type SalonId = string;

/**
 * Couleurs d'un personnage, en 0xRRGGBB. Mêmes champs que `PLAYERS` (src/world/actors.ts) :
 * coat = manteau, hat = bonnet, pompom = pompon, hair = cheveux, longHair = cheveux longs.
 */
export type CouleursJoueur = { coat: number; hat: number; pompom: number; hair: number; longHair: boolean };

/** Une place du salon telle qu'elle s'affiche. */
export type JoueurSalon = { prenom: string; couleurs: CouleursJoueur };

/**
 * Contenu personnalisé des jeux. Clé = numéro du jour EN TEXTE ("1".."24") ; valeur = contenu du jeu de ce jour,
 * de la même forme que son contenu par défaut dans src/data/games/ (chaque jeu publie son schéma, équipe Jeux).
 * Jour absent = contenu par défaut. Doit rester sérialisable en JSON (pas de fonctions, pas de Date).
 */
export type ContenuSalon = { [jour: string]: unknown };

/** Configuration d'un salon : lisible par ses deux membres, modifiable par eux. */
export type SalonConfig = {
  joueurs: Record<Who, JoueurSalon>;
  contenu: ContenuSalon;
};

export type Salon = {
  id: SalonId;
  config: SalonConfig;
  /** Vrai dès que la personne invitée a choisi son mot de passe (la place "flavie" est prise). */
  inviteArrive: boolean;
  /** Salon fictif du mode démo (celui qu'on voit en ouvrant /demo/). */
  demo: boolean;
  createdAt: string;
};

/** Résultat de `creerSalon` : le créateur est déjà connecté. */
export type SalonCree = {
  salon: Salon;
  /** Lien à garder par le créateur pour revenir dans SON salon (sur un autre appareil, par ex.). */
  lienConnexion: string;
  /** Lien à envoyer à l'autre personne (usage unique). */
  lienInvitation: string;
};

/** Ce que dit un lien d'invitation, avant de l'accepter (pour l'écran d'accueil de l'invité·e). */
export type InvitationInfo =
  /** Jeton valable : on peut accueillir l'invité·e par son prénom et lui faire choisir un mot de passe. */
  | { statut: "valide"; jeton: string; salonId: SalonId; joueurs: Record<Who, JoueurSalon> }
  /** Déjà utilisé (la personne a déjà son mot de passe : l'envoyer vers la connexion de ce salon). */
  | { statut: "utilisee"; salonId: SalonId; joueurs: Record<Who, JoueurSalon> }
  /** Jeton inconnu, remplacé par un plus récent, ou absent de l'adresse. */
  | { statut: "invalide" };

export type SalonErreurCode =
  | "INVITATION_INVALIDE"   // jeton inconnu ou remplacé
  | "INVITATION_UTILISEE"   // jeton déjà consommé
  | "LIMITE_CREATION"       // trop de salons créés depuis cet appareil / récemment
  | "NON_AUTORISE"          // pas membre du salon, ou pas le créateur (lien d'invitation)
  | "SALON_INCONNU"         // le salon du lien n'existe pas (ou plus)
  | "MOT_DE_PASSE_FAIBLE"   // moins de 8 caractères
  | "CONFIG_INVALIDE"       // prénom vide, contenu trop gros…
  | "INDISPONIBLE";         // fonction pas encore active sur ce backend

export interface SalonApi {
  /**
   * Salon courant, ou null s'il n'y en a pas (ex. : première visite sur le site principal → écran d'accueil
   * « Créer notre calendrier »). Le salon courant est, dans l'ordre : celui du lien ouvert (`?salon=…`),
   * sinon le dernier ouvert sur cet appareil. En démo, le salon fictif par défaut.
   * Lisible sans être connecté (prénoms et couleurs pour l'écran de connexion) ; `config.contenu` n'est
   * rempli que pour un membre connecté (sinon `{}`).
   */
  getSalon(): Promise<Salon | null>;
  /** Prévient quand le salon courant change (autre salon ouvert, config modifiée). */
  onSalonChange(cb: (salon: Salon | null) => void): () => void;

  /**
   * Crée un salon : le créateur prend la place "alexandre", est connecté, et le salon devient le salon courant.
   * `email` facultatif, seulement pour « mot de passe oublié ». `rester` comme pour signIn (défaut : oui).
   * Peut échouer avec LIMITE_CREATION, MOT_DE_PASSE_FAIBLE, CONFIG_INVALIDE.
   */
  creerSalon(input: { config: SalonConfig; motDePasse: string; email?: string; rester?: boolean }): Promise<SalonCree>;
  /**
   * Comme `creerSalon`, avec le jeton du widget anti-robot (Cloudflare Turnstile) quand il est activé sur le
   * serveur (sinon ignoré). Échec de la vérification : LIMITE_CREATION, avec un message prêt à afficher.
   */
  creerSalonAvecCaptcha(
    input: { config: SalonConfig; motDePasse: string; email?: string; rester?: boolean }, captcha: string | undefined,
  ): Promise<SalonCree>;
  /** Remplace la configuration du salon courant (membre connecté). Le contenu remplace tout l'objet `contenu`. */
  modifierSalon(config: SalonConfig): Promise<Salon>;

  /** Lien de connexion du salon courant (à garder, à ouvrir sur un autre appareil). */
  lienConnexion(): Promise<string>;
  /**
   * Lien d'invitation du salon courant (créateur connecté seulement, tant que l'invité·e n'est pas arrivé·e).
   * Renvoie le lien en cours ; `nouveau: true` en fabrique un autre et rend l'ancien invalide (lien perdu, mal envoyé).
   */
  lienInvitation(options?: { nouveau?: boolean }): Promise<string>;

  /** Lit un jeton d'invitation ; sans argument, celui de l'adresse de la page (`?invitation=…`). Ne le consomme pas. */
  lireInvitation(jeton?: string): Promise<InvitationInfo>;
  /**
   * Première connexion de l'invité·e : consomme le jeton, crée son accès avec ce mot de passe, la connecte
   * (place "flavie") et ouvre le salon. Échecs : INVITATION_INVALIDE, INVITATION_UTILISEE, MOT_DE_PASSE_FAIBLE.
   */
  accepterInvitation(jeton: string, motDePasse: string, options?: { email?: string; rester?: boolean }): Promise<void>;

  /**
   * Fait d'un salon le salon courant (connexion par lien, ou choix dans une liste). Ensuite, `me()` renvoie la
   * place de l'utilisateur DANS ce salon, ou null s'il n'y est pas connecté (→ écran de connexion de ce salon).
   * `onAuthChange` et `onSalonChange` sont appelés si quelque chose change. Échec : SALON_INCONNU.
   */
  ouvrirSalon(id: SalonId): Promise<Salon>;

  /**
   * Supprime pour de bon le salon courant : photos, lettres, jeux, réglages et les comptes des DEUX personnes.
   * Réservé à la personne qui l'a créé (place "alexandre", connectée). Ensuite plus personne n'est connecté et il
   * n'y a plus de salon courant (`getSalon()` → null ; en démo, retour au salon fictif).
   * Échec : NON_AUTORISE (pas connecté à ce salon, ou pas le créateur).
   */
  supprimerSalon(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export type Sfx =
  | "open" | "good" | "bad" | "pop" | "win" | "locked" | "step" | "whoosh"
  // interface : tap = bouton, select = case touchée, hover = approche d'un cadeau, talk = voix de Pingou,
  // pingou = apparition, day/night = bascule, unlock = nouvelle case, photo/send/notify = jeux à deux
  | "tap" | "select" | "hover" | "talk" | "pingou" | "day" | "night" | "unlock" | "photo" | "send" | "notify" | "jingle" | "snow"
  // animaux, personnages, jeux à deux
  | "fox" | "hare" | "owl" | "squirrel" | "reindeer" | "seal" | "bear"
  | "elf-laugh" | "elf-hammer" | "elf-hop" | "snowball" | "skate" | "ski" | "lift"
  | "partner-in" | "partner-out";

export interface SoundApi {
  setEnabled(on: boolean): void;
  /** Volume général 0..1 */
  setVolume(v: number): void;
  /** Volumes séparés 0..1 (défauts : musique 0,5 ; effets et bruitages 0,6) */
  setMusicVolume(v: number): void;
  setSfxVolume(v: number): void;
  /** Tempête de neige (jour 10) : vent fort */
  setWeather(storm: boolean): void;
  /** Force du vent 0..1 (montagnes : 1 près du col ; pôle Nord) */
  setWind(x: number): void;
  /** À appeler dans un geste de l'utilisateur (clic, toucher) pour débloquer le son, surtout sur iOS */
  unlock(): Promise<void>;
  /** Change d'ambiance musicale (fondu) */
  setZone(zone: ZoneId, night: boolean): void;
  /** Musique spéciale pendant un jeu (null = retour à l'ambiance) */
  setGameMusic(mood: "calm" | "action" | "victory" | "duel" | "cosy" | null): void;
  /** Jingle de 2–3 s à la première arrivée dans un monde */
  playJingle(zone: ZoneId): void;
  play(sfx: Sfx): void;
}

/* ------------------------------------------------------------------ */
/* Jeux                                                                */
/* ------------------------------------------------------------------ */

export type GameResult = { success: boolean; score?: number; data?: unknown };

export type GameContext = {
  day: DayNumber;
  me: Who;
  partner: Who;
  backend: BackendApi;
  sound: SoundApi;
  /** Fait parler Pingou (bulle de dialogue) */
  say: (lines: string[]) => void;
  /**
   * Contenu du jeu (questions, mots…) : `salon.config.contenu[String(day)]` s'il existe,
   * sinon `undefined` (ou null) → le jeu prend son contenu par défaut de src/data/games/.
   */
  content: unknown;
  /**
   * Prénoms affichés des deux places (depuis la config du salon). Ne jamais écrire « Alexandre » ou « Flavie »
   * en dur : `ctx.prenoms?.[ctx.partner]`, avec un repli choisi par le jeu. Facultatif le temps que tous les
   * appelants (DayWindow, ateliers) le passent.
   */
  prenoms?: Record<Who, string>;
  /** À appeler quand le jeu est terminé */
  complete: (result: GameResult) => void;
};

export interface GameModule {
  id: string;
  title: string;
  /** Monte le jeu dans un élément DOM ; renvoie une fonction de nettoyage */
  mount(el: HTMLElement, ctx: GameContext): () => void;
}
