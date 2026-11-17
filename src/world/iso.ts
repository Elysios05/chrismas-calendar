// Projection isométrique 2:1 et primitives de dessin vectoriel plat
import { Graphics } from "pixi.js";

export const TW = 80; // largeur d'une tuile à l'écran
export const TH = 40; // hauteur d'une tuile à l'écran
export const ZH = 44; // pixels par unité de hauteur

export type Pt = { x: number; y: number };

/** grille (x, y, z) -> écran */
export const P = (x: number, y: number, z = 0): Pt => ({
  x: ((x - y) * TW) / 2,
  y: ((x + y) * TH) / 2 - z * ZH,
});

const flat = (pts: Pt[]) => pts.flatMap((p) => [p.x, p.y]);

export function poly(g: Graphics, pts: Pt[], color: number, alpha = 1) {
  g.poly(flat(pts)).fill({ color, alpha });
}

/* ---------- couleurs ---------- */
const NIGHT = 0x1b2347;
export function mix(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}
export function shade(c: number, f: number) {
  return f < 0 ? mix(c, 0x000000, -f) : mix(c, 0xffffff, f);
}
/** Palette jour / nuit : la nuit, tout bascule vers un bleu profond sauf les lumières */
export function makePalette(night: boolean) {
  return {
    c: (hex: number) => (night ? mix(hex, NIGHT, 0.52) : hex),
    lit: (hex: number) => hex,
    window: night ? 0xffd46b : 0x8fb3d1,
    night,
  };
}
export type Palette = ReturnType<typeof makePalette>;

/* ---------- formes ---------- */
export type BoxColors = { top: number; left: number; right: number };

/** Pavé : origine (x,y,z), dimensions (w,d,h) en unités de grille */
export function box(g: Graphics, x: number, y: number, z: number, w: number, d: number, h: number, col: BoxColors) {
  poly(g, [P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)], col.left);
  poly(g, [P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)], col.right);
  poly(g, [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], col.top);
}

/** Rectangle dessiné sur la face gauche (+y) d'un pavé : u le long de x, v en hauteur */
export function onLeft(g: Graphics, y: number, x0: number, x1: number, z0: number, z1: number, color: number) {
  poly(g, [P(x0, y, z1), P(x1, y, z1), P(x1, y, z0), P(x0, y, z0)], color);
}
/** Rectangle sur la face droite (+x) : u le long de y */
export function onRight(g: Graphics, x: number, y0: number, y1: number, z0: number, z1: number, color: number) {
  poly(g, [P(x, y0, z1), P(x, y1, z1), P(x, y1, z0), P(x, y0, z0)], color);
}

/** Toit à deux pans, faîtage selon l'axe x */
export function gableRoof(
  g: Graphics, x: number, y: number, z: number, w: number, d: number, rh: number,
  front: number, back: number, gable: number, over = 0.12,
) {
  const x0 = x - over, x1 = x + w + over, y0 = y - over, y1 = y + d + over, ym = y + d / 2;
  poly(g, [P(x0, y0, z), P(x1, y0, z), P(x1, ym, z + rh), P(x0, ym, z + rh)], back);
  poly(g, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, ym, z + rh)], gable);
  poly(g, [P(x0, y1, z), P(x1, y1, z), P(x1, ym, z + rh), P(x0, ym, z + rh)], front);
}

