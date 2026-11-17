// Décors isométriques dessinés en vectoriel plat
import { Graphics } from "pixi.js";
import { P, box, onLeft, onRight, gableRoof, pyramid, tree, boulder, poly, shade, type Palette, type TreeKind } from "./iso";

export type PropKind =
  | "tree" | "treeSmall" | "house" | "chalet" | "snowman" | "lamp" | "rock" | "mountain"
  | "stall" | "bigTree" | "wheel" | "crystal" | "presents" | "cane" | "sleigh" | "workshop" | "deer" | "skater";

const SNOW = { top: 0xf7f5f0, left: 0xe4e1dc, right: 0xcfccd0 };
const STONE = { top: 0x9a9286, left: 0xa7a093, right: 0x7d7667 };

type Rnd = (n: number) => number;

/** Soubassement de pierre : comble le dénivelé entre la terrasse du bâtiment et le terrain en contrebas */
function socle(g: Graphics, x0: number, y0: number, w: number, d: number, drop: number, pal: Palette, rnd: Rnd) {
  if (drop < 0.06) return;
  const c = pal.c, o = 0.07;
  box(g, x0 - o, y0 - o, -drop, w + 2 * o, d + 2 * o, drop, { top: c(STONE.top), left: c(STONE.left), right: c(STONE.right) });
  // appareillage : des pierres un peu plus claires ou plus sombres, par assises
  const rows = Math.max(1, Math.round(drop / 0.24));
  for (let r = 0; r < rows; r++) {
    const z0 = -drop + (r * drop) / rows + drop / rows * 0.1, z1 = z0 + (drop / rows) * 0.72;
    for (let i = 0; i < 3; i++) {
      const a = x0 - o + (w + 2 * o) * ((i + rnd(100 + r * 3 + i) * 0.55) / 3.5);
      onLeft(g, y0 + d + o, a, a + 0.2, z0, z1, c(rnd(160 + r * 3 + i) > 0.5 ? 0xb5ada0 : 0x8f8879));
      const b = y0 - o + (d + 2 * o) * ((i + rnd(130 + r * 3 + i) * 0.55) / 3.5);
      onRight(g, x0 + w + o, b, b + 0.18, z0, z1, c(rnd(190 + r * 3 + i) > 0.5 ? 0x8b8475 : 0x6f6859));
    }
  }
}

/** Chaque monde a son architecture */
type HouseStyle = "chalet" | "colombages" | "cabane" | "pignon";
const HOUSE_STYLE: Record<string, HouseStyle> = {
  montagnes: "chalet",
  "saint-nicolas": "colombages",
  lac: "cabane",
  marche: "pignon",
  grotte: "cabane",
  "pole-nord": "colombages",
};

