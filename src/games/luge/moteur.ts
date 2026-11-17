/**
 * Jour 2 — moteur de la descente en luge (PixiJS).
 *
 * Repères : `d` = distance parcourue en mètres (0 → contenu.longueur), `x` = position latérale
 * en unités de piste (de -DEMI à +DEMI). Tout est calculé en coordonnées « monde » ;
 * l'écran n'est qu'une projection, ce qui garde les collisions justes quelle que soit la taille.
 *
 * La piste est tirée au sort à partir de `contenu.graine` : même graine = même piste pour les deux.
 */

import { Container, Graphics } from "pixi.js";
import type { SoundApi, Who } from "../../core/contracts";
import type { LugeContent } from "../../data/games/luge-jour2";
import { LUGE_LIGNES } from "../../data/games/luge-jour2";
import { creerAlea } from "../shared/alea";
import { creerSaisie, creerScene } from "../shared/scene";

const DEMI = 3.2;              // demi-largeur de la piste, en unités
const VUE = 31;                // mètres visibles devant la luge
const COLONNES = [-2.6, -1.3, 0, 1.3, 2.6];
const PERSPECTIVE = 0.34;      // rétrécissement au loin
const PART_HORIZON = 0.12;     // hauteur de l'horizon (fraction de l'écran)
const PART_LUGE = 0.74;        // hauteur de la luge (fraction de l'écran)

const MANTEAU: Record<Who, number> = { alexandre: 0x2f6fb5, flavie: 0xd9354b };
const BONNET: Record<Who, number> = { alexandre: 0x1f3d6b, flavie: 0xffffff };

export type EtatHud = { score: number; distance: number; vies: number; combo: number; turbo: boolean };
export type FinPartie = { score: number; distance: number; cadeaux: number; arrivee: boolean; vies: number };

export type OptionsLuge = {
  contenu: LugeContent;
  qui: Who;
  prenomAutre: string;
  /** Meilleur score de l'autre, pour le petit frisson du dépassement */
  scoreAutre: number | null;
  sound: SoundApi;
  surHud: (e: EtatHud) => void;
  surFlash: (texte: string) => void;
  surFin: (f: FinPartie) => void;
};

type TypeElem = "sapin" | "rocher" | "cadeau" | "turbo";
type Elem = { d: number; x: number; type: TypeElem; pris: boolean; vue?: Container };
type Decor = { d: number; x: number; grand: boolean; vue?: Container };

