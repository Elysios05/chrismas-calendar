// Vie du monde : animaux et personnages qui bougent dans le décor, et qui réagissent quand on les touche.
// Chacun vit dans les coordonnées de la grille (x, y) et la scène le range à sa profondeur à chaque image.
import { Circle, Container, Graphics } from "pixi.js";
import type { Sfx } from "../core/contracts";
import { P, ZH, shade, type Palette } from "./iso";
import { heightAt, key, type Terrain } from "./terrain";
import { ZONES } from "./zones";

export type Species =
  | "fox" | "hare" | "owl" | "squirrel" | "reindeer" | "seal" | "bear"
  | "villager" | "child" | "musician" | "skater" | "skier" | "elf" | "elfHammer";

type Pt2 = { x: number; y: number };

/** Ce que la scène prête aux habitants : le son, et le cadeau éventuel sous le doigt */
export type LifeEnv = {
  play: (s: Sfx) => void;
  /** Un cadeau tout proche ? Le toucher lui revient : un passant ne doit jamais voler le doigt d'une case */
  giftNear: (x: number, y: number) => number | null;
  tapGift: (day: number) => void;
};

/** Comment l'habitant se déplace quand on ne le dérange pas */
type Mover =
  | { kind: "wander"; home: Pt2; r: number }
  | { kind: "route"; pts: Pt2[]; t: number; dir: 1 | -1 }
  | { kind: "loop"; cx: number; cy: number; rx: number; ry: number; a: number; v: number }
  | { kind: "still" }
  | { kind: "slope"; a: Pt2; b: Pt2; t: number };

const CRIS: Partial<Record<Species, Sfx>> = {
  fox: "fox", hare: "hare", owl: "owl", squirrel: "squirrel", reindeer: "reindeer", seal: "seal", bear: "bear",
  elf: "elf-laugh", elfHammer: "elf-hammer", child: "snowball", skater: "skate", skier: "ski",
};

/** Animaux qui détalent quand on les touche, puis reviennent */
const FUYARDS = new Set<Species>(["fox", "hare", "squirrel", "reindeer"]);
const ANIMAUX = new Set<Species>(["fox", "hare", "owl", "squirrel", "reindeer", "seal", "bear"]);

export class Critter extends Container {
  species: Species;
  gx: number; gy: number;
  /** hauteur au-dessus du sol (chouette perchée, saut) */
  zoff = 0;
  base = 0;
  mover: Mover;
  inner = new Container();
  body = new Container();
  arm: Graphics | null = null;
  legs: Graphics[] = [];
  carry: Graphics | null = null;
  t = Math.random() * 10;
  /** pause en cours (en unités d'image) */
  wait = 0;
  target: Pt2 | null = null;
  /** réaction au toucher : nom et temps écoulé */
  react: { k: string; t: number; from?: Pt2; to?: Pt2 } | null = null;
  partner: Critter | null = null;
  ball: Graphics | null = null;
  ballT = -1;
  nextThrow = 120 + Math.random() * 200;
  notes: Graphics[] = [];
  walking = false;
  speed: number;

  constructor(species: Species, x: number, y: number, mover: Mover, pal: Palette, seed: number) {
    super();
    this.species = species;
    this.gx = x; this.gy = y;
    this.mover = mover;
    this.speed = { fox: 0.016, hare: 0.02, squirrel: 0.018, reindeer: 0.012, seal: 0.006, bear: 0.008, owl: 0, villager: 0.009, child: 0, musician: 0, skater: 0.004, skier: 0.006, elf: 0.012, elfHammer: 0 }[species];
    drawCritter(this, pal, seed);
    this.addChild(this.inner);
    this.inner.addChild(this.body);
    // les animaux sont un peu plus gros que nature (choix d'Alexandre) : on les remarque et on les touche mieux
    if (ANIMAUX.has(species)) this.scale.set(1.3);
    this.eventMode = "static";
    this.cursor = "pointer";
    // une cible généreuse : un doigt est bien plus gros qu'un lièvre
    const h = HAUTEUR[species];
    this.hitArea = new Circle(0, -h * 0.5, Math.max(20, h * 0.6));
  }

  face(dx: number, dy: number) {
    const sx = dx - dy; // vers la droite de l'écran quand x augmente ou y diminue
    if (Math.abs(sx) > 1e-4) this.body.scale.x = sx > 0 ? 1 : -1;
  }

  /** Avance vers un point ; vrai une fois arrivé */
  step(to: Pt2, v: number, dt: number) {
    const dx = to.x - this.gx, dy = to.y - this.gy;
    const d = Math.hypot(dx, dy);
    if (d < v * dt || d < 1e-3) { this.gx = to.x; this.gy = to.y; return true; }
    this.gx += (dx / d) * v * dt; this.gy += (dy / d) * v * dt;
    this.face(dx, dy);
    return false;
  }
}

/** Hauteur à l'écran, pour la zone de toucher */
const HAUTEUR: Record<Species, number> = {
  fox: 22, hare: 22, owl: 22, squirrel: 18, reindeer: 50, seal: 20, bear: 34,
  villager: 46, child: 34, musician: 46, skater: 44, skier: 44, elf: 30, elfHammer: 30,
};

/* ------------------------------------------------------------------ */
/* Dessin                                                               */
/* ------------------------------------------------------------------ */

