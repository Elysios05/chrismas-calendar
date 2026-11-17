// Terrain continu : la route traverse les mondes, le décor l'entoure jusqu'aux bords de l'écran
import { ZONES, DAYS_PER_ZONE } from "./zones";
import type { PropKind } from "./props";

export type PathCell = { x: number; y: number; z: number; zone: number };
export type DayNode = { day: number; idx: number; x: number; y: number; z: number; zone: number };
/** `rz` = altitude de la route la plus proche : sert à mesurer la hauteur relative d'une cellule */
export type Cell = { x: number; y: number; h: number; zone: number; road: boolean; lake: boolean; d: number; front: boolean; rz: number };
export type PlacedProp = { kind: PropKind; x: number; y: number; z: number; zone: number; seed: number };
export type Terrain = { path: PathCell[]; nodes: DayNode[]; cells: Map<string, Cell>; props: PlacedProp[]; V: Map<string, number> };

/** Hauteur du terrain en un point quelconque (interpolation bilinéaire des sommets) */
export function heightAt(t: Terrain, x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const v = (a: number, b: number) => t.V.get(key(a, b)) ?? 0;
  const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx;
  const bot = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx;
  return top + (bot - top) * fy;
}

export const key = (x: number, y: number) => `${x},${y}`;
const SEG = 4, TRANSITION = 6, LEAD = 4;
const HALF_WIDTH = 17; // demi-largeur du terrain (en tuiles, axe écran horizontal)

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// bruit de valeur lissé, déterministe
function noise2(x: number, y: number) {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function buildTerrain(seed = 2026): Terrain {
  const R = rng(seed);
  /* ---------- route ---------- */
  const path: PathCell[] = [];
  const nodes: DayNode[] = [];
  let x = 0, y = 0, dirX = true, zone = 0;
  path.push({ x, y, z: 0, zone });
  const step = () => { if (dirX) x++; else y++; path.push({ x, y, z: 0, zone }); };
  for (let i = 0; i < LEAD; i++) step();
  for (let day = 1; day <= 24; day++) {
    for (let i = 0; i < SEG; i++) step();
    nodes.push({ day, idx: path.length - 1, x, y, z: 0, zone });
    dirX = !dirX;
    if (day % DAYS_PER_ZONE === 0 && day < 24) {
      for (let i = 0; i < TRANSITION; i++) { step(); if (i === TRANSITION / 2 - 1) zone++; path[path.length - 1].zone = zone; }
    }
  }
  for (let i = 0; i < 4; i++) step();

  // altitude de la route : col dans les montagnes (montée puis descente)
  const mountain = path.map((c, i) => ({ c, i })).filter(({ c }) => ZONES[c.zone].id === "montagnes");
  if (mountain.length) {
    const i0 = mountain[0].i, i1 = mountain[mountain.length - 1].i;
    for (let i = i0; i <= i1; i++) {
      const t = (i - i0) / (i1 - i0);
      // montée plus longue que la descente (on redescend en luge)
      const s = t < 0.62 ? Math.sin((t / 0.62) * Math.PI / 2) : Math.cos(((t - 0.62) / 0.38) * Math.PI / 2);
      path[i].z = 3.2 * s;
    }
  }
  for (const n of nodes) n.z = path[n.idx].z;

  /* ---------- cellules ---------- */
  const byRow = new Map<number, PathCell[]>();
  path.forEach((c) => { const k = c.x + c.y; if (!byRow.has(k)) byRow.set(k, []); byRow.get(k)!.push(c); });
  const center = (k: number) => {
    const kk = Math.max(0, Math.min(path.length - 1, k));
    const c = byRow.get(kk)?.[0] ?? path[path.length - 1];
    return c.x - c.y;
  };
  const cells = new Map<string, Cell>();
  const onRoad = new Set(path.map((c) => key(c.x, c.y)));
  const kMin = -14, kMax = path[path.length - 1].x + path[path.length - 1].y + 16;
  for (let k = kMin; k <= kMax; k++) {
    const c0 = center(k);
    for (let u = c0 - HALF_WIDTH; u <= c0 + HALF_WIDTH; u++) {
      if ((u + k) % 2 !== 0) continue;
      const cx = (k + u) / 2, cy = (k - u) / 2;
      // chemin le plus proche (parmi les rangées voisines)
      let best: PathCell = path[0], bd = Infinity;
      for (let kk = k - 12; kk <= k + 12; kk++) for (const p of byRow.get(kk) ?? []) {
        const d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { bd = d; best = p; }
      }
      if (k < 0) { best = path[0]; bd = Math.hypot(cx, cy); }
      if (k > kMax - 16) { best = path[path.length - 1]; bd = Math.min(bd, Math.hypot(best.x - cx, best.y - cy)); }
      const front = cx + cy > best.x + best.y;
      const zdef = ZONES[best.zone];
      const n = noise2(cx * 0.35, cy * 0.35);
      let h = best.z;
      if (zdef.id === "montagnes") {
        const wall = Math.max(0, bd - 1.6);
        h += front ? Math.min(wall * 0.25, 1.2) : wall * (0.32 + n * 0.3);
        h = Math.min(h, best.z + 5.5);
      } else if (zdef.id === "grotte") {
        const wall = Math.max(0, bd - 2.2);
        h += front ? Math.min(wall * 0.3, 1.2) : wall * 0.7;
      } else {
        h += bd > 3 ? (n - 0.5) * 0.35 : 0;
      }
      cells.set(key(cx, cy), { x: cx, y: cy, h: Math.max(0, h), zone: best.zone, road: onRoad.has(key(cx, cy)), lake: false, d: bd, front, rz: best.z });
    }
  }
  // lissage : pentes en terrasses plutôt qu'en piliers
  for (let pass = 0; pass < 3; pass++) {
    const next = new Map<string, number>();
    for (const c of cells.values()) {
      let s = c.h * 2, n = 2;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = cells.get(key(c.x + dx, c.y + dy)); if (o) { s += o.h; n++; } }
      next.set(key(c.x, c.y), s / n);
    }
    for (const c of cells.values()) c.h = next.get(key(c.x, c.y))!;
  }
  // route et abords : hauteur de la route
  for (const p of path) { const c = cells.get(key(p.x, p.y)); if (c) c.h = p.z; }
  for (const c of cells.values()) if (!c.road && c.d < 1.5) {
    let best = path[0], bd = Infinity;
    for (const p of path) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; best = p; } }
    c.h = best.z;
  }
  // lac gelé : la route passe dessus (on traverse en patins)
  const lakeZone = ZONES.findIndex((z) => z.lake);
  if (lakeZone >= 0) {
    const zc = path.filter((p) => p.zone === lakeZone);
    const mid = zc[Math.floor(zc.length * 0.62)];
    for (const c of cells.values()) {
      const r = Math.hypot((c.x - mid.x) * 0.8, c.y - mid.y);
      if (c.zone === lakeZone && r < 4.3 + noise2(c.x * 0.5, c.y * 0.5) * 1.5) { c.lake = true; c.h = 0; }
    }
  }


  /* ---------- maillage : hauteur à chaque sommet ---------- */
  const V = new Map<string, number>();
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (const c of cells.values()) for (const [dx, dy] of corners) {
    const k = key(c.x + dx, c.y + dy);
    if (V.has(k)) continue;
    let sum = 0, n = 0;
    for (const [ex, ey] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const o = cells.get(key(c.x + dx + ex, c.y + dy + ey)); if (o) { sum += o.h; n++; } }
    V.set(k, sum / n);
  }
  const verts = [...V.keys()].map((k) => { const [x, y] = k.split(",").map(Number); return { k, x, y }; });
  const shuffled = [...cells.values()].map((c) => ({ c, r: R() })).sort((a, b) => a.r - b.r).map((o) => o.c);

  // crêtes : des chaînes de sommets reliés par une arête vive (et des aiguilles dans la grotte)
  type Seg = { ax: number; ay: number; ah: number; bx: number; by: number; bh: number; r: number };
  const segs: Seg[] = [];
  const starts: { x: number; y: number }[] = [];
  for (const c of shuffled) {
    const zid = ZONES[c.zone].id;
    const isM = zid === "montagnes", isG = zid === "grotte";
    if ((!isM && !isG) || c.front || c.d < (isM ? 5 : 3.2)) continue;
    if (starts.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < (isM ? 7.5 : 3))) continue;
    starts.push({ x: c.x, y: c.y });
    let px = c.x + 0.5, py = c.y + 0.5;
    let ph = isM ? 5 + R() * 3.4 : 2.2 + R() * 1.6;
    // la crête s'éloigne de la route : elle part vers l'arrière du terrain
    let ang = Math.atan2(c.y - 0.5, c.x - 0.5) + (R() - 0.5) * 2;
    const rad = isM ? 2.9 + R() * 1.3 : 1.3 + R() * 0.5;
    const links = isM ? 2 + Math.floor(R() * 3) : 1;
    for (let i = 0; i < links; i++) {
      const len = isM ? 2.6 + R() * 3.4 : 1.4 + R();
      ang += (R() - 0.5) * 1.1;
      const qx = px + Math.cos(ang) * len, qy = py + Math.sin(ang) * len;
      // les sommets voisins sont nettement plus bas ou plus hauts : silhouette dentelée
      const qh = Math.max(1.4, ph * (0.52 + R() * 0.62));
      segs.push({ ax: px, ay: py, ah: ph, bx: qx, by: qy, bh: qh, r: rad });
      px = qx; py = qy; ph = qh;
    }
  }
  for (const v of verts) {
    let add = 0;
    for (const s of segs) {
      const ux = s.bx - s.ax, uy = s.by - s.ay;
      const L2 = ux * ux + uy * uy || 1;
      const t = Math.max(0, Math.min(1, ((v.x - s.ax) * ux + (v.y - s.ay) * uy) / L2));
      const d = Math.hypot(v.x - (s.ax + ux * t), v.y - (s.ay + uy * t));
      if (d >= s.r) continue;
      const h = s.ah + (s.bh - s.ah) * t;
      // profil presque linéaire : arête nette au sommet, pied à peine adouci
      const k = 1 - d / s.r;
      add = Math.max(add, h * (k * 0.82 + k * k * 0.18) + (noise2(v.x * 1.1, v.y * 1.1) - 0.5) * 0.3 * k);
    }
    V.set(v.k, V.get(v.k)! + add);
  }

  // route : ruban à la hauteur du chemin, abords qui rejoignent le relief en douceur
  const roadZ = new Map<string, number[]>();
  for (const p of path) for (const [dx, dy] of corners) { const k = key(p.x + dx, p.y + dy); if (!roadZ.has(k)) roadZ.set(k, []); roadZ.get(k)!.push(p.z); }
  for (const v of verts) {
    let best = path[0], bd = Infinity;
    for (const p of path) { const d = Math.hypot(v.x - (p.x + 0.5), v.y - (p.y + 0.5)); if (d < bd) { bd = d; best = p; } }
    const rz = roadZ.get(v.k);
    if (rz) { V.set(v.k, rz.reduce((a, b) => a + b, 0) / rz.length); continue; }
    const t = Math.max(0, Math.min(1, (bd - 1.1) / 1.6));
    V.set(v.k, best.z + (V.get(v.k)! - best.z) * (t * t * (3 - 2 * t)));
  }
  // lac : parfaitement plat
  for (const c of cells.values()) if (c.lake) for (const [dx, dy] of corners) V.set(key(c.x + dx, c.y + dy), 0);
  // rien ne doit masquer la route : on rabote ce qui se trouve devant elle
  for (const p of path) {
    const pd = p.x + p.y + 1, pu = p.x - p.y;
    for (const v of verts) {
      const vd = v.x + v.y;
      if (vd <= pd + 0.5 || vd > pd + 16 || Math.abs(v.x - v.y - pu) > 2.5) continue;
      const max = p.z + 0.45 * (vd - pd) - 0.35;
      if (V.get(v.k)! > max) V.set(v.k, Math.max(0, max));
    }
  }
  for (const v of verts) V.set(v.k, Math.max(0, V.get(v.k)!));
  const T0: Terrain = { path, nodes, cells, props: [], V };
  const slopeOf = (c: Cell) => { const hs = corners.map(([dx, dy]) => V.get(key(c.x + dx, c.y + dy)) ?? 0); return Math.max(...hs) - Math.min(...hs); };

  /* ---------- décors ---------- */
  const props: PlacedProp[] = [];
  const taken = new Set<string>();
  const free = (cx: number, cy: number, r: number) => {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (taken.has(key(cx + dx, cy + dy))) return false;
      const c = cells.get(key(cx + dx, cy + dy)); if (!c || c.road) return false;
    }
    return true;
  };
  const place = (kind: PropKind, c: Cell, r = 0) => {
    props.push({ kind, x: c.x, y: c.y, z: heightAt(T0, c.x + 0.5, c.y + 0.5), zone: c.zone, seed: Math.floor(R() * 1e6) });
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) taken.add(key(c.x + dx, c.y + dy));
  };
  const all = shuffled;
  // une case de chaque nœud reste dégagée
  for (const n of nodes) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) taken.add(key(n.x + dx, n.y + dy));

  for (const c of all) {
    if (c.road || taken.has(key(c.x, c.y))) continue;
    const z = ZONES[c.zone];
    const flatAround = (r: number) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const o = cells.get(key(c.x + dx, c.y + dy)); if (!o || slopeOf(o) > 0.2 || o.road || o.lake) return false; } return true; };
    const steep = slopeOf(c);
    if (steep > 0.9) continue; // falaises : pas de décor
    const d = c.d;
    if (c.lake) { if (z.id === "lac" && d > 1.2 && R() < 0.05) place("skater", c); continue; }
    switch (z.id) {
      case "montagnes": {
        // les sapins s'arrêtent en altitude : plus haut, il n'y a que des rochers
        const high = Math.max(0, Math.min(1, (heightAt(T0, c.x + 0.5, c.y + 0.5) - c.rz - 1.6) / 2.6));
        if (d > 1.2 && R() < (c.front ? 0.18 : 0.42)) place(R() < 0.82 - high * 0.75 ? "tree" : "rock", c);
        else if (d > 1.2 && d < 3 && R() < 0.02) place("deer", c);
        break;
      }
      case "saint-nicolas": {
        const near = d > 1.5 && d < 9 && (!c.front || d > 3);
        if (near && R() < 0.5 && flatAround(0) && free(c.x, c.y, 1)) place("house", c, 1);
        else if (d > 1 && d < 1.6 && R() < 0.22) place("lamp", c);
        else if (d > 1.5 && R() < 0.12) place(R() < 0.7 ? "tree" : "treeSmall", c);
        break;
      }
      case "lac":
        if (d > 1.2 && R() < (c.front ? 0.25 : 0.55)) place(R() < 0.8 ? "tree" : "treeSmall", c);
        else if (d > 1.5 && R() < 0.01) place("deer", c);
        break;
      case "marche":
        if (d > 1.3 && d < 4 && (!c.front || d > 2.5) && R() < 0.35 && free(c.x, c.y, 0)) place("stall", c, 1);
        else if (d > 1 && d < 1.6 && R() < 0.2) place("lamp", c);
        else if (d > 4 && R() < 0.2) place(R() < 0.5 ? "house" : "tree", c, 1);
        break;
      case "grotte":
        if (d > 1.3 && R() < (c.front ? 0.12 : 0.3)) place("crystal", c);
        break;
      case "pole-nord":
        if (d > 1.3 && R() < 0.12) place(["cane", "presents", "tree", "deer"][Math.floor(R() * 4)] as PropKind, c);
        break;
    }
  }
  // repères uniques
  const landmark = (kind: PropKind, zid: string, pick: (c: Cell) => boolean, r = 1) => {
    const z = ZONES.findIndex((zz) => zz.id === zid);
    const c = all.find((c) => c.zone === z && !c.road && pick(c) && free(c.x, c.y, r));
    if (c) place(kind, c, r);
  };
  landmark("chalet", "montagnes", (c) => !c.front && c.d > 2 && c.d < 3.5 && c.h > 2);
  landmark("snowman", "saint-nicolas", (c) => c.d > 1.2 && c.d < 2, 0);
  landmark("bigTree", "marche", (c) => !c.front && c.d > 2.5 && c.d < 4);
  landmark("wheel", "marche", (c) => !c.front && c.d > 4 && c.d < 7);
  landmark("workshop", "pole-nord", (c) => !c.front && c.d > 2.5 && c.d < 4.5);
  landmark("sleigh", "pole-nord", (c) => c.d > 1.5 && c.d < 2.5, 0);

  T0.props = props;
  return T0;
}