const RAYON: Record<TypeElem, number> = { sapin: 0.58, rocher: 0.62, cadeau: 0.8, turbo: 0.9 };
const melange = (t: number, a: number, b: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/* ------------------------------------------------------------------ */
/* Tracé de la piste                                                   */
/* ------------------------------------------------------------------ */

function tracerPiste(contenu: LugeContent): { elements: Elem[]; decor: Decor[] } {
  const alea = creerAlea(contenu.graine);
  const elements: Elem[] = [];
  const debut = 55; // quelques secondes de glisse tranquille avant les premiers obstacles
  const fin = contenu.longueur - 60;

  for (let d = debut; d < fin;) {
    const t = (d - debut) / Math.max(1, fin - debut);
    // Combien d'obstacles sur cette rangée : on monte en difficulté, jamais plus de 3 sur 5
    const nb = t < 0.18 ? 1 : t < 0.5 ? alea.entier(1, 2) : alea.entier(2, 3);

    const libres = COLONNES.map((_, i) => i);
    for (let i = libres.length - 1; i > 0; i--) {
      const j = alea.entier(0, i);
      [libres[i], libres[j]] = [libres[j], libres[i]];
    }
    const occupees = libres.splice(0, nb);
    for (const c of occupees) {
      elements.push({ d, x: COLONNES[c] + (alea.reel() - 0.5) * 0.3, type: alea.chance(0.68) ? "sapin" : "rocher", pris: false });
    }
    // Un cadeau dans un couloir libre, et de temps en temps un flocon-turbo
    if (libres.length && alea.chance(0.72)) {
      elements.push({ d: d + 2, x: COLONNES[libres[0]], type: "cadeau", pris: false });
    }
    if (libres.length > 1 && alea.chance(0.08)) {
      elements.push({ d: d + 4, x: COLONNES[libres[1]], type: "turbo", pris: false });
    }
    d += melange(t, contenu.ecartRangeeDepart, contenu.ecartRangeeFin);
  }

  // Sapins décoratifs hors piste, des deux côtés
  const decor: Decor[] = [];
  for (let d = 10; d < contenu.longueur + 40; d += 4 + alea.reel() * 6) {
    for (const cote of [-1, 1]) {
      if (!alea.chance(0.85)) continue;
      decor.push({ d, x: cote * (DEMI + 0.35 + alea.reel() * 1.9), grand: alea.chance(0.5) });
    }
  }
  elements.sort((a, b) => a.d - b.d);
  return { elements, decor };
}

/* ------------------------------------------------------------------ */
/* Dessins                                                             */
/* ------------------------------------------------------------------ */

function dessinerSapin(grand = false): Container {
  const c = new Container();
  const h = grand ? 74 : 58;
  c.addChild(new Graphics().ellipse(0, 2, h * 0.28, h * 0.09).fill({ color: 0x1b2747, alpha: 0.16 }));
  c.addChild(new Graphics().rect(-3, -h * 0.26, 6, h * 0.26).fill(0x6b4a33));
  const g = new Graphics();
  for (let i = 0; i < 3; i++) {
    const base = -h * (0.2 + i * 0.26);
    const larg = (h * 0.34) * (1 - i * 0.22);
    g.poly([0, base - h * 0.34, -larg, base, larg, base]).fill(i === 2 ? 0x2a8f63 : 0x237a55);
  }
  g.poly([0, -h * 1.05, -8, -h * 0.9, 8, -h * 0.9]).fill(0xf7fbff); // neige au sommet
  c.addChild(g);
  return c;
}

function dessinerRocher(): Container {
  const c = new Container();
  c.addChild(new Graphics().ellipse(0, 2, 26, 8).fill({ color: 0x1b2747, alpha: 0.16 }));
  c.addChild(new Graphics()
    .poly([-24, 0, -16, -22, 2, -30, 20, -18, 24, 0]).fill(0x8a97b0)
    .poly([-16, -22, 2, -30, 20, -18, 4, -20]).fill(0xaebacd)
    .poly([-14, -24, 2, -31, 14, -22, 0, -24]).fill(0xf3f8ff));
  return c;
}

function dessinerCadeau(): Container {
  const c = new Container();
  c.addChild(new Graphics().ellipse(0, 2, 18, 6).fill({ color: 0x1b2747, alpha: 0.16 }));
  c.addChild(new Graphics()
    .roundRect(-16, -30, 32, 30, 5).fill(0xd9354b)
    .rect(-3, -30, 6, 30).fill(0xffc85a)
    .rect(-16, -18, 32, 6).fill(0xffc85a)
    .circle(-6, -33, 6).fill(0xffc85a)
    .circle(6, -33, 6).fill(0xffc85a));
  return c;
}

function dessinerTurbo(): Container {
  const c = new Container();
  const g = new Graphics();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.poly([Math.cos(a) * 20, Math.sin(a) * 20 - 20, Math.cos(a + 0.4) * 7, Math.sin(a + 0.4) * 7 - 20, Math.cos(a - 0.4) * 7, Math.sin(a - 0.4) * 7 - 20])
      .fill(0x8fe8ff);
  }
  g.circle(0, -20, 7).fill(0xffffff);
  c.addChild(g);
  return c;
}

