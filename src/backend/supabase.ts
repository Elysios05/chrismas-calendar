/**
 * Backend réel : Supabase (Auth + Postgres avec RLS + Storage + Realtime).
 * Les règles de sécurité vivent dans supabase/migrations/ : ce fichier ne fait que les appeler.
 * Chargé en import dynamique (voir index.ts) pour ne pas alourdir le mode démo.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BackendApi, DayNumber, PreparedContent, PreparedResult, Progress, RealtimeRoom, ReminderStatus, Salon, SalonApi, Who,
} from "../core/contracts";
import { browserStatus, currentSubscription, subscribe, subscriptionKeys } from "./push";
import type { PasswordRecovery } from "./index";
import {
  FROZEN_MESSAGE, PHOTO_MAX_DIMENSION, emailOf, PREPARED_DAYS, READ_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS,
  SALON_DEMO_CONFIG, checkPhotoSize, compressImage, isWho, lienSalonUrl, partnerOf, salonError,
} from "./config";

const BUCKET = "photos";

/**
 * Stockage de la session : localStorage (« rester connecté·e », survit à la fermeture du navigateur)
 * ou sessionStorage (disparaît à la fermeture de l'onglet). Le choix se fait au signIn ; au
 * rechargement, on le retrouve selon l'endroit où la session est rangée.
 */
class SwitchableStorage {
  persist: boolean;
  constructor(probeKey: string) {
    let inSession = false;
    try { inSession = sessionStorage.getItem(probeKey) !== null; } catch { /* indisponible */ }
    this.persist = !inSession;
  }
  private pick(): Storage | null {
    try { return this.persist ? localStorage : sessionStorage; } catch { return null; }
  }
  private other(): Storage | null {
    try { return this.persist ? sessionStorage : localStorage; } catch { return null; }
  }
  getItem = (k: string) => this.pick()?.getItem(k) ?? this.other()?.getItem(k) ?? null;
  setItem = (k: string, v: string) => { this.pick()?.setItem(k, v); this.other()?.removeItem(k); };
  removeItem = (k: string) => { this.pick()?.removeItem(k); this.other()?.removeItem(k); };
}
const AUTH_KEY = "cc-auth";

