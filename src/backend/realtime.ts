/**
 * Aide aux jeux en direct (Pictionary, duel, quiz synchro, bonhomme à deux, boules de neige, sapin à deux).
 * Construit au-dessus de `backend.joinRoom` : marche pareil en démo (deux onglets) et avec Supabase.
 * Mode d'emploi pour l'équipe Jeux : src/backend/README.md.
 *
 * Ce que ça apporte :
 *  - une salle par jour (`room:jour-5` côté Supabase) ;
 *  - « l'autre est là / est parti » ;
 *  - « prêt ? » des deux côtés, puis départ synchronisé sur une HORLOGE COMMUNE (celle d'Alexandre,
 *    l'autre estime le décalage par ping-pong) : les deux comptes à rebours finissent au même instant ;
 *  - un état partagé simple (le dernier écrit gagne) ;
 *  - la reprise après une déconnexion ou un rechargement (état et départ gardés dans getGameState).
 */
import type { BackendApi, DayNumber, RealtimeRoom, Who } from "../core/contracts";
import { partnerOf } from "./config";

/** Identifiant de salle pour un jour (joinRoom ajoute le préfixe « room: » côté Supabase). */
export const dayRoomId = (day: DayNumber, suffix?: string) => `jour-${day}${suffix ? "-" + suffix : ""}`;

/** Le « meneur » fixe l'heure de départ ; son horloge sert d'horloge commune. */
export const LEADER: Who = "alexandre";

export type LivePhase = "attente" | "compte-a-rebours" | "en-jeu";

export type LiveOptions<S> = {
  /** Variante de salle pour plusieurs parties le même jour (par défaut : une seule) */
  name?: string;
  /** État de départ (avant toute écriture) */
  initialState: S;
  /** Durée du compte à rebours après « prêt » des deux côtés (ms). Défaut : 3000 */
  countdownMs?: number;
  /** Pour les tests : horloge locale (défaut Date.now) */
  clock?: () => number;
};

type Stamp = { at: number; by: Who };
type Saved<S> = { state: S; stamp: Stamp; startAt: number | null; seed: number | null };
type Wire<S> =
  | { k: "hello"; ready: boolean; saved: Saved<S> }
  | { k: "ready"; ready: boolean }
  | { k: "state"; state: S; stamp: Stamp }
  | { k: "start"; at: number; seed: number }
  | { k: "ping"; t0: number }
  | { k: "pong"; t0: number; t1: number }
  | { k: "reset" };

const EV = "__live";

const newer = (a: Stamp, b: Stamp) => a.at > b.at || (a.at === b.at && a.by > b.by);

export class LiveGame<S> {
  readonly me: Who;
  readonly partner: Who;
  readonly day: DayNumber;
  private room: RealtimeRoom;
  private backend: BackendApi;
  private key: string;
  private clock: () => number;
  private countdownMs: number;

  private offset = 0;             // horlogeCommune = horlogeLocale + offset (0 pour le meneur)
  private bestRtt = Infinity;
  private partnerHere = false;
  private myReady = false;
  private partnerReady = false;
  private saved: Saved<S>;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private offs: (() => void)[] = [];
  private closed = false;

  private partnerCbs = new Set<(here: boolean) => void>();
  private readyCbs = new Set<(r: { me: boolean; partner: boolean }) => void>();
  private stateCbs = new Set<(s: S, by: Who) => void>();
  private startCbs = new Set<(s: { startsAt: number; seed: number; resumed: boolean }) => void>();

  /** Promesse résolue quand l'état sauvegardé (reprise) a été relu. */
  readonly loaded: Promise<void>;