function dessinerLuge(qui: Who): Container {
  const c = new Container();
  c.addChild(new Graphics().ellipse(0, 6, 30, 10).fill({ color: 0x1b2747, alpha: 0.22 }));
  const luge = new Graphics()
    .roundRect(-26, -10, 52, 12, 5).fill(0xb4701f)
    .roundRect(-28, 0, 56, 5, 2.5).fill(0x8a4f14)
    .roundRect(-30, -2, 7, 8, 3).fill(0x8a4f14)
    .roundRect(23, -2, 7, 8, 3).fill(0x8a4f14);
  const perso = new Graphics()
    .roundRect(-13, -36, 26, 28, 9).fill(MANTEAU[qui])          // dos / manteau
    .roundRect(-19, -30, 8, 16, 4).fill(MANTEAU[qui])           // bras
    .roundRect(11, -30, 8, 16, 4).fill(MANTEAU[qui])
    .circle(0, -45, 11).fill(0xf6cfae)                          // tête (de dos / de trois quarts)
    .roundRect(-12, -58, 24, 14, 7).fill(BONNET[qui])           // bonnet
    .circle(0, -59, 5).fill(qui === "alexandre" ? 0xffffff : 0xd9354b)
    .roundRect(-12, -40, 24, 7, 3.5).fill(qui === "alexandre" ? 0xffc85a : 0xffffff); // écharpe
  c.addChild(luge, perso);
  return c;
}

/* ------------------------------------------------------------------ */
/* Moteur                                                              */
/* ------------------------------------------------------------------ */

