/**
 * Mode démo : tout le backend simulé dans le navigateur (localStorage + BroadcastChannel).
 *
 * Paramètres d'URL utiles pour tester :
 *  - ?jour=N        simule le jour N (0..24)
 *  - ?moi=flavie    choisit le personnage de cet onglet (connexion automatique)
 *  - ?demo-reset    efface les données de démo au chargement
 *  - ?rappels=off   simule l'état des rappels (off | active | denied | unsupported | needs-install) ;
 *                   sans ce paramètre, la démo répond « unsupported » (pas de notification en démo)
 *
 *  - ?salon=ID      ouvre ce salon (lien de connexion) ; ?invitation=JETON : lien d'invitation (voir lireInvitation)
 *
 * Salons (docs/salons.md) : le salon fictif « demo » (Alexandre et Flavie, données d'exemple) est le salon par
 * défaut, inchangé. Les salons créés avec `salons.creerSalon` sont simulés dans localStorage, SANS exemples :
 * ils partent de zéro. Les liens d'invitation ne marchent donc que dans le même navigateur (autre onglet).
 *
 * Mots de passe : ignorés dans le salon démo ; dans un salon créé, vérifiés (stockés en clair dans localStorage :
 * c'est une simulation locale, rien n'est envoyé nulle part). La session est gardée par onglet (sessionStorage), ce
 * qui permet d'avoir une place dans un onglet et l'autre dans un autre ; les données (progression, cases préparées,
 * état des jeux) sont partagées entre onglets via localStorage.
 */
import type {
  BackendApi, DayNumber, InvitationInfo, PreparedContent, PreparedResult, Progress, RealtimeRoom, ReminderStatus,
  Salon, SalonApi, SalonConfig, SalonCree, SalonId, Who,
} from "../core/contracts";
import type { PasswordRecovery } from "./index";
import {
  DEMO_DAY_OUTSIDE_DECEMBER, DEMO_PHOTO_MAX_DIMENSION, DEMO_SALON_ID, FROZEN_MESSAGE, PREPARED_DAYS,
  SALON_CREATIONS_PAR_HEURE, SALON_DEMO_CONFIG, adventDayFor, checkMotDePasse, checkPhotoSize, checkSalonConfig,
  compressImage, isWho, lienInvitationUrl, lienSalonUrl, partnerOf, randomToken, salonError,
} from "./config";

const PREFIX = "cc-demo:";
/** Clés propres à un salon. Le salon démo garde les clés d'avant (données existantes intactes). */
const sessionKey = (salon: SalonId) => (salon === DEMO_SALON_ID ? PREFIX + "session" : `${PREFIX}s:${salon}:session`);
const dataKey = (salon: SalonId) => (salon === DEMO_SALON_ID ? PREFIX + "data-v2" : `${PREFIX}s:${salon}:data`);
/** Salon courant : par onglet (sessionStorage) puis pour le navigateur (localStorage). */
const CURRENT_SALON_KEY = PREFIX + "salon";
/** Registre des salons simulés (créés ou modifiés). */
const SALONS_KEY = PREFIX + "salons";
/** Horodatages des créations récentes (limite par heure). */
const CREATIONS_KEY = PREFIX + "creations";

type DemoData = {
  progress: Record<Who, Progress>;
  prepared: PreparedContent[];
  gameState: Record<string, unknown>; // clé "jour:clé"
};

/* ---------- données d'exemple ---------- */

function placeholderPhoto(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},60%,75%)"/><stop offset="1" stop-color="hsl(${hue},50%,45%)"/></linearGradient></defs>
<rect width="640" height="480" fill="url(#g)"/><polygon points="0,480 200,260 330,400 450,220 640,480" fill="#fff" opacity=".85"/>
<text x="320" y="110" font-family="Fredoka,sans-serif" font-size="44" text-anchor="middle" fill="#fff">${label}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/**
 * Données d'exemple pour le jour simulé `today` (ticket #32) : rien d'ouvert ni de joué à partir du jour
 * simulé ; les cases préparées d'exemple n'existent que jusqu'à ce jour (écrites la veille). Au jour 1,
 * tout est neuf. Ces exemples ne sont jamais enregistrés : ils sont recalculés à chaque lecture et
 * fusionnés avec ce que l'utilisateur a réellement fait (qui reste prioritaire).
 */
