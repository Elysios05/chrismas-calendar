/**
 * Jour 18 — moteur d'une manche du duel des forts (PixiJS).
 *
 * Toute la partie se joue en coordonnées « terrain » (`regles.ts`) ; l'écran n'est qu'une projection, en miroir
 * pour Flavie : chacun se voit à GAUCHE et tire vers la droite. Le début de la manche est une heure locale déjà
 * corrigée de l'horloge commune.
 *
 * L'autre vient soit du direct (tirs et posture reçus), soit d'un fantôme (tirs et posture enregistrés quand il a
 * joué cette manche), soit — s'il n'a pas encore joué — d'un lutin d'entraînement qui ne se cache jamais.
 */

import { Container, Graphics, Text } from "pixi.js";
import type { SoundApi, Who } from "../../core/contracts";
import type { BoulesContent } from "../../data/games/boules-jour18";
import { creerScene } from "../shared/scene";
import {
  A_MAX, A_MIN, Bataille, DEMI_MUR, GRAVITE, LARGEUR, MAIN_DX, MAIN_Y, MUR, PAS, PAS_TRACE, RANGEE,
  RETOMBEE, SENS, V_MAX, V_MIN, X, borner, xDe, postureDans, tirsLutin, ventA, type CoupManche, type Evenement, type Tir,
} from "./regles";

const COULEUR: Record<Who, number> = { alexandre: 0x2f6fd6, flavie: 0xd9354b };
/** Longueur de glissement (px) pour la force maximale */
const TIRE_MAX = 150;
/** Durée du début de trajectoire montré en pointillés (ms) */
const APERCU = 380;

export type Hud = {
  reste: number;
  avant: number;
  points: Record<Who, number>;
  /** 0 → 1 : la boule suivante est prête à 1 */
  recharge: number;
  /** Rangées de mon fort */
  fort: number;
  /** Vent vu de mon écran : positif = vers l'autre */
  vent: number;
  baisse: boolean;
};

export type OptionsManche = {
  hote: HTMLElement;
  contenu: BoulesContent;
  m: number;
  moi: Who;
  autre: Who;
  prenoms: Record<Who, string>;
  debut: number;
  /** L'autre a déjà joué cette manche : on rejoue ses tirs et sa posture */
  fantome: CoupManche | null;
  direct: boolean;
  sound: SoundApi;
  surHud: (h: Hud) => void;
  surFlash: (texte: string) => void;
  /** En direct : à diffuser */
  surTir: (t: Tir) => void;
  surPose: (baisse: boolean) => void;
  surFin: (coup: CoupManche) => void;
};

export type Manche = {
  tirDistant(t: Tir): void;
  poseDistante(baisse: boolean): void;
  /** Bouton « Se baisser » (maintenu) */
  baisser(b: boolean): void;
  sansAutre(): void;
  arreter(): void;
};

/* ------------------------------------------------------------------ */
/* Dessins                                                             */
/* ------------------------------------------------------------------ */

