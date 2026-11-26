/**
 * Jour 21 — moteur du sapin (PixiJS) : dessin du sapin et des décos, pose au doigt,
 * guirlandes tracées du doigt, main de l'autre en direct, étoile à tenir, lumières et feu d'artifice.
 *
 * Le moteur ne sait rien du journal : il reçoit l'état à afficher (`afficher`) et rend les gestes
 * du joueur (`surPose`, `surMain`, `surEtoile…`). La décision de poser l'étoile reste dans index.tsx.
 *
 * Repère : voir regles.ts (x de -1 à 1, y de 0 = pointe à 1 = bas des branches, 1–1,2 = pied).
 */

import { Container, FillGradient, Graphics, Text } from "pixi.js";
import type { SoundApi } from "../../core/contracts";
import type { SapinContent, TypeDeco } from "../../data/games/sapin-jour21";
import { creerAlea } from "../shared/alea";
import { creerScene } from "../shared/scene";
import { ETAGES, PIED, auPied, coupDeco, coupGuirlande, rabattre, surBranches, type CoupSapin, type Deco, type EtatSapin, type TypePose } from "./regles";

/** Ce que l'autre tient sous le doigt, envoyé en direct (jamais enregistré) */
export type Main = { x: number; y: number; d?: TypeDeco; c?: number; etoile?: 1 };

export type OptionsSapin = {
  contenu: SapinContent;
  sound: SoundApi;
  /** L'outil choisi dans le panier, lu à chaque geste */
  outil: () => { type: TypeDeco; couleur: number };
  /** Le joueur peut-il encore poser ? (limite atteinte → refus) */
  peutPoser: (type: TypeDeco) => boolean;
  surPose: (coup: CoupSapin) => void;
  surRefus: (raison: "hors" | "pied" | "plein") => void;
  surMain: (m: Main | null) => void;
  /** Le doigt se pose sur l'étoile ou la lâche */
  surEtoileTenue: (tient: boolean) => void;
  /** Vrai si le temps de tenue doit avancer (seul, ou l'autre tient aussi en direct) */
  etoileAvance: () => boolean;
  /** L'étoile a été tenue assez longtemps */
  surEtoileComplete: () => void;
};

export type MoteurSapin = {
  afficher(e: EtatSapin, etoileVisible: boolean): void;
  mainAutre(m: Main | null, prenom: string): void;
  /** Petit éclat et prénom sur une déco qui vient d'arriver de l'autre */
  saluer(id: string, texte: string): void;
  /** Lumières allumées (avec feu d'artifice si `fete`) */
  allumer(fete: boolean): void;
  detruire(): void;
};

/* ------------------------------------------------------------------ */
/* Couleurs                                                            */
/* ------------------------------------------------------------------ */

const SAPIN_CLAIR = 0x2f8a55, SAPIN_SOMBRE = 0x22693f, NEIGE = 0xf4f8fd, TRONC = 0x7a4a2c;
const AMPOULES = [0xffd25e, 0xff6b6b, 0x7cc4ff, 0xff9ad0, 0xb9f27c];

function teinte(c: number, f: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

/* ------------------------------------------------------------------ */
/* Dessins des décos (centrées en 0, 0, taille s)                     */
/* ------------------------------------------------------------------ */

function etoilePts(r: number, interieur = 0.45): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * interieur : r;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return pts;
}