function drawHouse(g: Graphics, cx: number, cy: number, pal: Palette, rnd: Rnd, style: HouseStyle, drop: number) {
  const c = pal.c, win = pal.window;
  const dim = {
    chalet: { w: 1.5, d: 1.15, h: 0.85, rh: 0.5, over: 0.32 },
    colombages: { w: 1.1, d: 0.9, h: 0.95, rh: 0.62, over: 0 },
    cabane: { w: 1.15, d: 0.85, h: 0.68, rh: 0.34, over: 0.16 },
    pignon: { w: 0.92, d: 0.95, h: 1.15, rh: 0.6, over: 0.08 },
  }[style];
  // deux maisons voisines n'ont jamais tout à fait la même carrure
  const kw = 0.88 + rnd(40) * 0.26, kh = 0.86 + rnd(41) * 0.3;
  const w = dim.w * kw, d = dim.d * (0.92 + rnd(42) * 0.16);
  const h = dim.h * kh, rh = dim.rh * (0.9 + rnd(43) * 0.25), over = dim.over;
  const x0 = cx - w / 2, y0 = cy - d / 2;
  socle(g, x0, y0, w, d, drop, pal, rnd);

  if (style === "chalet") {
    const wood = 0xb5763f;
    // rez-de-chaussée en pierre, étage en bois
    box(g, x0, y0, 0, w, d, h, { top: c(wood), left: c(shade(wood, 0.1)), right: c(shade(wood, -0.2)) });
    onLeft(g, y0 + d, x0, x0 + w, 0, h * 0.2, c(STONE.left));
    onRight(g, x0 + w, y0, y0 + d, 0, h * 0.2, c(STONE.right));
    // rondins visibles : lignes horizontales sur la façade
    for (let i = 1; i < 5; i++) onLeft(g, y0 + d, x0, x0 + w, h * (0.2 + i * 0.14), h * (0.2 + i * 0.14) + 0.012, c(shade(wood, -0.3)));
    // fenêtres à volets rouges
    for (let i = 0; i < 2; i++) {
      const a = x0 + w * (0.2 + i * 0.4);
      onLeft(g, y0 + d, a, a + 0.26, h * 0.46, h * 0.74, win);
      onLeft(g, y0 + d, a - 0.1, a - 0.01, h * 0.45, h * 0.75, c(0xc8362f));
      onLeft(g, y0 + d, a + 0.27, a + 0.36, h * 0.45, h * 0.75, c(0xc8362f));
    }
    onRight(g, x0 + w, y0 + d * 0.3, y0 + d * 0.7, 0, h * 0.6, c(0x6b3b22));
    // balcon de bois sur toute la façade
    const bz = h * 0.78;
    box(g, x0 - 0.06, y0 + d - 0.02, bz, w + 0.12, 0.2, 0.05, { top: c(0x8a5a33), left: c(0x8a5a33), right: c(0x6d4526) });
    for (let i = 0; i <= 7; i++) {
      const a = x0 - 0.04 + (i * (w + 0.08)) / 7;
      onLeft(g, y0 + d + 0.17, a, a + 0.035, bz + 0.05, bz + 0.21, c(0x7a4a2b));
    }
    onLeft(g, y0 + d + 0.17, x0 - 0.06, x0 + w + 0.06, bz + 0.2, bz + 0.25, c(0x8a5a33));
    box(g, x0 + w * 0.68, y0 + d * 0.1, h, 0.18, 0.18, 0.6, { top: c(0x5a4a48), left: c(0x8a5a4a), right: c(0x6e463a) });
    gableRoof(g, x0, y0, h, w, d, rh, c(SNOW.left), c(SNOW.top), c(shade(wood, -0.35)), over);
    // tas de bûches contre le pignon
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      box(g, x0 + w + 0.04, y0 + 0.12 + i * 0.17, j * 0.15, 0.3, 0.14, 0.13, { top: c(0xd6a86a), left: c(0x9a6a3c), right: c(0x7d5430) });
    }
  } else if (style === "colombages") {
    const walls = 0xf4ead7;
    const beam = 0x6b4328;
    const roofCol = [0xc8362f, 0x3f6fa5, 0x2f7f5c, 0xd98a2b][Math.floor(rnd(2) * 4)];
    box(g, x0, y0, 0, w, d, h, { top: c(walls), left: c(walls), right: c(shade(walls, -0.14)) });
    // colombages : poteaux verticaux et deux sablières
    for (let i = 0; i <= 4; i++) {
      const a = x0 + 0.06 + (i * (w - 0.12)) / 4;
      onLeft(g, y0 + d, a, a + 0.05, 0, h, c(beam));
    }
    for (const z of [h * 0.46, h * 0.52]) onLeft(g, y0 + d, x0, x0 + w, z, z + 0.035, c(beam));
    for (let i = 0; i <= 3; i++) {
      const b = y0 + 0.06 + (i * (d - 0.12)) / 3;
      onRight(g, x0 + w, b, b + 0.045, 0, h, c(shade(beam, -0.12)));
    }
    // fenêtres à petits carreaux + porte
    for (let i = 0; i < 2; i++) {
      const a = x0 + 0.16 + i * 0.5;
      onLeft(g, y0 + d, a, a + 0.26, h * 0.58, h * 0.84, win);
      onLeft(g, y0 + d, a, a + 0.26, h * 0.12, h * 0.38, win);
      onLeft(g, y0 + d, a + 0.12, a + 0.14, h * 0.12, h * 0.84, c(beam));
    }
    onRight(g, x0 + w, y0 + d * 0.35, y0 + d * 0.72, 0, h * 0.6, c(0x8a3a2a));
    box(g, x0 + w * 0.2, y0 + d * 0.2, h, 0.16, 0.16, 0.5, { top: c(0x5a4a48), left: c(0x8a5a4a), right: c(0x6e463a) });
    gableRoof(g, x0, y0, h, w, d, rh, c(shade(roofCol, -0.12)), c(SNOW.top), c(walls), over);
    // pignon à redans : un escalier de pierre par-dessus le toit
    const steps = 3, ym = y0 + d / 2;
    const pts: { x: number; y: number }[] = [];
    pts.push(P(x0 + w, y0, h));
    for (let i = 0; i < steps; i++) {
      const ya = y0 + ((d / 2) * i) / steps, yb = y0 + ((d / 2) * (i + 1)) / steps;
      const za = h + (rh * (i + 1)) / steps;
      pts.push(P(x0 + w, ya, za), P(x0 + w, yb, za));
    }
    pts.push(P(x0 + w, ym, h + rh + 0.06));
    for (let i = steps - 1; i >= 0; i--) {
      const ya = y0 + d - ((d / 2) * i) / steps, yb = y0 + d - ((d / 2) * (i + 1)) / steps;
      const za = h + (rh * (i + 1)) / steps;
      pts.push(P(x0 + w, yb, za), P(x0 + w, ya, za));
    }
    pts.push(P(x0 + w, y0 + d, h));
    poly(g, pts, c(shade(walls, -0.18)));
    // la neige tient sur chaque marche
    for (let i = 0; i < steps; i++) {
      const za = h + (rh * (i + 1)) / steps;
      const ya = y0 + ((d / 2) * i) / steps, yb = y0 + ((d / 2) * (i + 1)) / steps;
      poly(g, [P(x0 + w, ya, za), P(x0 + w, yb, za), P(x0 + w, yb, za - 0.035), P(x0 + w, ya, za - 0.035)], c(SNOW.top));
      const ya2 = y0 + d - ((d / 2) * (i + 1)) / steps, yb2 = y0 + d - ((d / 2) * i) / steps;
      poly(g, [P(x0 + w, ya2, za), P(x0 + w, yb2, za), P(x0 + w, yb2, za - 0.035), P(x0 + w, ya2, za - 0.035)], c(SNOW.top));
    }
  } else if (style === "cabane") {
    const wood = 0x7a5436;
    box(g, x0, y0, 0, w, d, h, { top: c(wood), left: c(shade(wood, 0.08)), right: c(shade(wood, -0.22)) });
    // planches verticales
    for (let i = 0; i < 7; i++) {
      const a = x0 + 0.04 + (i * (w - 0.08)) / 7;
      onLeft(g, y0 + d, a, a + 0.015, 0, h, c(shade(wood, -0.3)));
    }
    onLeft(g, y0 + d, x0 + 0.22, x0 + 0.46, h * 0.46, h * 0.76, win);
    onRight(g, x0 + w, y0 + d * 0.3, y0 + d * 0.7, 0, h * 0.68, c(0x5a3c25));
    gableRoof(g, x0, y0, h, w, d, rh, c(SNOW.left), c(SNOW.top), c(shade(wood, -0.3)), over);
    // appentis et tas de bois
    box(g, x0 + w + 0.02, y0 + 0.1, 0, 0.34, d - 0.2, h * 0.6, { top: c(SNOW.top), left: c(shade(wood, -0.1)), right: c(shade(wood, -0.3)) });
    for (let i = 0; i < 3; i++) box(g, x0 - 0.36, y0 + d - 0.5 + i * 0.03, i * 0.14, 0.32, 0.3, 0.13, { top: c(0xd6a86a), left: c(0x9a6a3c), right: c(0x7d5430) });
  } else {
    // maison étroite et haute du marché, façade colorée et auvent rayé
    const walls = [0xd9705a, 0xe0a63a, 0x3f7fb5, 0x5aa36b, 0xc8362f][Math.floor(rnd(2) * 5)];
    box(g, x0, y0, 0, w, d, h, { top: c(walls), left: c(shade(walls, 0.1)), right: c(shade(walls, -0.2)) });
    for (let i = 0; i < 3; i++) {
      const z = h * (0.2 + i * 0.26);
      onLeft(g, y0 + d, x0 + 0.18, x0 + 0.44, z, z + 0.2, win);
      onLeft(g, y0 + d, x0 + 0.56, x0 + 0.78, z, z + 0.2, win);
    }
    onRight(g, x0 + w, y0 + d * 0.3, y0 + d * 0.7, 0, h * 0.42, c(0x6b3b22));
    // auvent rayé au-dessus de la porte
    for (let i = 0; i < 4; i++) {
      const a = y0 + d * 0.22 + i * 0.14, b = a + 0.14;
      poly(g, [P(x0 + w, a, h * 0.52), P(x0 + w, b, h * 0.52), P(x0 + w + 0.26, b, h * 0.44), P(x0 + w + 0.26, a, h * 0.44)], c(i % 2 ? 0xffffff : 0xd9354b));
    }
    box(g, x0 + w * 0.6, y0 + d * 0.2, h, 0.15, 0.15, 0.42, { top: c(0x5a4a48), left: c(0x8a5a4a), right: c(0x6e463a) });
    gableRoof(g, x0, y0, h, w, d, rh, c(SNOW.left), c(SNOW.top), c(shade(walls, -0.3)), over);
  }
  if (pal.night) { const p = P(cx, y0 + d, h * 0.3); g.ellipse(p.x, p.y + 6, 44, 14).fill({ color: 0xffd46b, alpha: 0.18 }); }
}

