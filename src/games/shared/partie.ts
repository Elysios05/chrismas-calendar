/**
 * Socle des jeux à deux : un **journal de coups** partagé.
 *
 * Pourquoi : `backend.joinRoom` ne garantit rien. Un message envoyé pendant que l'autre
 * a l'écran éteint est perdu, personne ne rattrape ce qui s'est dit avant son arrivée, et
 * un rechargement de page repart de zéro. Un jeu bâti directement dessus se désynchronise.
 *
 * Le principe ici : chaque action est un **coup** avec un identifiant stable. Un coup est
 *  1. diffusé tout de suite dans la salle (c'est le « direct ») ;
 *  2. déposé dans l'état de la case via `setGameState` (c'est la mémoire).
 * Qui arrive, revient ou a raté un message rejoue le journal et se retrouve au bon endroit.
 *
 * Conséquence agréable : le mode « tour par tour » n'est pas un deuxième jeu à écrire.
 * C'est le même journal, lu plus tard.
 */

import type { GameContext, RealtimeRoom, Who } from "../../core/contracts";

export type Coup<T> = {
  /** Identifiant stable, choisi par le jeu (ex. « reponse:3 ») : deux fois le même = un seul coup */
  id: string;
  de: Who;
  /** Horodatage de l'auteur, pour l'ordre d'affichage */
  le: number;
  t: T;
};

export type Partie<T> = {
  /** Tous les coups connus, dans l'ordre */
  coups: Coup<T>[];
  /** Les miens, raccourci pratique */
  miens(): Coup<T>[];
  /** Ceux de l'autre */
  siens(): Coup<T>[];
  /** Joue un coup : direct + dépôt. Rejoue sans effet si l'identifiant existe déjà. */
  jouer(id: string, t: T): Promise<void>;
  /** L'autre est-il connecté maintenant ? */
  ensemble(): boolean;
  surPresence(cb: (ensemble: boolean) => void): () => void;
  surCoup(cb: (coup: Coup<T>, direct: boolean) => void): () => void;
  /** Relit le dépôt et fusionne (retour d'absence, message perdu) */
  rafraichir(): Promise<void>;
  quitter(): void;
};

const EVENEMENT = "coup";
/** Tant que l'autre n'est pas là, on relit le dépôt de temps en temps : il a pu jouer son tour */
const RELECTURE_MS = 20_000;

export async function ouvrirPartie<T>(ctx: GameContext, cle = "journal"): Promise<Partie<T>> {
  const coups: Coup<T>[] = [];
  const vus = new Set<string>();
  const ecouteursCoup = new Set<(c: Coup<T>, direct: boolean) => void>();
  const ecouteursPresence = new Set<(ensemble: boolean) => void>();
  let aDeux = false;
  let ferme = false;

  const trier = () => coups.sort((a, b) => a.le - b.le || a.id.localeCompare(b.id));

  /** Ajoute un coup s'il est nouveau. Renvoie vrai si c'est le cas. */
  const absorber = (c: Coup<T>, direct: boolean) => {
    if (!c || typeof c.id !== "string" || vus.has(c.id)) return false;
    vus.add(c.id);
    coups.push(c);
    trier();
    ecouteursCoup.forEach((cb) => cb(c, direct));
    return true;
  };

  const lireDepot = async (): Promise<Coup<T>[]> => {
    try { return (await ctx.backend.getGameState<Coup<T>[]>(ctx.day, cle)) ?? []; } catch { return []; }
  };

  const rafraichir = async () => {
    const distants = await lireDepot();
    let nouveaux = false;
    for (const c of distants) nouveaux = absorber(c, false) || nouveaux;
    // si le dépôt ignore des coups que nous avons (deux écritures en même temps), on le répare
    if (distants.length < coups.length) {
      try { await ctx.backend.setGameState<Coup<T>[]>(ctx.day, cle, [...coups]); } catch { /* on réessaiera */ }
    }
    return nouveaux;
  };

  await rafraichir();

  /* ---------- salle temps réel ---------- */
  let salle: RealtimeRoom | null = null;
  try {
    salle = ctx.backend.joinRoom(`jour-${ctx.day}`);
    salle.on(EVENEMENT, (payload) => {
      const c = payload as Coup<T>;
      // un trou dans le journal (message perdu) : on relit le dépôt plutôt que de deviner
      if (!absorber(c, true)) return;
    });
    salle.presence((enLigne) => {
      const ensemble = enLigne.includes(ctx.partner);
      if (ensemble === aDeux) return;
      aDeux = ensemble;
      ecouteursPresence.forEach((cb) => cb(ensemble));
      // l'autre vient d'arriver : il a peut-être joué de son côté entre-temps
      if (ensemble) void rafraichir();
    });
  } catch {
    salle = null; // pas de temps réel : on reste en tour par tour, le journal suffit
  }

  const minuteur = setInterval(() => { if (!ferme && !aDeux) void rafraichir(); }, RELECTURE_MS);
  // au retour sur l'onglet, on se remet à jour tout de suite
  const auRetour = () => { if (!ferme && document.visibilityState === "visible") void rafraichir(); };
  document.addEventListener("visibilitychange", auRetour);

  return {
    coups,
    miens: () => coups.filter((c) => c.de === ctx.me),
    siens: () => coups.filter((c) => c.de === ctx.partner),
    ensemble: () => aDeux,

    async jouer(id, t) {
      if (vus.has(id)) return;
      const coup: Coup<T> = { id, de: ctx.me, le: Date.now(), t };
      absorber(coup, true);
      try { salle?.send(EVENEMENT, coup); } catch { /* le dépôt prend le relais */ }
      // dépôt : on relit juste avant pour ne pas écraser un coup de l'autre
      try {
        const distants = await lireDepot();
        for (const c of distants) absorber(c, false);
        await ctx.backend.setGameState<Coup<T>[]>(ctx.day, cle, [...coups]);
      } catch { /* hors ligne : le coup vit au moins dans cette partie */ }
    },

    surPresence(cb) { ecouteursPresence.add(cb); return () => { ecouteursPresence.delete(cb); }; },
    surCoup(cb) { ecouteursCoup.add(cb); return () => { ecouteursCoup.delete(cb); }; },
    // chaque coup absorbé prévient déjà `surCoup` ; seuls ceux lus à l'ouverture, avant que
    // le jeu n'écoute, n'ont prévenu personne — d'où le rafraîchissement du jeu à la connexion.
    rafraichir: async () => { await rafraichir(); },

    quitter() {
      ferme = true;
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
      ecouteursCoup.clear();
      ecouteursPresence.clear();
      try { salle?.leave(); } catch { /* déjà partie */ }
    },
  };
}