function drawCritter(cr: Critter, pal: Palette, seed: number) {
  const c = pal.c;
  const rnd = (n: number) => { const s = Math.sin(seed * 9301 + n * 49297) * 233280; return s - Math.floor(s); };
  const g = new Graphics();
  const shadow = new Graphics();
  const sh = (w: number) => shadow.ellipse(0, 0, w, w * 0.38).fill({ color: 0x1b2347, alpha: 0.2 });
  const leg = (x: number, w: number, h: number, col: number) => {
    const l = new Graphics().roundRect(x, -h, w, h, w / 2).fill(c(col));
    cr.legs.push(l);
    cr.body.addChild(l);
  };
  const person = (coat: number, hat: number, scale = 1, opts: { scarf?: number; elf?: boolean } = {}) => {
    const s = scale;
    sh(11 * s);
    leg(-5 * s, 4 * s, 12 * s, opts.elf ? 0x2fa37a : 0x2b2f45);
    leg(1 * s, 4 * s, 12 * s, opts.elf ? 0xd9354b : 0x2b2f45);
    g.roundRect(-8 * s, -30 * s, 16 * s, 20 * s, 6 * s).fill(c(coat));
    if (opts.elf) g.rect(-8 * s, -14 * s, 16 * s, 3 * s).fill(c(0x3d2a1a)).rect(-2 * s, -14.5 * s, 4 * s, 4 * s).fill(c(0xffd46b));
    g.rect(-8 * s, -32 * s, 16 * s, 5 * s).fill(c(opts.scarf ?? 0xf2e6d2));
    g.circle(0, -37 * s, 6.5 * s).fill(c(0xf2c9a6));
    g.circle(-2.2 * s, -37.5 * s, 0.9 * s).fill(c(0x2b2f45));
    g.circle(2.6 * s, -37.5 * s, 0.9 * s).fill(c(0x2b2f45));
    if (opts.elf) {
      // bonnet pointu qui retombe, oreilles en pointe
      g.poly([-7 * s, -41 * s, 7 * s, -41 * s, 12 * s, -52 * s]).fill(c(0x2fa37a));
      g.circle(12.5 * s, -52 * s, 2.4 * s).fill(c(0xffffff));
      g.poly([-6.5 * s, -38 * s, -10 * s, -41 * s, -6 * s, -35 * s]).fill(c(0xf2c9a6));
      g.rect(-7.5 * s, -42.5 * s, 15 * s, 3 * s).fill(c(0xffffff));
    } else {
      g.circle(0, -41 * s, 6.5 * s).fill(c(hat));
      g.circle(0, -47 * s, 2.6 * s).fill(c(0xffffff));
    }
    // bras levé pour saluer : pivote à l'épaule
    const arm = new Graphics().roundRect(-2 * s, 0, 4 * s, 12 * s, 2 * s).fill(c(shade(coat, -0.12)));
    arm.position.set(7 * s, -28 * s);
    arm.rotation = -0.25;
    cr.arm = arm;
    cr.body.addChild(g, arm);
  };
  const coats = [0xd9354b, 0x3f7fb5, 0x2fa37a, 0x8e4fb5, 0xe0a63a, 0xc8463b];
  const coat = coats[Math.floor(rnd(3) * coats.length)];
  const hat = [0xd9354b, 0xffffff, 0x2b2f45, 0x3f7fb5][Math.floor(rnd(4) * 4)];

  switch (cr.species) {
    case "fox": {
      sh(13);
      const o = c(0xe07a2f), d = c(0xb85a1d), w = c(0xfbf3ea);
      leg(-8, 3, 7, 0x3d2a1a); leg(5, 3, 7, 0x3d2a1a);
      g.ellipse(-14, -12, 10, 4.5).fill(o); g.ellipse(-21, -13, 4, 3).fill(w); // queue touffue
      g.ellipse(0, -11, 11, 6).fill(o);
      g.ellipse(2, -8, 6, 3).fill(w);
      g.circle(10, -16, 5.5).fill(o);
      g.poly([13, -17, 21, -14, 13, -12]).fill(o); g.circle(21, -14, 1.3).fill(c(0x2b2f45));
      g.poly([6, -19, 8, -27, 11, -20]).fill(d); g.poly([10, -20, 13, -27, 15, -19]).fill(d);
      g.circle(11, -17, 1).fill(c(0x2b2f45));
      cr.body.addChild(g);
      break;
    }
    case "hare": {
      sh(10);
      const f = c(0xe9e5de), d = c(0xc9c2b8);
      leg(-5, 4, 4, 0xd8d2c8); leg(3, 4, 4, 0xd8d2c8);
      g.ellipse(0, -8, 9, 7).fill(f);
      g.circle(-8, -9, 3).fill(c(0xffffff));
      g.circle(6, -14, 5).fill(f);
      g.roundRect(3, -30, 3.5, 14, 2).fill(f); g.roundRect(6.5, -29, 3.5, 13, 2).fill(d);
      g.roundRect(3.8, -28, 1.8, 9, 1).fill(c(0xf2b8c0));
      g.circle(8, -15, 1).fill(c(0x2b2f45)); g.circle(11, -13.5, 1).fill(c(0xd98a96));
      cr.body.addChild(g);
      break;
    }
    case "squirrel": {
      sh(8);
      const r = c(0xb5562a), w = c(0xf2d9b8);
      leg(-3, 3, 4, 0x8a3e1c); leg(2, 3, 4, 0x8a3e1c);
      g.ellipse(-8, -14, 5, 10).fill(r); g.ellipse(-9, -22, 5, 4).fill(r); // queue en panache
      g.ellipse(0, -8, 6, 6).fill(r); g.ellipse(1.5, -7, 3, 4).fill(w);
      g.circle(3, -15, 4.5).fill(r);
      g.poly([1, -18, 2, -23, 4.5, -19]).fill(r);
      g.circle(5, -16, 0.9).fill(c(0x2b2f45));
      g.circle(5, -10, 1.8).fill(c(0x8a5a2b)); // une noisette
      cr.body.addChild(g);
      break;
    }
    case "owl": {
      sh(8);
      shadow.alpha = 0; // perchée : pas d'ombre au sol
      const b = c(0x9a7a5a), w = c(0xefe4d2);
      g.ellipse(0, -10, 8, 10).fill(b);
      g.ellipse(0, -8, 5, 6.5).fill(w);
      g.circle(0, -21, 7).fill(b);
      g.poly([-6, -25, -4, -30, -2, -26]).fill(b); g.poly([6, -25, 4, -30, 2, -26]).fill(b);
      g.circle(-2.8, -21.5, 2.6).fill(c(0xffd46b)); g.circle(2.8, -21.5, 2.6).fill(c(0xffd46b));
      g.circle(-2.6, -21.5, 1.2).fill(c(0x2b2f45)); g.circle(2.6, -21.5, 1.2).fill(c(0x2b2f45));
      g.poly([-1.2, -19, 1.2, -19, 0, -16.5]).fill(c(0xe0a63a));
      // ailes : elles battent pendant le vol
      const wing = new Graphics().ellipse(0, 0, 4, 8).fill(c(shade(0x9a7a5a, -0.15)));
      wing.position.set(-7, -12);
      const wing2 = new Graphics().ellipse(0, 0, 4, 8).fill(c(shade(0x9a7a5a, -0.15)));
      wing2.position.set(7, -12);
      cr.legs.push(wing, wing2);
      cr.body.addChild(wing, wing2, g);
      break;
    }
    case "reindeer": {
      sh(16);
      const b = c(0xa86b3d), d = c(0x7d4a26);
      for (const lx of [-10, -4, 6, 11]) leg(lx, 3, 16, 0x7d4a26);
      g.roundRect(-14, -26, 30, 13, 6).fill(b);
      g.ellipse(-12, -22, 4, 3).fill(c(0xf2e6d2));
      g.roundRect(10, -40, 8, 18, 3).fill(b);
      g.roundRect(12, -46, 14, 9, 4).fill(b);
      g.circle(26, -42, 3).fill(c(0xd9354b));
      g.circle(17, -43, 1.2).fill(c(0x2b2f45));
      g.moveTo(14, -46).lineTo(8, -58).lineTo(2, -60).moveTo(10, -53).lineTo(16, -60).stroke({ width: 2.5, color: d });
      g.roundRect(-14, -27, 30, 4, 2).fill(c(0xd9354b)); // harnais rouge à grelot
      g.circle(10, -22, 2.4).fill(c(0xffd46b));
      cr.body.addChild(g);
      break;
    }
    case "seal": {
      sh(14);
      const b = c(0x8e9bb0), l = c(0xb4bfd0);
      g.ellipse(-4, -7, 14, 7).fill(b);
      g.poly([-16, -6, -24, -11, -23, -2]).fill(b);
      g.circle(9, -13, 6.5).fill(b);
      g.ellipse(10, -11, 4, 2.5).fill(l);
      g.circle(9, -15, 1.2).fill(c(0x2b2f45)); g.circle(13, -14.5, 1.2).fill(c(0x2b2f45));
      g.circle(14.5, -11.5, 1.2).fill(c(0x2b2f45));
      const fl = new Graphics().ellipse(0, 0, 3, 6).fill(c(shade(0x8e9bb0, -0.15)));
      fl.position.set(3, -5); fl.rotation = 0.6;
      cr.arm = fl;
      cr.body.addChild(g, fl);
      break;
    }
    case "bear": {
      sh(18);
      const w = c(0xf4f1ea), d = c(0xd9d4ca);
      for (const lx of [-12, -5, 5, 11]) leg(lx, 6, 9, 0xe4e0d6);
      g.ellipse(0, -15, 17, 10).fill(w);
      g.ellipse(-2, -10, 14, 5).fill(d);
      g.circle(15, -20, 7.5).fill(w);
      g.circle(12, -26, 2.5).fill(d);
      g.ellipse(21, -18, 4, 3).fill(w);
      g.circle(23.5, -18.5, 1.5).fill(c(0x2b2f45));
      g.circle(16, -22, 1.2).fill(c(0x2b2f45));
      cr.body.addChild(g);
      break;
    }
    case "villager":
    case "musician":
      person(coat, hat);
      if (cr.species === "musician") {
        // violon ou accordéon, selon le musicien
        const inst = new Graphics();
        if (rnd(8) < 0.5) inst.ellipse(-4, -22, 5, 3).fill(c(0x9a5a2b)).rect(-1, -30, 10, 1.5).fill(c(0x3d2a1a));
        else inst.roundRect(-10, -25, 20, 10, 2).fill(c(0xd9354b)).rect(-10, -21, 20, 2).fill(c(0xffffff));
        cr.body.addChild(inst);
      }
      break;
    case "child":
      person(coat, hat, 0.74, { scarf: 0xd9354b });
      break;
    case "skater":
      person(coat, hat, 1, { scarf: 0xffffff });
      g.roundRect(-8, -1, 8, 2, 1).fill(c(0xb9c0cf)).roundRect(1, -1, 8, 2, 1).fill(c(0xb9c0cf));
      shadow.tint = 0x5f86a8;
      break;
    case "skier": {
      person(coat, hat, 1, { scarf: 0xffd46b });
      const skis = new Graphics().roundRect(-14, -2, 30, 2.5, 1.2).fill(c(0xd9354b)).roundRect(-12, 1, 30, 2.5, 1.2).fill(c(0xd9354b));
      const pole = new Graphics().moveTo(-9, -24).lineTo(-16, -2).stroke({ width: 1.5, color: c(0x3d4152) });
      cr.body.addChildAt(skis, 0);
      cr.body.addChild(pole);
      break;
    }
    case "elf":
    case "elfHammer":
      person(0x2fa37a, 0x2fa37a, 0.66, { scarf: 0xd9354b, elf: true });
      if (cr.species === "elf") {
        // le cadeau porté à bout de bras, visible à l'aller seulement
        const gift = new Graphics().rect(-6, -10, 12, 10).fill(c([0xd9354b, 0xffd46b, 0x3f7fb5][Math.floor(rnd(9) * 3)]))
          .rect(-1, -10, 2, 10).fill(c(0xffffff)).rect(-6, -6, 12, 2).fill(c(0xffffff));
        gift.position.set(0, -18);
        cr.carry = gift;
        cr.body.addChild(gift);
      } else {
        const hammer = new Graphics().rect(-1, 0, 2, 10).fill(c(0x9a5a2b)).rect(-3.5, 9, 7, 4).fill(c(0x6b6f80));
        cr.arm?.addChild(hammer);
        // l'établi et le jouet qu'il fabrique
        const bench = new Graphics().rect(8, -10, 16, 3).fill(c(0x9a5a2b)).rect(9, -7, 2, 7).fill(c(0x7d4a26)).rect(21, -7, 2, 7).fill(c(0x7d4a26))
          .roundRect(13, -16, 7, 6, 2).fill(c(0xd9354b)).circle(14, -9.5, 1.6).fill(c(0x2b2f45)).circle(19, -9.5, 1.6).fill(c(0x2b2f45));
        cr.body.addChild(bench);
      }
      break;
  }
  cr.addChild(shadow);
}