export function drawProp(kind: PropKind, x: number, y: number, pal: Palette, seed: number, opts: { zone?: string; drop?: number } = {}): Graphics {
  const g = new Graphics();
  const c = pal.c;
  const cx = x + 0.5, cy = y + 0.5;
  const drop = opts.drop ?? 0;
  const rnd = (n: number) => { const s = Math.sin(seed * 9301 + n * 49297) * 233280; return s - Math.floor(s); };

  switch (kind) {
    case "tree":
    case "treeSmall": {
      // trois essences, chacune avec sa taille, son vert et sa charge de neige
      const k = rnd(7);
      const shape: TreeKind = kind === "treeSmall" ? (k < 0.6 ? "pousse" : "sapin") : k < 0.45 ? "epicea" : k < 0.9 ? "sapin" : "pousse";
      const s = (kind === "tree" ? 0.8 + rnd(1) * 0.45 : 0.5 + rnd(1) * 0.22) * (shape === "epicea" ? 1.1 : 1);
      tree(g, P(cx, cy), s, pal, { kind: shape, variant: Math.floor(rnd(8) * 4), snowAmount: rnd(9) });
      break;
    }
    case "house":
    case "chalet": {
      // le chalet est toujours un chalet ; les autres maisons suivent l'architecture du monde
      const style = kind === "chalet" ? "chalet" : HOUSE_STYLE[opts.zone ?? ""] ?? "colombages";
      drawHouse(g, cx, cy, pal, rnd, style, drop);
      break;
    }
    case "snowman": {
      const p = P(cx, cy);
      g.ellipse(p.x, p.y, 16, 7).fill({ color: c(0x9aa3b8), alpha: 0.35 });
      g.circle(p.x, p.y - 14, 15).fill(c(0xffffff));
      g.circle(p.x + 4, p.y - 12, 12).fill(c(0xe7e9ef));
      g.circle(p.x, p.y - 36, 11).fill(c(0xffffff));
      g.rect(p.x - 10, p.y - 44, 20, 4).fill(c(0xd9354b));
      g.rect(p.x - 7, p.y - 60, 14, 14).fill(c(0x1b2340));
      g.rect(p.x - 11, p.y - 48, 22, 3).fill(c(0x1b2340));
      poly(g, [{ x: p.x + 2, y: p.y - 38 }, { x: p.x + 14, y: p.y - 35 }, { x: p.x + 2, y: p.y - 34 }], c(0xff8a3d));
      g.circle(p.x - 4, p.y - 39, 1.6).fill(c(0x1b2340));
      g.circle(p.x + 3, p.y - 40, 1.6).fill(c(0x1b2340));
      break;
    }
    case "lamp": {
      const p = P(cx, cy);
      g.rect(p.x - 2, p.y - 46, 4, 46).fill(c(0x2b2f45));
      g.roundRect(p.x - 7, p.y - 58, 14, 14, 3).fill(pal.night ? 0xffd46b : c(0xf4e6b0));
      g.rect(p.x - 9, p.y - 61, 18, 4).fill(c(0x2b2f45));
      if (pal.night) g.circle(p.x, p.y - 51, 34).fill({ color: 0xffd46b, alpha: 0.16 });
      break;
    }
    case "rock": {
      // bloc facetté coiffé de neige, parfois accompagné d'un caillou
      const r = 0.26 + rnd(11) * 0.22;
      boulder(g, cx, cy, r, 0.3 + rnd(12) * 0.45, pal, rnd, rnd(13) > 0.25);
      if (rnd(14) > 0.55) boulder(g, cx + 0.35, cy + 0.2, r * 0.45, 0.16, pal, (n) => rnd(n + 80), true);
      break;
    }
    case "mountain": {
      const h = 3 + rnd(3) * 1.6;
      pyramid(g, cx, cy, 1.5, h, c(0x8d9bb5), c(0x6b7896), c(0xffffff), c(0xdde3ee));
      break;
    }
    case "stall": {
      const x0 = cx - 0.6, y0 = cy - 0.4;
      socle(g, x0, y0, 1.2, 0.8, drop, pal, rnd);
      box(g, x0, y0, 0, 1.2, 0.8, 0.5, { top: c(0xc8a06a), left: c(0xb5763f), right: c(0x8f5a2e) });
      onLeft(g, y0 + 0.8, x0 + 0.1, x0 + 1.1, 0.3, 0.5, c(0xf2d7a8));
      for (const px of [x0 + 0.05, x0 + 1.1]) box(g, px, y0 + 0.65, 0.5, 0.06, 0.06, 0.45, { top: c(0x6b3b22), left: c(0x6b3b22), right: c(0x4e2a18) });
      // toit rayé
      const z = 0.95;
      for (let i = 0; i < 6; i++) {
        const a = x0 - 0.1 + i * 0.233, b = a + 0.233;
        poly(g, [P(a, y0 + 1, z - 0.2), P(b, y0 + 1, z - 0.2), P(b, y0 + 0.35, z + 0.2), P(a, y0 + 0.35, z + 0.2)], c(i % 2 ? 0xffffff : 0xd9354b));
      }
      poly(g, [P(x0 - 0.1, y0 + 1, z - 0.2), P(x0 + 1.3, y0 + 1, z - 0.2), P(x0 + 1.3, y0 + 1, z - 0.32), P(x0 - 0.1, y0 + 1, z - 0.32)], c(0xb02a3c));
      break;
    }
    case "bigTree": {
      const p = P(cx, cy);
      tree(g, p, 1.9, pal, { snow: false, light: 0x2fa36b, dark: 0x1f7a52 });
      const cols = [0xd9354b, 0xffc85a, 0x3f7fb5, 0xffffff];
      for (let i = 0; i < 16; i++) {
        const t = rnd(10 + i), lvl = rnd(30 + i);
        const yy = p.y - 20 - lvl * 85, half = (1 - lvl) * 40 + 6;
        g.circle(p.x + (t - 0.5) * 2 * half * 0.8, yy, 3.4).fill(pal.night ? cols[i % 4] : c(cols[i % 4]));
      }
      const sy = p.y - 118;
      g.star(p.x, sy, 5, 11, 5).fill(0xffd46b);
      if (pal.night) g.circle(p.x, sy, 26).fill({ color: 0xffd46b, alpha: 0.2 });
      break;
    }
    case "wheel": {
      const p = P(cx, cy), r = 62, hy = p.y - 86;
      poly(g, [{ x: p.x - 30, y: p.y }, { x: p.x, y: hy }, { x: p.x - 24, y: p.y }], c(0x8a93a8));
      poly(g, [{ x: p.x + 30, y: p.y }, { x: p.x, y: hy }, { x: p.x + 24, y: p.y }], c(0x6b7489));
      g.circle(p.x, hy, r).stroke({ width: 5, color: c(0xd9354b) });
      g.circle(p.x, hy, r - 12).stroke({ width: 2, color: c(0xe8a0a8) });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.moveTo(p.x, hy).lineTo(p.x + Math.cos(a) * r, hy + Math.sin(a) * r).stroke({ width: 2, color: c(0xb9c0cf) });
        const col = [0xffc85a, 0x3f7fb5, 0x2fa37a, 0xffffff][i % 4];
        g.roundRect(p.x + Math.cos(a) * r - 7, hy + Math.sin(a) * r, 14, 12, 3).fill(c(col));
        if (pal.night) g.circle(p.x + Math.cos(a) * r, hy + Math.sin(a) * r, 3).fill(0xffd46b);
      }
      g.circle(p.x, hy, 6).fill(c(0x2b2f45));
      break;
    }
    case "crystal": {
      const p = P(cx, cy);
      const k = 0.7 + rnd(4) * 0.7;
      for (const [dx, hh, ww] of [[0, 70, 14], [-16, 44, 10], [15, 52, 10]] as const) {
        const h = hh * k, w = ww * k, bx = p.x + dx * k;
        poly(g, [{ x: bx, y: p.y - h }, { x: bx - w, y: p.y - h * 0.75 }, { x: bx - w, y: p.y - 4 }, { x: bx, y: p.y }], pal.night ? 0x7fe3ff : c(0x9ff0ff));
        poly(g, [{ x: bx, y: p.y - h }, { x: bx + w, y: p.y - h * 0.75 }, { x: bx + w, y: p.y - 4 }, { x: bx, y: p.y }], pal.night ? 0x3fb8e0 : c(0x4fc6e6));
      }
      if (pal.night) g.circle(p.x, p.y - 30, 40).fill({ color: 0x7fe3ff, alpha: 0.13 });
      break;
    }
    case "presents": {
      const cols = [0xd9354b, 0x2fa37a, 0x3f7fb5, 0xffc85a];
      const spots = [[-0.3, -0.1, 0.4], [0.1, -0.25, 0.3], [-0.05, 0.2, 0.32]];
      spots.forEach(([dx, dy, s], i) => {
        const col = cols[(i + Math.floor(rnd(5) * 4)) % 4];
        box(g, cx + dx - s / 2, cy + dy - s / 2, 0, s, s, s * 0.9, { top: c(shade(col, 0.15)), left: c(col), right: c(shade(col, -0.2)) });
        onLeft(g, cy + dy + s / 2, cx + dx - 0.04, cx + dx + 0.04, 0, s * 0.9, c(0xffe7a6));
        onRight(g, cx + dx + s / 2, cy + dy - 0.04, cy + dy + 0.04, 0, s * 0.9, c(0xffd47a));
      });
      break;
    }
    case "cane": {
      const p = P(cx, cy);
      for (let i = 0; i < 8; i++) g.rect(p.x - 4, p.y - 8 - i * 8, 8, 8).fill(c(i % 2 ? 0xffffff : 0xd9354b));
      g.moveTo(p.x - 4, p.y - 70).arc(p.x + 10, p.y - 70, 14, Math.PI, 0).stroke({ width: 8, color: c(0xd9354b) });
      break;
    }
    case "sleigh": {
      const p = P(cx, cy);
      g.roundRect(p.x - 40, p.y - 34, 70, 26, 10).fill(c(0xd9354b));
      g.roundRect(p.x - 40, p.y - 34, 70, 8, 4).fill(c(0xf0b23a));
      g.moveTo(p.x - 46, p.y - 2).lineTo(p.x + 36, p.y - 2).arc(p.x + 36, p.y - 10, 8, Math.PI / 2, -Math.PI / 2, true).stroke({ width: 4, color: c(0xf0b23a) });
      box(g, cx - 0.35, cy - 0.3, 0.5, 0.35, 0.35, 0.3, { top: c(0x3f9e6e), left: c(0x2fa37a), right: c(0x1f7a52) });
      break;
    }
    case "workshop": {
      const x0 = cx - 1, y0 = cy - 0.75;
      socle(g, x0, y0, 2, 1.5, drop, pal, rnd);
      box(g, x0, y0, 0, 2, 1.5, 1.1, { top: c(0x9a3b3b), left: c(0xc8463b), right: c(0x9a2f2a) });
      for (let i = 0; i < 4; i++) onLeft(g, y0 + 1.5, x0 + 0.2 + i * 0.45, x0 + 0.45 + i * 0.45, 0.5, 0.85, pal.window);
      onRight(g, x0 + 2, y0 + 0.5, y0 + 1, 0, 0.75, c(0x2fa37a));
      gableRoof(g, x0, y0, 1.1, 2, 1.5, 0.75, c(SNOW.left), c(SNOW.top), c(0x7a2622));
      const s = P(x0 + 1, y0 + 0.75, 2.1);
      g.star(s.x, s.y, 5, 12, 5).fill(0xffd46b);
      break;
    }
    case "deer": {
      const p = P(cx, cy), b = c(0xa86b3d), d = c(0x7d4a26);
      g.ellipse(p.x, p.y, 16, 6).fill({ color: c(0x9aa3b8), alpha: 0.3 });
      for (const lx of [-10, -4, 6, 11]) g.rect(p.x + lx, p.y - 16, 3, 16).fill(d);
      g.roundRect(p.x - 14, p.y - 26, 30, 13, 6).fill(b);
      g.roundRect(p.x + 10, p.y - 40, 8, 18, 3).fill(b);
      g.roundRect(p.x + 12, p.y - 46, 14, 9, 4).fill(b);
      g.circle(p.x + 26, p.y - 42, 3).fill(c(0xd9354b));
      g.moveTo(p.x + 14, p.y - 46).lineTo(p.x + 8, p.y - 58).lineTo(p.x + 2, p.y - 60).moveTo(p.x + 10, p.y - 53).lineTo(p.x + 16, p.y - 60).stroke({ width: 2.5, color: d });
      break;
    }
    case "skater": {
      const p = P(cx, cy), col = [0xd9354b, 0x3f7fb5, 0x2fa37a][Math.floor(rnd(6) * 3)];
      g.ellipse(p.x, p.y, 10, 4).fill({ color: 0x5f86a8, alpha: 0.35 });
      g.rect(p.x - 4, p.y - 12, 3, 12).fill(c(0x2b2f45));
      g.rect(p.x + 1, p.y - 12, 3, 12).fill(c(0x2b2f45));
      g.roundRect(p.x - 7, p.y - 28, 14, 18, 5).fill(c(col));
      g.circle(p.x, p.y - 33, 6).fill(c(0xf2c9a6));
      g.circle(p.x, p.y - 37, 6).fill(c(shade(col, -0.2)));
      break;
    }
  }
  return g;
}