function dessinerDeco(d: TypeDeco, couleur: number, s: number): Container {
  const c = new Container();
  const g = new Graphics();
  const sombre = teinte(couleur, -0.35);
  const clair = couleur === 0xfff8ec || couleur === 0xc9d4e2;
  switch (d) {
    case "boule":
      g.moveTo(0, -s * 1.15).lineTo(0, -s * 0.85).stroke({ width: Math.max(1, s * 0.08), color: 0xe9d8a6 });
      g.roundRect(-s * 0.24, -s * 1.02, s * 0.48, s * 0.24, s * 0.06).fill(0xe0b84a);
      g.circle(0, 0, s * 0.85).fill(couleur).stroke({ width: Math.max(1, s * 0.1), color: sombre });
      g.ellipse(0, s * 0.05, s * 0.82, s * 0.16).stroke({ width: Math.max(1, s * 0.09), color: teinte(couleur, 0.35), alpha: 0.8 });
      g.circle(-s * 0.32, -s * 0.34, s * 0.2).fill({ color: 0xffffff, alpha: 0.7 });
      break;
    case "sucre": {
      // une canne : on trace le crochet, puis les rayures par-dessus
      const pts: [number, number][] = [];
      for (let i = 0; i <= 8; i++) pts.push([0, s * 1.1 - (i / 8) * s * 1.5]);
      for (let i = 1; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; pts.push([s * 0.42 + Math.cos(a) * s * 0.42, -s * 0.4 + Math.sin(a) * s * 0.42]); }
      const w = s * 0.34;
      g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p);
      g.stroke({ width: w + 2, color: sombre, cap: "round", join: "round" });
      g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p);
      g.stroke({ width: w, color: clair ? 0xd9354b : 0xfffaf2, cap: "round", join: "round" });
      for (let i = 0; i < pts.length - 1; i += 2) {
        g.moveTo(...pts[i]).lineTo(...pts[i + 1]).stroke({ width: w * 0.8, color: clair ? 0xfffaf2 : couleur, cap: "butt" });
      }
      break;
    }
    case "coeur":
      g.moveTo(0, s * 0.85)
        .bezierCurveTo(-s * 1.2, s * 0.05, -s * 0.75, -s * 0.95, 0, -s * 0.38)
        .bezierCurveTo(s * 0.75, -s * 0.95, s * 1.2, s * 0.05, 0, s * 0.85)
        .fill(couleur).stroke({ width: Math.max(1, s * 0.1), color: sombre });
      g.moveTo(-s * 0.5, -s * 0.2).quadraticCurveTo(-s * 0.55, -s * 0.5, -s * 0.25, -s * 0.5).stroke({ width: s * 0.12, color: 0xffffff, alpha: 0.6, cap: "round" });
      break;
    case "cloche":
      g.circle(0, -s * 0.95, s * 0.14).fill(0xe0b84a);
      g.moveTo(-s * 0.85, s * 0.6)
        .bezierCurveTo(-s * 0.55, s * 0.4, -s * 0.6, -s * 0.85, 0, -s * 0.85)
        .bezierCurveTo(s * 0.6, -s * 0.85, s * 0.55, s * 0.4, s * 0.85, s * 0.6)
        .closePath().fill(couleur).stroke({ width: Math.max(1, s * 0.1), color: sombre });
      g.circle(0, s * 0.72, s * 0.2).fill(sombre);
      g.moveTo(-s * 0.28, -s * 0.5).quadraticCurveTo(-s * 0.4, -s * 0.1, -s * 0.42, s * 0.25).stroke({ width: s * 0.12, color: 0xffffff, alpha: 0.55, cap: "round" });
      break;
    case "noeud":
      g.poly([0, 0, -s * 1, -s * 0.6, -s * 1, s * 0.55]).fill(couleur).stroke({ width: Math.max(1, s * 0.08), color: sombre, join: "round" });
      g.poly([0, 0, s * 1, -s * 0.6, s * 1, s * 0.55]).fill(couleur).stroke({ width: Math.max(1, s * 0.08), color: sombre, join: "round" });
      g.poly([-s * 0.1, s * 0.1, -s * 0.55, s * 1.1, -s * 0.25, s * 0.95, 0, s * 1.15]).fill(sombre);
      g.poly([s * 0.1, s * 0.1, s * 0.55, s * 1.1, s * 0.25, s * 0.95, 0, s * 1.15]).fill(sombre);
      g.circle(0, 0, s * 0.28).fill(teinte(couleur, 0.15)).stroke({ width: Math.max(1, s * 0.08), color: sombre });
      break;
    case "cadeau": {
      const ruban = clair ? 0xd9354b : couleur === 0xf2b632 ? 0xd9354b : 0xf6e7b8;
      const L = s * 2.1, H = s * 1.6;
      g.ellipse(0, s * 0.05, L * 0.6, s * 0.22).fill({ color: 0x0c1530, alpha: 0.25 });
      g.roundRect(-L / 2, -H, L, H, s * 0.12).fill(couleur).stroke({ width: Math.max(1, s * 0.1), color: sombre });
      g.rect(L / 2 - L * 0.22, -H, L * 0.22, H).fill({ color: 0x000000, alpha: 0.12 });
      g.rect(-s * 0.16, -H, s * 0.32, H).fill(ruban);
      g.rect(-L / 2, -H * 0.62, L, s * 0.26).fill(ruban);
      g.ellipse(-s * 0.32, -H - s * 0.16, s * 0.34, s * 0.2).stroke({ width: s * 0.16, color: ruban });
      g.ellipse(s * 0.32, -H - s * 0.16, s * 0.34, s * 0.2).stroke({ width: s * 0.16, color: ruban });
      break;
    }
    case "guirlande":
      // icône seulement (fantôme sous le doigt) : trois ampoules sur un fil
      g.moveTo(-s, -s * 0.2).quadraticCurveTo(0, s * 0.7, s, -s * 0.2).stroke({ width: s * 0.22, color: couleur });
      [-0.6, 0, 0.6].forEach((x, i) => g.circle(x * s, s * 0.1 + (x === 0 ? s * 0.12 : 0), s * 0.18).fill(AMPOULES[i]));
      break;
  }
  c.addChild(g);
  return c;
}