function seedData(today: DayNumber): DemoData {
  const now = new Date().toISOString();
  const before = (days: number[]) => days.filter((d) => d < today);
  const prepared: PreparedContent[] = [];
  const msgs: Record<Who, string[]> = {
    flavie: [
      "Coucou mon cœur ! Première case préparée rien que pour toi. Tu me manques, vivement qu'on se retrouve ❤️",
      "Tu te souviens de notre balade sous la neige ? J'y repense tout le temps.",
      "Encore quelques jours… je compte les dodos !",
    ],
    alexandre: [
      "Bonjour ma Flavie ! Voici ta première case : un petit mot et un souvenir de nous deux.",
      "Ljubljana est jolie sous la neige, mais il manque quelqu'un à côté de moi.",
      "Plus que quelques cases avant Noël, tiens bon !",
    ],
  };
  for (const from of ["alexandre", "flavie"] as Who[]) {
    PREPARED_DAYS.slice(0, 3).forEach((day, i) => {
      prepared.push({
        day, from, to: partnerOf(from), message: msgs[from][i],
        photos: [placeholderPhoto(`Souvenir n°${i + 1}`, from === "flavie" ? 340 : 200)],
        updatedAt: now,
      });
    });
  }
  const gameState: Record<string, unknown> = {};
  for (const [k, v] of Object.entries({ "2:score:flavie": 1840, "10:score:alexandre": 57 })) {
    if (Number(k.split(":")[0]) < today) gameState[k] = v;
  }
  return {
    progress: {
      alexandre: { opened: before([1, 2, 3, 4, 5, 6]), completed: before([1, 2, 3, 4, 5]) },
      flavie: { opened: before([1, 2, 3, 4, 5, 6, 7]), completed: before([1, 2, 3, 4, 5, 6, 7]) },
    },
    prepared: prepared.filter((c) => c.day <= today),
    gameState,
  };
}

/* ---------- stockage ---------- */

const safe = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* quota / navigation privée */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* idem */ } },
  sget(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset(k: string, v: string | null) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* idem */ } },
};

const emptyData = (): DemoData => ({
  progress: { alexandre: { opened: [], completed: [] }, flavie: { opened: [], completed: [] } },
  prepared: [],
  gameState: {},
});

/** Ce que l'utilisateur a fait dans la démo (sans les exemples). */
function load(salon: SalonId): DemoData {
  const raw = safe.get(dataKey(salon));
  if (raw) { try { return { ...emptyData(), ...(JSON.parse(raw) as DemoData) }; } catch { /* données corrompues */ } }
  return emptyData();
}

/** Vue complète pour le jour simulé : exemples + actions de l'utilisateur, rien au-delà de `today`. */
function view(salon: SalonId, today: DayNumber): DemoData {
  // v2 : seules les actions de l'utilisateur sont enregistrées ; les exemples (salon démo seulement) sont recalculés
  const seed = salon === DEMO_SALON_ID ? seedData(today) : emptyData();
  const user = load(salon);
  const progress = {} as Record<Who, Progress>;
  for (const w of ["alexandre", "flavie"] as Who[]) {
    const s = seed.progress[w], u = user.progress[w] ?? { opened: [], completed: [] };
    progress[w] = {
      opened: uniqSorted([...s.opened, ...u.opened]).filter((d) => d <= today),
      completed: uniqSorted([...s.completed, ...u.completed]).filter((d) => d <= today),
    };
  }
  const mine = new Set(user.prepared.map((c) => `${c.day}:${c.from}`));
  return {
    progress,
    prepared: [...seed.prepared.filter((c) => !mine.has(`${c.day}:${c.from}`)), ...user.prepared],
    gameState: { ...seed.gameState, ...user.gameState },
  };
}
function save(salon: SalonId, d: DemoData) {
  try { localStorage.setItem(dataKey(salon), JSON.stringify(d)); }
  catch { throw new Error("Stockage du navigateur plein (mode démo) : supprime quelques photos."); }
}