export async function demarrerLuge(hote: HTMLElement, o: OptionsLuge): Promise<() => void> {
  const scene = await creerScene(hote);
  if (!scene) return () => { /* hôte déjà parti */ };
  const saisie = creerSaisie(hote);
  const { contenu } = o;
  const { elements, decor } = tracerPiste(contenu);

  const fond = new Graphics();
  const vagues = new Graphics();
  const coucheDecor = new Container();
  const coucheElems = new Container();
  const particules = new Container();
  const coucheLuge = new Container();
  coucheDecor.sortableChildren = true;
  coucheElems.sortableChildren = true;
  scene.monde.addChild(fond, vagues, coucheDecor, coucheElems, particules, coucheLuge);

  const luge = dessinerLuge(o.qui);
  coucheLuge.addChild(luge);

  // flocons qui filent pour donner la sensation de vitesse
  const flocons = Array.from({ length: 44 }, () => {
    const g = new Graphics().roundRect(-1.2, -7, 2.4, 14, 1.2).fill({ color: 0xffffff, alpha: 0.75 });
    particules.addChild(g);
    return { g, x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.8 };
  });

  /* ---------- état de la partie ---------- */
  let d = 0, x = 0, vx = 0, temps = 0;
  let vies = contenu.chocsPermis;
  let pointsCadeaux = 0, cadeaux = 0, serie = 0;
  let invincible = 0, ralenti = 0, turbo = 0;
  let fini = false;
  let jalonMoitie = false, depasse = false;
  const indexChoc = { n: 0 };

  // géométrie dépendant de la taille de l'écran
  let cx = 0, yLuge = 0, yHorizon = 0, echelleX = 1, hauteurEcran = 0, largeurEcran = 0;

  const projX = (ux: number, t: number) => cx + ux * echelleX * (1 - PERSPECTIVE * t);
  const projY = (t: number) => yLuge - t * (yLuge - yHorizon);

  function redessinerFond() {
    const tBas = -(hauteurEcran - yLuge) / (yLuge - yHorizon);
    fond.clear();
    // ciel et montagnes au loin
    fond.rect(0, 0, largeurEcran, yHorizon + 2).fill(0xbcd8ee);
    for (let i = -1; i < 5; i++) {
      const mx = (i + 0.5) * (largeurEcran / 4);
      fond.poly([mx - 150, yHorizon + 2, mx, yHorizon - 86, mx + 150, yHorizon + 2]).fill(0xd7e6f4);
      fond.poly([mx - 46, yHorizon - 60, mx, yHorizon - 86, mx + 46, yHorizon - 60]).fill(0xffffff);
    }
    // champ de neige puis piste
    fond.rect(0, yHorizon, largeurEcran, hauteurEcran - yHorizon).fill(0xe3edf7);
    fond.poly([
      projX(-DEMI, tBas), hauteurEcran,
      projX(-DEMI, 1), yHorizon,
      projX(DEMI, 1), yHorizon,
      projX(DEMI, tBas), hauteurEcran,
    ]).fill(0xfbfdff);
    // bords de piste légèrement bleutés
    fond.poly([projX(-DEMI, tBas), hauteurEcran, projX(-DEMI, 1), yHorizon, projX(-DEMI, 1) + 10, yHorizon, projX(-DEMI, tBas) + 26, hauteurEcran]).fill({ color: 0xcfe0ef, alpha: 0.8 });
    fond.poly([projX(DEMI, tBas), hauteurEcran, projX(DEMI, 1), yHorizon, projX(DEMI, 1) - 10, yHorizon, projX(DEMI, tBas) - 26, hauteurEcran]).fill({ color: 0xcfe0ef, alpha: 0.8 });
  }

  function mesurer(l: number, h: number) {
    largeurEcran = l; hauteurEcran = h;
    cx = l / 2;
    yLuge = h * PART_LUGE;
    yHorizon = h * PART_HORIZON;
    echelleX = (l * 0.8) / (DEMI * 2);
    luge.y = yLuge;
    luge.scale.set(Math.min(1.25, Math.max(0.62, l / 430)));
    redessinerFond();
  }
  mesurer(scene.largeur, scene.hauteur);
  scene.surTaille(mesurer);

  const scoreCourant = () => Math.floor(d) + pointsCadeaux;

  function flash(texte: string) { o.surFlash(texte); }

  function choc() {
    if (invincible > 0) return;
    vies--;
    serie = Math.floor(serie / 2);
    invincible = 1.4;
    ralenti = 0.8;
    turbo = 0;
    o.sound.play("bad");
    if (vies <= 0) { terminer(false); return; }
    flash(LUGE_LIGNES.choc[Math.min(indexChoc.n, LUGE_LIGNES.choc.length - 1)]);
    indexChoc.n++;
  }

  function terminer(arrivee: boolean) {
    if (fini) return;
    fini = true;
    let score = scoreCourant();
    if (arrivee) score += contenu.bonusArrivee + contenu.bonusVie * Math.max(0, vies);
    o.sound.play(arrivee ? "win" : "locked");
    o.surFin({ score, distance: Math.floor(d), cadeaux, arrivee, vies: Math.max(0, vies) });
  }

  let hudTemps = 0;
  function pousserHud(force = false) {
    if (!force && hudTemps < 0.1) return;
    hudTemps = 0;
    o.surHud({
      score: scoreCourant(),
      distance: Math.floor(d),
      vies: Math.max(0, vies),
      combo: Math.min(contenu.comboMax, 1 + 0.2 * serie),
      turbo: turbo > 0,
    });
  }
  pousserHud(true);

  /* ---------- boucle ---------- */
  scene.surImage((dt) => {
    if (fini) return;
    temps += dt; hudTemps += dt;

    // vitesse : montée progressive, turbo, ralentissement après un choc
    let vitesse = melange(temps / contenu.tempsAcceleration, contenu.vitesseDepart, contenu.vitesseMax);
    if (turbo > 0) { vitesse *= 1.38; turbo -= dt; }
    if (ralenti > 0) { vitesse *= 0.55; ralenti -= dt; }
    if (invincible > 0) invincible -= dt;
    d += vitesse * dt;

    // direction : glissement du doigt + flèches
    const glissement = saisie.prendreGlissement();
    const avant = x;
    x += glissement / echelleX;
    x += saisie.axeClavier() * 6.4 * dt;
    x = Math.max(-DEMI, Math.min(DEMI, x));
    vx = (x - avant) / Math.max(dt, 0.001);

    luge.x = projX(x, 0);
    luge.rotation = Math.max(-0.3, Math.min(0.3, vx * 0.045));
    luge.alpha = invincible > 0 ? (Math.sin(temps * 28) > 0 ? 0.35 : 1) : 1;

    // collisions et ramassages
    for (const e of elements) {
      if (e.pris) continue;
      if (e.d < d - 2) continue;
      if (e.d > d + 2) break;
      if (Math.abs(e.d - d) > 0.9 || Math.abs(e.x - x) > RAYON[e.type]) continue;
      if (e.type === "cadeau") {
        e.pris = true; cadeaux++; serie++;
        pointsCadeaux += Math.round(contenu.pointsCadeau * Math.min(contenu.comboMax, 1 + 0.2 * (serie - 1)));
        o.sound.play("pop");
        e.vue?.destroy({ children: true }); e.vue = undefined;
      } else if (e.type === "turbo") {
        e.pris = true; turbo = 2.6; pointsCadeaux += 50;
        o.sound.play("whoosh");
        e.vue?.destroy({ children: true }); e.vue = undefined;
      } else {
        e.pris = true;
        e.vue?.destroy({ children: true }); e.vue = undefined;
        choc();
        if (fini) return;
      }
    }

    // affichage des éléments proches
    for (const e of elements) {
      const t = (e.d - d) / VUE;
      if (t < -0.2 || t > 1.02) {
        if (e.vue) { e.vue.destroy({ children: true }); e.vue = undefined; }
        continue;
      }
      if (e.pris) continue;
      if (!e.vue) {
        e.vue = e.type === "sapin" ? dessinerSapin() : e.type === "rocher" ? dessinerRocher()
          : e.type === "cadeau" ? dessinerCadeau() : dessinerTurbo();
        e.vue.zIndex = -e.d;
        coucheElems.addChild(e.vue);
      }
      const p = 1 - PERSPECTIVE * t;
      e.vue.x = projX(e.x, t);
      e.vue.y = projY(t);
      e.vue.scale.set(p * luge.scale.x * (1 - t * 0.5));
      if (e.type === "cadeau" || e.type === "turbo") e.vue.y -= 6 + Math.sin(temps * 4 + e.d) * 4;
    }

    // décor latéral
    for (const s of decor) {
      const t = (s.d - d) / VUE;
      if (t < -0.2 || t > 1.02) {
        if (s.vue) { s.vue.destroy({ children: true }); s.vue = undefined; }
        continue;
      }
      if (!s.vue) {
        s.vue = dessinerSapin(s.grand);
        s.vue.zIndex = -s.d;
        coucheDecor.addChild(s.vue);
      }
      const p = 1 - PERSPECTIVE * t;
      s.vue.x = projX(s.x, t);
      s.vue.y = projY(t);
      s.vue.scale.set(p * luge.scale.x * (1 - t * 0.5));
    }

    // vaguelettes de neige : repère de vitesse
    vagues.clear();
    for (let i = 0; i < 9; i++) {
      const t = ((i * 3 - (d % 3)) / VUE) * 3;
      if (t < 0 || t > 1) continue;
      const y = projY(t);
      vagues.moveTo(projX(-DEMI * 0.92, t), y).lineTo(projX(DEMI * 0.92, t), y)
        .stroke({ width: 1.5, color: 0xd7e6f4, alpha: 0.55 * (1 - t) });
    }

    // flocons de vitesse
    const vitRelative = vitesse / contenu.vitesseMax;
    for (const f of flocons) {
      f.y += (0.55 + vitRelative * 1.5) * f.v * dt;
      if (f.y > 1) { f.y -= 1; f.x = Math.random(); }
      f.g.x = f.x * largeurEcran;
      f.g.y = yHorizon + f.y * (hauteurEcran - yHorizon);
      f.g.scale.set(0.5 + f.y * 1.1, 0.6 + vitRelative * 1.4);
      f.g.alpha = 0.15 + f.y * 0.5;
    }

    // jalons
    if (!jalonMoitie && d > contenu.longueur / 2) { jalonMoitie = true; flash(LUGE_LIGNES.moitie); }
    if (!depasse && o.scoreAutre !== null && scoreCourant() > o.scoreAutre) {
      depasse = true;
      o.sound.play("good");
      flash(LUGE_LIGNES.depasse.replace("{autre}", o.prenomAutre));
    }
    if (d >= contenu.longueur) { terminer(true); return; }

    pousserHud();
  });

  o.sound.setGameMusic("action");
  flash(LUGE_LIGNES.depart);

  return () => {
    saisie.detruire();
    scene.detruire();
  };
}