/** Un personnage en anorak, dessiné en unités terrain (y vers le haut → on dessine en y négatif) */
function dessinerPerso(g: Graphics, couleur: number, baisse: boolean, vise: boolean, lutin: boolean) {
  g.clear();
  const peau = 0xf6d2b8;
  const bonnet = lutin ? 0xd9354b : couleur;
  const manteau = lutin ? 0x2f9a5a : couleur;
  if (baisse) {
    // accroupi : genoux, dos rond, juste le bonnet qui dépasse
    g.ellipse(0, -10, 19, 10).fill(0x2b3550);
    g.roundRect(-18, -34, 36, 26, 12).fill(manteau);
    g.circle(2, -36, 11).fill(peau);
    g.roundRect(-12, -46, 26, 10, 5).fill(bonnet);
    g.circle(14, -48, 4.5).fill(0xffffff);
    return;
  }
  // jambes
  g.roundRect(-12, -30, 10, 30, 4).fill(0x2b3550);
  g.roundRect(3, -30, 10, 30, 4).fill(0x2b3550);
  // manteau
  g.roundRect(-17, -76, 34, 50, 12).fill(manteau);
  g.rect(-17, -58, 34, 5).fill({ color: 0xffffff, alpha: 0.35 });
  // écharpe
  g.roundRect(-14, -80, 28, 8, 4).fill(lutin ? 0xf2c14e : 0xf4f1e8);
  // tête
  g.circle(0, -90, 13).fill(peau);
  g.circle(5, -91, 1.8).fill(0x2b2b33);
  g.circle(-1, -91, 1.8).fill(0x2b2b33);
  // bonnet (pointu pour le lutin)
  if (lutin) g.poly([-14, -96, 14, -96, -10, -122]).fill(bonnet);
  else g.roundRect(-14, -108, 28, 14, 7).fill(bonnet);
  g.circle(lutin ? -10 : 0, lutin ? -122 : -108, 5).fill(0xffffff);
  // bras : levé avec une boule quand on vise
  if (vise) {
    g.roundRect(-4, -98, 9, 30, 4).fill(manteau);
    g.circle(0, -100, 7).fill(0xffffff).stroke({ width: 1.5, color: 0xb9d3ea });
  } else {
    g.roundRect(12, -72, 9, 28, 4).fill(manteau);
  }
}

/** Le fort : `hp` rangées de blocs de neige, des éboulis pour les rangées tombées */
function dessinerFort(g: Graphics, hp: number, rangees: number) {
  g.clear();
  const l = DEMI_MUR * 2 + 8;
  for (let i = 0; i < rangees; i++) {
    const y = -(i + 1) * RANGEE;
    if (i < hp) {
      const dec = i % 2 ? 6 : 0;
      g.roundRect(-l / 2, y, l, RANGEE - 2, 6).fill(0xf7fbff).stroke({ width: 1.5, color: 0xa9c6e8 });
      g.moveTo(-l / 2 + 14 + dec, y + 2).lineTo(-l / 2 + 14 + dec, y + RANGEE - 4).stroke({ width: 1.2, color: 0xc7dcf0 });
      g.moveTo(-l / 2 + 32 + dec, y + 2).lineTo(-l / 2 + 32 + dec, y + RANGEE - 4).stroke({ width: 1.2, color: 0xc7dcf0 });
    }
  }
  if (hp < rangees) {
    // éboulis au pied du fort
    const n = rangees - hp;
    for (let k = 0; k < n * 2; k++) g.ellipse(-l / 2 + 6 + ((k * 17) % l), -3, 8, 5).fill(0xe9f2fb);
  }
}

/* ------------------------------------------------------------------ */
/* Manche                                                              */
/* ------------------------------------------------------------------ */