const uniqSorted = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 0));

/* ---------- registre des salons simulés ---------- */

type DemoSalonRecord = {
  config: SalonConfig;
  createdAt: string;
  /** Mots de passe des places (simulation locale, en clair). Absent pour le salon démo : tout est accepté. */
  passwords: Partial<Record<Who, string>>;
  /** Jeton d'invitation en cours (null une fois utilisé) et jetons déjà consommés. */
  jeton: string | null;
  jetonsUtilises: string[];
  inviteArrive: boolean;
};

const DEMO_RECORD: DemoSalonRecord = {
  config: SALON_DEMO_CONFIG, createdAt: "2026-11-17T00:00:00.000Z", passwords: {},
  jeton: null, jetonsUtilises: [], inviteArrive: true,
};

function loadSalons(): Record<SalonId, DemoSalonRecord> {
  try { return JSON.parse(safe.get(SALONS_KEY) ?? "{}") as Record<SalonId, DemoSalonRecord>; } catch { return {}; }
}
function saveSalons(r: Record<SalonId, DemoSalonRecord>) {
  try { localStorage.setItem(SALONS_KEY, JSON.stringify(r)); }
  catch { throw new Error("Stockage du navigateur plein (mode démo)."); }
}
/** Salon simulé, ou null s'il n'existe pas. Le salon démo existe toujours (config modifiable, sinon par défaut). */
function salonRecord(id: SalonId): DemoSalonRecord | null {
  const r = loadSalons()[id];
  if (id === DEMO_SALON_ID) return { ...DEMO_RECORD, ...r, passwords: {}, inviteArrive: true };
  return r ?? null;
}

/* ---------- backend ---------- */

export class DemoBackend implements BackendApi, PasswordRecovery {
  readonly mode = "demo" as const;
  private authListeners = new Set<(who: Who | null) => void>();
  private salonListeners = new Set<(salon: Salon | null) => void>();
  private params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");

  constructor() {
    safe.del(PREFIX + "data"); // ancien format (exemples figés, avant le ticket #32)
    if (this.params.has("demo-reset")) {
      // tout effacer : données de chaque salon, salons créés, sessions, salon courant
      for (const st of [() => localStorage, () => sessionStorage]) {
        try {
          const store = st();
          for (const k of Object.keys(store)) if (k.startsWith(PREFIX) && k !== PREFIX + "rappels") store.removeItem(k);
        } catch { /* navigation privée */ }
      }
    }
    const fromUrl = this.params.get("salon");
    if (fromUrl && salonRecord(fromUrl)) this.setCurrentSalon(fromUrl);
    const forced = this.params.get("moi");
    if (isWho(forced)) safe.sset(sessionKey(this.salonId()), forced);
  }

  /** Salon courant de cet onglet (le salon démo par défaut, ou si le salon retenu n'existe plus). */
  private salonId(): SalonId {
    const id = safe.sget(CURRENT_SALON_KEY) ?? safe.get(CURRENT_SALON_KEY);
    return id && salonRecord(id) ? id : DEMO_SALON_ID;
  }
  private setCurrentSalon(id: SalonId) {
    safe.sset(CURRENT_SALON_KEY, id);
    safe.set(CURRENT_SALON_KEY, id);
  }

  /** Utilisateur de cet onglet dans le salon courant (synchrone, utile pour joinRoom) */
  private current(): Who | null {
    const k = sessionKey(this.salonId());
    const s = safe.sget(k) ?? safe.get(k);
    return isWho(s) ? s : null;
  }
  private requireMe(): Who {
    const w = this.current();
    if (!w) throw new Error("Pas connecté.");
    return w;
  }

