// Présentation d'un monde la première fois qu'on y arrive (issue #12, choix d'Alexandre : « survol de la route »).
// La caméra recule un peu, file le long de la route jusqu'au bout du monde (ou jusqu'au banc de nuages),
// puis revient en douceur sur le personnage. Un toucher, la molette ou le clavier l'arrêtent aussitôt.
import type { Pt } from "./iso";

/** Durées en millisecondes : on recule, on file, on revient */
const ENTREE = 700, TRAJET = 1900, RETOUR = 900;
/** Retour accéléré quand le joueur coupe le survol */
const RETOUR_COUPE = 380;
/** Zoom au plus loin : assez pour voir loin devant, pas au point de perdre le personnage de vue */
export const ZOOM_SURVOL = 0.74;
const ZOOM = ZOOM_SURVOL;

const doux = (t: number) => t * t * (3 - 2 * t);
const tresDoux = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export type CameraSurvol = { x: number; y: number; zoom: number; poids: number; fini: boolean };

export class Survol {
  readonly zone: number;
  private readonly route: Pt[];
  private readonly longueurs: number[];
  readonly t0: number;
  /** Moment où le retour a commencé (fin normale ou coupure), et poids à ce moment-là */
  private retour: { t: number; duree: number; depuis: number; point: Pt } | null = null;
  /** Coupé par le joueur (toucher, molette, clavier) : le monde compte comme présenté */
  coupeParJoueur = false;
  /** Coupé par autre chose (défilement automatique, ouverture d'une case) : on le rejouera plus tard */
  interrompu = false;

  /** `route` : points du monde (coordonnées de la scène), du personnage jusqu'au bout visible du monde */
  constructor(zone: number, route: Pt[], maintenant: number) {
    this.zone = zone;
    this.route = route.length ? route : [{ x: 0, y: 0 }];
    this.longueurs = [0];
    for (let i = 1; i < this.route.length; i++) {
      const a = this.route[i - 1], b = this.route[i];
      this.longueurs.push(this.longueurs[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.t0 = maintenant;
  }

  /** Point de la route à la fraction `f` de sa longueur */
  private pointA(f: number): Pt {
    const L = this.longueurs, total = L[L.length - 1];
    if (total <= 0) return this.route[0];
    const cible = f * total;
    let i = 1;
    while (i < L.length - 1 && L[i] < cible) i++;
    const a = this.route[i - 1], b = this.route[i];
    const seg = L[i] - L[i - 1] || 1;
    const k = Math.max(0, Math.min(1, (cible - L[i - 1]) / seg));
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  /** Avance du trajet seul (0 → 1), lent au départ et à l'arrivée */
  private avance(t: number) {
    return tresDoux(Math.max(0, Math.min(1, (t - ENTREE * 0.45) / TRAJET)));
  }

  /** Le joueur reprend la main (ou le défilement bouge tout seul) : on rentre vite, sans à-coup */
  couper(maintenant: number, parJoueur = true) {
    if (this.retour || this.etat(maintenant).fini) return;
    this.coupeParJoueur = parJoueur;
    this.interrompu = !parJoueur;
    const e = this.etat(maintenant);
    this.retour = { t: maintenant, duree: RETOUR_COUPE, depuis: e.poids, point: { x: e.x, y: e.y } };
  }

  /**
   * Caméra à l'instant `maintenant` : point du monde à mettre au centre, zoom relatif, et `poids`
   * (0 = caméra normale, 1 = survol pur) pour mélanger avec la caméra qui suit le défilement.
   */
  etat(maintenant: number): CameraSurvol {
    const t = maintenant - this.t0;
    // fin normale : calculée à chaque fois (rien n'est mémorisé, la lecture reste sans effet)
    const retour = this.retour ?? (t >= ENTREE * 0.45 + TRAJET
      ? { t: this.t0 + ENTREE * 0.45 + TRAJET, duree: RETOUR, depuis: 1, point: this.pointA(1) }
      : null);
    if (retour) {
      const k = Math.max(0, Math.min(1, (maintenant - retour.t) / retour.duree));
      const poids = retour.depuis * (1 - doux(k));
      return { ...retour.point, zoom: 1 - (1 - ZOOM) * poids, poids, fini: k >= 1 };
    }
    const poids = doux(Math.min(1, t / ENTREE));
    const p = this.pointA(this.avance(t));
    return { x: p.x, y: p.y, zoom: 1 - (1 - ZOOM) * poids, poids, fini: false };
  }
}

/* ---------------- mémoire : mondes déjà présentés, par joueur ---------------- */
// Sur l'appareil seulement (localStorage) : revoir un survol sur un autre téléphone n'a rien de grave,
// et cela évite un changement de contrat avec le backend.
const cle = (who: string) => `calendrier.mondesPresentes.${who}`;

export function mondesPresentes(who: string): Set<string> {
  try {
    const brut = localStorage.getItem(cle(who));
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string") : []);
  } catch { return new Set(); }
}

export function marquerPresente(who: string, zoneId: string) {
  const deja = mondesPresentes(who);
  deja.add(zoneId);
  try { localStorage.setItem(cle(who), JSON.stringify([...deja])); } catch { /* navigation privée : on reverra le survol */ }
}

export function oublierPresentations(who: string) {
  try { localStorage.removeItem(cle(who)); } catch { /* rien à oublier */ }
}