  constructor(backend: BackendApi, me: Who, day: DayNumber, opts: LiveOptions<S>) {
    this.backend = backend;
    this.me = me;
    this.partner = partnerOf(me);
    this.day = day;
    this.key = `live:${opts.name ?? "partie"}`;
    this.clock = opts.clock ?? Date.now;
    this.countdownMs = opts.countdownMs ?? 3000;
    this.saved = { state: opts.initialState, stamp: { at: 0, by: me }, startAt: null, seed: null };
    this.room = backend.joinRoom(dayRoomId(day, opts.name));

    this.offs.push(this.room.on(EV, (p, from) => this.receive(p as Wire<S>, from)));
    this.offs.push(this.room.presence((online) => {
      const here = online.includes(this.partner);
      if (here === this.partnerHere) return;
      this.partnerHere = here;
      if (!here) { this.partnerReady = false; this.emitReady(); }
      if (here) this.hello();
      this.partnerCbs.forEach((cb) => cb(here));
    }));

    // Reprise : relit l'état sauvegardé (rechargement de page, retour après coupure)
    this.loaded = backend.getGameState<Saved<S>>(day, this.key).then((s) => {
      if (s && newer(s.stamp, this.saved.stamp)) {
        this.saved = { ...s };
        this.stateCbs.forEach((cb) => cb(this.saved.state, s.stamp.by));
      }
      if (s?.startAt != null) this.emitStart(true);
    }).catch(() => { /* pas d'état : partie neuve */ });

    // Synchronisation d'horloge (le non-meneur interroge le meneur) : rafale au début, puis de temps en temps
    if (this.me !== LEADER) {
      let n = 0;
      this.pingTimer = setInterval(() => {
        if (this.partnerHere) this.send({ k: "ping", t0: this.clock() });
        if (++n === 10 && this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = setInterval(() => {
          if (this.partnerHere) this.send({ k: "ping", t0: this.clock() });
        }, 5000); }
      }, 300);
    }
  }

  /* ---------- lecture ---------- */

  /** Heure de l'horloge commune (ms). */
  now(): number { return this.clock() + this.offset; }
  /** Convertit une heure de l'horloge commune en heure locale (pour setTimeout, requestAnimationFrame…). */
  toLocal(sharedMs: number): number { return sharedMs - this.offset; }
  get partnerPresent(): boolean { return this.partnerHere; }
  get state(): S { return this.saved.state; }
  get phase(): LivePhase {
    if (this.saved.startAt == null) return "attente";
    return this.now() < this.saved.startAt ? "compte-a-rebours" : "en-jeu";
  }
  /** Décalage estimé avec l'horloge commune (ms) et meilleur aller-retour mesuré (debug). */
  get clockInfo() { return { offset: this.offset, rtt: this.bestRtt }; }

  /* ---------- abonnements (chacun renvoie une fonction de désabonnement) ---------- */

  onPartner(cb: (here: boolean) => void) { this.partnerCbs.add(cb); cb(this.partnerHere); return () => { this.partnerCbs.delete(cb); }; }
  onReady(cb: (r: { me: boolean; partner: boolean }) => void) { this.readyCbs.add(cb); return () => { this.readyCbs.delete(cb); }; }
  onState(cb: (s: S, by: Who) => void) { this.stateCbs.add(cb); return () => { this.stateCbs.delete(cb); }; }
  /**
   * Départ : `startsAt` est en heure LOCALE (comparable à Date.now()) ; `seed` est un nombre commun aux deux
   * (pour tirer les mêmes mots, la même grille…) ; `resumed` = la partie avait déjà démarré (reprise).
   */
  onStart(cb: (s: { startsAt: number; seed: number; resumed: boolean }) => void) {
    this.startCbs.add(cb);
    if (this.saved.startAt != null) cb(this.startInfo(true));
    return () => { this.startCbs.delete(cb); };
  }

  /* ---------- actions ---------- */

  /** « Je suis prêt·e » (ou plus prêt·e). Quand les deux le sont, le meneur lance le compte à rebours. */
  setReady(ready = true) {
    this.myReady = ready;
    this.send({ k: "ready", ready });
    this.emitReady();
    this.maybeStart();
  }

  /** Remplace l'état partagé (le dernier écrit gagne, côté des deux joueurs). */
  setState(state: S) {
    const stamp: Stamp = { at: Math.max(this.now(), this.saved.stamp.at + 1), by: this.me };
    this.saved = { ...this.saved, state, stamp };
    this.send({ k: "state", state, stamp });
    this.stateCbs.forEach((cb) => cb(state, this.me));
    this.persist();
  }
  /** Modifie l'état à partir de l'état courant. */
  update(fn: (s: S) => S) { this.setState(fn(this.saved.state)); }

  /** Messages propres au jeu (traits de dessin, tirs…) : non sauvegardés, pour le flux rapide. */
  emit(event: string, payload: unknown) { this.room.send(event, payload); }
  on(event: string, cb: (payload: unknown, from: Who) => void) {
    const off = this.room.on(event, cb);
    this.offs.push(off);
    return off;
  }