/* ------------------------------------------------------------------ */
/* Peuplement                                                           */
/* ------------------------------------------------------------------ */

const BIG: Record<string, number> = { house: 1, chalet: 1, workshop: 2, stall: 1, wheel: 2, bigTree: 1, igloo: 1, santaHouse: 2, postOffice: 1, stable: 2 };

/** Petit monde praticable : cases libres de tout décor, sans falaise */
export function makeGround(t: Terrain) {
  const blocked = new Set<string>();
  for (const p of t.props) {
    const r = BIG[p.kind] ?? 0;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) blocked.add(key(p.x + dx, p.y + dy));
  }
  const slope = (x: number, y: number) => {
    const hs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => t.V.get(key(x + dx, y + dy)) ?? 0);
    return Math.max(...hs) - Math.min(...hs);
  };
  /** `lake` : vrai pour les patineurs et les phoques ; `road` : vrai pour les passants */
  const ok = (x: number, y: number, o: { lake?: boolean; road?: boolean } = {}) => {
    const c = t.cells.get(key(Math.floor(x), Math.floor(y)));
    if (!c) return false;
    if (c.road) return !!o.road;
    if (c.lake) return !!o.lake;
    return !blocked.has(key(c.x, c.y)) && slope(c.x, c.y) < 0.7;
  };
  /** Le segment entier est praticable (on l'échantillonne tous les tiers de case) */
  const clear = (a: Pt2, b: Pt2, o: { lake?: boolean; road?: boolean } = {}) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3);
    for (let i = 1; i <= n; i++) if (!ok(a.x + (b.x - a.x) * (i / n), a.y + (b.y - a.y) * (i / n), o)) return false;
    return true;
  };
  return { ok, clear, blocked };
}