  async me() { return delay(this.current()); }

  async signIn(who: Who, password: string, options?: { rester?: boolean }) {
    if (!isWho(who)) throw new Error("Utilisateur inconnu.");
    // salon démo : n'importe quel mot de passe ; salon créé : vérifié
    const rec = salonRecord(this.salonId());
    if (rec && this.salonId() !== DEMO_SALON_ID) {
      const expected = rec.passwords[who];
      if (expected === undefined) {
        throw new Error(who === "flavie"
          ? `${rec.config.joueurs.flavie.prenom} n'a pas encore ouvert son lien d'invitation.`
          : "Ce compte n'existe pas.");
      }
      if (expected !== password) throw new Error("Mot de passe incorrect.");
    }
    this.openSession(who, options?.rester);
  }
  /** Ouvre la session de `who` dans le salon courant. */
  private openSession(who: Who, rester?: boolean) {
    const before = this.current();
    const k = sessionKey(this.salonId());
    safe.sset(k, who);
    // rester (défaut) : mémorisé aussi pour les prochaines visites ; sinon, seulement pour cet onglet
    if (rester === false) safe.del(k);
    else safe.set(k, who);
    if (before !== who) this.emitAuth(who);
  }

  async signOut() {
    const before = this.current();
    const k = sessionKey(this.salonId());
    safe.sset(k, null);
    safe.del(k);
    if (before !== null) this.emitAuth(null);
  }

  onAuthChange(cb: (who: Who | null) => void) {
    this.authListeners.add(cb);
    return () => { this.authListeners.delete(cb); };
  }
  private emitAuth(who: Who | null) { this.authListeners.forEach((cb) => cb(who)); }

  /* « Mot de passe oublié » : rien à faire en démo (tout mot de passe est accepté). */
  async resetPassword(who: Who) { if (!isWho(who)) throw new Error("Utilisateur inconnu."); }
  inPasswordRecovery() { return false; }
  async updatePassword(_newPassword: string) { void _newPassword; }

  private todaySync(): DayNumber {
    const q = this.params.get("jour");
    if (q !== null && q.trim() !== "" && !Number.isNaN(+q)) return Math.max(0, Math.min(24, Math.floor(+q)));
    return adventDayFor(new Date(), DEMO_DAY_OUTSIDE_DECEMBER);
  }
  async today() { return delay(this.todaySync()); }

  async getProgress(who: Who): Promise<Progress> {
    const p = view(this.salonId(), this.todaySync()).progress[who];
    return delay({ opened: [...p.opened], completed: [...p.completed] });
  }

  private mark(day: DayNumber, completed: boolean) {
    const me = this.requireMe();
    if (!Number.isInteger(day) || day < 1 || day > 24) throw new Error(`Jour invalide : ${day}`);
    if (day > this.todaySync()) throw new Error(`La case ${day} n'est pas encore ouverte.`);
    const d = load(this.salonId());
    const p = d.progress[me] ?? { opened: [], completed: [] };
    p.opened = uniqSorted([...p.opened, day]);
    if (completed) p.completed = uniqSorted([...p.completed, day]);
    d.progress[me] = p;
    save(this.salonId(), d);
  }
  async markOpened(day: DayNumber) { this.mark(day, false); }
  async markCompleted(day: DayNumber) { this.mark(day, true); }

  async getPrepared(day: DayNumber, to: Who): Promise<PreparedResult> {
    const me = this.requireMe();
    const from = partnerOf(to);
    // Même règle que le serveur : le destinataire ne lit qu'à partir du jour J, l'auteur toujours.
    if (me !== from && day > this.todaySync()) return delay({ status: "locked" });
    const c = view(this.salonId(), this.todaySync()).prepared.find((x) => x.day === day && x.from === from);
    return delay(c ? { status: "ready", content: { ...c, photos: [...c.photos] } } : { status: "empty" });
  }

