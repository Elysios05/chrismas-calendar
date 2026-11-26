/**
 * Jour 22 — moteur du tri des cadeaux (PixiJS).
 *
 * Repères : le jeu se passe dans un « terrain » centré, de largeur `L` (au plus 0,8 × la hauteur,
 * borné pour que l'ordinateur reste comparable au téléphone). Sur le tapis, la position d'un paquet
 * est une fraction : `x` de 0 (entrée du tapis, à gauche) à 1 (bout du tapis, à droite, où il tombe).
 * En bas, cinq emplacements : quatre hottes de couleur (la 4e s'ouvre en cours de partie) et la poubelle à charbon.
 *
 * Chaque couleur a aussi sa forme (étoile, sapin, boule, cœur) : on peut trier sans distinguer les couleurs.
 * Tous les paquets sont tirés à l'avance depuis `contenu.graine` : même graine = même partie pour les deux.
 */

import { Container, Graphics } from "pixi.js";
import type { SoundApi } from "../../core/contracts";
import { TRI_CADEAUX_LIGNES, type TriCadeauxContent } from "../../data/games/tri-cadeaux-jour22";
import { creerAlea } from "../shared/alea";
import { creerScene } from "../shared/scene";

const Y_TAPIS = 0.34;   // hauteur du dessus du tapis (fraction)
const Y_HOTTES = 0.6;   // haut des hottes (fraction)
const ESPACE = 0.16;    // écart minimal entre deux paquets sur le tapis (fraction de tapis)
const N_PLACES = 5;

export type Couleur = "rouge" | "vert" | "bleu" | "dore";
type TypePaquet = Couleur | "charbon";
const PLACES: (Couleur | "poubelle")[] = ["rouge", "vert", "bleu", "dore", "poubelle"];
const TEINTE: Record<Couleur, { fond: number; sombre: number }> = {
  rouge: { fond: 0xd9354b, sombre: 0x9c1f33 },
  vert: { fond: 0x2e9e5b, sombre: 0x1d6b3c },
  bleu: { fond: 0x2f7fd6, sombre: 0x1f5596 },
  dore: { fond: 0xf2b632, sombre: 0xb07c14 },
};

export type EtatHud = { score: number; reste: number; vies: number; combo: number };
export type FinPartie = { score: number; tries: number; charbons: number; vies: number; tenu: boolean; meilleureSerie: number };

export type OptionsTri = {
  contenu: TriCadeauxContent;
  prenomAutre: string;
  /** Meilleur score de l'autre, pour le petit frisson du dépassement */
  scoreAutre: number | null;
  sound: SoundApi;
  surHud: (e: EtatHud) => void;
  surFlash: (texte: string) => void;
  surFin: (f: FinPartie) => void;
};

type Etat = "attente" | "tapis" | "tenu" | "vol" | "chute" | "fini";
type Paquet = {
  t: number; type: TypePaquet; x: number; etat: Etat;
  /** position en pixels quand le paquet n'est plus sur le tapis */
  px: number; py: number; vx: number; vy: number;
  vers?: { x: number; y: number; depart: { x: number; y: number }; temps: number };
  vue?: Container;
};
type Eclat = { x: number; y: number; vx: number; vy: number; vie: number; couleur: number };

