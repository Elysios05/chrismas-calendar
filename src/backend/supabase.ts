/**
 * Backend réel : Supabase (Auth + Postgres avec RLS + Storage + Realtime).
 * Les règles de sécurité vivent dans supabase/migrations/ : ce fichier ne fait que les appeler.
 * Chargé en import dynamique (voir index.ts) pour ne pas alourdir le mode démo.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BackendApi, DayNumber, InvitationInfo, JoueurSalon, PreparedContent, PreparedResult, Progress, RealtimeRoom,
  ReminderStatus, Salon, SalonApi, SalonConfig, SalonCree, SalonErreurCode, Who,
} from "../core/contracts";
import { browserStatus, currentSubscription, subscribe, subscriptionKeys } from "./push";
import type { PasswordRecovery } from "./index";
import {
  FROZEN_MESSAGE, MOT_DE_PASSE_MIN, PHOTO_MAX_DIMENSION, PHOTO_QUALITE, PREPARED_DAYS, READ_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS,
  checkMotDePasse, checkPhotoSize, checkSalonConfig, compressImage, isWho, lienInvitationUrl, lienSalonUrl, partnerOf,
  salonError, siteBaseUrl,
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
/** Dernier salon ouvert sur cet appareil (le site le rouvre sans lien). */
const SALON_KEY = "cc-salon";

const SALON_CODES: SalonErreurCode[] = [
  "INVITATION_INVALIDE", "INVITATION_UTILISEE", "LIMITE_CREATION", "NON_AUTORISE", "SALON_INCONNU",
  "MOT_DE_PASSE_FAIBLE", "CONFIG_INVALIDE", "INDISPONIBLE",
];
/** Les fonctions SQL lèvent « CODE : message » ; on en refait une SalonError (message par défaut si besoin). */
function salonErrorFrom(message: string, fallback: SalonErreurCode = "INDISPONIBLE") {
  const code = SALON_CODES.find((c) => message.includes(c));
  if (!code) return salonError(fallback, fallback === "INDISPONIBLE" ? "Le serveur n'a pas pu répondre : " + message : undefined);
  const text = message.split(code).pop()!.replace(/^\s*:\s*/, "").trim();
  return salonError(code, text ? text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? "" : ".") : undefined);
}
const readSalonParam = () => {
  try { return new URLSearchParams(location.search).get("salon"); } catch { return null; }
};
const readStoredSalon = () => {
  try { return localStorage.getItem(SALON_KEY); } catch { return null; }
};
type SalonRow = { id: string; config: SalonConfig; created_at: string };
type SalonPublic = { id: string; joueurs: Record<Who, JoueurSalon>; inviteArrive: boolean; createdAt: string };
/** Compte connecté : sa place et son salon (table profiles). */
type Profil = { who: Who; salonId: string };

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
  if (message.includes("QUOTA_JEUX")) return "Ce calendrier a atteint sa place maximale pour les jeux : rien n'a été enregistré.";
  if (message.includes("row-level security")) return "Action refusée par le serveur.";
  return message;
}

export class SupabaseBackend implements BackendApi, PasswordRecovery {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;
  private who: Who | null = null;           // place dans le SALON COURANT (null si pas membre de ce salon)
  private profil: Profil | null = null;     // compte connecté (peut appartenir à un autre salon)
  private salonId: string | null = readSalonParam() || readStoredSalon();
  private salonCache: Salon | null = null;
  private salonListeners = new Set<(salon: Salon | null) => void>();
  private salonChannel: RealtimeChannel | null = null;
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
        if (event === "SIGNED_OUT") {
          this.who = null; this.profil = null; this.whoReady = Promise.resolve(null); this.emitAuth(null); this.watchSalon(); return;
        }
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

  /**
   * Lit la place (alexandre/flavie) et le salon du compte connecté (table profiles).
   * Sans salon courant (ni lien, ni salon retenu), le salon du compte devient le salon courant.
   */
  private async loadWho(): Promise<Who | null> {
    const { data: { session } } = await this.sb.auth.getSession();
    if (!session) { this.who = null; this.profil = null; this.watchSalon(); return null; }
    const { data, error } = await this.sb.from("profiles").select("who, salon_id").eq("user_id", session.user.id).maybeSingle();
    if (error) throw new Error("Lecture du profil impossible : " + error.message);
    this.profil = data && isWho(data.who) ? { who: data.who, salonId: String(data.salon_id) } : null;
    if (this.profil && !this.salonId) this.setSalonId(this.profil.salonId);
    this.who = this.profil && this.profil.salonId === this.salonId ? this.profil.who : null;
    this.watchSalon();
    return this.who;
  }