export async function lancerManche(o: OptionsManche): Promise<Manche | null> {
  const scene = await creerScene(o.hote);
  if (!scene) return null;
  const { app, monde } = scene;
  const c = o.contenu;
  const duree = c.secondes * 1000;
  const lutin = !o.direct && !o.fantome;
  const miroir = o.moi === "flavie";

  /* ---------- projection ---------- */
  let W = scene.largeur, H = scene.hauteur;
  let s = 1, ox = 0, sol = 0;
  const projeter = () => {
    s = Math.min(W / (LARGEUR + 30), H / 360);
    ox = (W - LARGEUR * s) / 2;
    sol = H * 0.8;
  };
  projeter();
  const sx = (x: number) => ox + (miroir ? LARGEUR - x : x) * s;
  const sy = (y: number) => sol - y * s;

  /* ---------- décor : falaise, cascade gelée, neige ---------- */
  const decor = new Graphics();
  const flocons = Array.from({ length: 36 }, (_, i) => ({ x: (i * 97) % 1000 / 1000, y: (i * 61) % 1000 / 1000, r: 1 + (i % 3) }));
  const neige = new Graphics();
  const dessinerDecor = () => {
    decor.clear();
    const cx = W / 2;
    const haut = Math.max(0, sol - 300 * s);
    // falaise
    decor.poly([cx - 190 * s, sol, cx - 160 * s, haut + 40 * s, cx - 95 * s, haut, cx - 66 * s, sol]).fill(0x5d6f93);
    decor.poly([cx + 66 * s, sol, cx + 95 * s, haut + 10 * s, cx + 170 * s, haut + 60 * s, cx + 200 * s, sol]).fill(0x52648a);
    // cascade gelée
    const lc = 70 * s;
    decor.roundRect(cx - lc, haut + 6 * s, lc * 2, sol - haut, 18 * s).fill(0xbfe6f5);
    for (let i = 0; i < 9; i++) {
      const x = cx - lc + (i + 0.5) * (lc * 2 / 9);
      const l = 4 + (i % 3) * 3;
      decor.roundRect(x - l * s / 2, haut + (10 + (i % 4) * 14) * s, l * s, sol - haut - (30 + (i % 3) * 20) * s, 4 * s).fill({ color: 0xffffff, alpha: 0.55 });
    }
    // stalactites
    for (let i = 0; i < 7; i++) {
      const x = cx - lc + (i + 0.5) * (lc * 2 / 7);
      decor.poly([x - 7 * s, haut + 6 * s, x + 7 * s, haut + 6 * s, x, haut + (30 + (i % 3) * 12) * s]).fill(0xe6f6fc);
    }
    // bassin gelé
    decor.ellipse(cx, sol + 6 * s, lc * 1.5, 18 * s).fill(0x9fd3ea).stroke({ width: 2, color: 0xe6f6fc });
    // sol enneigé
    decor.rect(0, sol + 10 * s, W, H - sol).fill(0xf4f8fd);
    decor.ellipse(W * 0.18, sol + 10 * s, W * 0.3, 22 * s).fill(0xf4f8fd);
    decor.ellipse(W * 0.82, sol + 10 * s, W * 0.3, 22 * s).fill(0xf4f8fd);
  };
  dessinerDecor();
  monde.addChild(decor);

  /* ---------- forts et personnages ---------- */
  const creerCote = (qui: Who, figure: "moi" | "autre" | "lutin") => {
    const fort = new Graphics();
    const perso = new Graphics();
    const nom = new Text({
      text: figure === "lutin" ? "Lutin farceur" : o.prenoms[qui],
      style: { fontFamily: "Fredoka, system-ui, sans-serif", fontSize: 13, fontWeight: "700", fill: figure === "lutin" ? 0x2f9a5a : COULEUR[qui] },
    });
    nom.anchor.set(0.5, 0);
    monde.addChild(fort, perso, nom);
    return { qui, fort, perso, nom, figure, hp: -1, baisse: null as boolean | null, vise: false };
  };
  const moi = creerCote(o.moi, "moi");
  const lui = creerCote(o.autre, lutin ? "lutin" : "autre");
  if (o.fantome) { lui.perso.alpha = 0.6; lui.nom.text = `👻 ${o.prenoms[o.autre]}`; }

  const coucheBoules = new Graphics();
  const viseur = new Graphics();
  const eclats = new Container();
  monde.addChild(coucheBoules, eclats, viseur, neige);

  const placer = () => {
    for (const cote of [moi, lui]) {
      // le personnage dessiné en unités terrain, retourné pour regarder vers l'autre
      cote.perso.scale.set((cote.qui === o.moi ? 1 : -1) * s, s);
      cote.perso.position.set(sx(X[cote.qui]), sy(0));
      cote.fort.scale.set(s);
      cote.fort.position.set(sx(MUR[cote.qui]), sy(0));
      cote.nom.position.set(sx(X[cote.qui]), sy(0) + 6);
    }
  };
  const redessiner = (cote: typeof moi, hp: number, baisse: boolean, vise: boolean) => {
    if (cote.hp !== hp) { cote.hp = hp; dessinerFort(cote.fort, hp, c.rangees); }
    if (cote.baisse !== baisse || cote.vise !== vise) {
      cote.baisse = baisse; cote.vise = vise;
      dessinerPerso(cote.perso, COULEUR[cote.qui], baisse, vise, cote.figure === "lutin");
    }
  };
  placer();

  scene.surTaille((l, h) => {
    W = l; H = h; projeter(); dessinerDecor(); placer();
    moi.hp = lui.hp = -1; // force le redessin des forts
  });

  /* ---------- état ---------- */
  const trace: number[] = [];
  const mesTirs: Tir[] = [];
  let prochaineTrace = 0;
  let boutonBaisse = false, toucheBaisse = false;
  let autreBaisse = false;
  let derniereBaisse: boolean | null = null;
  let pretA = 0; // heure (tm) à laquelle la boule suivante est prête
  let fini = false;
  let tm = Date.now() - o.debut;
  let secousse = 0;
  let autreParti = false;

  /* visée */
  let depart: { x: number; y: number } | null = null;
  let courant: { x: number; y: number } | null = null;

  const baisseMoi = () => (boutonBaisse || toucheBaisse) && !depart;
  const posture = (qui: Who, t: number): boolean => {
    if (qui === o.moi) return trace.length ? postureDans(trace, t) : baisseMoi();
    if (o.fantome) return postureDans(o.fantome.trace, t);
    if (lutin || autreParti) return false;
    return autreBaisse;
  };

  /* ---------- éclats ---------- */
  type Eclat = { g: Graphics; vx: number; vy: number; vie: number };
  const listeEclats: Eclat[] = [];
  const eclabousser = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const g = new Graphics().circle(0, 0, 2 + Math.random() * 2.5).fill(0xffffff);
      g.position.set(sx(x), sy(Math.max(0, y)));
      eclats.addChild(g);
      const a = Math.random() * Math.PI;
      const v = 60 + Math.random() * 120;
      listeEclats.push({ g, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, vie: 0.5 + Math.random() * 0.3 });
    }
  };

  const surEvenement = (e: Evenement) => {
    if (fini) return;
    const b = e.boule;
    eclabousser(b.x, b.y, e.issue === "sol" ? 5 : 10);
    if (e.issue === "touche") {
      if (e.cible === o.moi) {
        secousse = 0.35;
        o.sound.play("bad");
        o.surFlash(b.compte ? "Aïe ! Touché·e…" : "Aïe ! (le lutin ne compte pas)");
      } else if (b.qui === o.moi) {
        o.sound.play("good");
        o.surFlash(`🎯 +${c.points}`);
      }
    } else if (e.issue === "mur") {
      o.sound.play("pop");
      if (e.cible === o.moi && bataille.hp[o.moi] === 0) o.surFlash("Ton fort est par terre ! Baisse-toi pour le refaire");
    }
  };

  const bataille = new Bataille(c, posture, surEvenement);
  if (o.fantome) for (const t of o.fantome.tirs) bataille.lancer(o.autre, t);
  if (lutin) for (const t of tirsLutin(c, o.m, o.autre)) bataille.lancer(o.autre, t, false);

  /* ---------- saisie ---------- */
  const canvas = app.canvas;
  const point = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const peutTirer = () => !fini && tm >= 0 && tm < duree && tm >= pretA && !boutonBaisse && !toucheBaisse;

  /** Force et angle d'après le glissement (lance-pierre : on tire vers l'arrière) */
  const lireVisee = (): { v: number; a: number } | null => {
    if (!depart || !courant) return null;
    const dx = depart.x - courant.x, dy = depart.y - courant.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) return null;
    const a = dx <= 0 ? A_MAX : borner(Math.atan2(-dy, dx), A_MIN, A_MAX);
    const v = V_MIN + (V_MAX - V_MIN) * Math.min(1, d / TIRE_MAX);
    return { v: Math.round(v), a: Math.round(a * 1000) / 1000 };
  };

  const bas = (e: PointerEvent) => {
    if (!peutTirer()) { if (tm >= 0 && tm < pretA) o.surFlash("Je refais une boule…"); return; }
    depart = point(e); courant = depart;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const bouge = (e: PointerEvent) => { if (depart) courant = point(e); };
  const haut = () => {
    const visee = lireVisee();
    depart = courant = null;
    if (!visee || fini || tm < 0 || tm >= duree) return;
    const t = Math.max(Math.ceil(tm / PAS) * PAS, bataille.t);
    const tir: Tir = { t, v: visee.v, a: visee.a, w: ventA(c, o.m, t) };
    mesTirs.push(tir);
    bataille.lancer(o.moi, tir);
    pretA = tm + c.recharge * 1000;
    o.sound.play("whoosh");
    if (o.direct) o.surTir(tir);
  };
  const annuler = () => { depart = courant = null; };
  canvas.addEventListener("pointerdown", bas);
  canvas.addEventListener("pointermove", bouge);
  canvas.addEventListener("pointerup", haut);
  canvas.addEventListener("pointercancel", annuler);

  const touche = (e: KeyboardEvent, enfonce: boolean) => {
    if (e.key === " " || e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
      toucheBaisse = enfonce;
      if (enfonce) depart = courant = null;
      e.preventDefault();
    }
  };
  const kd = (e: KeyboardEvent) => touche(e, true);
  const ku = (e: KeyboardEvent) => touche(e, false);
  const flou = () => { toucheBaisse = false; boutonBaisse = false; };
  addEventListener("keydown", kd);
  addEventListener("keyup", ku);
  addEventListener("blur", flou);

  /* ---------- image ---------- */
  let dernierHud = -Infinity;
  const hud = () => {
    const w = ventA(c, o.m, Math.max(0, tm));
    o.surHud({
      reste: Math.max(0, Math.ceil((duree - Math.max(0, tm)) / 1000)),
      avant: tm < 0 ? Math.ceil(-tm / 1000) : 0,
      points: { ...bataille.points },
      recharge: tm >= pretA ? 1 : borner(1 - (pretA - tm) / (c.recharge * 1000), 0, 1),
      fort: bataille.hp[o.moi],
      vent: w * SENS[o.moi],
      baisse: baisseMoi(),
    });
  };

  scene.surImage((dt) => {
    if (fini) return;
    tm = Date.now() - o.debut;

    /* --- ma posture, échantillonnée (c'est elle que l'autre affrontera) --- */
    const b = baisseMoi();
    if (tm >= 0) while (prochaineTrace <= Math.min(tm, duree + RETOMBEE)) { trace.push(b ? 1 : 0); prochaineTrace += PAS_TRACE; }
    if (o.direct && b !== derniereBaisse) { derniereBaisse = b; o.surPose(b); }

    if (tm >= 0) bataille.avancer(Math.min(tm, duree + RETOMBEE));

    /* --- personnages et forts --- */
    redessiner(moi, bataille.hp[o.moi], b, !!depart);
    redessiner(lui, bataille.hp[o.autre], posture(o.autre, Math.max(0, tm)), false);
    secousse = Math.max(0, secousse - dt);
    // baissé, on se plaque contre son fort (c'est aussi là que la règle cherche les touches)
    lui.perso.x = sx(xDe(o.autre, !!lui.baisse));
    moi.perso.x = sx(xDe(o.moi, b)) + (secousse > 0 ? Math.sin(tm / 25) * 4 : 0);
    moi.perso.alpha = secousse > 0 ? 0.6 : 1;

    /* --- boules en vol --- */
    coucheBoules.clear();
    for (const bl of bataille.boules) {
      coucheBoules.ellipse(sx(bl.x), sy(-2), 6 * s, 2 * s).fill({ color: 0x1b2747, alpha: 0.12 });
      coucheBoules.circle(sx(bl.x), sy(bl.y), Math.max(4, 8 * s)).fill(bl.compte ? 0xffffff : 0xe9fff0).stroke({ width: 1.5, color: 0x9ab8d8 });
    }

    /* --- visée : élastique + début de trajectoire --- */
    viseur.clear();
    const visee = lireVisee();
    if (depart && courant) {
      viseur.circle(depart.x, depart.y, 6).fill({ color: 0xffffff, alpha: 0.7 });
      viseur.moveTo(depart.x, depart.y).lineTo(courant.x, courant.y).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
    }
    if (visee) {
      const s0 = SENS[o.moi];
      let x = X[o.moi] + s0 * MAIN_DX, y = MAIN_Y;
      let vx = s0 * visee.v * Math.cos(visee.a), vy = visee.v * Math.sin(visee.a);
      const w = ventA(c, o.m, Math.max(0, tm));
      for (let t = 0, k = 0; t < APERCU; t += PAS, k++) {
        vx += w * PAS / 1000; vy -= GRAVITE * PAS / 1000; x += vx * PAS / 1000; y += vy * PAS / 1000;
        if (k % 4 === 3) viseur.circle(sx(x), sy(y), Math.max(3.5, 6 * s) * (1 - t / APERCU / 2)).fill({ color: 0xffd166, alpha: 0.95 - t / APERCU * 0.5 }).stroke({ width: 1.5, color: 0x1b2747, alpha: 0.35 });
      }
    }

    /* --- éclats --- */
    for (let i = listeEclats.length - 1; i >= 0; i--) {
      const e = listeEclats[i];
      e.vie -= dt; e.vy += 400 * dt;
      e.g.x += e.vx * dt; e.g.y += e.vy * dt; e.g.alpha = Math.max(0, e.vie * 2);
      if (e.vie <= 0) { e.g.destroy(); listeEclats.splice(i, 1); }
    }

    /* --- neige qui file avec le vent (vu de mon écran) --- */
    const vEcran = ventA(c, o.m, Math.max(0, tm)) * SENS[o.moi];
    neige.clear();
    for (const f of flocons) {
      f.y = (f.y + dt * (0.05 + f.r * 0.02)) % 1;
      f.x = (((f.x + dt * vEcran / 3000) % 1) + 1) % 1;
      neige.circle(f.x * W, f.y * sol, f.r).fill({ color: 0xffffff, alpha: 0.7 });
    }

    if (tm - dernierHud > 100 || tm < 0) { dernierHud = tm; hud(); }

    // la manche s'arrête quand les dernières boules sont retombées
    if (tm >= duree + 400 && (bataille.boules.length === 0 || tm >= duree + RETOMBEE)) {
      fini = true;
      hud();
      o.surFin({ m: o.m, tirs: mesTirs, trace, direct: o.direct });
    }
  });

  const nettoyer = () => {
    canvas.removeEventListener("pointerdown", bas);
    canvas.removeEventListener("pointermove", bouge);
    canvas.removeEventListener("pointerup", haut);
    canvas.removeEventListener("pointercancel", annuler);
    removeEventListener("keydown", kd);
    removeEventListener("keyup", ku);
    removeEventListener("blur", flou);
  };

  return {
    tirDistant: (t) => { if (!fini && !autreParti) bataille.lancer(o.autre, t); },
    poseDistante: (b) => { autreBaisse = b; },
    baisser: (b) => { boutonBaisse = b; if (b) depart = courant = null; },
    sansAutre: () => { autreParti = true; lui.perso.alpha = 0.3; },
    arreter: () => { fini = true; nettoyer(); scene.detruire(); },
  };
}
