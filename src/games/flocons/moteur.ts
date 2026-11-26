/**
 * Jour 10 — moteur de l'attrape-flocons (PixiJS).
 *
 * Repères : le jeu se passe dans un « terrain » centré, de largeur `L` (au plus 0,8 × la hauteur,
 * pour que l'ordinateur ne soit pas plus facile que le téléphone). Positions des objets en fractions :
 * `x` de 0 (gauche) à 1 (droite), `y` de 0 (haut) à 1 (bas). Pingou glisse sur la glace en bas.
 *
 * Tout ce qui tombe est tiré à l'avance depuis `contenu.graine` : même graine = même tempête pour les deux.
 */

import { Container, Graphics } from "pixi.js";
import type { SoundApi } from "../../core/contracts";
import { FLOCONS_LIGNES, type FloconsContent } from "../../data/games/flocons-jour10";
import { creerAlea } from "../shared/alea";
import { creerSaisie, creerScene } from "../shared/scene";

const SOL = 0.86;           // hauteur de la glace où glisse Pingou (fraction)
const DEMI_PANIER = 30;     // demi-largeur de l'ouverture du panier (pixels à l'échelle 1)
const HAUT_PANIER = 80;     // hauteur du bord du panier au-dessus des pieds
const ANNONCE = 1.4;        // secondes d'avance avec lesquelles Pingou annonce une rafale

export type EtatHud = { score: number; reste: number; vies: number; combo: number };
export type FinPartie = { score: number; flocons: number; dores: number; vies: number; tenu: boolean; meilleureSerie: number };

export type OptionsFlocons = {
  contenu: FloconsContent;
  prenomAutre: string;
  /** Meilleur score de l'autre, pour le petit frisson du dépassement */
  scoreAutre: number | null;
  sound: SoundApi;
  surHud: (e: EtatHud) => void;
  surFlash: (texte: string) => void;
  surFin: (f: FinPartie) => void;
};

type TypeObjet = "flocon" | "dore" | "glacon";
type Objet = { t: number; x: number; v: number; type: TypeObjet; y: number; actif: boolean; fini: boolean; rot: number; vue?: Container };
type Rafale = { t: number; sens: 1 | -1; annoncee: boolean };
type Eclat = { x: number; y: number; vx: number; vy: number; vie: number; couleur: number };

const melange = (t: number, a: number, b: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/* ------------------------------------------------------------------ */
/* Tirage de la tempête                                                */
/* ------------------------------------------------------------------ */

function tirerTempete(c: FloconsContent): { objets: Objet[]; rafales: Rafale[] } {
  const alea = creerAlea(c.graine);
  const objets: Objet[] = [];
  let dernierX = 0.5;
  for (let t = 1.2; t < c.duree - 1.2;) {
    const p = t / c.duree;
    const tire = alea.reel();
    const type: TypeObjet = tire < c.partDores ? "dore" : tire < c.partDores + melange(p, c.partGlaconsDepart, c.partGlaconsFin) ? "glacon" : "flocon";
    // pas deux objets collés au même endroit : on s'écarte un peu du précédent
    let x = 0.07 + alea.reel() * 0.86;
    if (Math.abs(x - dernierX) < 0.08) x = x > 0.5 ? x - 0.16 : x + 0.16;
    dernierX = x;
    const v = melange(p, c.vitesseDepart, c.vitesseFin) * (type === "dore" ? 1.4 : type === "glacon" ? 1.12 : 1) * (0.88 + alea.reel() * 0.24);
    objets.push({ t, x, v, type, y: -0.06, actif: false, fini: false, rot: alea.reel() * 6.28 });
    t += (1 / melange(p, c.cadenceDepart, c.cadenceFin)) * (0.6 + alea.reel() * 0.8);
  }
  // rafales : réparties sur la partie à partir de 15 s, un peu de flou sur les dates
  const rafales: Rafale[] = [];
  const debut = 15, fin = c.duree - c.dureeRafale - 3;
  for (let i = 0; i < c.rafales; i++) {
    const base = debut + ((fin - debut) * (i + 0.5)) / Math.max(1, c.rafales);
    rafales.push({ t: base + (alea.reel() - 0.5) * 4, sens: alea.chance(0.5) ? 1 : -1, annoncee: false });
  }
  return { objets, rafales };
}

/* ------------------------------------------------------------------ */
/* Dessins                                                             */
/* ------------------------------------------------------------------ */

/** Les six branches d'un flocon, avec leurs petits V */
function branches(g: Graphics): Graphics {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const cx = Math.cos(a), sy = Math.sin(a);
    g.moveTo(0, 0).lineTo(cx * 12, sy * 12);
    const bx = cx * 7, by = sy * 7;
    for (const s of [-1, 1]) {
      const b = a + s * 0.75;
      g.moveTo(bx, by).lineTo(bx + Math.cos(b) * 4.5, by + Math.sin(b) * 4.5);
    }
  }
  return g;
}