/** Extrait le chemin Storage d'une URL signée (…/object/sign/photos/<chemin>?token=…), ou renvoie la chaîne telle quelle. */
export function toStoragePath(urlOrPath: string): string {
  const m = /\/object\/sign\/photos\/([^?#]+)/.exec(urlOrPath);
  return m ? decodeURIComponent(m[1]) : urlOrPath;
}
const isUrl = (s: string) => /^(https?:|data:|blob:)/.test(s);

type ProgressRow = { day: number; completed_at: string | null };
type PreparedRow = { day: number; from_who: Who; to_who: Who; message: string; photos: string[]; updated_at: string };

/** Traduit les erreurs Postgres/RLS utiles en messages français. */
function friendly(message: string): string {
  if (message.includes("CASE_FIGEE")) return FROZEN_MESSAGE;
  if (message.includes("row-level security")) return "Action refusée par le serveur.";
  return message;
}

export class SupabaseBackend implements BackendApi, PasswordRecovery {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;
  private who: Who | null = null;
  private whoReady: Promise<Who | null>;
  private authListeners = new Set<(who: Who | null) => void>();
  private lastEmitted: Who | null | undefined = undefined;
  private recovery: boolean;

  private storage = new SwitchableStorage(AUTH_KEY);

  constructor(url: string, anonKey: string) {
    // À lire AVANT createClient, qui consomme le #access_token…&type=recovery de l'URL
    this.recovery = typeof location !== "undefined" && /type=recovery/.test(location.hash);
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_KEY, detectSessionInUrl: true, storage: this.storage },
    });
    this.whoReady = this.loadWho();
    void this.whoReady.then((w) => { this.lastEmitted = w; }, () => { this.lastEmitted = null; });
    this.sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") this.recovery = true;
      if (event === "INITIAL_SESSION") return;
      // Pas d'appel Supabase directement dans ce rappel (risque de blocage) : on diffère.
      setTimeout(() => {
        if (event === "SIGNED_OUT") { this.who = null; this.whoReady = Promise.resolve(null); this.emitAuth(null); return; }
        this.whoReady = this.loadWho();
        this.whoReady.then((w) => this.emitAuth(w), () => this.emitAuth(null));
      }, 0);
    });
  }

  onAuthChange(cb: (who: Who | null) => void) {
    this.authListeners.add(cb);
    return () => { this.authListeners.delete(cb); };
  }
  private emitAuth(who: Who | null) {
    if (who === this.lastEmitted) return;
    this.lastEmitted = who;
    this.authListeners.forEach((cb) => cb(who));
  }

  /** Lit l'identité (alexandre/flavie) de l'utilisateur connecté dans la table profiles. */
  private async loadWho(): Promise<Who | null> {
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) { this.who = null; return null; }
    const { data, error } = await this.sb.from("profiles").select("who").eq("user_id", session.user.id).maybeSingle();
    if (error) throw new Error("Lecture du profil impossible : " + error.message);
    this.who = isWho(data?.who) ? data.who : null;
    return this.who;
  }

  private async requireMe(): Promise<Who> {
    const w = this.who ?? (await this.whoReady) ?? (await (this.whoReady = this.loadWho()));
    if (!w) throw new Error("Pas connecté.");
    return w;
  }

  async me() {
    try { return this.who ?? (await this.whoReady); } catch { return null; }
  }

  async signIn(who: Who, password: string, options?: { rester?: boolean }) {
    this.storage.persist = options?.rester !== false; // à régler AVANT que Supabase n'écrive la session
    const { error } = await this.sb.auth.signInWithPassword({ email: emailOf(who), password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Mot de passe incorrect." : error.message);
    this.whoReady = this.loadWho();
    const got = await this.whoReady;
    if (got !== who) {
      await this.sb.auth.signOut();
      this.who = null;
      this.whoReady = Promise.resolve(null);
      throw new Error("Ce compte n'est pas relié à " + who + " (table profiles).");
    }
    this.emitAuth(got);
  }

  async signOut() {
    // L'appareil ne doit plus recevoir les rappels de la personne qui se déconnecte
    try {
      const sub = await currentSubscription();
      if (sub) { await this.sb.rpc("delete_push_subscription", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
    } catch { /* sans gravité */ }
    await this.sb.auth.signOut();
    this.who = null;
    this.whoReady = Promise.resolve(null);
    this.emitAuth(null);
  }

  /* ----- mot de passe oublié (méthodes en plus du contrat) ----- */

  async resetPassword(who: Who) {
    const back = typeof location !== "undefined" ? location.origin + location.pathname : undefined;
    const { error } = await this.sb.auth.resetPasswordForEmail(emailOf(who), { redirectTo: back });
    if (error) throw new Error("Envoi de l'e-mail impossible : " + error.message);
  }

  inPasswordRecovery() { return this.recovery; }

  async updatePassword(newPassword: string) {
    if (newPassword.length < 6) throw new Error("Mot de passe trop court (6 caractères minimum).");
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    this.recovery = false;
  }

  /** Jour calculé par le serveur (fonction SQL advent_today, fuseau Europe/Paris). */
  async today(): Promise<DayNumber> {
    const { data, error } = await this.sb.rpc("advent_today");
    if (error) throw new Error("Date du serveur indisponible : " + error.message);
    return Number(data);
  }

  async getProgress(who: Who): Promise<Progress> {
    const { data, error } = await this.sb.from("progress").select("day, completed_at").eq("who", who).order("day");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ProgressRow[];
    return { opened: rows.map((r) => r.day), completed: rows.filter((r) => r.completed_at).map((r) => r.day) };
  }

  async markOpened(day: DayNumber) {
    const me = await this.requireMe();
    // ignoreDuplicates : ne touche pas à completed_at si la ligne existe déjà
    const { error } = await this.sb.from("progress").upsert({ who: me, day }, { onConflict: "who,day", ignoreDuplicates: true });
    if (error) throw new Error(friendly(error.message));
  }

  async markCompleted(day: DayNumber) {
    const me = await this.requireMe();
    const { error } = await this.sb.from("progress")
      .upsert({ who: me, day, completed_at: new Date().toISOString() }, { onConflict: "who,day" });
    if (error) throw new Error(error.message);
  }

  async getPrepared(day: DayNumber, to: Who): Promise<PreparedResult> {
    const me = await this.requireMe();
    if (!PREPARED_DAYS.includes(day)) return { status: "empty" };
    // Le destinataire avant le jour J : « locked ». (La RLS refuserait de toute façon la lecture.)
    if (me === to && day > (await this.today())) return { status: "locked" };
    const { data, error } = await this.sb.from("prepared_content")
      .select("day, from_who, to_who, message, photos, updated_at")
      .eq("day", day).eq("to_who", to).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { status: "empty" };
    const row = data as PreparedRow;
    return {
      status: "ready",
      content: {
        day: row.day, from: row.from_who, to: row.to_who, message: row.message,
        photos: await this.signPaths(row.photos ?? []), updatedAt: row.updated_at,
      },
    };
  }

  private async signPaths(paths: string[]): Promise<string[]> {
    const toSign = paths.filter((p) => !isUrl(p));
    if (!toSign.length) return paths;
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrls(toSign, READ_URL_TTL_SECONDS);
    if (error) throw new Error("Photos inaccessibles : " + error.message);
    const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    return paths.map((p) => (isUrl(p) ? p : byPath.get(p) ?? "")).filter(Boolean);
  }

  async savePrepared(day: DayNumber, content: Pick<PreparedContent, "message" | "photos">) {
    const me = await this.requireMe();
    if (!PREPARED_DAYS.includes(day)) throw new Error(`Le jour ${day} n'est pas une case préparée.`);
    // On stocke des chemins Storage (pas les URLs signées, qui expirent) : la lecture re-signe.
    const photos = content.photos.map(toStoragePath);
    const { error } = await this.sb.from("prepared_content").upsert(
      { day, from_who: me, to_who: partnerOf(me), message: content.message, photos },
      { onConflict: "day,from_who" },
    );
    // Le serveur refuse (CASE_FIGEE) si le destinataire a déjà ouvert la case
    if (error) throw new Error(friendly(error.message));
  }

  /** Envoie une photo dans <moi>/<uuid>.jpg et renvoie une URL signée valable 60 jours. */
  async uploadPhoto(file: Blob): Promise<string> {
    const me = await this.requireMe();
    const small = await compressImage(file, PHOTO_MAX_DIMENSION);
    checkPhotoSize(small);
    const ext = small.type === "image/png" ? "png" : small.type === "image/webp" ? "webp" : "jpg";
    const path = `${me}/${crypto.randomUUID()}.${ext}`;
    const up = await this.sb.storage.from(BUCKET).upload(path, small, { contentType: small.type || "image/jpeg", upsert: false });
    if (up.error) throw new Error("Envoi de la photo impossible : " + up.error.message);
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, UPLOAD_URL_TTL_SECONDS);
    if (error || !data) throw new Error("URL de la photo impossible : " + (error?.message ?? "?"));
    return data.signedUrl;
  }

  async getGameState<T>(day: DayNumber, key: string): Promise<T | null> {
    const { data, error } = await this.sb.from("game_state").select("value").eq("day", day).eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? (data.value as T) : null;
  }

  async setGameState<T>(day: DayNumber, key: string, value: T) {
    await this.requireMe();
    const { error } = await this.sb.from("game_state")
      .upsert({ day, key, value: value as unknown }, { onConflict: "day,key" });
    if (error) throw new Error(error.message);
  }

  joinRoom(roomId: string): RealtimeRoom {
    return new SupabaseRoom(this.sb, roomId, this.who, () => this.requireMe());
  }

  /* ----- rappels par notification ----- */

  private async saveSubscription(sub: PushSubscription) {
    const k = subscriptionKeys(sub);
    const { error } = await this.sb.rpc("save_push_subscription", {
      p_endpoint: k.endpoint, p_p256dh: k.p256dh, p_auth: k.auth, p_user_agent: navigator.userAgent.slice(0, 300),
    });
    if (error) throw new Error("Enregistrement des rappels impossible : " + error.message);
  }

  async reminderStatus(): Promise<ReminderStatus> {
    const pre = browserStatus();
    if (pre) return pre;
    if (Notification.permission !== "granted") return "off";
    const sub = await currentSubscription();
    if (!sub) return "off";
    // Re-synchronise l'abonnement avec le serveur (il peut changer ou avoir été effacé)
    if (this.who ?? (await this.whoReady)) { try { await this.saveSubscription(sub); } catch { /* réessayé plus tard */ } }
    return "active";
  }

  async enableReminders(): Promise<ReminderStatus> {
    const res = await subscribe(); // demande l'autorisation en premier, dans le geste utilisateur
    if (typeof res === "string") return res;
    await this.requireMe();
    await this.saveSubscription(res);
    return "active";
  }

  /*
   * ----- salons : PROVISOIRE (lot 1) -----
   * Tant que le schéma multi-salons n'est pas en place (lot 2), le Supabase ne contient qu'un salon :
   * celui d'Alexandre et Flavie, avec la configuration par défaut. Création et invitations : INDISPONIBLE.
   */
  private principal(): Salon {
    return { id: "principal", config: structuredClone(SALON_DEMO_CONFIG), inviteArrive: true, demo: false, createdAt: "2026-11-17T00:00:00.000Z" };
  }
  readonly salons: SalonApi = {
    getSalon: async () => this.principal(),
    onSalonChange: () => () => { /* rien ne change tant qu'il n'y a qu'un salon */ },
    creerSalon: async () => { throw salonError("INDISPONIBLE"); },
    modifierSalon: async () => { throw salonError("INDISPONIBLE"); },
    lienConnexion: async () => lienSalonUrl("principal"),
    lienInvitation: async () => { throw salonError("INDISPONIBLE"); },
    lireInvitation: async () => ({ statut: "invalide" }),
    accepterInvitation: async () => { throw salonError("INDISPONIBLE"); },
    ouvrirSalon: async (id) => {
      if (id !== "principal") throw salonError("SALON_INCONNU");
      return this.principal();
    },
  };
}

/* ---------- salle temps réel : Realtime broadcast + presence (canal privé) ---------- */

type Envelope = { from: Who; payload: unknown };

class SupabaseRoom implements RealtimeRoom {
  private channel: RealtimeChannel | null = null;
  private queue: { event: string; payload: unknown }[] = [];
  private subscribed = false;
  private closed = false;
  private handlers = new Map<string, Set<(p: unknown, from: Who) => void>>();
  private bound = new Set<string>();
  private presenceCbs = new Set<(online: Who[]) => void>();
  private online: Who[] = [];
  private who: Who | null;
  private sb: SupabaseClient;
  private roomId: string;

  constructor(sb: SupabaseClient, roomId: string, who: Who | null, resolveWho: () => Promise<Who>) {
    this.sb = sb;
    this.roomId = roomId;
    this.who = who;
    if (who) this.open(who);
    else resolveWho().then((w) => { this.who = w; this.open(w); }).catch((e) => console.error("[salle]", e));
  }

  private open(who: Who) {
    if (this.closed) return;
    const ch = this.sb.channel(`room:${this.roomId}`, {
      config: { private: true, broadcast: { self: false, ack: false }, presence: { key: who } },
    });
    this.channel = ch;
    for (const ev of this.handlers.keys()) this.bind(ev);
    ch.on("presence", { event: "sync" }, () => {
      const keys = Object.keys(ch.presenceState()).filter(isWho);
      this.online = (["alexandre", "flavie"] as Who[]).filter((w) => keys.includes(w));
      this.presenceCbs.forEach((cb) => cb([...this.online]));
    });
    ch.subscribe(async (status, err) => {
      if (status === "SUBSCRIBED") {
        this.subscribed = true;
        await ch.track({ who, at: new Date().toISOString() });
        for (const m of this.queue.splice(0)) this.send(m.event, m.payload);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.subscribed = false;
        console.error("[salle]", status, err?.message ?? "");
      }
    });
  }

  private bind(event: string) {
    if (!this.channel || this.bound.has(event)) return;
    this.bound.add(event);
    this.channel.on("broadcast", { event }, ({ payload }) => {
      const env = payload as Envelope;
      this.handlers.get(event)?.forEach((cb) => cb(env?.payload, env?.from));
    });
  }

  send = (event: string, payload: unknown) => {
    if (this.closed) return;
    if (!this.channel || !this.subscribed || !this.who) { this.queue.push({ event, payload }); return; }
    void this.channel.send({ type: "broadcast", event, payload: { from: this.who, payload } satisfies Envelope });
  };

  on = (event: string, cb: (payload: unknown, from: Who) => void) => {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(cb);
    // Les écouteurs « broadcast » peuvent s'ajouter même après subscribe (pas ceux de presence).
    this.bind(event);
    return () => { this.handlers.get(event)?.delete(cb); };
  };

  presence = (cb: (online: Who[]) => void) => {
    this.presenceCbs.add(cb);
    cb([...this.online]);
    return () => { this.presenceCbs.delete(cb); };
  };

  leave = () => {
    if (this.closed) return;
    this.closed = true;
    this.handlers.clear();
    this.presenceCbs.clear();
    if (this.channel) { void this.channel.untrack(); void this.sb.removeChannel(this.channel); }
    this.channel = null;
  };
}