export function spawnLife(t: Terrain, pal: Palette): Critter[] {
  let seed = 7331;
  const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const G = makeGround(t);
  const out: Critter[] = [];
  const zoneIdx = (id: string) => ZONES.findIndex((z) => z.id === id);
  const cellsOf = (id: string, f: (c: { d: number; lake: boolean; road: boolean; front: boolean }) => boolean) => {
    const z = zoneIdx(id);
    return [...t.cells.values()].filter((c) => c.zone === z && f(c));
  };
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const add = (sp: Species, x: number, y: number, mover: Mover) => {
    const cr = new Critter(sp, x, y, mover, pal, Math.floor(R() * 1e6));
    out.push(cr);
    return cr;
  };
  // animaux en liberté autour d'un point : une case libre, pas trop loin de la route pour qu'on les voie
  const wanderers = (id: string, sp: Species, n: number, dMin = 1.6, dMax = 5, r = 2.2) => {
    const cands = cellsOf(id, (c) => !c.road && !c.lake && c.d > dMin && c.d < dMax).filter((c) => G.ok(c.x + 0.5, c.y + 0.5));
    for (let i = 0; i < n && cands.length; i++) {
      const c = cands.splice(Math.floor(R() * cands.length), 1)[0];
      add(sp, c.x + 0.5, c.y + 0.5, { kind: "wander", home: { x: c.x + 0.5, y: c.y + 0.5 }, r });
    }
  };
  // passants le long de la rue, sur un côté de la chaussée
  const walkers = (id: string, sp: Species, n: number) => {
    const z = zoneIdx(id);
    const road = t.path.filter((p) => p.zone === z);
    if (road.length < 8) return;
    for (let i = 0; i < n; i++) {
      const len = 6 + Math.floor(R() * 6);
      const s = Math.floor(R() * Math.max(1, road.length - len));
      const side = R() < 0.5 ? -0.36 : 0.36;
      const pts = road.slice(s, s + len).map((p, j, a) => {
        const q = a[Math.min(a.length - 1, j + 1)], o = a[Math.max(0, j - 1)];
        const dx = q.x - o.x, dy = q.y - o.y, L = Math.hypot(dx, dy) || 1;
        return { x: p.x + 0.5 - (dy / L) * side, y: p.y + 0.5 + (dx / L) * side };
      });
      add(sp, pts[0].x, pts[0].y, { kind: "route", pts, t: R() * (pts.length - 1), dir: R() < 0.5 ? 1 : -1 });
    }
  };

  /* --- montagnes : lièvres, renard, skieurs --- */
  wanderers("montagnes", "hare", 3);
  wanderers("montagnes", "fox", 1);
  {
    // skieurs : ils descendent un versant en godillant, puis repartent d'en haut
    const z = zoneIdx("montagnes");
    const slopes = [...t.cells.values()].filter((c) => c.zone === z && !c.road && c.d > 2 && c.d < 5 && !c.front);
    let made = 0;
    for (let k = 0; k < 60 && made < 2 && slopes.length; k++) {
      const c = pick(slopes);
      const a = { x: c.x + 0.5, y: c.y + 0.5 };
      // vers l'aval : on cherche la direction où le terrain descend le plus
      let best: Pt2 | null = null, bh = heightAt(t, a.x, a.y);
      for (let ang = 0; ang < 6.28; ang += 0.4) {
        const b = { x: a.x + Math.cos(ang) * 3, y: a.y + Math.sin(ang) * 3 };
        const h = heightAt(t, b.x, b.y);
        if (h < bh - 0.8 && G.clear(a, b)) { bh = h; best = b; }
      }
      if (best) { add("skier", a.x, a.y, { kind: "slope", a, b: best, t: R() }); made++; }
    }
  }

  /* --- village : passants, enfants qui se lancent des boules de neige, écureuil --- */
  walkers("saint-nicolas", "villager", 5);
  wanderers("saint-nicolas", "squirrel", 1, 3, 8);
  {
    const cands = cellsOf("saint-nicolas", (c) => !c.road && c.d > 1.3 && c.d < 3.5).filter((c) => G.ok(c.x + 0.5, c.y + 0.5));
    for (let pair = 0; pair < 2; pair++) for (let k = 0; k < 80; k++) {
      const c = pick(cands);
      const a = { x: c.x + 0.5, y: c.y + 0.5 };
      const b = { x: a.x + 2.2, y: a.y - 0.4 };
      if (!G.ok(b.x, b.y) || !G.clear(a, b)) continue;
      const k1 = add("child", a.x, a.y, { kind: "still" });
      const k2 = add("child", b.x, b.y, { kind: "still" });
      k1.partner = k2; k2.partner = k1;
      k1.face(1, 0); k2.face(-1, 0);
      k2.nextThrow += 140;
      break;
    }
  }

  /* --- forêt et lac : patineurs, renards, chouettes dans les sapins, cerf --- */
  {
    const z = zoneIdx("lac");
    const lake = [...t.cells.values()].filter((c) => c.lake && c.zone === z);
    const inner = lake.filter((c) => [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1]].every(([dx, dy]) => t.cells.get(key(c.x + dx, c.y + dy))?.lake));
    for (let i = 0; i < 3 && inner.length; i++) {
      const c = inner.splice(Math.floor(R() * inner.length), 1)[0];
      const rx = 1.1 + R() * 0.6, ry = 0.8 + R() * 0.5;
      add("skater", c.x + 0.5, c.y + 0.5, { kind: "loop", cx: c.x + 0.5, cy: c.y + 0.5, rx, ry, a: R() * 6.28, v: (R() < 0.5 ? 1 : -1) * (0.008 + R() * 0.006) });
    }
  }
  wanderers("lac", "fox", 2, 1.6, 6);
  wanderers("lac", "hare", 1, 1.6, 5);
  wanderers("lac", "reindeer", 1, 2, 6, 2.6);
  wanderers("lac", "squirrel", 1, 1.6, 5);
  {
    // chouettes : perchées au sommet d'un sapin, assez près de la route pour qu'on les remarque
    const z = zoneIdx("lac");
    const trees = t.props.filter((p) => p.kind === "tree" && p.zone === z && (t.cells.get(key(p.x, p.y))?.d ?? 99) < 4.5);
    for (let i = 0; i < 2 && trees.length; i++) {
      const p = trees.splice(Math.floor(R() * trees.length), 1)[0];
      const o = add("owl", p.x + 0.5, p.y + 0.5, { kind: "still" });
      o.base = 1.55; o.zoff = o.base;
    }
  }

  /* --- marché : badauds, musiciens --- */
  walkers("marche", "villager", 6);
  {
    const cands = cellsOf("marche", (c) => !c.road && c.d > 1.1 && c.d < 1.9).filter((c) => G.ok(c.x + 0.5, c.y + 0.5));
    for (let i = 0; i < 3 && cands.length; i++) {
      const c = cands.splice(Math.floor(R() * cands.length), 1)[0];
      add("musician", c.x + 0.5, c.y + 0.5, { kind: "still" }).face(R() - 0.5, 0);
    }
  }

  /* --- grotte : phoques et un ours blanc --- */
  wanderers("grotte", "seal", 2, 1.1, 2.6, 1);
  wanderers("grotte", "bear", 1, 1.2, 3, 1.4);

  /* --- pôle Nord : lutins qui font la navette, lutin forgeron, rennes, ours, phoque --- */
  {
    const z = zoneIdx("pole-nord");
    const ws = t.props.find((p) => p.kind === "workshop" && p.zone === z);
    const sl = t.props.find((p) => p.kind === "sleigh" && p.zone === z);
    if (ws && sl) {
      // on part devant la porte de la fabrique (côté +y) jusqu'à côté du traîneau
      const a = { x: ws.x + 0.5, y: ws.y + 2.1 }, b = { x: sl.x + 0.5, y: sl.y + 1.2 };
      const mid = { x: (a.x + b.x) / 2 + 0.4, y: (a.y + b.y) / 2 + 0.5 };
      for (let i = 0; i < 4; i++) {
        const dir = i % 2 ? 1 : -1;
        const elf = add("elf", a.x, a.y, { kind: "route", pts: [a, mid, b], t: (i / 4) * 2, dir });
        if (elf.carry) elf.carry.visible = dir === 1;
      }
      add("elfHammer", ws.x + 1.6, ws.y + 2, { kind: "still" });
    }
  }
  wanderers("pole-nord", "reindeer", 2, 2, 6, 2.4);
  wanderers("pole-nord", "bear", 1, 3, 7, 2);
  wanderers("pole-nord", "seal", 1, 1.6, 4, 1.2);
  return out;
}