  async savePrepared(day: DayNumber, content: Pick<PreparedContent, "message" | "photos">) {
    const me = this.requireMe();
    if (!PREPARED_DAYS.includes(day)) throw new Error(`Le jour ${day} n'est pas une case préparée.`);
    // Figée dès que le destinataire l'a ouverte (même règle que le serveur)
    // (on regarde aussi les ouvertures réelles non filtrées : un autre onglet peut simuler un jour plus avancé)
    const d = load(this.salonId());
    const other = partnerOf(me);
    if (view(this.salonId(), this.todaySync()).progress[other].opened.includes(day) || d.progress[other]?.opened.includes(day)) {
      throw new Error(FROZEN_MESSAGE);
    }
    const item: PreparedContent = {
      day, from: me, to: partnerOf(me), message: content.message, photos: [...content.photos],
      updatedAt: new Date().toISOString(),
    };
    d.prepared = [...d.prepared.filter((x) => !(x.day === day && x.from === me)), item];
    save(this.salonId(), d);
  }

  async uploadPhoto(file: Blob): Promise<string> {
    this.requireMe();
    const small = await compressImage(file, DEMO_PHOTO_MAX_DIMENSION, 0.75);
    checkPhotoSize(small);
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("Lecture de la photo impossible."));
      r.readAsDataURL(small);
    });
  }

  async getGameState<T>(day: DayNumber, key: string): Promise<T | null> {
    const v = view(this.salonId(), this.todaySync()).gameState[`${day}:${key}`];
    return delay(v === undefined ? null : (structuredClone(v) as T));
  }
  async setGameState<T>(day: DayNumber, key: string, value: T) {
    this.requireMe();
    const d = load(this.salonId());
    d.gameState[`${day}:${key}`] = value;
    save(this.salonId(), d);
  }

  joinRoom(roomId: string): RealtimeRoom {
    const salon = this.salonId();
    // le salon démo garde le nom de canal d'avant ; les autres salons ont leurs propres salles
    return new DemoRoom(salon === DEMO_SALON_ID ? roomId : `${salon}:${roomId}`, this.requireMe());
  }

  /* ----- salons (docs/salons.md) : simulés dans localStorage ----- */

  private toSalon(id: SalonId, rec: DemoSalonRecord, member: boolean): Salon {
    const config = structuredClone(rec.config);
    if (!member) config.contenu = {}; // le contenu des jeux n'est lisible que par les membres connectés
    return { id, config, inviteArrive: rec.inviteArrive, demo: id === DEMO_SALON_ID, createdAt: rec.createdAt };
  }
  private currentSalon(): Salon {
    const id = this.salonId();
    return this.toSalon(id, salonRecord(id)!, this.current() !== null);
  }
  private updateRecord(id: SalonId, change: (r: DemoSalonRecord) => void) {
    const all = loadSalons();
    const rec = salonRecord(id);
    if (!rec) throw salonError("SALON_INCONNU");
    change(rec);
    all[id] = rec;
    saveSalons(all);
  }
  private emitSalon() {
    const s = this.currentSalon();
    this.salonListeners.forEach((cb) => cb(s));
  }
  /** Change de salon courant et prévient (salon + session, qui dépend du salon). */
  private switchTo(id: SalonId) {
    const beforeWho = this.current();
    this.setCurrentSalon(id);
    const afterWho = this.current();
    if (beforeWho !== afterWho) this.emitAuth(afterWho);
    this.emitSalon();
  }
  private findInvitation(jeton: string): { id: SalonId; rec: DemoSalonRecord; used: boolean } | null {
    for (const [id, rec] of Object.entries(loadSalons())) {
      if (rec.jeton === jeton) return { id, rec, used: false };
      if (rec.jetonsUtilises?.includes(jeton)) return { id, rec, used: true };
    }
    return null;
  }

  readonly salons: SalonApi = {
    getSalon: async () => delay(this.currentSalon()),

    onSalonChange: (cb) => {
      this.salonListeners.add(cb);
      return () => { this.salonListeners.delete(cb); };
    },

    creerSalon: async ({ config, motDePasse, rester }): Promise<SalonCree> => {
      const now = Date.now();
      let recent: number[] = [];
      try { recent = (JSON.parse(safe.get(CREATIONS_KEY) ?? "[]") as number[]).filter((t) => now - t < 3600_000); } catch { /* vide */ }
      if (recent.length >= SALON_CREATIONS_PAR_HEURE) throw salonError("LIMITE_CREATION");
      checkMotDePasse(motDePasse);
      const clean = checkSalonConfig(config);
      const id = randomToken(9);
      const jeton = randomToken();
      const all = loadSalons();
      all[id] = {
        config: clean, createdAt: new Date().toISOString(), passwords: { alexandre: motDePasse },
        jeton, jetonsUtilises: [], inviteArrive: false,
      };
      saveSalons(all);
      safe.set(CREATIONS_KEY, JSON.stringify([...recent, now]));
      this.setCurrentSalon(id);
      this.openSession("alexandre", rester);
      this.emitSalon();
      return { salon: this.currentSalon(), lienConnexion: lienSalonUrl(id), lienInvitation: lienInvitationUrl(jeton) };
    },

    modifierSalon: async (config) => {
      this.requireMe();
      const clean = checkSalonConfig(config);
      this.updateRecord(this.salonId(), (r) => { r.config = clean; });
      this.emitSalon();
      return this.currentSalon();
    },

    lienConnexion: async () => lienSalonUrl(this.salonId()),

    lienInvitation: async (options) => {
      const id = this.salonId();
      if (this.current() !== "alexandre") throw salonError("NON_AUTORISE", "Seule la personne qui a créé le calendrier peut inviter.");
      const rec = salonRecord(id)!;
      if (rec.inviteArrive) {
        throw salonError("INVITATION_UTILISEE", `${rec.config.joueurs.flavie.prenom} a déjà rejoint le calendrier.`);
      }
      let jeton = rec.jeton;
      if (options?.nouveau || !jeton) {
        jeton = randomToken();
        this.updateRecord(id, (r) => { r.jeton = jeton; });
      }
      return lienInvitationUrl(jeton);
    },

    lireInvitation: async (jeton?: string): Promise<InvitationInfo> => {
      const j = jeton ?? this.params.get("invitation");
      const found = j ? this.findInvitation(j) : null;
      if (!j || !found) return delay({ statut: "invalide" });
      const joueurs = structuredClone(found.rec.config.joueurs);
      return delay(found.used
        ? { statut: "utilisee", salonId: found.id, joueurs }
        : { statut: "valide", jeton: j, salonId: found.id, joueurs });
    },

    accepterInvitation: async (jeton, motDePasse, options) => {
      const found = this.findInvitation(jeton);
      if (!found) throw salonError("INVITATION_INVALIDE");
      if (found.used) throw salonError("INVITATION_UTILISEE");
      checkMotDePasse(motDePasse);
      this.updateRecord(found.id, (r) => {
        r.passwords.flavie = motDePasse;
        r.inviteArrive = true;
        r.jeton = null;
        r.jetonsUtilises = [...(r.jetonsUtilises ?? []), jeton];
      });
      this.setCurrentSalon(found.id);
      this.openSession("flavie", options?.rester);
      this.emitSalon();
    },

    ouvrirSalon: async (id) => {
      if (!salonRecord(id)) throw salonError("SALON_INCONNU");
      this.switchTo(id);
      return this.currentSalon();
    },
  };

  /* ----- rappels : simulés seulement avec ?rappels=… (aucune vraie notification en démo) ----- */
  private static REMINDER_STATES: readonly ReminderStatus[] = ["active", "off", "denied", "unsupported", "needs-install"];
  async reminderStatus(): Promise<ReminderStatus> {
    const stored = safe.sget(PREFIX + "rappels");
    const q = this.params.get("rappels");
    const v = stored ?? q;
    return DemoBackend.REMINDER_STATES.includes(v as ReminderStatus) ? (v as ReminderStatus) : "unsupported";
  }
  async enableReminders(): Promise<ReminderStatus> {
    const cur = await this.reminderStatus();
    if (cur !== "off") return cur;
    safe.sset(PREFIX + "rappels", "active");
    return "active";
  }
}