const melange = (t: number, a: number, b: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const vitesseTapis = (c: TriCadeauxContent, temps: number) => melange(temps / c.duree, c.vitesseDepart, c.vitesseFin);

/* ------------------------------------------------------------------ */
/* Tirage des paquets                                                  */
/* ------------------------------------------------------------------ */

function tirerPaquets(c: TriCadeauxContent): Paquet[] {
  const alea = creerAlea(c.graine);
  const paquets: Paquet[] = [];
  let precedent: TypePaquet | null = null;
  for (let t = 0.8; t < c.duree - 2;) {
    const couleurs: Couleur[] = t >= c.quatriemeHotte ? ["rouge", "vert", "bleu", "dore"] : ["rouge", "vert", "bleu"];
    // juste après l'ouverture de la 4e hotte, on fait arriver un doré pour qu'elle serve tout de suite
    let type: TypePaquet = alea.chance(c.partCharbon) ? "charbon" : alea.parmi(couleurs);
    if (t >= c.quatriemeHotte && !paquets.some((p) => p.type === "dore")) type = "dore";
    // jamais deux charbons d'affilée
    if (type === "charbon" && precedent === "charbon") type = alea.parmi(couleurs);
    precedent = type;
    paquets.push({ t, type, x: -0.08, etat: "attente", px: 0, py: 0, vx: 0, vy: 0 });
    const p = t / c.duree;
    t += Math.max((1 / melange(p, c.cadenceDepart, c.cadenceFin)) * (0.7 + alea.reel() * 0.6), ESPACE / vitesseTapis(c, t));
  }
  return paquets;
}

/* ------------------------------------------------------------------ */
/* Dessins                                                             */
/* ------------------------------------------------------------------ */

/** Le symbole d'une couleur, centré en (0, 0), de rayon r */
function symbole(g: Graphics, couleur: Couleur, r: number, teinte: number) {
  if (couleur === "rouge") {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.poly(pts).fill(teinte);
  } else if (couleur === "vert") {
    g.poly([0, -r, r * 0.62, -r * 0.05, -r * 0.62, -r * 0.05]).fill(teinte);
    g.poly([0, -r * 0.45, r * 0.85, r * 0.7, -r * 0.85, r * 0.7]).fill(teinte);
    g.rect(-r * 0.16, r * 0.7, r * 0.32, r * 0.3).fill(teinte);
  } else if (couleur === "bleu") {
    g.circle(0, r * 0.12, r * 0.82).fill(teinte);
    g.rect(-r * 0.22, -r * 0.95, r * 0.44, r * 0.3).fill(teinte);
  } else {
    g.circle(-r * 0.45, -r * 0.22, r * 0.52).fill(teinte);
    g.circle(r * 0.45, -r * 0.22, r * 0.52).fill(teinte);
    g.poly([-r * 0.94, -r * 0.05, r * 0.94, -r * 0.05, 0, r * 0.95]).fill(teinte);
  }
}

/** Un paquet cadeau posé sur le tapis. Origine = milieu du dessous. */
function dessinerCadeau(couleur: Couleur): Container {
  const c = new Container();
  const { fond, sombre } = TEINTE[couleur];
  const ruban = couleur === "dore" ? 0xd9354b : 0xfff4d6;
  const g = new Graphics();
  g.ellipse(0, 1, 24, 5).fill({ color: 0x1b2747, alpha: 0.22 });
  g.roundRect(-21, -38, 42, 38, 4).fill(fond).stroke({ width: 2, color: sombre });
  g.roundRect(-24, -45, 48, 11, 3).fill(fond).stroke({ width: 2, color: sombre });
  g.rect(-4, -45, 8, 45).fill(ruban);
  g.rect(-24, -42, 48, 5).fill(ruban);
  // nœud
  g.ellipse(-8, -50, 8, 5).fill(ruban).stroke({ width: 1.5, color: sombre, alpha: 0.5 });
  g.ellipse(8, -50, 8, 5).fill(ruban).stroke({ width: 1.5, color: sombre, alpha: 0.5 });
  g.circle(0, -48, 3.5).fill(ruban);
  // étiquette : forme de la couleur sur un rond blanc
  g.circle(0, -19, 11).fill(0xffffff).stroke({ width: 2, color: sombre });
  const marque = new Graphics();
  symbole(marque, couleur, 7, sombre);
  marque.y = -19;
  c.addChild(g, marque);
  return c;
}

function dessinerCharbon(): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(0, 1, 22, 5).fill({ color: 0x1b2747, alpha: 0.22 });
  g.poly([-20, 0, -22, -14, -12, -26, 2, -30, 15, -24, 22, -12, 19, 0]).fill(0x2a2a30).stroke({ width: 2, color: 0x121216 });
  g.poly([-8, -22, 2, -26, 6, -18, -4, -15]).fill({ color: 0x6b6b78, alpha: 0.8 });
  g.poly([8, -10, 15, -14, 16, -6]).fill({ color: 0x55555f, alpha: 0.8 });
  c.addChild(g);
  return c;
}

/* ------------------------------------------------------------------ */
/* Partie                                                              */
/* ------------------------------------------------------------------ */