/* ------------------------------------------------------------------ */
/* Animation                                                            */
/* ------------------------------------------------------------------ */

export function updateCritter(cr: Critter, dt: number, G: ReturnType<typeof makeGround>, t: Terrain) {
  cr.t += dt;
  let moving = false;
  const m = cr.mover;
  if (cr.react) {
    moving = reactStep(cr, dt);
  } else if (cr.wait > 0) {
    cr.wait -= dt;
  } else if (m.kind === "wander") {
    const o = { lake: cr.species === "seal" };
    if (!cr.target) {
      for (let k = 0; k < 6 && !cr.target; k++) {
        const a = Math.random() * 6.28, r = Math.random() * m.r;
        const p = { x: m.home.x + Math.cos(a) * r, y: m.home.y + Math.sin(a) * r };
        if (G.ok(p.x, p.y, o) && G.clear({ x: cr.gx, y: cr.gy }, p, o)) cr.target = p;
      }
      if (!cr.target) cr.wait = 60;
    } else {
      moving = true;
      if (cr.step(cr.target, cr.speed, dt)) { cr.target = null; cr.wait = 60 + Math.random() * 240; }
    }
  } else if (m.kind === "route") {
    // aller-retour le long d'une ligne brisée ; petite pause à chaque bout
    const n = m.pts.length - 1;
    const segLen = (i: number) => Math.hypot(m.pts[i + 1].x - m.pts[i].x, m.pts[i + 1].y - m.pts[i].y) || 1;
    const i = Math.min(n - 1, Math.floor(m.t));
    m.t += (m.dir * cr.speed * dt) / segLen(i);
    if (m.t >= n || m.t <= 0) {
      m.t = Math.max(0, Math.min(n, m.t));
      m.dir = m.dir === 1 ? -1 : 1;
      cr.wait = cr.species === "elf" ? 50 : 40 + Math.random() * 160;
      // le lutin repart vers le traîneau avec un cadeau, et revient les mains vides
      if (cr.carry) cr.carry.visible = m.dir === 1;
    }
    const j = Math.min(n - 1, Math.floor(m.t)), f = m.t - j;
    const a = m.pts[j], b = m.pts[j + 1];
    cr.gx = a.x + (b.x - a.x) * f; cr.gy = a.y + (b.y - a.y) * f;
    cr.face((b.x - a.x) * m.dir, (b.y - a.y) * m.dir);
    moving = true;
  } else if (m.kind === "loop") {
    m.a += m.v * dt;
    const nx = m.cx + Math.cos(m.a) * m.rx, ny = m.cy + Math.sin(m.a) * m.ry;
    cr.face(nx - cr.gx, ny - cr.gy);
    cr.gx = nx; cr.gy = ny;
    cr.inner.rotation = Math.sin(cr.t * 0.05) * 0.1;
  } else if (m.kind === "slope") {
    // la descente : godille de part et d'autre de la ligne de pente, puis on réapparaît en haut
    m.t += cr.speed * dt / 3;
    if (m.t >= 1) { m.t = 0; }
    const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y, L = Math.hypot(dx, dy);
    const w = Math.sin(m.t * Math.PI * 6) * 0.45;
    const nx = m.a.x + dx * m.t - (dy / L) * w, ny = m.a.y + dy * m.t + (dx / L) * w;
    cr.face(nx - cr.gx, ny - cr.gy);
    cr.gx = nx; cr.gy = ny;
    cr.alpha = Math.min(1, m.t * 8, (1 - m.t) * 8);
    cr.inner.rotation = Math.cos(m.t * Math.PI * 6) * 0.18;
  }

  // les gestes propres à chacun
  const s = cr.species;
  if (s === "child" && cr.partner && !cr.react) {
    cr.nextThrow -= dt;
    if (cr.nextThrow <= 0) { throwBall(cr); cr.nextThrow = 220 + Math.random() * 260; }
  }
  if (cr.ball && cr.ballT >= 0 && cr.partner) {
    cr.ballT += dt / 40;
    const a = P(cr.gx, cr.gy, 0.55), b = P(cr.partner.gx, cr.partner.gy, 0.55);
    const tt = Math.min(1, cr.ballT);
    // la boule vit dans le repère de l'enfant qui la lance
    cr.ball.position.set((b.x - a.x) * tt, (b.y - a.y) * tt - Math.sin(tt * Math.PI) * 26 - 0.55 * ZH);
    cr.ball.visible = tt < 1;
    if (tt >= 1) { cr.ballT = -1; cr.partner.react = { k: "flinch", t: 0 }; }
  }
  if (s === "elfHammer" && cr.arm) cr.arm.rotation = -1.4 + Math.max(0, Math.sin(cr.t * 0.18)) * 1.5;
  if (s === "musician") {
    cr.body.y = -Math.abs(Math.sin(cr.t * 0.09)) * 2;
    if (Math.random() < 0.012 * dt) note(cr);
  }
  for (let i = cr.notes.length - 1; i >= 0; i--) {
    const n = cr.notes[i];
    n.y -= 0.45 * dt; n.x += Math.sin((cr.t + i * 20) * 0.06) * 0.3;
    n.alpha -= 0.008 * dt;
    if (n.alpha <= 0) { n.destroy(); cr.notes.splice(i, 1); }
  }
  // pattes, sautillements
  cr.walking = moving;
  animateLegs(cr, moving, dt);

  // position à l'écran et profondeur
  const z = heightAt(t, cr.gx, cr.gy) + cr.zoff;
  const p = P(cr.gx, cr.gy, z);
  cr.position.set(p.x, p.y);
  cr.zIndex = cr.gx + cr.gy + (s === "owl" ? 0.9 : 0.3);
}