  private setSalonId(id: string | null) {
    if (id !== this.salonId) this.salonCache = null;
    this.salonId = id;
    try { if (id) localStorage.setItem(SALON_KEY, id); else localStorage.removeItem(SALON_KEY); } catch { /* indisponible */ }
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
    const info = await this.connexionInfo(who);
    if (info.email) {
      // Adresse technique (rien de personnel) : connexion directe
      const { error } = await this.sb.auth.signInWithPassword({ email: info.email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Mot de passe incorrect." : error.message);
    } else {
      // Adresse réelle : elle ne quitte jamais le serveur, c'est l'Edge Function qui connecte (SEC-05)
      const r = await this.callSalons<{ session: { access_token: string; refresh_token: string } }>({
        action: "connexion", salonId: this.salonId, place: who, motDePasse: password,
      });
      const { error } = await this.sb.auth.setSession(r.session);
      if (error) throw new Error("Connexion impossible pour le moment. Réessaie dans un instant.");
    }
    this.whoReady = this.loadWho();
    const got = await this.whoReady;
    if (got !== who) {
      await this.sb.auth.signOut();
      this.who = null;
      this.profil = null;
      this.whoReady = Promise.resolve(null);
      throw new Error("Ce compte n'appartient pas à ce calendrier.");
    }
    this.emitAuth(got);
    this.emitSalon();
  }

  /**
   * Comment se connecter à une place du salon courant : `email` = adresse technique <salon>-<place>@… (connexion
   * directe), ou null si le compte a une adresse réelle (connexion par l'Edge Function, l'adresse reste secrète).
   */
  private async connexionInfo(who: Who): Promise<{ email: string | null }> {
    if (!this.salonId) throw new Error("Ouvre le lien de connexion de ton calendrier pour te connecter.");
    const { data, error } = await this.sb.rpc("salon_connexion_info", { p_salon: this.salonId, p_place: who });
    if (error) throw new Error("Connexion impossible pour le moment. Réessaie dans un instant.");
    const d = data as { existe?: boolean; email?: string | null } | null;
    if (!d?.existe) {
      throw new Error(who === "flavie"
        ? "Cette personne n'a pas encore rejoint le calendrier : envoie-lui le lien d'invitation."
        : "Ce calendrier n'existe pas (ou plus).");
    }
    return { email: d.email ?? null };
  }

  async signOut() {
    // L'appareil ne doit plus recevoir les rappels de la personne qui se déconnecte
    try {
      const sub = await currentSubscription();
      if (sub) { await this.sb.rpc("delete_push_subscription", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
    } catch { /* sans gravité */ }
    await this.sb.auth.signOut();
    this.who = null;
    this.profil = null;
    this.whoReady = Promise.resolve(null);
    this.emitAuth(null);
    this.watchSalon();
    this.emitSalon();   // le contenu n'est plus lisible
  }

  /** Jeton anti-robot de la création en cours (creerSalonAvecCaptcha). */
  private captcha: string | undefined;

  /* ----- mot de passe oublié (méthodes en plus du contrat) ----- */

  async resetPassword(who: Who) {
    const info = await this.connexionInfo(who);
    if (info.email) {
      throw new Error("Aucune adresse e-mail n'a été donnée pour ce compte : le mot de passe ne peut pas être "
        + "réinitialisé par e-mail.");
    }
    const back = typeof location !== "undefined"
      ? siteBaseUrl() + (this.salonId ? `?salon=${encodeURIComponent(this.salonId)}` : "") : undefined;
    // L'adresse réelle n'est connue que du serveur : c'est lui qui demande l'e-mail (SEC-05)
    await this.callSalons({ action: "oubli", salonId: this.salonId, place: who, redirectTo: back });
  }

  inPasswordRecovery() { return this.recovery; }

  async updatePassword(newPassword: string) {
    if (newPassword.length < MOT_DE_PASSE_MIN) throw new Error(`Mot de passe trop court (${MOT_DE_PASSE_MIN} caractères minimum).`);
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
    const { error } = await this.sb.from("progress").upsert({ who: me, day }, { onConflict: "salon_id,who,day", ignoreDuplicates: true });
    if (error) throw new Error(friendly(error.message));
  }

  async markCompleted(day: DayNumber) {
    const me = await this.requireMe();
    const { error } = await this.sb.from("progress")
      .upsert({ who: me, day, completed_at: new Date().toISOString() }, { onConflict: "salon_id,who,day" });
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
      { onConflict: "salon_id,day,from_who" },
    );
    // Le serveur refuse (CASE_FIGEE) si le destinataire a déjà ouvert la case
    if (error) throw new Error(friendly(error.message));
  }

  /** Taille des photos de ce salon (réglage du serveur : 1280 px en général), lue une fois. */
  private photoDimension: { salon: string; px: number } | null = null;
  private async dimensionPhotos(salon: string): Promise<number> {
    if (this.photoDimension?.salon === salon) return this.photoDimension.px;
    let px = PHOTO_MAX_DIMENSION;
    try {
      const { data } = await this.sb.rpc("salon_public", { p_salon: salon });
      const v = Number((data as { photoDimension?: unknown } | null)?.photoDimension);
      if (Number.isFinite(v) && v >= 320 && v <= 4000) px = Math.round(v);
    } catch { /* réglage par défaut */ }
    this.photoDimension = { salon, px };
    return px;
  }

  /** Envoie une photo dans <salon>/<moi>/<uuid>.jpg et renvoie une URL signée valable 60 jours. */
  async uploadPhoto(file: Blob): Promise<string> {
    const me = await this.requireMe();
    const salon = this.profil!.salonId;
    const small = await compressImage(file, await this.dimensionPhotos(salon), PHOTO_QUALITE);
    checkPhotoSize(small);
    const ext = small.type === "image/png" ? "png" : small.type === "image/webp" ? "webp" : "jpg";
    const path = `${salon}/${me}/${crypto.randomUUID()}.${ext}`;
    const up = await this.sb.storage.from(BUCKET).upload(path, small, { contentType: small.type || "image/jpeg", upsert: false });
    if (up.error) {
      // La règle d'accès refuse aussi quand le quota de photos du salon est atteint
      if (/row-level security|violates/i.test(up.error.message)) {
        throw new Error("Envoi de la photo refusé : le calendrier a peut-être atteint sa place maximale pour les photos.");
      }
      throw new Error("Envoi de la photo impossible : " + up.error.message);
    }
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
      .upsert({ day, key, value: value as unknown }, { onConflict: "salon_id,day,key" });
    if (error) throw new Error(friendly(error.message));
  }

  joinRoom(roomId: string): RealtimeRoom {
    const now = this.who && this.profil ? { who: this.who, salon: this.profil.salonId } : null;
    return new SupabaseRoom(this.sb, roomId, now, async () => ({ who: await this.requireMe(), salon: this.profil!.salonId }));
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

  /* ----- salons (docs/salons.md, supabase/migrations/0004_salons.sql, Edge Function « salons ») ----- */

  private salonListenersEmit(salon: Salon | null) {
    this.salonListeners.forEach((cb) => cb(salon));
  }
  /** Relit le salon courant et prévient les écouteurs. */
  private emitSalon() {
    this.salonCache = null;
    void this.fetchSalon().then((s) => this.salonListenersEmit(s), () => this.salonListenersEmit(null));
  }

  /**
   * Membre connecté : écoute les changements de la config (l'autre personne modifie les réglages).
   * Nécessite la table salons dans la publication Realtime (fait par 0004_salons.sql).
   */
  private watchSalon() {
    const id = this.who && this.salonId ? this.salonId : null;
    if (this.salonChannel && this.salonChannel.topic === `realtime:salon:${id}`) return;
    if (this.salonChannel) { void this.sb.removeChannel(this.salonChannel); this.salonChannel = null; }
    if (!id) return;
    this.salonChannel = this.sb.channel(`salon:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "salons", filter: `id=eq.${id}` }, () => this.emitSalon())
      .subscribe();
  }

  /** Salon courant : complet pour un membre connecté, sinon prénoms et couleurs seulement (contenu vide). */
  private async fetchSalon(): Promise<Salon | null> {
    try { await this.whoReady; } catch { /* session illisible : on lit en visiteur */ }
    const id = this.salonId;
    if (!id) return null;
    if (this.salonCache?.id === id) return structuredClone(this.salonCache);
    let salon: Salon | null = null;
    if (this.who) {
      const { data, error } = await this.sb.from("salons").select("id, config, created_at").eq("id", id).maybeSingle();
      if (error) throw salonErrorFrom(error.message);
      if (data) {
        const row = data as SalonRow;
        const { count } = await this.sb.from("profiles").select("who", { count: "exact", head: true }).eq("who", "flavie");
        salon = {
          id: row.id, config: { joueurs: row.config.joueurs, contenu: row.config.contenu ?? {} },
          inviteArrive: (count ?? 0) > 0, demo: false, createdAt: row.created_at,
        };
      }
    }
    if (!salon) {
      // uuid invalide (lien abîmé) : Postgres refuse la conversion → salon inconnu
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data, error } = await this.sb.rpc("salon_public", { p_salon: id });
      if (error) throw salonErrorFrom(error.message);
      if (!data) return null;
      const p = data as SalonPublic;
      salon = { id: p.id, config: { joueurs: p.joueurs, contenu: {} }, inviteArrive: !!p.inviteArrive, demo: false, createdAt: p.createdAt };
    }
    if (this.salonId !== id) return this.fetchSalon();   // salon changé pendant la lecture
    this.salonCache = salon;
    return structuredClone(salon);
  }

  /** Appelle l'Edge Function « salons » (création de comptes, réservée au serveur). */
  private async callSalons<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.functions.invoke("salons", { body });
    if (!error) return data as T;
    const ctx = (error as { context?: Response }).context;
    let payload: { code?: SalonErreurCode; message?: string } | null = null;
    try { payload = ctx && typeof ctx.json === "function" ? await ctx.json() : null; } catch { /* corps illisible */ }
    if (payload?.code && SALON_CODES.includes(payload.code)) throw salonError(payload.code, payload.message);
    throw salonError("INDISPONIBLE", "Le serveur des calendriers ne répond pas. Réessaie dans un instant.");
  }

  /** Connexion juste après la création d'un compte, puis ouverture de son salon. */
  private async enterSalon(salonId: string, email: string, password: string, rester?: boolean) {
    this.storage.persist = rester !== false;
    this.setSalonId(salonId);
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw salonError("INDISPONIBLE", "Compte créé, mais la connexion a échoué : " + error.message);
    this.whoReady = this.loadWho();
    const who = await this.whoReady;
    this.emitAuth(who);
    this.emitSalon();
  }

  readonly salons: SalonApi = {
    getSalon: () => this.fetchSalon(),

    onSalonChange: (cb) => {
      this.salonListeners.add(cb);
      return () => { this.salonListeners.delete(cb); };
    },

    creerSalon: async (input): Promise<SalonCree> => {
      const config = checkSalonConfig(input.config);
      checkMotDePasse(input.motDePasse);
      const r = await this.callSalons<{ salonId: string; jeton: string; email: string }>({
        action: "creer", config, motDePasse: input.motDePasse, email: input.email?.trim() || undefined,
        captcha: this.captcha || undefined,
      });
      await this.enterSalon(r.salonId, r.email, input.motDePasse, input.rester);
      const salon = await this.fetchSalon();
      if (!salon) throw salonError("INDISPONIBLE");
      return { salon, lienConnexion: lienSalonUrl(r.salonId), lienInvitation: lienInvitationUrl(r.jeton) };
    },

    modifierSalon: async (config) => {
      const clean = checkSalonConfig(config);
      const me = await this.me();
      if (!me || !this.salonId) throw salonError("NON_AUTORISE");
      const { data, error } = await this.sb.from("salons").update({ config: clean }).eq("id", this.salonId).select("id");
      if (error) throw salonErrorFrom(error.message, "NON_AUTORISE");
      if (!data?.length) throw salonError("NON_AUTORISE");   // la RLS filtre en silence
      this.salonCache = null;
      const salon = await this.fetchSalon();
      if (!salon) throw salonError("SALON_INCONNU");
      this.salonListenersEmit(structuredClone(salon));
      return salon;
    },

    lienConnexion: async () => {
      if (!this.salonId) throw salonError("SALON_INCONNU");
      return lienSalonUrl(this.salonId);
    },

    lienInvitation: async (options) => {
      if (!(await this.me())) throw salonError("NON_AUTORISE");
      const { data, error } = await this.sb.rpc("salon_invitation", { p_nouveau: options?.nouveau === true });
      if (error) throw salonErrorFrom(error.message, "NON_AUTORISE");
      return lienInvitationUrl(String(data));
    },

    lireInvitation: async (jeton): Promise<InvitationInfo> => {
      let t = jeton;
      if (t === undefined) { try { t = new URLSearchParams(location.search).get("invitation") ?? undefined; } catch { /* rien */ } }
      if (!t) return { statut: "invalide" };
      const { data, error } = await this.sb.rpc("salon_invitation_info", { p_token: t });
      if (error) throw salonErrorFrom(error.message);
      const d = data as { statut: string; salonId?: string; joueurs?: Record<Who, JoueurSalon> } | null;
      if (d?.statut === "valide" && d.salonId && d.joueurs) return { statut: "valide", jeton: t, salonId: d.salonId, joueurs: d.joueurs };
      if (d?.statut === "utilisee" && d.salonId && d.joueurs) return { statut: "utilisee", salonId: d.salonId, joueurs: d.joueurs };
      return { statut: "invalide" };
    },

    accepterInvitation: async (jeton, motDePasse, options) => {
      checkMotDePasse(motDePasse);
      const r = await this.callSalons<{ salonId: string; email: string }>({
        action: "accepter", jeton, motDePasse, email: options?.email?.trim() || undefined,
      });
      await this.enterSalon(r.salonId, r.email, motDePasse, options?.rester);
    },

    creerSalonAvecCaptcha: async (input, captcha) => {
      this.captcha = captcha;
      try { return await this.salons.creerSalon(input); } finally { this.captcha = undefined; }
    },

    supprimerSalon: async () => {
      // Réservé au créateur (le serveur le vérifie aussi)
      if ((await this.me()) !== "alexandre" || !this.salonId) throw salonError("NON_AUTORISE");
      // L'Edge Function lit le compte dans la session envoyée avec la requête
      await this.callSalons({ action: "supprimer" });
      try { const sub = await currentSubscription(); if (sub) await sub.unsubscribe(); } catch { /* sans gravité */ }
      try { await this.sb.auth.signOut({ scope: "local" }); } catch { /* comptes déjà supprimés */ }
      this.who = null;
      this.profil = null;
      this.whoReady = Promise.resolve(null);
      this.photoDimension = null;
      this.setSalonId(null);
      this.watchSalon();
      this.emitAuth(null);
      this.emitSalon();
    },

    ouvrirSalon: async (id) => {
      const before = this.who;
      const prev = this.salonId;
      this.setSalonId(id);
      this.who = this.profil && this.profil.salonId === id ? this.profil.who : null;
      this.whoReady = Promise.resolve(this.who);
      let salon: Salon | null = null;
      try { salon = await this.fetchSalon(); } catch { salon = null; }
      if (!salon) {
        // Salon inconnu : on revient au précédent
        this.setSalonId(prev);
        this.who = before;
        this.whoReady = Promise.resolve(before);
        throw salonError("SALON_INCONNU");
      }
      this.watchSalon();
      if (this.who !== before) this.emitAuth(this.who);
      if (id !== prev) this.salonListenersEmit(structuredClone(salon));
      return salon;
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

  /** Salle privée du salon : « room:<salon>:<salle> » (seuls ses membres y entrent, voir 0004_salons.sql). */
  constructor(sb: SupabaseClient, roomId: string, now: { who: Who; salon: string } | null,
    resolve: () => Promise<{ who: Who; salon: string }>) {
    this.sb = sb;
    this.roomId = roomId;
    this.who = now?.who ?? null;
    if (now) this.open(now.who, now.salon);
    else resolve().then((r) => { this.who = r.who; this.open(r.who, r.salon); }).catch((e) => console.error("[salle]", e));
  }

  private open(who: Who, salon: string) {
    if (this.closed) return;
    const ch = this.sb.channel(`room:${salon}:${this.roomId}`, {
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