export async function demarrerTri(hote: HTMLElement, o: OptionsTri): Promise<() => void> {
  const creee = await creerScene(hote);
  if (!creee) return () => { /* jeu déjà fermé */ };
  const scene = creee;
  const { contenu } = o;
  const paquets = tirerPaquets(contenu);

  /* ---------- géométrie ---------- */
  let L = 0, H = 0, gauche = 0, S = 1, colonne = 0;
  const mesurer = () => {
    H = scene.hauteur;
    // un peu plus large qu'une colonne de téléphone sur ordinateur, sans changer la durée du trajet sur le tapis
    L = Math.min(scene.largeur, H * 1.05, 760);
    gauche = (scene.largeur - L) / 2;
    S = Math.max(0.7, Math.min(L / 390, H / 640));
    colonne = L / N_PLACES;
  };
  mesurer();
  const pxTapis = (x: number) => gauche + x * L;
  const yTapis = () => H * Y_TAPIS;
  const yHottes = () => H * Y_HOTTES;
  const centrePlace = (i: number) => gauche + (i + 0.5) * colonne;

  /* ---------- décor ---------- */
  const mur = new Graphics();
  const tapis = new Graphics();
  const bandes = new Graphics(); // rayures du tapis qui défilent
  const couchePlaces = new Container();
  const coucheTapis = new Container();
  const coucheVol = new Container();
  const coucheEclats = new Graphics();
  scene.monde.addChild(mur, tapis, bandes, couchePlaces, coucheTapis, coucheVol, coucheEclats);

  type Place = { vue: Container; corps: Container; planches: Graphics; alerte: Graphics; rebond: number; rouge: number };
  const places: Place[] = [];
  let quatriemeOuverte = false;

  function dessinerDecor() {
    const l = scene.largeur, h = H;
    const yT = yTapis();
    mur.clear();
    // mur de planches chaudes
    mur.rect(0, 0, l, h).fill(0x7a4b2e);
    for (let x = (gauche % (34 * S)) - 34 * S; x < l; x += 34 * S) {
      mur.rect(x, 0, 2, h * 0.56).fill({ color: 0x5c3820, alpha: 0.5 });
    }
    // fenêtre sur la nuit enneigée
    const fx = gauche + L * 0.62, fy = h * 0.06, fl = Math.min(L * 0.3, 120 * S), fh = Math.min(h * 0.16, 90 * S);
    mur.roundRect(fx - 6, fy - 6, fl + 12, fh + 12, 6).fill(0x4a2c18);
    mur.rect(fx, fy, fl, fh).fill(0x22385e);
    const alea = creerAlea(22);
    for (let i = 0; i < 14; i++) mur.circle(fx + alea.reel() * fl, fy + alea.reel() * fh, 1.2 + alea.reel() * 1.6).fill({ color: 0xffffff, alpha: 0.85 });
    mur.rect(fx, fy + fh - 10 * S, fl, 10 * S).fill(0xeef4fa);
    mur.rect(fx + fl / 2 - 2, fy, 4, fh).fill(0x4a2c18);
    mur.rect(fx, fy + fh / 2 - 2, fl, 4).fill(0x4a2c18);
    // guirlande d'ampoules
    const yG = h * 0.04;
    mur.moveTo(0, yG);
    for (let x = 0; x <= l; x += 20) mur.lineTo(x, yG + Math.sin((x / l) * Math.PI * 4) * 8 * S + 10 * S);
    mur.stroke({ width: 2, color: 0x2b3b24 });
    const ampoules = [0xff5a5a, 0xffd23f, 0x5ad1ff, 0x7be07b];
    for (let x = 14, i = 0; x < l; x += 38 * S, i++) {
      mur.circle(x, yG + Math.sin((x / l) * Math.PI * 4) * 8 * S + 16 * S, 4.5 * S).fill(ampoules[i % ampoules.length]);
    }
    // sol de l'atelier
    const ySol = yT + 70 * S;
    mur.rect(0, ySol, l, h - ySol).fill(0xb98a5e);
    for (let y = ySol + 26 * S; y < h; y += 26 * S) mur.rect(0, y, l, 2).fill({ color: 0x8e6440, alpha: 0.6 });

    // tapis roulant : châssis, pieds, rouleaux aux deux bouts
    tapis.clear();
    const x0 = gauche - 6 * S, x1 = gauche + L + 6 * S;
    tapis.rect(x0 + 14 * S, yT + 14 * S, 8 * S, 56 * S).fill(0x4a5163);
    tapis.rect(x1 - 22 * S, yT + 14 * S, 8 * S, 56 * S).fill(0x4a5163);
    tapis.roundRect(x0, yT, x1 - x0, 18 * S, 9 * S).fill(0x3b4252).stroke({ width: 2, color: 0x252a36 });
    tapis.rect(x0, yT + 18 * S, x1 - x0, 6 * S).fill(0x8a93a8);
    tapis.circle(x0 + 9 * S, yT + 9 * S, 7 * S).fill(0xa7b0c4);
    tapis.circle(x1 - 9 * S, yT + 9 * S, 7 * S).fill(0xa7b0c4);
    // bord gauche : la trappe d'où sortent les paquets
    tapis.roundRect(x0 - 40 * S, yT - 66 * S, 46 * S, 84 * S, 6 * S).fill(0x5c3820).stroke({ width: 2, color: 0x3d2414 });
    tapis.rect(x0 - 34 * S, yT - 58 * S, 34 * S, 58 * S).fill(0x24160c);
  }

  function dessinerPlaces() {
    couchePlaces.removeChildren().forEach((c) => c.destroy({ children: true }));
    places.length = 0;
    const haut = yHottes();
    const hauteur = Math.min(H * 0.26, 130 * S);
    const larg = Math.min(colonne * 0.86, 90 * S);
    for (let i = 0; i < N_PLACES; i++) {
      const sorte = PLACES[i];
      const vue = new Container();
      const corps = new Container();
      const g = new Graphics();
      if (sorte === "poubelle") {
        g.roundRect(-larg * 0.42, 6, larg * 0.84, hauteur - 6, 6).fill(0x8a93a8).stroke({ width: 2, color: 0x4a5163 });
        for (let k = -1; k <= 1; k++) g.rect(k * larg * 0.2 - 2, 16, 4, hauteur - 26).fill({ color: 0x4a5163, alpha: 0.5 });
        g.roundRect(-larg * 0.5, -4, larg, 12, 4).fill(0x6b7387).stroke({ width: 2, color: 0x4a5163 });
        g.circle(0, hauteur * 0.55, 17 * S).fill(0xffffff).stroke({ width: 2.5, color: 0x4a5163 });
      } else {
        const { fond, sombre } = TEINTE[sorte];
        // hotte en osier, bord de la couleur, rond blanc avec la forme
        g.poly([-larg / 2, 0, larg / 2, 0, larg * 0.4, hauteur, -larg * 0.4, hauteur]).fill(0xc58a4a).stroke({ width: 2, color: 0x7a4f22 });
        for (let k = 1; k < 5; k++) {
          const y = (hauteur * k) / 5;
          const d = larg / 2 - (larg * 0.1 * y) / hauteur;
          g.moveTo(-d, y).lineTo(d, y);
        }
        g.stroke({ width: 1.4, color: 0x8a5a2b, alpha: 0.7 });
        g.roundRect(-larg / 2 - 3, -6, larg + 6, 14, 5).fill(fond).stroke({ width: 2, color: sombre });
        g.circle(0, hauteur * 0.55, 17 * S).fill(0xffffff).stroke({ width: 2.5, color: sombre });
      }
      corps.addChild(g);
      // forme (ou charbon) sur le rond blanc
      const marque = new Graphics();
      if (sorte === "poubelle") {
        marque.poly([-9, 4, -10, -4, -4, -9, 3, -10, 9, -5, 10, 3, 7, 7]).fill(0x2a2a30);
      } else {
        symbole(marque, sorte, 11, TEINTE[sorte].sombre);
      }
      marque.scale.set(S);
      marque.y = hauteur * 0.55;
      corps.addChild(marque);
      // planches clouées sur la 4e hotte tant qu'elle est fermée
      const planches = new Graphics();
      planches.roundRect(-larg * 0.55, hauteur * 0.25, larg * 1.1, 14 * S, 3).fill(0x8a5a2b).stroke({ width: 1.5, color: 0x5c3820 });
      planches.roundRect(-larg * 0.55, hauteur * 0.6, larg * 1.1, 14 * S, 3).fill(0x8a5a2b).stroke({ width: 1.5, color: 0x5c3820 });
      planches.visible = sorte === "dore" && !quatriemeOuverte;
      const alerte = new Graphics();
      alerte.roundRect(-larg / 2 - 4, -8, larg + 8, hauteur + 12, 10).fill({ color: 0xff3b3b, alpha: 0.4 });
      alerte.alpha = 0;
      vue.addChild(corps, planches, alerte);
      vue.x = centrePlace(i);
      vue.y = haut;
      couchePlaces.addChild(vue);
      places.push({ vue, corps, planches, alerte, rebond: 0, rouge: 0 });
    }
  }

  dessinerDecor();
  dessinerPlaces();
  scene.surTaille(() => { mesurer(); dessinerDecor(); dessinerPlaces(); });

  /* ---------- état ---------- */
  let temps = 0, hudTemps = 0, fini = false;
  let avance = 0; // distance parcourue par le tapis, pour faire défiler les rayures
  let vies = contenu.vies;
  let points = 0, serie = 0, meilleureSerie = 0, tries = 0, charbons = 0;
  let jalonMoitie = false, jalonFinale = false, depasse = false;
  let prochain = 0;
  let tenu: Paquet | null = null;
  const eclats: Eclat[] = [];

  const multiplicateur = () => Math.min(contenu.comboMax, 1 + 0.1 * serie);
  const reste = () => Math.max(0, Math.ceil(contenu.duree - temps));
  const flash = (t: string) => o.surFlash(t);

  function pousserHud(force = false) {
    if (!force && hudTemps < 0.1) return;
    hudTemps = 0;
    o.surHud({ score: points, reste: reste(), vies: Math.max(0, vies), combo: multiplicateur() });
  }
  pousserHud(true);

  function eclater(xp: number, yp: number, couleur: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, f = (40 + Math.random() * 90) * S;
      eclats.push({ x: xp, y: yp, vx: Math.cos(a) * f, vy: Math.sin(a) * f - 60 * S, vie: 0.5 + Math.random() * 0.3, couleur });
    }
  }

  function terminer(reussi: boolean) {
    if (fini) return;
    fini = true;
    if (tenu) { tenu.etat = "fini"; tenu = null; }
    if (reussi) points += Math.max(0, vies) * contenu.bonusVie;
    pousserHud(true);
    o.sound.play(reussi ? "win" : "bad");
    o.surFin({ score: points, tries, charbons, vies: Math.max(0, vies), tenu: reussi, meilleureSerie });
  }

  function erreur(texte: string, place: number | null) {
    vies--; serie = 0;
    o.sound.play("bad");
    flash(texte);
    if (place !== null) places[place].rouge = 0.6;
    if (vies <= 0) terminer(false);
  }

  function reussite(p: Paquet, place: number) {
    serie++;
    meilleureSerie = Math.max(meilleureSerie, serie);
    const base = p.type === "charbon" ? contenu.pointsCharbon : contenu.pointsCadeau;
    points += Math.round(base * multiplicateur());
    if (p.type === "charbon") { charbons++; flash(TRI_CADEAUX_LIGNES.charbon); }
    else tries++;
    o.sound.play(p.type === "dore" ? "good" : "pop");
    places[place].rebond = 0.35;
    eclater(centrePlace(place), yHottes(), p.type === "charbon" ? 0x55555f : TEINTE[p.type].fond, 8);
    if (serie > 0 && serie % 10 === 0) flash(TRI_CADEAUX_LIGNES.serie.replace("{n}", String(serie)));
  }

  /** Le paquet est lâché sur l'emplacement `place` : bon tri, erreur, ou retour sur le tapis si fermé */
  function deposer(p: Paquet, place: number) {
    const sorte = PLACES[place];
    if (sorte === "dore" && !quatriemeOuverte) return false;
    p.etat = "vol";
    p.vers = { x: centrePlace(place), y: yHottes() + 12 * S, depart: { x: p.px, y: p.py }, temps: 0 };
    coucheVol.addChild(p.vue!);
    const juste = p.type === "charbon" ? sorte === "poubelle" : sorte === p.type;
    if (juste) reussite(p, place);
    else erreur(p.type === "charbon" ? TRI_CADEAUX_LIGNES.charbonHotte : TRI_CADEAUX_LIGNES.erreur[Math.min(TRI_CADEAUX_LIGNES.erreur.length - 1, contenu.vies - vies)], place);
    return true;
  }

  /* ---------- saisie : on attrape un paquet du doigt et on le lâche sur une hotte ---------- */
  const point = (e: PointerEvent) => {
    const r = hote.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const bas = (e: PointerEvent) => {
    if (fini || tenu) return;
    const { x, y } = point(e);
    let meilleur: Paquet | null = null, dMin = Infinity;
    for (let i = 0; i < prochain; i++) {
      const p = paquets[i];
      if (p.etat !== "tapis") continue;
      const dx = Math.abs(pxTapis(p.x) - x), dy = Math.abs(yTapis() - 22 * S - y);
      if (dx < 36 * S && dy < 52 * S && dx + dy < dMin) { meilleur = p; dMin = dx + dy; }
    }
    if (!meilleur) return;
    tenu = meilleur;
    tenu.etat = "tenu";
    tenu.px = x; tenu.py = y + 24 * S;
    hote.setPointerCapture?.(e.pointerId);
    o.sound.play("step");
  };
  const bouge = (e: PointerEvent) => {
    if (!tenu) return;
    const { x, y } = point(e);
    tenu.px = x; tenu.py = y + 24 * S;
  };
  const haut = (e: PointerEvent) => {
    if (!tenu) return;
    const p = tenu;
    tenu = null;
    if (fini) return;
    const { x, y } = point(e);
    if (y > yHottes() - 40 * S) {
      const place = Math.max(0, Math.min(N_PLACES - 1, Math.floor((x - gauche) / colonne)));
      if (deposer(p, place)) return;
    }
    // lâché ailleurs : il retourne sur le tapis, à l'endroit du doigt
    p.etat = "tapis";
    p.x = Math.max(-0.05, Math.min(0.97, (x - gauche) / L));
  };
  // clavier : 1 à 5 envoient le paquet le plus avancé sur le tapis vers la place correspondante
  const touche = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (fini || !Number.isInteger(n) || n < 1 || n > N_PLACES) return;
    let devant: Paquet | null = null;
    for (let i = 0; i < prochain; i++) {
      const p = paquets[i];
      if (p.etat === "tapis" && p.x > -0.02 && (!devant || p.x > devant.x)) devant = p;
    }
    if (!devant) return;
    e.preventDefault();
    devant.px = pxTapis(devant.x); devant.py = yTapis();
    deposer(devant, n - 1);
  };
  hote.addEventListener("pointerdown", bas);
  hote.addEventListener("pointermove", bouge);
  hote.addEventListener("pointerup", haut);
  hote.addEventListener("pointercancel", haut);
  addEventListener("keydown", touche);

  /* ---------- boucle ---------- */
  scene.surImage((dt) => {
    if (fini) return;
    temps += dt; hudTemps += dt;
    const p = temps / contenu.duree;
    const v = vitesseTapis(contenu, temps);
    avance += v * dt * L;

    // ouverture de la 4e hotte
    if (!quatriemeOuverte && temps >= contenu.quatriemeHotte) {
      quatriemeOuverte = true;
      places[3].planches.visible = false;
      places[3].rebond = 0.5;
      eclater(centrePlace(3), yHottes() + 40 * S, 0x8a5a2b, 14);
      o.sound.play("whoosh");
      flash(TRI_CADEAUX_LIGNES.nouvelleHotte);
    }

    // rayures du tapis
    bandes.clear();
    const pas = 26 * S, yT = yTapis();
    for (let x = gauche + (avance % pas) - pas; x < gauche + L; x += pas) {
      if (x < gauche) continue;
      bandes.rect(x, yT + 3 * S, 3 * S, 12 * S).fill({ color: 0x5b6378, alpha: 0.9 });
    }

    // paquets qui sortent de la trappe
    while (prochain < paquets.length && paquets[prochain].t <= temps) {
      const n = paquets[prochain++];
      n.etat = "tapis";
      n.vue = n.type === "charbon" ? dessinerCharbon() : dessinerCadeau(n.type);
      coucheTapis.addChild(n.vue);
    }

    for (let i = 0; i < prochain; i++) {
      const q = paquets[i];
      if (q.etat === "fini" || !q.vue) continue;
      q.vue.scale.set(S);
      if (q.etat === "tapis") {
        q.x += v * dt;
        q.vue.x = pxTapis(q.x);
        q.vue.y = yT;
        q.vue.rotation = 0;
        if (q.x > 1.0) {
          // il tombe au bout du tapis
          q.etat = "chute";
          q.px = pxTapis(q.x); q.py = yT;
          q.vx = v * L * 0.8; q.vy = -40 * S;
          if (q.type !== "charbon") erreur(TRI_CADEAUX_LIGNES.tombe, null);
          if (fini) return;
        }
      } else if (q.etat === "tenu") {
        q.vue.scale.set(S * 1.15);
        q.vue.x = q.px; q.vue.y = q.py;
        q.vue.rotation = Math.sin(temps * 9) * 0.05;
      } else if (q.etat === "vol" && q.vers) {
        q.vers.temps += dt;
        const k = Math.min(1, q.vers.temps / 0.18);
        q.vue.x = melange(k, q.vers.depart.x, q.vers.x);
        q.vue.y = melange(k, q.vers.depart.y, q.vers.y);
        q.vue.scale.set(S * (1 - 0.5 * k));
        if (k >= 1) { q.etat = "fini"; q.vue.destroy({ children: true }); q.vue = undefined; }
      } else if (q.etat === "chute") {
        q.vy += 900 * S * dt;
        q.px += q.vx * dt; q.py += q.vy * dt;
        q.vue.x = q.px; q.vue.y = q.py;
        q.vue.rotation += dt * 4;
        if (q.py > H + 60 * S) { q.etat = "fini"; q.vue.destroy({ children: true }); q.vue = undefined; }
      }
    }

    // hottes : petit rebond quand on y range un paquet, rouge quand c'est une erreur
    for (const pl of places) {
      if (pl.rebond > 0) pl.rebond = Math.max(0, pl.rebond - dt);
      pl.corps.scale.y = 1 + Math.sin(pl.rebond * 18) * pl.rebond * 0.25;
      if (pl.rouge > 0) pl.rouge = Math.max(0, pl.rouge - dt);
      pl.alerte.alpha = pl.rouge / 0.6;
    }

    // éclats
    coucheEclats.clear();
    for (let i = eclats.length - 1; i >= 0; i--) {
      const e = eclats[i];
      e.vie -= dt;
      if (e.vie <= 0) { eclats.splice(i, 1); continue; }
      e.vy += 300 * S * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      coucheEclats.circle(e.x, e.y, 2.6 * S).fill({ color: e.couleur, alpha: Math.min(1, e.vie * 2) });
    }

    // jalons
    if (!jalonMoitie && p >= 0.5) { jalonMoitie = true; flash(TRI_CADEAUX_LIGNES.moitie); }
    if (!jalonFinale && contenu.duree - temps <= 10) { jalonFinale = true; flash(TRI_CADEAUX_LIGNES.finale); }
    if (!depasse && o.scoreAutre !== null && points > o.scoreAutre) {
      depasse = true;
      o.sound.play("good");
      flash(TRI_CADEAUX_LIGNES.depasse.replace("{autre}", o.prenomAutre));
    }
    if (temps >= contenu.duree) { terminer(true); return; }

    pousserHud();
  });

  o.sound.setGameMusic("action");
  flash(TRI_CADEAUX_LIGNES.depart);

  return () => {
    hote.removeEventListener("pointerdown", bas);
    hote.removeEventListener("pointermove", bouge);
    hote.removeEventListener("pointerup", haut);
    hote.removeEventListener("pointercancel", haut);
    removeEventListener("keydown", touche);
    scene.detruire();
  };
}