function dessinerFlocon(dore: boolean): Container {
  const c = new Container();
  const couleur = dore ? 0xffc93c : 0xffffff;
  if (dore) c.addChild(new Graphics().circle(0, 0, 19).fill({ color: 0xffd76a, alpha: 0.3 }));
  c.addChild(branches(new Graphics()).stroke({ width: 5, color: dore ? 0xb7790f : 0x7fb2dd, cap: "round", alpha: 0.75 }));
  c.addChild(branches(new Graphics()).stroke({ width: 2.4, color: couleur, cap: "round" }));
  c.addChild(new Graphics().circle(0, 0, 3).fill(couleur));
  return c;
}

function dessinerGlacon(): Container {
  const c = new Container();
  const g = new Graphics();
  // glaçon pointu, pointe vers le bas, contour sombre pour qu'il se distingue des flocons
  g.poly([-11, -16, 11, -16, 7, -4, 3, 18, 0, 24, -3, 18, -7, -4]).fill(0xcfeaff).stroke({ width: 2.5, color: 0x2a5b8c });
  g.poly([-4, -14, 0, -14, -1, 12]).fill({ color: 0xffffff, alpha: 0.85 });
  g.roundRect(-13, -20, 26, 6, 3).fill(0x9cc9ec).stroke({ width: 2, color: 0x2a5b8c });
  c.addChild(g);
  return c;
}

/** Pingou vu de face, ailerons levés, panier au-dessus de la tête. Origine = entre les pieds. */
function dessinerPingou(): { vue: Container; panier: Graphics } {
  const vue = new Container();
  const ombre = new Graphics().ellipse(0, 2, 26, 6).fill({ color: 0x1b2747, alpha: 0.18 });
  const pieds = new Graphics().ellipse(-9, -1, 8, 4).fill(0xf29a2e).ellipse(9, -1, 8, 4).fill(0xf29a2e);
  const ailes = new Graphics();
  ailes.poly([-17, -40, -24, -46, -30, -72, -24, -74, -12, -48]).fill(0x1d2433);
  ailes.poly([17, -40, 24, -46, 30, -72, 24, -74, 12, -48]).fill(0x1d2433);
  const corps = new Graphics()
    .ellipse(0, -28, 20, 28).fill(0x1d2433)
    .ellipse(0, -23, 13, 20).fill(0xffffff);
  const tete = new Graphics()
    .circle(0, -52, 15).fill(0x1d2433)
    .ellipse(0, -50, 10, 9).fill(0xffffff)
    .circle(-4.5, -53, 2.2).fill(0x1d2433)
    .circle(4.5, -53, 2.2).fill(0x1d2433)
    .circle(-3.8, -53.8, 0.8).fill(0xffffff)
    .circle(5.2, -53.8, 0.8).fill(0xffffff)
    .poly([-3.5, -48, 3.5, -48, 0, -43.5]).fill(0xf29a2e)
    .ellipse(-9, -47, 3, 1.8).fill({ color: 0xff8fa3, alpha: 0.7 })
    .ellipse(9, -47, 3, 1.8).fill({ color: 0xff8fa3, alpha: 0.7 });
  const echarpe = new Graphics()
    .roundRect(-15, -40, 30, 6, 3).fill(0xd9354b)
    .roundRect(6, -38, 6, 13, 3).fill(0xb52a3e);
  // panier en osier tenu à bout d'ailerons ; son bord est à y = -HAUT_PANIER
  const panier = new Graphics();
  panier.poly([-DEMI_PANIER, -HAUT_PANIER, DEMI_PANIER, -HAUT_PANIER, 22, -62, -22, -62]).fill(0xc58a4a).stroke({ width: 2, color: 0x7a4f22 });
  for (let i = -2; i <= 2; i++) panier.moveTo(i * 10.5, -HAUT_PANIER + 2).lineTo(i * 8, -63);
  panier.moveTo(-26, -71).lineTo(26, -71);
  panier.stroke({ width: 1.4, color: 0x8a5a2b, alpha: 0.8 });
  panier.roundRect(-DEMI_PANIER - 3, -HAUT_PANIER - 3, DEMI_PANIER * 2 + 6, 6, 3).fill(0xa8713a).stroke({ width: 1.5, color: 0x7a4f22 });
  vue.addChild(ombre, pieds, ailes, corps, echarpe, tete, panier);
  return { vue, panier };
}