/* ---------- salle temps réel simulée (BroadcastChannel entre onglets) ---------- */

type Wire =
  | { t: "msg"; id: string; from: Who; event: string; payload: unknown }
  | { t: "hello" | "here" | "beat" | "bye"; id: string; from: Who };

const HEARTBEAT_MS = 1500;
const TIMEOUT_MS = 4500;

class DemoRoom implements RealtimeRoom {
  private ch: BroadcastChannel;
  private id = Math.random().toString(36).slice(2);
  private peers = new Map<string, { who: Who; seen: number }>();
  private handlers = new Map<string, Set<(p: unknown, from: Who) => void>>();
  private presenceCbs = new Set<(online: Who[]) => void>();
  private timer: ReturnType<typeof setInterval>;
  private lastOnline = "";
  private closed = false;

  private who: Who;

  constructor(roomId: string, who: Who) {
    this.who = who;
    this.ch = new BroadcastChannel(PREFIX + "room:" + roomId);
    this.ch.onmessage = (e: MessageEvent<Wire>) => this.receive(e.data);
    this.post({ t: "hello", id: this.id, from: who });
    this.timer = setInterval(() => {
      this.post({ t: "beat", id: this.id, from: this.who });
      const now = Date.now();
      for (const [k, p] of this.peers) if (now - p.seen > TIMEOUT_MS) this.peers.delete(k);
      this.emitPresence();
    }, HEARTBEAT_MS);
    if (typeof window !== "undefined") window.addEventListener("pagehide", this.leave);
  }