function animateLegs(cr: Critter, moving: boolean, _dt: number) {
  const s = cr.species;
  const ph = cr.t * (s === "hare" ? 0.3 : 0.32);
  if (s === "owl") {
    const flying = cr.zoff > cr.base + 0.05 || cr.react?.k === "fly";
    for (const [i, w] of cr.legs.entries()) {
      w.rotation = flying ? Math.sin(cr.t * 0.6) * 1.1 * (i ? -1 : 1) : 0;
      w.scale.y = flying ? 0.7 : 1;
    }
    return;
  }
  if (s === "hare" && moving && !cr.react) {
    // le lièvre bondit plutôt qu'il ne marche
    cr.body.y = -Math.abs(Math.sin(ph)) * 7;
    return;
  }
  if (s === "skater" || s === "skier") { cr.body.y = 0; return; }
  cr.legs.forEach((l, i) => { l.y = moving ? Math.max(0, Math.sin(ph + i * Math.PI)) * -3 : 0; });
  if (!cr.react || cr.react.k === "flee") cr.body.y = moving ? -Math.abs(Math.sin(ph)) * 1.6 : Math.sin(cr.t * 0.05) * 0.5;
  if (cr.arm && !cr.react && s !== "elfHammer" && s !== "seal") cr.arm.rotation = moving ? Math.sin(ph) * 0.35 - 0.1 : -0.15;
}

