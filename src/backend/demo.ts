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
 * Les mots de passe sont ignorés. La session est gardée par onglet (sessionStorage), ce qui
 * permet d'avoir Alexandre dans un onglet et Flavie dans un autre ; les données (progression,
 * cases préparées, état des jeux) sont partagées entre onglets via localStorage.
 */
import type { BackendApi, DayNumber, PreparedContent, PreparedResult, Progress, RealtimeRoom, ReminderStatus, Who } from "../core/contracts";
import type { PasswordRecovery } from "./index";
import {
  DEMO_DAY_OUTSIDE_DECEMBER, DEMO_PHOTO_MAX_DIMENSION, FROZEN_MESSAGE, PREPARED_DAYS,
  adventDayFor, checkPhotoSize, compressImage, isWho, partnerOf,
} from "./config";

const PREFIX = "cc-demo:";
const SESSION_KEY = PREFIX + "session";

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

// v2 : seules les actions de l'utilisateur sont enregistrées (les exemples sont recalculés, ticket #32)
const DATA_KEY = PREFIX + "data-v2";
const emptyData = (): DemoData => ({
  progress: { alexandre: { opened: [], completed: [] }, flavie: { opened: [], completed: [] } },
  prepared: [],
  gameState: {},
});

/** Ce que l'utilisateur a fait dans la démo (sans les exemples). */
function load(): DemoData {
  const raw = safe.get(DATA_KEY);
  if (raw) { try { return { ...emptyData(), ...(JSON.parse(raw) as DemoData) }; } catch { /* données corrompues */ } }
  return emptyData();
}

/** Vue complète pour le jour simulé : exemples + actions de l'utilisateur, rien au-delà de `today`. */
function view(today: DayNumber): DemoData {
  const seed = seedData(today);
  const user = load();
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
function save(d: DemoData) {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(d)); }
  catch { throw new Error("Stockage du navigateur plein (mode démo) : supprime quelques photos."); }
}

const uniqSorted = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 0));

/* ---------- backend ---------- */

export class DemoBackend implements BackendApi, PasswordRecovery {
  readonly mode = "demo" as const;
  private authListeners = new Set<(who: Who | null) => void>();
  private params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");

  constructor() {
    safe.del(PREFIX + "data"); // ancien format (exemples figés, avant le ticket #32)
    if (this.params.has("demo-reset")) { safe.del(DATA_KEY); safe.sset(SESSION_KEY, null); safe.del(SESSION_KEY); }
    const forced = this.params.get("moi");
    if (isWho(forced)) safe.sset(SESSION_KEY, forced);
  }

  /** Utilisateur de cet onglet (synchrone, utile pour joinRoom) */
  private current(): Who | null {
    const s = safe.sget(SESSION_KEY) ?? safe.get(SESSION_KEY);
    return isWho(s) ? s : null;
  }
  private requireMe(): Who {
    const w = this.current();
    if (!w) throw new Error("Pas connecté.");
    return w;
  }

  async me() { return delay(this.current()); }

  async signIn(who: Who, _password: string, options?: { rester?: boolean }) {
    void _password; // n'importe quel mot de passe est accepté en démo
    if (!isWho(who)) throw new Error("Utilisateur inconnu.");
    const before = this.current();
    safe.sset(SESSION_KEY, who);
    // rester (défaut) : mémorisé aussi pour les prochaines visites ; sinon, seulement pour cet onglet
    if (options?.rester === false) safe.del(SESSION_KEY);
    else safe.set(SESSION_KEY, who);
    if (before !== who) this.emitAuth(who);
  }

  async signOut() {
    const before = this.current();
    safe.sset(SESSION_KEY, null);
    safe.del(SESSION_KEY);
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
    const p = view(this.todaySync()).progress[who];
    return delay({ opened: [...p.opened], completed: [...p.completed] });
  }

  private mark(day: DayNumber, completed: boolean) {
    const me = this.requireMe();
    if (!Number.isInteger(day) || day < 1 || day > 24) throw new Error(`Jour invalide : ${day}`);
    if (day > this.todaySync()) throw new Error(`La case ${day} n'est pas encore ouverte.`);
    const d = load();
    const p = d.progress[me] ?? { opened: [], completed: [] };
    p.opened = uniqSorted([...p.opened, day]);
    if (completed) p.completed = uniqSorted([...p.completed, day]);
    d.progress[me] = p;
    save(d);
  }
  async markOpened(day: DayNumber) { this.mark(day, false); }
  async markCompleted(day: DayNumber) { this.mark(day, true); }

  async getPrepared(day: DayNumber, to: Who): Promise<PreparedResult> {
    const me = this.requireMe();
    const from = partnerOf(to);
    // Même règle que le serveur : le destinataire ne lit qu'à partir du jour J, l'auteur toujours.
    if (me !== from && day > this.todaySync()) return delay({ status: "locked" });
    const c = view(this.todaySync()).prepared.find((x) => x.day === day && x.from === from);
    return delay(c ? { status: "ready", content: { ...c, photos: [...c.photos] } } : { status: "empty" });
  }

  async savePrepared(day: DayNumber, content: Pick<PreparedContent, "message" | "photos">) {
    const me = this.requireMe();
    if (!PREPARED_DAYS.includes(day)) throw new Error(`Le jour ${day} n'est pas une case préparée.`);
    // Figée dès que le destinataire l'a ouverte (même règle que le serveur)
    // (on regarde aussi les ouvertures réelles non filtrées : un autre onglet peut simuler un jour plus avancé)
    const d = load();
    const other = partnerOf(me);
    if (view(this.todaySync()).progress[other].opened.includes(day) || d.progress[other]?.opened.includes(day)) {
      throw new Error(FROZEN_MESSAGE);
    }
    const item: PreparedContent = {
      day, from: me, to: partnerOf(me), message: content.message, photos: [...content.photos],
      updatedAt: new Date().toISOString(),
    };
    d.prepared = [...d.prepared.filter((x) => !(x.day === day && x.from === me)), item];
    save(d);
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
    const v = view(this.todaySync()).gameState[`${day}:${key}`];
    return delay(v === undefined ? null : (structuredClone(v) as T));
  }
  async setGameState<T>(day: DayNumber, key: string, value: T) {
    this.requireMe();
    const d = load();
    d.gameState[`${day}:${key}`] = value;
    save(d);
  }

  joinRoom(roomId: string): RealtimeRoom {
    return new DemoRoom(roomId, this.requireMe());
  }

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