/** Pyramide (montagne) avec calotte de neige */
export function pyramid(g: Graphics, cx: number, cy: number, r: number, h: number, left: number, right: number, snowL: number, snowR: number, cap = 0.42) {
  const top = P(cx, cy, h);
  const a = P(cx - r, cy + r, 0), b = P(cx + r, cy + r, 0), c = P(cx + r, cy - r, 0);
  poly(g, [top, a, b], left);
  poly(g, [top, b, c], right);
  const lerp = (p: Pt, q: Pt, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const sa = lerp(top, a, cap), sb = lerp(top, b, cap), sc = lerp(top, c, cap);
  const sab = lerp(top, lerp(a, b, 0.5), cap * 1.25), sbc = lerp(top, lerp(b, c, 0.5), cap * 0.9);
  poly(g, [top, sa, sab, sb], snowL);
  poly(g, [top, sb, sbc, sc], snowR);
}

/* ---------- sapins ---------- */
/** Trois essences : épicéa élancé, sapin large, jeune pousse */
export type TreeKind = "epicea" | "sapin" | "pousse";
/** Quatre verts, du plus clair au plus sombre : chaque arbre tire le sien */
export const TREE_GREENS: [number, number][] = [
  [0x3a9b6e, 0x256f52],
  [0x2e8b62, 0x1f6b4f],
  [0x2f7f5c, 0x1b5f46],
  [0x266b55, 0x17503e],
];
const TREE_SHAPES: Record<TreeKind, { tiers: number; w0: number; dw: number; gap: number; th: number; dth: number; trunkW: number; trunkH: number }> = {
  // w0 demi-largeur du 1er étage, dw ce qu'on retire par étage, gap écart vertical, th hauteur d'un étage
  epicea: { tiers: 4, w0: 21, dw: 4.2, gap: 12, th: 30, dth: 2, trunkW: 2.6, trunkH: 10 },
  sapin: { tiers: 3, w0: 27, dw: 6.5, gap: 15, th: 26, dth: 3, trunkW: 3, trunkH: 10 },
  pousse: { tiers: 2, w0: 19, dw: 6, gap: 13, th: 21, dth: 3, trunkW: 2.4, trunkH: 7 },
};

export function tree(
  g: Graphics, at: Pt, size: number, pal: Palette,
  opts: { snow?: boolean; light?: number; dark?: number; kind?: TreeKind; variant?: number; snowAmount?: number } = {},
) {
  const kind = opts.kind ?? "sapin";
  const sp = TREE_SHAPES[kind];
  const [gl, gd] = TREE_GREENS[(opts.variant ?? 0) % TREE_GREENS.length];
  const light = pal.c(opts.light ?? gl), dark = pal.c(opts.dark ?? gd);
  const snow = pal.c(0xf7f5f0), snowD = pal.c(0xdcdde3);
  const trunk = pal.c(0x7a4a2e);
  g.rect(at.x - sp.trunkW * size, at.y - 8 * size, sp.trunkW * 2 * size, (sp.trunkH + 8) * size).fill(trunk);
  for (let i = 0; i < sp.tiers; i++) {
    const w = (sp.w0 - i * sp.dw) * size;
    const base = at.y - (6 + i * sp.gap) * size;
    const top = base - (sp.th - i * sp.dth) * size;
    poly(g, [{ x: at.x, y: top }, { x: at.x - w, y: base }, { x: at.x, y: base + 4 * size }], light);
    poly(g, [{ x: at.x, y: top }, { x: at.x + w, y: base }, { x: at.x, y: base + 4 * size }], dark);
    if (opts.snow !== false) {
      const t = 0.28 + (opts.snowAmount ?? 0.5) * 0.26;
      const sw = w * t, sh = (base - top) * t;
      poly(g, [{ x: at.x, y: top }, { x: at.x - sw, y: top + sh }, { x: at.x, y: top + sh + 3 * size }], snow);
      poly(g, [{ x: at.x, y: top }, { x: at.x + sw, y: top + sh }, { x: at.x, y: top + sh + 3 * size }], snowD);
    }
  }
}

/** Rocher facetté coiffé de neige, dessiné en coordonnées de grille */
export function boulder(g: Graphics, cx: number, cy: number, r: number, h: number, pal: Palette, rnd: (n: number) => number, snowy = true) {
  const n = 6;
  const base: Pt[] = [], top: Pt[] = [];
  // deux anneaux de sommets : le haut est plus serré et décalé → facettes irrégulières
  const ox = (rnd(21) - 0.5) * r * 0.35, oy = (rnd(22) - 0.5) * r * 0.35;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(30 + i) * 0.5;
    const rb = r * (0.7 + rnd(40 + i) * 0.5);
    const rt = rb * (0.34 + rnd(50 + i) * 0.26);
    const hh = h * (0.78 + rnd(60 + i) * 0.3);
    base.push(P(cx + Math.cos(a) * rb, cy + Math.sin(a) * rb, 0));
    top.push(P(cx + ox + Math.cos(a) * rt, cy + oy + Math.sin(a) * rt, hh));
  }
  const ROCK = 0x737e9c, DARK = 0x4b5478, LIGHT = 0x9aa3bd;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // la lumière vient de l'arrière-gauche : les faces de gauche sont claires
    const dx = (base[i].x + base[j].x) / 2 - P(cx, cy, 0).x;
    const f = dx < 0 ? LIGHT : dx > 0 ? DARK : ROCK;
    poly(g, [top[i], top[j], base[j], base[i]], pal.c(mix(f, ROCK, 0.25 + rnd(70 + i) * 0.3)));
  }
  poly(g, top, pal.c(snowy ? 0xf7f5f0 : LIGHT));
}