function throwBall(cr: Critter) {
  if (!cr.ball) {
    cr.ball = new Graphics().circle(0, 0, 3.4).fill(0xffffff).circle(0, 0, 3.4).stroke({ width: 1, color: 0xc6cfe0 });
    cr.addChild(cr.ball);
  }
  cr.ballT = 0;
  cr.ball.visible = true;
  if (cr.arm) cr.arm.rotation = -2.6;
}

function note(cr: Critter) {
  const n = new Graphics();
  const col = [0xffd46b, 0xd9354b, 0x7fe3ff][Math.floor(Math.random() * 3)];
  n.circle(0, 0, 2.6).fill(col).rect(1.8, -9, 1.3, 9).fill(col).poly([3, -9, 7, -6, 3, -6]).fill(col);
  n.position.set((Math.random() - 0.5) * 10, -48);
  cr.addChild(n);
  cr.notes.push(n);
}

/** Toucher : chaque espèce réagit à sa façon */
export function poke(cr: Critter, env: LifeEnv, G: ReturnType<typeof makeGround>) {
  const gift = env.giftNear(cr.gx, cr.gy);
  if (gift !== null) { env.tapGift(gift); return; }
  if (cr.react && cr.react.k !== "flinch") return;
  const s = cr.species;
  const cri = CRIS[s];
  if (cri) env.play(cri);
  if (FUYARDS.has(s)) {
    // il détale à l'opposé, puis revient tranquillement à sa place
    const from = { x: cr.gx, y: cr.gy };
    let to = from;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * 6.28, r = 2 + Math.random() * 1.5;
      const p = { x: from.x + Math.cos(a) * r, y: from.y + Math.sin(a) * r };
      if (G.ok(p.x, p.y) && G.clear(from, p)) { to = p; break; }
    }
    cr.react = { k: "flee", t: 0, from, to };
  } else if (s === "owl") cr.react = { k: "fly", t: 0 };
  else if (s === "seal") cr.react = { k: "clap", t: 0 };
  else if (s === "bear") cr.react = { k: "rear", t: 0 };
  else if (s === "child") { if (cr.partner) throwBall(cr); cr.react = { k: "hop", t: 0 }; }
  else if (s === "elf" || s === "elfHammer") cr.react = { k: "hop", t: 0 };
  else if (s === "skater") cr.react = { k: "spin", t: 0 };
  else if (s === "skier") cr.react = { k: "jump", t: 0 };
  else {
    cr.react = { k: "wave", t: 0 };
    if (s === "musician") for (let i = 0; i < 4; i++) note(cr);
  }
  if (!ANIMAUX.has(s)) cr.target = null;
}