/* ------------------------------------------------------------------ */
/* Partie                                                              */
/* ------------------------------------------------------------------ */

export async function demarrerFlocons(hote: HTMLElement, o: OptionsFlocons): Promise<() => void> {
  const creee = await creerScene(hote);
  if (!creee) return () => { /* jeu déjà fermé */ };
  const scene = creee;
  const { contenu } = o;
  const { objets, rafales } = tirerTempete(contenu);
  const saisie = creerSaisie(hote);

  /* ---------- géométrie ---------- */
  let L = 0, H = 0, gauche = 0, S = 1;
  const mesurer = () => {
    H = scene.hauteur;
    L = Math.min(scene.largeur, H * 0.8);
    gauche = (scene.largeur - L) / 2;
    S = Math.max(0.7, Math.min(L / 390, H / 640));
  };
  mesurer();
  const px = (x: number) => gauche + x * L;
  const py = (y: number) => y * H;

  /* ---------- décor ---------- */
  const ciel = new Graphics();
  const rive = new Graphics();
  const lac = new Graphics();
  const coucheObjets = new Container();
  const coucheEclats = new Graphics();
  const brume = new Graphics();
  const neige = new Graphics();
  const traits = new Graphics(); // traînées de vent pendant les rafales
  const { vue: pingou } = dessinerPingou();
  scene.monde.addChild(ciel, rive, lac, coucheObjets, pingou, coucheEclats, traits, neige, brume);

  function dessinerDecor() {
    const l = scene.largeur, h = H, yLac = py(SOL) - 40 * S;
    ciel.clear();
    // dégradé de l'orage (sombre en haut) vers l'horizon, en fines bandes
    const haut = [0x2d, 0x44, 0x69], bas = [0x8f, 0xa7, 0xc4], n = 40;
    for (let i = 0; i < n; i++) {
      const [r, v, b] = haut.map((c, k) => Math.round(melange(i / (n - 1), c, bas[k])));
      ciel.rect(0, (yLac * i) / n, l, yLac / n + 1).fill((r << 16) | (v << 8) | b);
    }
    // rive lointaine : sapins sombres
    rive.clear();
    const alea = creerAlea(77);
    rive.rect(0, yLac - 10 * S, l, 12 * S).fill(0xdfe9f3);
    for (let x = -10; x < l + 20; x += 14 + alea.reel() * 14) {
      const hS = (22 + alea.reel() * 26) * S;
      rive.poly([x - hS * 0.32, yLac - 6 * S, x + hS * 0.32, yLac - 6 * S, x, yLac - 6 * S - hS]).fill(alea.chance(0.5) ? 0x24405e : 0x2c4b6b);
    }
    // lac gelé, avec quelques fissures
    lac.clear();
    lac.rect(0, yLac, l, h - yLac).fill(0xc9e1f2);
    lac.ellipse(l / 2, py(SOL) + 8 * S, Math.max(l, 400) * 0.62, 26 * S).fill({ color: 0xe6f2fb, alpha: 0.8 });
    for (let i = 0; i < 7; i++) {
      const x0 = alea.reel() * l, y0 = yLac + 10 + alea.reel() * (h - yLac - 20);
      lac.moveTo(x0, y0).lineTo(x0 + (alea.reel() - 0.5) * 60 * S, y0 + (alea.reel() - 0.3) * 14 * S)
        .lineTo(x0 + (alea.reel() - 0.5) * 90 * S, y0 + (alea.reel() - 0.2) * 18 * S);
    }
    lac.stroke({ width: 1.3, color: 0x8fb8d8, alpha: 0.7 });
    // bords du terrain, discrets, quand l'écran est plus large que le terrain
    if (gauche > 4) {
      lac.rect(gauche - 3, yLac, 3, h - yLac).fill({ color: 0xffffff, alpha: 0.3 });
      lac.rect(gauche + L, yLac, 3, h - yLac).fill({ color: 0xffffff, alpha: 0.3 });
    }
  }
  dessinerDecor();
  scene.surTaille(() => { mesurer(); dessinerDecor(); });

  // neige de la tempête : particules purement décoratives (hasard libre, pas besoin d'être identiques)
  const particules = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2, v: 0.5 + Math.random() }));

  /* ---------- état ---------- */
  let temps = 0, hudTemps = 0, fini = false;
  let x = 0.5, vx = 0;
  let vies = contenu.vies, invincible = 0;
  let points = 0, serie = 0, meilleureSerie = 0, attrapes = 0, dores = 0;
  let vent = 0;
  let jalonMoitie = false, jalonFinale = false, depasse = false;
  let prochain = 0; // index du prochain objet à faire tomber
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
      eclats.push({ x: xp, y: yp, vx: Math.cos(a) * f, vy: Math.sin(a) * f - 40 * S, vie: 0.5 + Math.random() * 0.3, couleur });
    }
  }

  function terminer(tenu: boolean) {
    if (fini) return;
    fini = true;
    const bonus = tenu ? Math.max(0, vies) * contenu.bonusVie : 0;
    points += bonus;
    pousserHud(true);
    o.sound.play(tenu ? "win" : "bad");
    o.surFin({ score: points, flocons: attrapes, dores, vies: Math.max(0, vies), tenu, meilleureSerie });
  }

  /* ---------- boucle ---------- */
  scene.surImage((dt) => {
    if (fini) return;
    temps += dt; hudTemps += dt;
    const p = temps / contenu.duree;

    // vent : léger balancement qui grandit, plus les rafales
    let rafale = 0;
    for (const r of rafales) {
      if (!r.annoncee && temps >= r.t - ANNONCE) {
        r.annoncee = true;
        flash(`${FLOCONS_LIGNES.rafale} ${r.sens > 0 ? "→" : "←"}`);
        o.sound.play("whoosh");
      }
      const dans = temps - r.t;
      if (dans > 0 && dans < contenu.dureeRafale) {
        const monte = Math.min(1, dans / 0.5, (contenu.dureeRafale - dans) / 0.5);
        rafale += r.sens * contenu.forceRafale * monte;
      }
    }
    vent = Math.sin(temps * 0.35) * melange(p, 0.01, 0.05) + rafale;

    // Pingou : suit le doigt, ou glisse avec les flèches (un peu d'élan sur la glace)
    const avant = x;
    x += saisie.prendreGlissement() / L;
    const axe = saisie.axeClavier();
    if (axe !== 0) vx = melange(dt * 9, vx, axe * 1.15);
    else vx *= Math.max(0, 1 - dt * 7);
    x += vx * dt + vent * 0.22 * dt; // la rafale pousse un peu Pingou aussi
    const marge = ((DEMI_PANIER + 8) * S) / L;
    x = Math.max(marge, Math.min(1 - marge, x));
    const vitesse = (x - avant) / Math.max(dt, 0.001);

    pingou.scale.set(S);
    pingou.x = px(x);
    pingou.y = py(SOL);
    pingou.rotation = Math.max(-0.22, Math.min(0.22, vitesse * 0.35));
    if (invincible > 0) invincible -= dt;
    pingou.alpha = invincible > 0 ? (Math.sin(temps * 28) > 0 ? 0.35 : 1) : 1;

    // le bord du panier, en pixels (il suit l'inclinaison de Pingou, à peu près)
    const bordY = py(SOL) - HAUT_PANIER * S;
    const bordX = px(x) + Math.sin(pingou.rotation) * HAUT_PANIER * S;

    // objets qui entrent dans le ciel
    while (prochain < objets.length && objets[prochain].t <= temps) objets[prochain++].actif = true;

    for (let i = 0; i < prochain; i++) {
      const ob = objets[i];
      if (ob.fini) continue;
      const yAvant = py(ob.y);
      ob.y += ob.v * dt;
      ob.x = Math.max(0.03, Math.min(0.97, ob.x + vent * dt));
      ob.rot += dt * (ob.type === "glacon" ? 0 : 1.2);
      const yObj = py(ob.y);

      if (!ob.vue) {
        ob.vue = ob.type === "glacon" ? dessinerGlacon() : dessinerFlocon(ob.type === "dore");
        coucheObjets.addChild(ob.vue);
      }
      ob.vue.scale.set(S);
      ob.vue.x = px(ob.x);
      ob.vue.y = yObj;
      ob.vue.rotation = ob.type === "glacon" ? vent * 1.2 : ob.rot;

      // dans le panier ?
      const rayon = (ob.type === "glacon" ? 7 : 10) * S;
      if (yAvant <= bordY + 4 * S && yObj >= bordY - 2 * S && Math.abs(px(ob.x) - bordX) <= DEMI_PANIER * S + rayon) {
        ob.fini = true;
        ob.vue.destroy({ children: true }); ob.vue = undefined;
        if (ob.type === "glacon") {
          if (invincible > 0) continue; // il rebondit sur le panier pendant le clignotement
          vies--; serie = 0; invincible = 1.1;
          o.sound.play("bad");
          eclater(bordX, bordY, 0xcfeaff, 10);
          flash(FLOCONS_LIGNES.glacon[Math.min(FLOCONS_LIGNES.glacon.length - 1, contenu.vies - vies - 1)]);
          if (vies <= 0) { terminer(false); return; }
        } else {
          serie++; attrapes++;
          meilleureSerie = Math.max(meilleureSerie, serie);
          const base = ob.type === "dore" ? contenu.pointsDore : contenu.pointsFlocon;
          points += Math.round(base * multiplicateur());
          if (ob.type === "dore") { dores++; o.sound.play("good"); flash(FLOCONS_LIGNES.dore); }
          else o.sound.play("pop");
          eclater(bordX, bordY, ob.type === "dore" ? 0xffd76a : 0xffffff, ob.type === "dore" ? 12 : 5);
          if (serie > 0 && serie % 15 === 0) flash(FLOCONS_LIGNES.serie.replace("{n}", String(serie)));
        }
        continue;
      }

      // tombé sur la glace
      if (ob.y >= SOL + 0.015) {
        ob.fini = true;
        ob.vue.destroy({ children: true }); ob.vue = undefined;
        if (ob.type === "flocon") serie = 0; // un flocon perdu casse la série (les dorés, non)
        eclater(px(ob.x), py(SOL + 0.015), ob.type === "glacon" ? 0xcfeaff : 0xffffff, ob.type === "glacon" ? 6 : 3);
      }
    }

    // éclats
    coucheEclats.clear();
    for (let i = eclats.length - 1; i >= 0; i--) {
      const e = eclats[i];
      e.vie -= dt;
      if (e.vie <= 0) { eclats.splice(i, 1); continue; }
      e.vy += 260 * S * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      coucheEclats.circle(e.x, e.y, 2.2 * S).fill({ color: e.couleur, alpha: Math.min(1, e.vie * 2) });
    }

    // la tempête monte : plus de neige, plus de brume
    const visibles = Math.floor(melange(p, 45, 220));
    neige.clear();
    for (let i = 0; i < visibles; i++) {
      const f = particules[i];
      f.y += (0.08 + 0.12 * p) * f.v * dt;
      f.x += (vent * 1.6 + 0.01) * f.v * dt;
      if (f.y > 1) f.y -= 1;
      if (f.x > 1) f.x -= 1; else if (f.x < 0) f.x += 1;
      neige.circle(f.x * scene.largeur, f.y * H, f.r * S).fill({ color: 0xffffff, alpha: 0.35 + f.r * 0.15 });
    }
    brume.clear();
    brume.rect(0, 0, scene.largeur, H).fill({ color: 0xeef4fa, alpha: melange(p, 0.02, 0.2) });

    traits.clear();
    if (Math.abs(rafale) > 0.02) {
      const force = Math.abs(rafale) / contenu.forceRafale;
      for (let i = 0; i < 9; i++) {
        const y = H * (0.12 + i * 0.08) + Math.sin(temps * 3 + i) * 8;
        const longueur = (50 + (i % 3) * 25) * S * force;
        const x0 = ((temps * 900 * Math.sign(rafale) + i * 157) % (scene.largeur + 200) + scene.largeur + 200) % (scene.largeur + 200) - 100;
        traits.moveTo(x0, y).lineTo(x0 - Math.sign(rafale) * longueur, y);
      }
      traits.stroke({ width: 2, color: 0xffffff, alpha: 0.5 * force, cap: "round" });
    }

    // jalons
    if (!jalonMoitie && p >= 0.5) { jalonMoitie = true; flash(FLOCONS_LIGNES.moitie); }
    if (!jalonFinale && contenu.duree - temps <= 10) { jalonFinale = true; flash(FLOCONS_LIGNES.finale); }
    if (!depasse && o.scoreAutre !== null && points > o.scoreAutre) {
      depasse = true;
      o.sound.play("good");
      flash(FLOCONS_LIGNES.depasse.replace("{autre}", o.prenomAutre));
    }
    if (temps >= contenu.duree) { terminer(true); return; }

    pousserHud();
  });

  o.sound.setGameMusic("action");
  flash(FLOCONS_LIGNES.depart);

  return () => {
    saisie.detruire();
    scene.detruire();
  };
}
