// Terrain continu : la route traverse les mondes, le décor l'entoure jusqu'aux bords de l'écran
import { ZONES, DAYS_PER_ZONE } from "./zones";
import type { PropKind } from "./props";

/** `i` = rang de la cellule le long du chemin */
export type PathCell = { x: number; y: number; z: number; zone: number; i: number };
export type DayNode = { day: number; idx: number; x: number; y: number; z: number; zone: number };
/** `rz` = altitude de la route la plus proche : sert à mesurer la hauteur relative d'une cellule */
export type Cell = { x: number; y: number; h: number; zone: number; road: boolean; lake: boolean; d: number; front: boolean; rz: number; pi: number;
  /** sol dessiné à part au bout du monde : la place du pôle Nord et la piste d'envol */
  sol?: "place" | "piste" };
/** `drop` = dénivelé à combler sous un bâtiment, côté aval (hauteur du soubassement) */
export type PlacedProp = { kind: PropKind; x: number; y: number; z: number; zone: number; seed: number; drop: number; alongX?: boolean;
  /** renne de l'attelage : il part avec le traîneau quand la case 24 est ouverte */
  attelage?: boolean };
export type Terrain = { path: PathCell[]; nodes: DayNode[]; cells: Map<string, Cell>; props: PlacedProp[]; V: Map<string, number>;
  /** bout de la piste d'envol (cases) : au jour 24, la caméra descend jusque-là */
  bout?: { x: number; y: number };
  /** ancienne place du traîneau, devant chez le Père Noël : les lutins y apportent toujours les cadeaux */
  depot?: { x: number; y: number } };

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
/** Longueur du passage d'un monde au suivant. Entre le lac et le marché il est bien plus long :
 *  la forêt doit avoir le temps de s'éteindre avant que le marché commence. Entre le marché et la
 *  grotte aussi : la voûte d'entrée tombait juste à côté du cadeau 16 (issue #50). */