/** Fait avancer la réaction en cours ; vrai si l'habitant se déplace */
function reactStep(cr: Critter, dt: number): boolean {
  const r = cr.react!;
  r.t += dt;
  const end = () => { cr.react = null; cr.body.rotation = 0; cr.body.scale.y = 1; cr.inner.rotation = 0; cr.body.y = 0; };
  switch (r.k) {
    case "flee": {
      // fuite rapide, petite pause, retour au pas
      if (r.to && cr.step(r.to, cr.speed * 4, dt)) {
        const back = r.from!;
        r.to = undefined;
        cr.wait = 0;
        r.from = back;
        r.t = 0;
        r.k = "back";
      }
      return true;
    }
    case "back": {
      if (r.t < 90) return false;
      if (cr.step(r.from!, cr.speed, dt)) end();
      return true;
    }
    case "fly": {
      // la chouette s'envole, fait un tour au-dessus des arbres et revient sur sa branche
      const u = Math.min(1, r.t / 200);
      const a = u * Math.PI * 2;
      cr.zoff = cr.base + Math.sin(u * Math.PI) * 2.4;
      cr.inner.x = Math.sin(a) * 60;
      cr.inner.y = (1 - Math.cos(a)) * -14;
      cr.body.scale.x = Math.cos(a) >= 0 ? 1 : -1;
      if (u >= 1) { cr.zoff = cr.base; cr.inner.position.set(0, 0); end(); }
      return false;
    }
    case "clap": {
      if (cr.arm) cr.arm.rotation = 0.6 + Math.sin(r.t * 0.5) * 0.9;
      cr.body.scale.y = 1 + Math.abs(Math.sin(r.t * 0.25)) * 0.12;
      if (r.t > 70) { if (cr.arm) cr.arm.rotation = 0.6; end(); }
      return false;
    }
    case "rear": {
      // l'ours se dresse sur ses pattes arrière, puis retombe
      const u = Math.min(1, r.t / 80), e = Math.sin(u * Math.PI);
      cr.body.rotation = -e * 0.9 * cr.body.scale.x;
      cr.body.y = -e * 4;
      if (u >= 1) end();
      return false;
    }
    case "hop": {
      const u = Math.min(1, r.t / 45);
      cr.body.y = -Math.sin(u * Math.PI) * 12;
      if (cr.arm) cr.arm.rotation = -2.4 + Math.sin(r.t * 0.4) * 0.4;
      if (u >= 1) end();
      return false;
    }
    case "flinch": {
      // touché par la boule de neige : petit recul
      cr.body.rotation = -Math.sin(Math.min(1, r.t / 30) * Math.PI) * 0.3 * cr.body.scale.x;
      if (r.t > 30) end();
      return false;
    }
    case "spin": {
      cr.inner.scale.x = Math.cos(r.t * 0.35);
      if (r.t > 54) { cr.inner.scale.x = 1; end(); }
      return true;
    }
    case "jump": {
      const u = Math.min(1, r.t / 40);
      cr.inner.y = -Math.sin(u * Math.PI) * 16;
      if (u >= 1) { cr.inner.y = 0; end(); }
      return true;
    }
    default: {
      // coucou de la main, puis on repart
      if (cr.arm) cr.arm.rotation = -2.6 + Math.sin(r.t * 0.3) * 0.45;
      if (r.t > 90) end();
      return false;
    }
  }
}