/* ------------------------------------------------------------------ */
/* Moteur                                                              */
/* ------------------------------------------------------------------ */

type VueDeco = { cont: Container; nee: number; deco: Deco };
type Eclat = { g: Graphics; vx: number; vy: number; vie: number; duree: number };

export async function demarrerSapin(hote: HTMLElement, o: OptionsSapin): Promise<MoteurSapin | null> {
  const scene = await creerScene(hote);
  if (!scene) return null;
  const { monde } = scene;
  const palette = o.contenu.couleurs.map((c) => c.hex);

  // calques, du fond vers l'avant
  const fond = new Graphics();
  const neige = new Container();
  const arbre = new Graphics();
  const calqueGuirlandes = new Container();
  const calqueDecos = new Container(); calqueDecos.sortableChildren = true;
  const lueurs = new Container(); lueurs.blendMode = "add";
  const etoile = new Container();
  const autre = new Container();
  const fantome = new Container();
  const effets = new Container();
  monde.addChild(fond, neige, arbre, calqueGuirlandes, calqueDecos, lueurs, etoile, autre, fantome, effets);

  /* ---------- mise en page ---------- */
  let k = 100, cx = 0, haut = 0;
  const X = (x: number) => cx + x * k;
  const Y = (y: number) => haut + y * k * 1.55;
  const versSapin = (px: number, py: number): [number, number] => [(px - cx) / k, (py - haut) / (k * 1.55)];
  const taille = () => k * 0.075;

  const mettreEnPage = () => {
    const L = scene.largeur, H = scene.hauteur;
    k = Math.max(60, Math.min((L - 28) / 2.1, (H - 24) / 2.3));
    cx = L / 2;
    haut = (H - k * 1.55 * PIED.bas) / 2 + k * 0.2;
  };

  /* ---------- décor ---------- */
  const alea = creerAlea(21);
  const etoilesCiel = Array.from({ length: 36 }, () => ({ x: alea.reel(), y: alea.reel() * 0.6, r: 0.6 + alea.reel() * 1.4 }));
  let nuit = 0; // 0 → 1 quand les lumières s'allument

  const dessinerFond = () => {
    const L = scene.largeur, H = scene.hauteur;
    fond.clear();
    const ciel = new FillGradient(0, 0, 0, H);
    ciel.addColorStop(0, teinte(0x2a4174, -0.45 * nuit));
    ciel.addColorStop(1, teinte(0x4d6aa8, -0.4 * nuit));
    fond.rect(0, 0, L, H).fill(ciel);
    for (const e of etoilesCiel) fond.circle(e.x * L, e.y * H, e.r).fill({ color: 0xffffff, alpha: 0.35 + 0.4 * nuit });
    // colline de neige sous le sapin
    fond.ellipse(cx, Y(1.13) + k * 0.6, Math.max(L * 0.75, k * 1.6), k * 0.75).fill(teinte(NEIGE, -0.06 - 0.25 * nuit));
    fond.ellipse(cx, Y(1.1), k * 1.15, k * 0.16).fill({ color: 0x0c1530, alpha: 0.12 });
  };

  const dessinerArbre = () => {
    arbre.clear();
    // tronc et tapis de sapin
    arbre.rect(X(-0.09), Y(0.95), k * 0.18, Y(1.08) - Y(0.95)).fill(TRONC);
    arbre.rect(X(0), Y(0.95), k * 0.09, Y(1.08) - Y(0.95)).fill(teinte(TRONC, -0.25));
    arbre.ellipse(cx, Y(1.08), k * 0.62, k * 0.11).fill(0xb8323f);
    arbre.ellipse(cx, Y(1.08) - 2, k * 0.62, k * 0.11).stroke({ width: Math.max(2, k * 0.025), color: 0xfff4f0 });
    // les étages, du bas vers le haut
    for (let i = ETAGES.length - 1; i >= 0; i--) {
      const [a, b, wa, wb] = ETAGES[i];
      const n = 4 + i; const creux = 0.035;
      const bord = (cote: 1 | -1, couleur: number) => {
        arbre.moveTo(X(0), Y(a - (i === 0 ? 0.0 : 0.02)));
        arbre.lineTo(X(cote * wa), Y(a));
        arbre.lineTo(X(cote * wb), Y(b));
        // festons du bas, du bord vers le milieu
        for (let j = 0; j < n; j++) {
          const x0 = cote * wb * (1 - j / n), x1 = cote * wb * (1 - (j + 1) / n);
          arbre.quadraticCurveTo(X((x0 + x1) / 2), Y(b - creux), X(x1), Y(b));
        }
        arbre.closePath().fill(couleur);
      };
      bord(-1, SAPIN_CLAIR);
      bord(1, SAPIN_SOMBRE);
      // neige posée sur les festons
      for (let j = 0; j < n * 2; j++) {
        const x0 = -wb + (j / (n * 2)) * wb * 2, x1 = -wb + ((j + 1) / (n * 2)) * wb * 2;
        if (j % 2) continue;
        arbre.ellipse(X((x0 + x1) / 2 + wb / n / 2), Y(b - 0.012), ((x1 - x0) * k) * 0.75, k * 0.018).fill({ color: NEIGE, alpha: 0.9 });
      }
      // un peu de neige sur l'arête de gauche
      arbre.moveTo(X(-wa * 0.6), Y(a + 0.02)).lineTo(X(-wb * 0.8), Y(b - 0.06))
        .stroke({ width: Math.max(2, k * 0.02), color: NEIGE, alpha: 0.35, cap: "round" });
    }
  };

  /* ---------- flocons ---------- */
  const flocons = Array.from({ length: 38 }, () => {
    const g = new Graphics().circle(0, 0, 1 + Math.random() * 1.8).fill({ color: 0xffffff, alpha: 0.85 });
    g.x = Math.random() * scene.largeur; g.y = Math.random() * scene.hauteur;
    neige.addChild(g);
    return { g, vy: 14 + Math.random() * 26, ph: Math.random() * 6 };
  });

  /* ---------- décos ---------- */
  const vues = new Map<string, VueDeco>();
  let etat: EtatSapin | null = null;
  let etoileVisible = false;
  let allume = false;

  const placer = (v: VueDeco) => {
    const d = v.deco;
    if (d.k === "deco") {
      v.cont.position.set(X(d.x), Y(d.y));
      v.cont.rotation = d.r;
      v.cont.zIndex = d.d === "cadeau" ? 1000 + d.y : d.y;
    }
  };

  const ampoulesDe = (p: number[]): { x: number; y: number }[] => {
    const res: { x: number; y: number }[] = [];
    const pas = k * 0.085;
    let reste = pas / 2;
    for (let i = 2; i < p.length; i += 2) {
      const ax = X(p[i - 2]), ay = Y(p[i - 1]), bx = X(p[i]), by = Y(p[i + 1]);
      const l = Math.hypot(bx - ax, by - ay);
      let t = reste;
      while (t <= l) { res.push({ x: ax + ((bx - ax) * t) / l, y: ay + ((by - ay) * t) / l }); t += pas; }
      reste = t - l;
    }
    return res;
  };

  const dessinerGuirlande = (g: Graphics, p: number[], c: number) => {
    g.clear();
    const trace = () => { g.moveTo(X(p[0]), Y(p[1])); for (let i = 2; i < p.length; i += 2) g.lineTo(X(p[i]), Y(p[i + 1])); };
    trace(); g.stroke({ width: Math.max(3, k * 0.032), color: teinte(c, -0.3), cap: "round", join: "round" });
    trace(); g.stroke({ width: Math.max(2, k * 0.022), color: c, cap: "round", join: "round" });
    ampoulesDe(p).forEach((a, i) => {
      g.circle(a.x, a.y + k * 0.012, Math.max(2, k * 0.016)).fill(AMPOULES[i % AMPOULES.length]);
    });
  };

  const construireVue = (d: Deco): VueDeco => {
    let cont: Container;
    if (d.k === "guirlande") {
      cont = new Container();
      const g = new Graphics();
      dessinerGuirlande(g, d.p, palette[d.c] ?? 0xf2b632);
      cont.addChild(g);
      calqueGuirlandes.addChild(cont);
    } else {
      cont = dessinerDeco(d.d, palette[d.c] ?? 0xd9354b, taille() * (d.d === "cadeau" ? 1.5 : 1));
      calqueDecos.addChild(cont);
    }
    const v = { cont, nee: performance.now(), deco: d };
    placer(v);
    return v;
  };

  const toutRedessiner = () => {
    mettreEnPage();
    dessinerFond();
    dessinerArbre();
    for (const v of vues.values()) v.cont.destroy({ children: true });
    vues.clear();
    if (etat) for (const d of etat.decos) { const v = construireVue(d); v.nee = 0; vues.set(d.id, v); }
    dessinerLueurs();
    dessinerEtoile();
  };

  /* ---------- lumières ---------- */
  const lueursListe: { g: Graphics; ph: number }[] = [];
  const dessinerLueurs = () => {
    lueurs.removeChildren().forEach((c) => c.destroy());
    lueursListe.length = 0;
    if (!allume || !etat) return;
    for (const d of etat.decos) {
      const pts = d.k === "guirlande" ? ampoulesDe(d.p).map((a, i) => ({ ...a, c: AMPOULES[i % AMPOULES.length], r: k * 0.05 }))
        : d.d === "cadeau" ? [] : [{ x: X(d.x), y: Y(d.y), c: palette[d.c] ?? 0xffd25e, r: k * 0.09 }];
      for (const p of pts) {
        const g = new Graphics().circle(0, 0, p.r).fill({ color: p.c, alpha: 0.28 }).circle(0, 0, p.r * 0.5).fill({ color: p.c, alpha: 0.3 });
        g.position.set(p.x, p.y + (d.k === "guirlande" ? k * 0.012 : 0));
        lueurs.addChild(g);
        lueursListe.push({ g, ph: Math.random() * Math.PI * 2 });
      }
    }
  };

  /* ---------- étoile ---------- */
  const corpsEtoile = new Graphics();
  const halo = new Graphics();
  const anneau = new Graphics();
  etoile.addChild(halo, corpsEtoile, anneau);
  let tenue = 0;          // ms tenues
  let doigtEtoile = false;
  let envol = 0;          // 0 → 1 : l'étoile monte à la pointe
  let posee = false;

  const posAttente = () => ({ x: X(0.62), y: Y(0.12) });
  const posPointe = () => ({ x: X(0), y: Y(-0.045) });

  const dessinerEtoile = () => {
    const r = k * 0.12;
    corpsEtoile.clear().poly(etoilePts(r)).fill(0xffd25e).stroke({ width: Math.max(2, k * 0.015), color: 0xc98a12, join: "round" });
    corpsEtoile.poly(etoilePts(r * 0.45)).fill({ color: 0xfff6cf, alpha: 0.8 });
    halo.clear().circle(0, 0, r * 1.9).fill({ color: 0xffe28a, alpha: 0.18 }).circle(0, 0, r * 1.3).fill({ color: 0xffe28a, alpha: 0.2 });
    etoile.visible = etoileVisible || posee;
  };

  /* ---------- main de l'autre ---------- */
  let mainVisee: Main | null = null;
  let mainAff = { x: 0, y: 0, a: 0 };
  let mainDessin = "";
  const mainG = new Graphics();
  const mainDeco = new Container();
  const mainNom = new Text({ text: "", style: { fontFamily: "Fredoka, sans-serif", fontSize: 13, fontWeight: "600", fill: 0xffffff } });
  mainNom.anchor.set(0.5, 0);
  autre.addChild(mainDeco, mainG, mainNom);

  /* ---------- fantôme sous mon doigt ---------- */
  let geste: null | { type: "pose"; d: TypePose; c: number; x: number; y: number; decale: number }
    | { type: "guirlande"; c: number; pts: [number, number][]; g: Graphics }
    | { type: "etoile" } = null;
  let derniereMain = 0;

  const envoyerMain = (m: Main | null, force = false) => {
    const t = performance.now();
    if (!force && m && t - derniereMain < 60) return;
    derniereMain = t;
    o.surMain(m);
  };

  const pointDe = (e: PointerEvent) => {
    const r = hote.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };

  const bas = (e: PointerEvent) => {
    if (geste) return;
    const { px, py } = pointDe(e);
    // l'étoile d'abord
    if (etoileVisible && !posee && envol === 0) {
      const s = posAttente();
      if (Math.hypot(px - s.x, py - s.y) < k * 0.22) {
        geste = { type: "etoile" }; doigtEtoile = true; tenue = 0;
        o.surEtoileTenue(true);
        envoyerMain({ ...normalise(s.x, s.y), etoile: 1 }, true);
        o.sound.play("tap");
        hote.setPointerCapture?.(e.pointerId);
        return;
      }
    }
    const { type, couleur } = o.outil();
    if (!o.peutPoser(type)) { o.surRefus("plein"); o.sound.play("bad"); return; }
    hote.setPointerCapture?.(e.pointerId);
    if (type === "guirlande") {
      const g = new Graphics();
      calqueGuirlandes.addChild(g);
      const [x, y] = rabattre(...versSapin(px, py));
      geste = { type: "guirlande", c: couleur, pts: [[x, y]], g };
      envoyerMain({ x, y, d: "guirlande", c: couleur }, true);
      return;
    }
    // au doigt, la déco flotte un peu au-dessus pour rester visible
    const decale = e.pointerType === "touch" ? k * 0.22 : 0;
    const [x, y] = versSapin(px, py - decale);
    geste = { type: "pose", d: type, c: couleur, x, y, decale };
    fantome.removeChildren().forEach((c) => c.destroy({ children: true }));
    const f = dessinerDeco(type, palette[couleur] ?? 0xd9354b, taille() * (type === "cadeau" ? 1.5 : 1) * 1.15);
    fantome.addChild(f);
    fantome.position.set(X(x), Y(y));
    envoyerMain({ x, y, d: type, c: couleur }, true);
  };

  const normalise = (px: number, py: number) => { const [x, y] = versSapin(px, py); return { x, y }; };

  const bouge = (e: PointerEvent) => {
    if (!geste) return;
    const { px, py } = pointDe(e);
    if (geste.type === "pose") {
      const [x, y] = versSapin(px, py - geste.decale);
      geste.x = x; geste.y = y;
      fantome.position.set(X(x), Y(y));
      const ok = geste.d === "cadeau" ? auPied(x, y) : surBranches(x, y);
      fantome.alpha = ok ? 1 : 0.5;
      envoyerMain({ x, y, d: geste.d, c: geste.c });
    } else if (geste.type === "guirlande") {
      const [x, y] = rabattre(...versSapin(px, py));
      const q = geste.pts[geste.pts.length - 1];
      if (Math.hypot(x - q[0], y - q[1]) > 0.012) geste.pts.push([x, y]);
      if (geste.pts.length > 1) dessinerGuirlande(geste.g, geste.pts.flat(), palette[geste.c] ?? 0xf2b632);
      envoyerMain({ x, y, d: "guirlande", c: geste.c });
    }
  };

  const haut_ = () => {
    if (!geste) return;
    const g = geste; geste = null;
    if (g.type === "etoile") {
      doigtEtoile = false; tenue = 0;
      o.surEtoileTenue(false);
    } else if (g.type === "guirlande") {
      g.g.destroy();
      const coup = coupGuirlande(g.c, g.pts);
      if (coup) { o.surPose(coup); o.sound.play("pop"); }
    } else {
      fantome.removeChildren().forEach((c) => c.destroy({ children: true }));
      const ok = g.d === "cadeau" ? auPied(g.x, g.y) : surBranches(g.x, g.y);
      if (ok) {
        // petite inclinaison naturelle (pas pour les cadeaux, posés bien à plat)
        const r = g.d === "cadeau" ? 0 : (Math.random() - 0.5) * 0.35;
        o.surPose(coupDeco(g.d, g.c, g.x, g.y, r));
        o.sound.play("pop");
      } else {
        o.surRefus(g.d === "cadeau" ? "pied" : "hors");
        o.sound.play("bad");
      }
    }
    envoyerMain(null, true);
  };

  hote.addEventListener("pointerdown", bas);
  hote.addEventListener("pointermove", bouge);
  hote.addEventListener("pointerup", haut_);
  hote.addEventListener("pointercancel", haut_);

  /* ---------- effets ---------- */
  const eclats: Eclat[] = [];
  const eclater = (x: number, y: number, n: number, couleurs: number[], vitesse: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = vitesse * (0.4 + Math.random() * 0.6);
      const g = new Graphics().circle(0, 0, 1.5 + Math.random() * 2).fill(couleurs[i % couleurs.length]);
      g.position.set(x, y);
      effets.addChild(g);
      eclats.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 0, duree: 0.9 + Math.random() * 0.6 });
    }
  };
  const etiquettes: { t: Text; vie: number }[] = [];
  let feu = 0; // secondes de feu d'artifice restantes
  let prochainFeu = 0;

  /* ---------- boucle ---------- */
  let temps = 0;
  let horloge = performance.now();
  scene.surImage((dt) => {
    temps += dt;
    // la tenue de l'étoile se compte en temps réel : sur un téléphone lent, `dt` est plafonné
    const maintenant = performance.now(), reel = maintenant - horloge;
    horloge = maintenant;
    for (const f of flocons) {
      f.g.y += f.vy * dt; f.g.x += Math.sin(temps + f.ph) * 8 * dt;
      if (f.g.y > scene.hauteur + 4) { f.g.y = -4; f.g.x = Math.random() * scene.largeur; }
    }
    // pop des décos neuves
    const t = performance.now();
    for (const v of vues.values()) {
      if (!v.nee) continue;
      const p = Math.min(1, (t - v.nee) / 320);
      const s = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.35 - (1 - p) * 0.6 : 1;
      v.cont.scale.set(Math.max(0.01, s));
      if (p >= 1) v.nee = 0;
    }
    // étoile : attente qui flotte, tenue, envol
    if (etoile.visible) {
      if (posee) {
        envol = Math.min(1, envol + dt / 1.1);
        const a = posAttente(), b = posPointe();
        const e = 1 - Math.pow(1 - envol, 3);
        etoile.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * k * 0.25);
        etoile.rotation = (1 - e) * Math.PI * 2;
        halo.scale.set(1 + Math.sin(temps * 2) * 0.12 + (allume ? 0.4 : 0));
      } else {
        const a = posAttente();
        etoile.position.set(a.x, a.y + Math.sin(temps * 2.2) * k * 0.025);
        etoile.rotation = Math.sin(temps * 1.3) * 0.12;
        halo.scale.set(1 + Math.sin(temps * 3) * 0.15);
        if (doigtEtoile && o.etoileAvance()) {
          tenue += reel;
          if (tenue >= o.contenu.tenueEtoileMs) { doigtEtoile = false; tenue = 0; o.surEtoileComplete(); }
        } else if (!doigtEtoile) tenue = 0;
      }
      anneau.clear();
      if (tenue > 0) {
        anneau.arc(0, 0, k * 0.19, -Math.PI / 2, -Math.PI / 2 + (tenue / o.contenu.tenueEtoileMs) * Math.PI * 2)
          .stroke({ width: Math.max(3, k * 0.025), color: 0xffffff, cap: "round" });
      }
    }
    // lumières qui scintillent
    for (const l of lueursListe) l.g.alpha = 0.55 + 0.45 * Math.sin(temps * 2.4 + l.ph);
    if (allume && nuit < 1) { nuit = Math.min(1, nuit + dt / 1.2); dessinerFond(); }
    // main de l'autre
    if (mainVisee) {
      const cible = { x: X(mainVisee.x), y: Y(mainVisee.y) };
      if (mainAff.a === 0) { mainAff.x = cible.x; mainAff.y = cible.y; }
      mainAff.x += (cible.x - mainAff.x) * Math.min(1, dt * 14);
      mainAff.y += (cible.y - mainAff.y) * Math.min(1, dt * 14);
      mainAff.a = Math.min(1, mainAff.a + dt * 5);
    } else mainAff.a = Math.max(0, mainAff.a - dt * 3);
    autre.alpha = mainAff.a;
    autre.position.set(mainAff.x, mainAff.y);
    // éclats et feu d'artifice
    for (let i = eclats.length - 1; i >= 0; i--) {
      const e = eclats[i];
      e.vie += dt; e.vy += 90 * dt;
      e.g.x += e.vx * dt; e.g.y += e.vy * dt;
      e.g.alpha = Math.max(0, 1 - e.vie / e.duree);
      if (e.vie >= e.duree) { e.g.destroy(); eclats.splice(i, 1); }
    }
    for (let i = etiquettes.length - 1; i >= 0; i--) {
      const l = etiquettes[i];
      l.vie += dt; l.t.y -= 14 * dt; l.t.alpha = Math.max(0, 1 - Math.max(0, l.vie - 1.2) / 0.6);
      if (l.vie > 1.8) { l.t.destroy(); etiquettes.splice(i, 1); }
    }
    if (feu > 0) {
      feu -= dt; prochainFeu -= dt;
      if (prochainFeu <= 0) {
        prochainFeu = 0.35 + Math.random() * 0.35;
        eclater(scene.largeur * (0.15 + Math.random() * 0.7), scene.hauteur * (0.08 + Math.random() * 0.25), 34, AMPOULES, k * 1.3);
      }
    }
  });

  scene.surTaille(() => { toutRedessiner(); });
  toutRedessiner();

  return {
    afficher(e, visible) {
      etat = e;
      etoileVisible = visible;
      const presents = new Set(e.decos.map((d) => d.id));
      for (const [id, v] of vues) if (!presents.has(id)) { v.cont.destroy({ children: true }); vues.delete(id); }
      for (const d of e.decos) if (!vues.has(d.id)) vues.set(d.id, construireVue(d));
      if (e.etoile && !posee) { posee = true; envol = 0; }
      dessinerEtoile();
      if (allume) dessinerLueurs();
    },

    mainAutre(m, prenom) {
      mainVisee = m;
      if (!m) return;
      const cle = `${m.d ?? ""}:${m.c ?? ""}:${m.etoile ?? ""}:${prenom}`;
      if (cle === mainDessin) return;
      mainDessin = cle;
      mainG.clear().circle(0, 0, k * 0.06).fill({ color: 0xffffff, alpha: 0.35 }).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      mainDeco.removeChildren().forEach((c) => c.destroy({ children: true }));
      if (m.d && !m.etoile) {
        const f = dessinerDeco(m.d, palette[m.c ?? 0] ?? 0xd9354b, taille() * (m.d === "cadeau" ? 1.5 : 1));
        f.alpha = 0.75;
        mainDeco.addChild(f);
      }
      mainNom.text = prenom;
      mainNom.position.set(0, k * 0.08);
    },

    saluer(id, texte) {
      const v = vues.get(id);
      if (!v) return;
      const b = v.cont.getBounds();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      eclater(x, y, 14, [0xffffff, 0xffe28a], k * 0.6);
      const t = new Text({ text: texte, style: { fontFamily: "Fredoka, sans-serif", fontSize: 13, fontWeight: "600", fill: 0xffffff, stroke: { color: 0x1b2747, width: 3 } } });
      t.anchor.set(0.5, 1);
      t.position.set(x, b.y - 4);
      effets.addChild(t);
      etiquettes.push({ t, vie: 0 });
    },

    allumer(fete) {
      if (!allume) { allume = true; dessinerLueurs(); }
      if (fete) { feu = 5; prochainFeu = 0.9; } else nuit = 1;
      dessinerFond();
    },

    detruire() {
      hote.removeEventListener("pointerdown", bas);
      hote.removeEventListener("pointermove", bouge);
      hote.removeEventListener("pointerup", haut_);
      hote.removeEventListener("pointercancel", haut_);
      scene.detruire();
    },
  };
}