const transitionLen = (fromZone: number) => ({ lac: 18, marche: 12 } as Record<string, number>)[ZONES[fromZone]?.id] ?? TRANSITION;
/** Décors assez bas pour être posés devant une case sans la cacher. */
const LOW = new Set<PropKind>(["rock", "bush", "presents", "bench", "sled", "fence", "iceLantern", "visitor", "snowman", "deer", "brazier"]);
// demi-largeur du terrain (en tuiles, axe écran horizontal). 17 ne suffisait pas sur ordinateur :
// le chemin s'écarte du centre de l'écran et le bord carré des tuiles apparaissait (issue #13).
const HALF_WIDTH = 30;
/** rangées de neige ajoutées sous la fin de la route (téléphone haut au jour 24, échelle 0,62 : ~45 rangées) */
const RANGEES_SUD = 40;

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
  path.push({ x, y, z: 0, zone, i: 0 });
  const step = () => { if (dirX) x++; else y++; path.push({ x, y, z: 0, zone, i: path.length }); };
  for (let i = 0; i < LEAD; i++) step();
  for (let day = 1; day <= 24; day++) {
    for (let i = 0; i < SEG; i++) step();
    nodes.push({ day, idx: path.length - 1, x, y, z: 0, zone });
    dirX = !dirX;
    if (day % DAYS_PER_ZONE === 0 && day < 24) {
      const len = transitionLen(zone);
      for (let i = 0; i < len; i++) { step(); if (i === Math.floor(len / 2) - 1) zone++; path[path.length - 1].zone = zone; }
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
        // parois resserrées : le passage se referme sur la route, mais ses abords restent plats
        // plafonnée : depuis que le terrain est plus large, les parois lointaines montaient sans fin
        const wall = Math.min(7, Math.max(0, bd - 2));
        h += front ? Math.min(Math.pow(wall, 1.3) * 0.5, 2) : Math.pow(wall, 1.3) * 0.95;
      } else {
        h += bd > 3 ? (n - 0.5) * 0.35 : 0;
      }
      cells.set(key(cx, cy), { x: cx, y: cy, h: Math.max(0, h), zone: best.zone, road: onRoad.has(key(cx, cy)), lake: false, d: bd, front, rz: best.z, pi: best.i });
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
  // demi-emprise des bâtiments : sous eux, on taille une terrasse plate dans la pente
  const FOOTPRINT: Partial<Record<PropKind, number>> = { house: 0.8, chalet: 1, workshop: 1.3, stall: 0.75, santaHouse: 1.1, postOffice: 0.8, stable: 1.1 };
  /** case et emprise de chaque décor posé, pour pouvoir le déplacer ensuite */
  const origine = new Map<PlacedProp, { c: Cell; r: number }>();
  const place = (kind: PropKind, c: Cell, r = 0) => {
    // règle générale (issue #50) : rien de haut juste devant une case
    // les éléments naturels sont décalés au hasard : sinon la forêt se lit comme une plantation en lignes
    const wild = kind === "tree" || kind === "treeSmall" || kind === "bush" || kind === "rock";
    const jx = wild ? (R() - 0.5) * 0.7 : 0, jy = wild ? (R() - 0.5) * 0.7 : 0;
    let z = heightAt(T0, c.x + jx + 0.5, c.y + jy + 0.5);
    let drop = 0;
    const fp = FOOTPRINT[kind];
    if (fp !== undefined) {
      const mx = c.x + 0.5, my = c.y + 0.5;
      const x0 = Math.floor(mx - fp), x1 = Math.ceil(mx + fp);
      const y0 = Math.floor(my - fp), y1 = Math.ceil(my + fp);
      const hs: number[] = [];
      let ok = true;
      for (let vx = x0; vx <= x1 && ok; vx++) for (let vy = y0; vy <= y1; vy++) {
        const h = V.get(key(vx, vy));
        if (h === undefined) continue;
        // on ne touche jamais au maillage de la route
        for (const [ex, ey] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (cells.get(key(vx + ex, vy + ey))?.road) { ok = false; break; }
        if (!ok) break;
        hs.push(h);
      }
      if (ok && hs.length) {
        hs.sort((a, b) => a - b);
        // un peu au-dessus de la médiane : on remblaie plutôt qu'on ne creuse
        z = hs[Math.floor(hs.length * 0.6)];
        for (let vx = x0; vx <= x1; vx++) for (let vy = y0; vy <= y1; vy++) if (V.has(key(vx, vy))) V.set(key(vx, vy), z);
        // ce qui reste de vide en contrebas sera comblé par un soubassement de pierre
        // on mesure la marche juste au pied du bâtiment, pas le fond de la vallée
        drop = Math.min(0.85, Math.max(0, z - heightAt(T0, mx + fp + 0.45, my + fp + 0.45)));
      }
    }
    props.push({ kind, x: c.x + jx, y: c.y + jy, z, zone: c.zone, seed: Math.floor(R() * 1e6), drop });
    origine.set(props[props.length - 1], { c, r });
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) taken.add(key(c.x + dx, c.y + dy));
  };
  const all = shuffled;
  // une case de chaque nœud reste dégagée
  for (const n of nodes) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) taken.add(key(n.x + dx, n.y + dy));
  // et devant chaque case (plus bas à l'écran, donc dessiné par-dessus), un cône où seuls les décors bas
  // ont droit de cité : un sapin, une échoppe ou une voûte y cacheraient le cadeau (issue #50)
  const devant = new Set<string>();
  for (const n of nodes) for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) {
    const dk = dx + dy, du = dx - dy;
    if ((dk >= 1 && dk <= 5 && Math.abs(du) <= 1.5 + dk * 0.4) || Math.hypot(dx, dy) < 1.8) devant.add(key(n.x + dx, n.y + dy));
  }
  /** un bâtiment de rayon `r` posé en (x, y) déborderait-il dans le cône d'une case ? */
  const hidesGift = (x: number, y: number, r: number) => {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (devant.has(key(x + dx, y + dy))) return true;
    return false;
  };
  /** la place libre la plus proche de `c`, dans le même monde, hors des cônes et à distance de route semblable */
  const ailleurs = (c: Cell, r: number): Cell | undefined => {
    const bati = r > 0;
    let best: Cell | undefined, bs = Infinity;
    for (let dx = -10; dx <= 10; dx++) for (let dy = -10; dy <= 10; dy++) {
      const o = cells.get(key(c.x + dx, c.y + dy));
      if (!o || o.zone !== c.zone || o.road || o.lake || taken.has(key(o.x, o.y))) continue;
      if (slopeOf(o) > (bati ? 0.6 : 0.9) || !free(o.x, o.y, r) || hidesGift(o.x, o.y, r)) continue;
      const score = Math.hypot(dx, dy) + Math.abs(o.d - c.d) * 1.5;
      if (score < bs) { bs = score; best = o; }
    }
    return best;
  };

  // rangs du chemin où l'on change de monde
  const zoneEdges = path.filter((p, i) => i > 0 && p.zone !== path[i - 1].zone).map((p) => p.i);
  /* ---------- lisières : ce qui ferme la carte à gauche et à droite ---------- */
  // Sans cela, les tuiles s'arrêtent net sur un bord carré (issue #13). Comme le demande l'issue,
  // chaque bord est fermé par un décor très dense : crêtes en montagne et dans la grotte, forêt
  // serrée partout ailleurs (les nuages, essayés au marché et au pôle Nord, rendaient mal).
  const LISIERE: Record<string, PropKind> = { montagnes: "ridge", grotte: "ridge" };
  const parRangee = new Map<number, Cell[]>();
  for (const c of cells.values()) {
    const k = c.x + c.y;
    if (!parRangee.has(k)) parRangee.set(k, []);
    parRangee.get(k)!.push(c);
  }
  for (const [k, rang] of parRangee) {
    rang.sort((a, b) => (a.x - a.y) - (b.x - b.y));
    const n = rang.length;
    // la rangée extrême porte la lisière proprement dite, une rangée sur deux
    if (k % 2 === 0) for (const c of [rang[0], rang[n - 1]]) {
      if (!c || c.road || c.lake) continue;
      place(LISIERE[ZONES[c.zone].id] ?? "deepWood", c);
    }
    // et derrière elle, une bande de forêt serrée qui remplit le bord de l'écran
    for (let i = 1; i < Math.min(5, n / 2); i++) for (const c of [rang[i], rang[n - 1 - i]]) {
      if (!c || c.road || c.lake || c.d < 6 || taken.has(key(c.x, c.y))) continue;
      const zid = ZONES[c.zone].id;
      if (zid === "montagnes" || zid === "grotte") continue; // la crête suffit, la roche n'a pas d'arbres
      if (R() < 0.8) place(R() < 0.55 ? "tree" : "treeSmall", c);
    }
  }

  // repères uniques — posés avant le reste, sinon le décor dense leur prend la place
  /** `prefer` : emplacement idéal si on en trouve un, sinon on se rabat sur le premier venu */
  const landmark = (kind: PropKind, zid: string, pick: (c: Cell) => boolean, r = 1, prefer?: (c: Cell) => boolean) => {
    const z = ZONES.findIndex((zz) => zz.id === zid);
    const cands = all.filter((c) => c.zone === z && !c.road && pick(c) && free(c.x, c.y, r) && (LOW.has(kind) || !hidesGift(c.x, c.y, r)));
    const c = (prefer && cands.find(prefer)) ?? cands[0];
    if (c) place(kind, c, r);
  };
  // le chalet s'installe sur un replat, pas au bord d'une falaise
  landmark("chalet", "montagnes", (c) => !c.front && c.d > 2 && c.d < 3.5 && c.h > 2, 1, (c) => slopeOf(c) < 0.55);
  landmark("snowman", "saint-nicolas", (c) => c.d > 1.2 && c.d < 2, 0);
  // deux cabanes de pêcheur, au bord de la glace
  const nearLake = (c: Cell) => !c.lake && [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2]].some(([dx, dy]) => cells.get(key(c.x + dx, c.y + dy))?.lake);
  for (let i = 0; i < 2; i++) landmark("house", "lac", (c) => c.d > 1.6 && nearLake(c));
  landmark("bigTree", "marche", (c) => !c.front && c.d > 2.5 && c.d < 4);
  landmark("wheel", "marche", (c) => !c.front && c.d > 4 && c.d < 7);
  landmark("workshop", "pole-nord", (c) => !c.front && c.d > 2.6 && c.d < 4.5, 2);
  // le village du Père Noël : sa maison, le bureau du courrier et l'écurie des rennes autour de la fabrique
  // on les veut groupés : chacun prend la place libre la plus proche de la fabrique, à distance décente
  {
    const ws = props.find((p) => p.kind === "workshop");
    const z = ZONES.findIndex((zz) => zz.id === "pole-nord");
    const near = (kind: PropKind, r: number, dMin: number, dMax: number) => {
      if (!ws) return;
      const cands = all
        .filter((c) => c.zone === z && !c.road && c.d > dMin && c.d < dMax && free(c.x, c.y, r) && !hidesGift(c.x, c.y, r))
        .map((c) => ({ c, k: Math.hypot(c.x - ws.x, c.y - ws.y) }))
        .filter((o) => o.k > 3.2)
        .sort((a, b) => a.k - b.k);
      if (cands[0]) place(kind, cands[0].c, r);
    };
    near("santaHouse", 2, 2.6, 5);
    near("stable", 2, 2.6, 5.5);
    near("postOffice", 1, 2.2, 4.5);
  }
  landmark("sleigh", "pole-nord", (c) => c.d > 1.5 && c.d < 2.5, 0);

  for (const c of all) {
    if (c.road || taken.has(key(c.x, c.y))) continue;
    const z = ZONES[c.zone];
    // `max` : pente tolérée. Depuis que les bâtiments taillent leur terrasse, on peut bâtir sur un terrain
    // nettement plus accidenté qu'avant — sinon les villages se vident sur les coteaux.
    const flatAround = (r: number, max = 0.2) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const o = cells.get(key(c.x + dx, c.y + dy)); if (!o || slopeOf(o) > max || o.road || o.lake) return false; } return true; };
    const steep = slopeOf(c);
    if (steep > 0.9) continue; // falaises : pas de décor
    const d = c.d;
    // près d'une frontière de monde, les constructions se raréfient : chaque monde s'éteint avant le suivant
    const edge = Math.min(1, Math.min(...zoneEdges.map((b) => Math.abs(c.pi - b))) / 4);
    // les patineurs ne sont plus posés ici : ils glissent pour de bon (voir life.ts)
    if (c.lake) continue;
    switch (z.id) {
      case "montagnes": {
        // les sapins s'arrêtent en altitude : plus haut, il n'y a que des rochers
        const high = Math.max(0, Math.min(1, (heightAt(T0, c.x + 0.5, c.y + 0.5) - c.rz - 1.6) / 2.6));
        if (d > 1.2 && R() < (c.front ? 0.18 : 0.42)) place(R() < 0.82 - high * 0.75 ? "tree" : "rock", c);
        else if (d > 1.2 && d < 3 && R() < 0.02) place("deer", c);
        break;
      }
      case "saint-nicolas": {
        // un vrai bourg : des rangées de maisons serrées de part et d'autre de la rue
        const row = (d > 1.55 && d < 3.2 ? 0.95 : d > 3.6 && d < 5.4 ? 0.85 : d > 5.8 && d < 8.5 ? 0.6 : 0) * edge;
        if (row && R() < row && flatAround(0, 0.6) && free(c.x, c.y, 1)) place("house", c, 1);
        // guirlandes tendues au-dessus de la chaussée, et lampadaires le long des trottoirs
        else if (d > 1 && d < 2.2 && R() < 0.5 * edge) place(R() < 0.5 ? "lamp" : "garland", c);
        // du mobilier de rue : bancs, luges contre les murs, sapins décorés, badauds
        else if (d > 1.4 && d < 4.5 && R() < 0.16 * edge) {
          const k = R();
          place(k < 0.34 ? "visitor" : k < 0.52 ? "bench" : k < 0.68 ? "sled" : k < 0.84 ? "presents" : "snowman", c);
        }
        else if (d > 1.4 && R() < 0.16) place(R() < 0.4 ? "tree" : R() < 0.75 ? "treeSmall" : "bush", c);
        break;
      }
      case "lac": {
        // forêt profonde, trouée de clairières ; la densité retombe loin de la route
        const wood = noise2(c.x * 0.15, c.y * 0.15);
        const far = Math.max(0, Math.min(1, (d - 8) / 7));
        const dense = (wood > 0.44 ? 0.95 : 0.3) * (c.front ? 0.55 : 1) * (1 - far * 0.75) * (0.35 + edge * 0.65);
        if (d > 1.8 && d < 6 && R() < 0.05 && flatAround(0) && free(c.x, c.y, 1)) place("house", c, 1);
        else if (d > 1.3 && R() < dense) place(R() < 0.5 ? "tree" : R() < 0.78 ? "treeSmall" : R() < 0.96 ? "bush" : "rock", c);
        else if (d > 1.5 && R() < 0.025) place("deer", c);
        break;
      }
      case "marche": {
        // deux allées d'échoppes collées les unes aux autres, guirlandes au-dessus de la rue
        const aisle = (d > 1.6 && d < 2.6) || (d > 3.6 && d < 4.6);
        if (aisle && R() < 0.72 * edge && free(c.x, c.y, 0)) place("stall", c);
        else if (d > 1 && d < 2.2 && R() < 0.5 * edge) place(R() < 0.45 ? "lamp" : "garland", c);
        else if (d > 1.2 && d < 5 && R() < 0.4 * edge) {
          const k = R();
          place(k < 0.45 ? "visitor" : k < 0.68 ? "brazier" : k < 0.84 ? "presents" : "bench", c);
        }
        else if (d > 5 && d < 9 && R() < 0.55 * edge && flatAround(0, 0.6) && free(c.x, c.y, 1)) place("house", c, 1);
        else if (d > 5 && R() < 0.22) place(R() < 0.55 ? "tree" : R() < 0.8 ? "treeSmall" : "bush", c);
        break;
      }
      case "grotte": {
        // lanternes de glace le long du chemin, cristaux et stalactites sur les parois
        if (d > 1 && d < 2.6 && R() < 0.3) place("iceLantern", c);
        else if (d > 1.3 && R() < (c.front ? 0.45 : 0.8) * edge) {
          const k = R();
          place(k < 0.52 ? "crystal" : k < 0.84 ? "icicle" : "rock", c);
        }
        break;
      }
      case "pole-nord": {
        // le village du Père Noël : igloos, enclos de rennes, piles de cadeaux et lampions
        if (d > 2 && d < 7 && R() < 0.14 * edge && flatAround(0) && free(c.x, c.y, 1)) place("igloo", c, 1);
        else if (d > 1 && d < 1.7 && R() < 0.3 * edge) place(R() < 0.6 ? "lamp" : "cane", c);
        else if (d > 1.8 && d < 5.5 && R() < 0.3 * edge) {
          const k = R();
          place(k < 0.3 ? "deer" : k < 0.5 ? "fence" : k < 0.72 ? "presents" : k < 0.88 ? "visitor" : "tree", c);
        }
        else if (d > 1.3 && R() < 0.14) place(R() < 0.45 ? "cane" : R() < 0.75 ? "tree" : "treeSmall", c);
        break;
      }
    }
  }

  /* ---------- place centrale du village (jeu du 6) ---------- */
  const n6 = nodes.find((n) => n.day === 6);
  if (n6 && ZONES[n6.zone].id === "saint-nicolas") {
    const cx6 = n6.x + 0.5, cy6 = n6.y + 0.5;
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x + 0.5 - cx6, p.y + 0.5 - cy6);
    // on dégage la place : les terrasses des maisons retirées font un beau pavé plat
    for (let i = props.length - 1; i >= 0; i--) if (dist(props[i]) < 3.2) props.splice(i, 1);
    for (const c of cells.values()) if (dist(c) < 3.4) taken.add(key(c.x, c.y));
    const at = (dx: number, dy: number) => cells.get(key(n6.x + dx, n6.y + dy));
    const put = (kind: PropKind, dx: number, dy: number) => {
      const c = at(dx, dy);
      if (c && !c.road) { taken.delete(key(c.x, c.y)); place(kind, c); }
    };
    // le grand sapin derrière la case, jamais devant : il la cacherait (issue #50)
    put("bigTree", -2, -2);
    put("snowman", -2, 1);
    for (const [dx, dy] of [[3, -1], [-1, 3], [-3, -1], [1, -3]] as const) put("lamp", dx, dy);
    for (const [dx, dy] of [[2, -2], [-2, 2], [3, 2], [2, 2]] as const) put("visitor", dx, dy);
  }

  /* ---------- rien de haut devant une case (issue #50) ---------- */
  // Alexandre ne veut perdre aucun décor : le décor est d'abord posé comme si la règle n'existait pas,
  // puis chaque élément haut qui cacherait une case est déplacé à la place libre la plus proche.
  let horsPlace = 0; // décors qu'on n'a pu caser nulle part : doit rester à 0 (sinon, agrandir la carte)
  for (const p of props.slice()) {
    const o = origine.get(p);
    if (!o || LOW.has(p.kind) || !hidesGift(o.c.x, o.c.y, o.r)) continue;
    for (let dx = -o.r; dx <= o.r; dx++) for (let dy = -o.r; dy <= o.r; dy++) taken.delete(key(o.c.x + dx, o.c.y + dy));
    const alt = ailleurs(o.c, o.r);
    if (!alt) {
      horsPlace++;
      for (let dx = -o.r; dx <= o.r; dx++) for (let dy = -o.r; dy <= o.r; dy++) taken.add(key(o.c.x + dx, o.c.y + dy));
      continue;
    }
    props.splice(props.indexOf(p), 1);
    place(p.kind, alt, o.r);
  }

  // voûtes d'entrée et de sortie de la grotte, à cheval sur le chemin. Elles sont hautes : posées juste
  // après une case, elles passeraient devant son cadeau (cône `devant`, 5 pas). On les met donc 6 pas après
  // la case 16 (entrée) et la case 20 (sortie), là où le chemin file encore tout droit.
  const caveZone = ZONES.findIndex((z) => z.id === "grotte");
  if (caveZone >= 0) {
    const jours = nodes.filter((n) => n.zone === caveZone).map((n) => n.day);
    if (jours.length) for (const d of [Math.min(...jours) - 1, Math.max(...jours)]) {
      const n = nodes.find((m) => m.day === d);
      if (!n) continue;
      const p = path[Math.min(path.length - 2, n.idx + 6)];
      // la voûte est percée dans le sens de la marche : on lit la direction sur le chemin
      const nxt = path[p.i + 1];
      props.push({ kind: "caveMouth", x: p.x, y: p.y, z: p.z, zone: caveZone, seed: Math.floor(R() * 1e6), drop: 0, alongX: nxt.x !== p.x });
    }
  }

  /* ---------- lisière sud ----------
   * Au jour 24, la caméra descend sous la fin de la route : sur un téléphone haut, on voyait le bord du monde
   * (une bande bleu foncé en dents de scie, #113). On prolonge le terrain de RANGEES_SUD rangées de neige plate.
   * Ajoutées après coup et avec leur propre tirage : le décor du reste du monde ne change pas. */
  const R2 = rng(seed + 24);
  const fin = path[path.length - 1];
  for (let k = kMax + 1; k <= kMax + RANGEES_SUD; k++) {
    const c0 = center(k);
    const rang: [number, number][] = [];
    for (let u = c0 - HALF_WIDTH; u <= c0 + HALF_WIDTH; u++) if ((u + k) % 2 === 0) rang.push([(k + u) / 2, (k - u) / 2]);
    rang.forEach(([cx, cy], i) => {
      const d = Math.hypot(fin.x - cx, fin.y - cy);
      const bord = Math.min(i, rang.length - 1 - i);
      cells.set(key(cx, cy), { x: cx, y: cy, h: 0, zone: fin.zone, road: false, lake: false, d, front: true, rz: 0, pi: fin.i });
      for (const [dx, dy] of corners) if (!V.has(key(cx + dx, cy + dy))) V.set(key(cx + dx, cy + dy), 0);
      const pousse = (kind: PropKind, jitter: number) =>
        props.push({ kind, x: cx + (R2() - 0.5) * jitter, y: cy + (R2() - 0.5) * jitter, z: 0, zone: fin.zone, seed: Math.floor(R2() * 1e6), drop: 0 });
      // mêmes bords que le reste du monde (issue #13) : lisière au bout de la rangée, forêt serrée derrière
      if (bord === 0) { if (k % 2 === 0) pousse("deepWood", 0); }
      else if (bord < 5) { if (R2() < 0.6) pousse(R2() < 0.6 ? "tree" : "treeSmall", 0.7); }
    });
  }

  /* ---------- le bout du monde : place du pôle Nord, piste d'envol, puis la forêt (choix d'Alexandre) ----------
   * Place carrée de 5 × 5 cases juste sous la fin de la route (un losange à l'écran), poteau au centre.
   * La piste part de son coin bas (sous le poteau, au milieu de l'écran), vers le bas à gauche, sur 3 cases de large
   * et 6 de long : plus longue, elle sortait de l'écran du téléphone. */
  const PX = fin.x + 1, PY = fin.y + 1; // coin haut de la place
  const piste = { x0: PX + 2, x1: PX + 4, y0: PY + 5, y1: PY + 10 };
  const dansPlace = (x: number, y: number) => x >= PX && x <= PX + 4 && y >= PY && y <= PY + 4;
  const dansPiste = (x: number, y: number) => x >= piste.x0 && x <= piste.x1 && y >= piste.y0 && y <= piste.y1;
  // réservé : la scène et une case de marge, plus le passage entre la route et la place
  const reserve = (x: number, y: number) =>
    (x >= PX - 2 && x <= PX + 5 && y >= PY - 1 && y <= PY + 5) || (x >= piste.x0 - 2 && x <= piste.x1 + 5 && y >= piste.y0 - 1 && y <= piste.y1 + 1);
  for (const c of cells.values()) {
    if (dansPlace(c.x, c.y)) c.sol = "place";
    else if (dansPiste(c.x, c.y)) c.sol = "piste";
  }
  const passage = cells.get(key(PX, PY - 1));
  if (passage) passage.sol = "place";
  // le décor déjà posé sur la scène s'en va (sans tirage : le reste du monde ne bouge pas)
  for (let i = props.length - 1; i >= 0; i--) {
    const pr = props[i];
    if (reserve(Math.floor(pr.x + 0.5), Math.floor(pr.y + 0.5)) && pr.kind !== "sleigh") props.splice(i, 1);
  }
  const met = (kind: PropKind, x: number, y: number, drop = 0) =>
    props.push({ kind, x, y, z: heightAt(T0, x + 0.5, y + 0.5), zone: fin.zone, seed: Math.floor(R2() * 1e6), drop });
  // la place : le poteau, le grand sapin, des lampadaires aux coins, braseros, bancs et visiteurs
  met("poleNord", PX + 2, PY + 2);
  met("bigTree", PX - 0.5, PY + 4.2);
  for (const [x, y] of [[PX - 0.6, PY + 0.4], [PX + 0.4, PY - 0.6], [PX + 4.6, PY - 0.4], [PX + 4.6, PY + 4.6]]) met("lamp", x, y);
  met("brazier", PX + 3.4, PY + 0.8);
  met("brazier", PX + 0.9, PY + 2.1);
  met("bench", PX + 3.6, PY + 3.4);
  met("bench", PX + 1.4, PY + 0.4);
  for (const [x, y] of [[PX + 3, PY + 1.2], [PX + 1.2, PY + 2.8], [PX + 2.9, PY + 3.1], [PX + 3.9, PY + 1.9]]) met("visitor", x, y);
  met("snowman", PX + 5.6, PY + 3.2);
  // la piste : un attelage de rennes au départ, des lanternes tout du long, l'écurie à côté
  // le traîneau du Père Noël attend au bas de la piste, tourné vers la place (choix d'Alexandre) : le 24,
  // il remonte la piste et s'envole vers le haut à droite, au-dessus du poteau du pôle Nord.
  // À son ancienne place, devant chez le Père Noël, une pile de cadeaux que les lutins continuent d'apporter.
  const traineau = props.find((pr) => pr.kind === "sleigh");
  if (traineau) {
    T0.depot = { x: traineau.x, y: traineau.y };
    props.push({ ...traineau, kind: "presents", seed: Math.floor(R2() * 1e6) });
    Object.assign(traineau, { x: piste.x0 + 1, y: piste.y1 - 0.6, z: heightAt(T0, piste.x0 + 1.5, piste.y1 - 0.1), drop: 0 });
  }
  // l'attelage, devant lui (vers la place)
  for (let r = 0; r < 3; r++) for (const dx of [-0.45, 0.45]) {
    met("deer", piste.x0 + 1 + dx, piste.y1 - 2.1 - r * 1.2);
    props[props.length - 1].attelage = true;
  }
  for (let y = piste.y0 + 1; y <= piste.y1; y += 2) { met("iceLantern", piste.x0 - 0.7, y); met("iceLantern", piste.x1 + 0.7, y); }
  met("stable", piste.x1 + 3.2, piste.y0 + 4);
  met("presents", piste.x0 - 1.6, piste.y0 + 0.2);
  met("brazier", piste.x1 + 1.6, piste.y1 + 0.6);

  T0.bout = { x: (piste.x0 + piste.x1) / 2 + 0.5, y: piste.y1 + 1 };

  /* ---------- fond sud : la forêt s'épaissit en descendant, jusqu'aux bosquets serrés tout en bas ---------- */
  const kFin = fin.x + fin.y, kBas = kMax + RANGEES_SUD;
  const occupe = new Set(taken);
  for (const pr of props) occupe.add(key(Math.floor(pr.x + 0.5), Math.floor(pr.y + 0.5)));
  for (const c of cells.values()) {
    const k = c.x + c.y;
    if (k <= kFin + 1 || c.road || c.lake || occupe.has(key(c.x, c.y)) || reserve(c.x, c.y)) continue;
    if (Math.hypot(fin.x - c.x, fin.y - c.y) < 2.5) continue;
    const t = (k - kFin) / (kBas - kFin); // 0 juste sous la route, 1 tout en bas
    const pose = (kind: PropKind, jitter = 0.7) => {
      const x = c.x + (R2() - 0.5) * jitter, y = c.y + (R2() - 0.5) * jitter;
      props.push({ kind, x, y, z: heightAt(T0, x + 0.5, y + 0.5), zone: c.zone, seed: Math.floor(R2() * 1e6), drop: 0 });
    };
    if (t > 0.55 && R2() < 0.14) pose("deepWood", 0);
    else if (R2() < 0.1 + 0.5 * t) { const r = R2(); pose(r < 0.55 ? "tree" : r < 0.85 ? "treeSmall" : "bush"); }
  }

  T0.props = props;
  if (horsPlace) console.warn(`[monde] ${horsPlace} décor(s) sans place hors des cônes des cases : agrandir la carte`);
  return T0;
}