  /** Nouvelle partie : efface le départ et les « prêt » (l'état est gardé, à remettre par setState). */
  reset() {
    this.myReady = false;
    this.partnerReady = false;
    this.saved = { ...this.saved, startAt: null, seed: null };
    this.send({ k: "reset" });
    this.emitReady();
    this.persist();
  }

  leave() {
    if (this.closed) return;
    this.closed = true;
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.flush(); }
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.offs.forEach((f) => f());
    this.room.leave();
    this.partnerCbs.clear(); this.readyCbs.clear(); this.stateCbs.clear(); this.startCbs.clear();
  }

  /* ---------- interne ---------- */

  private send(m: Wire<S>) { if (!this.closed) this.room.send(EV, m); }

  private hello() { this.send({ k: "hello", ready: this.myReady, saved: this.saved }); }

  private receive(m: Wire<S>, from: Who) {
    if (!m || from !== this.partner) return;
    switch (m.k) {
      case "hello":
        this.partnerReady = m.ready;
        this.emitReady();
        this.mergeSaved(m.saved);
        if (!this.partnerHere) { this.partnerHere = true; this.partnerCbs.forEach((cb) => cb(true)); this.hello(); }
        this.maybeStart();
        break;
      case "ready":
        this.partnerReady = m.ready;
        this.emitReady();
        this.maybeStart();
        break;
      case "state":
        if (newer(m.stamp, this.saved.stamp)) {
          this.saved = { ...this.saved, state: m.state, stamp: m.stamp };
          this.stateCbs.forEach((cb) => cb(m.state, from));
          this.persist();
        }
        break;
      case "start":
        if (this.saved.startAt !== m.at) {
          this.saved = { ...this.saved, startAt: m.at, seed: m.seed };
          this.emitStart(false);
        }
        break;
      case "ping":
        this.send({ k: "pong", t0: m.t0, t1: this.now() });
        break;
      case "pong": {
        const t2 = this.clock();
        const rtt = t2 - m.t0;
        // On garde la mesure du plus court aller-retour (la plus fiable)
        if (rtt >= 0 && rtt <= this.bestRtt) { this.bestRtt = rtt; this.offset = m.t1 + rtt / 2 - t2; }
        break;
      }
      case "reset":
        this.myReady = false; this.partnerReady = false;
        this.saved = { ...this.saved, startAt: null, seed: null };
        this.emitReady();
        break;
    }
  }

  private mergeSaved(s: Saved<S>) {
    if (newer(s.stamp, this.saved.stamp)) {
      this.saved = { ...this.saved, state: s.state, stamp: s.stamp };
      this.stateCbs.forEach((cb) => cb(s.state, s.stamp.by));
    }
    if (s.startAt != null && this.saved.startAt == null) {
      this.saved = { ...this.saved, startAt: s.startAt, seed: s.seed };
      this.emitStart(true);
    }
  }

  private maybeStart() {
    if (this.me !== LEADER || !this.myReady || !this.partnerReady || this.saved.startAt != null) return;
    const at = this.now() + this.countdownMs;
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.saved = { ...this.saved, startAt: at, seed };
    this.send({ k: "start", at, seed });
    this.emitStart(false);
    this.persist();
  }

  private startInfo(resumed: boolean) {
    return { startsAt: this.toLocal(this.saved.startAt!), seed: this.saved.seed ?? 0, resumed };
  }
  private emitStart(resumed: boolean) { const i = this.startInfo(resumed); this.startCbs.forEach((cb) => cb(i)); }
  private emitReady() { const r = { me: this.myReady, partner: this.partnerReady }; this.readyCbs.forEach((cb) => cb(r)); }

  /** Sauvegarde différée (au plus une écriture toutes les 500 ms). */
  private persist() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.flush(); }, 500);
  }
  private flush() { void this.backend.setGameState(this.day, this.key, this.saved).catch(() => { /* hors ligne : réessayé au prochain changement */ }); }
}

/** Raccourci : `const live = await joinLive(backend, 5, { initialState: {...} })`. */
export async function joinLive<S>(backend: BackendApi, day: DayNumber, opts: LiveOptions<S>): Promise<LiveGame<S>> {
  const me = await backend.me();
  if (!me) throw new Error("Pas connecté.");
  const g = new LiveGame<S>(backend, me, day, opts);
  await g.loaded;
  return g;
}