  private post(m: Wire) { if (!this.closed) this.ch.postMessage(m); }

  private receive(m: Wire) {
    if (!m || m.id === this.id) return;
    if (m.t === "msg") {
      this.handlers.get(m.event)?.forEach((cb) => cb(m.payload, m.from));
      return;
    }
    if (m.t === "bye") this.peers.delete(m.id);
    else this.peers.set(m.id, { who: m.from, seen: Date.now() });
    if (m.t === "hello") this.post({ t: "here", id: this.id, from: this.who });
    this.emitPresence();
  }

  private online(): Who[] {
    const s = new Set<Who>([this.who]);
    for (const p of this.peers.values()) s.add(p.who);
    return (["alexandre", "flavie"] as Who[]).filter((w) => s.has(w));
  }
  private emitPresence(force = false) {
    const o = this.online();
    const key = o.join(",");
    if (!force && key === this.lastOnline) return;
    this.lastOnline = key;
    this.presenceCbs.forEach((cb) => cb(o));
  }

  send = (event: string, payload: unknown) => {
    this.post({ t: "msg", id: this.id, from: this.who, event, payload: structuredClone(payload) });
  };

  on = (event: string, cb: (payload: unknown, from: Who) => void) => {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(cb);
    return () => { this.handlers.get(event)?.delete(cb); };
  };

  presence = (cb: (online: Who[]) => void) => {
    this.presenceCbs.add(cb);
    cb(this.online());
    return () => { this.presenceCbs.delete(cb); };
  };

  leave = () => {
    if (this.closed) return;
    this.post({ t: "bye", id: this.id, from: this.who });
    this.closed = true;
    clearInterval(this.timer);
    this.ch.close();
    this.handlers.clear();
    this.presenceCbs.clear();
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.leave);
  };
}
