// Génère le plan du monde : route, îlots, emplacements des cases et des décors
import { ZONES, DAYS_PER_ZONE } from "./zones";
import type { PropKind } from "./props";

export type PathCell = { x: number; y: number; zone: number; bridge: boolean };
export type DayNode = { day: number; idx: number; x: number; y: number; zone: number };
export type IslandCell = { x: number; y: number; zone: number; lake: boolean; edgeNoise: number };
export type PlacedProp = { kind: PropKind; x: number; y: number; zone: number; seed: number };
export type Layout = { path: PathCell[]; nodes: DayNode[]; island: Map<string, IslandCell>; props: PlacedProp[] };

const SEG = 4, BRIDGE = 7, LEAD = 3;
export const key = (x: number, y: number) => `${x},${y}`;

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLayout(seed = 2026): Layout {
  const R = rng(seed);
  const path: PathCell[] = [];
  const nodes: DayNode[] = [];
  let x = 0, y = 0, dirX = true, zone = 0;
  path.push({ x, y, zone, bridge: false });
  const step = (bridge: boolean) => { if (dirX) x++; else y++; path.push({ x, y, zone, bridge }); };
  for (let i = 0; i < LEAD; i++) step(false);
  for (let day = 1; day <= 24; day++) {
    for (let i = 0; i < SEG; i++) step(false);
    nodes.push({ day, idx: path.length - 1, x, y, zone });
    dirX = !dirX;
    if (day % DAYS_PER_ZONE === 0 && day < 24) {
      for (let i = 0; i < BRIDGE; i++) step(true);
      zone++;
    }
  }
  for (let i = 0; i < 3; i++) step(false); // petite fin de route

  // --- îlots ---
  const zonePaths = ZONES.map((_, z) => path.filter((c) => c.zone === z && !c.bridge));
  const island = new Map<string, IslandCell>();
  const dist = (ax: number, ay: number, cells: PathCell[]) => Math.min(...cells.map((c) => Math.hypot(c.x - ax, c.y - ay)));
  const minX = Math.min(...path.map((c) => c.x)) - 5, maxX = Math.max(...path.map((c) => c.x)) + 5;
  const minY = Math.min(...path.map((c) => c.y)) - 5, maxY = Math.max(...path.map((c) => c.y)) + 5;
  const noise = new Map<string, number>();
  for (let cx = minX; cx <= maxX; cx++) for (let cy = minY; cy <= maxY; cy++) noise.set(key(cx, cy), R());
  const smooth = (cx: number, cy: number) => {
    let s = 0, n = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const v = noise.get(key(cx + dx, cy + dy)); if (v != null) { s += v; n++; } }
    return s / n;
  };
  const distTo = new Map<string, number>();
  for (let cx = minX; cx <= maxX; cx++) for (let cy = minY; cy <= maxY; cy++) {
    let best = Infinity, bz = -1;
    zonePaths.forEach((cells, z) => { const d = dist(cx, cy, cells); if (d < best) { best = d; bz = z; } });
    const radius = 2.3 + smooth(cx, cy) * 1.1;
    if (best <= radius) {
      island.set(key(cx, cy), { x: cx, y: cy, zone: bz, lake: false, edgeNoise: smooth(cx, cy) });
      distTo.set(key(cx, cy), best);
    }
  }

  // --- lac gelé ---
  ZONES.forEach((zdef, z) => {
    if (!zdef.lake) return;
    const cands = [...island.values()].filter((c) => c.zone === z && (distTo.get(key(c.x, c.y)) ?? 0) >= 2);
    const center = cands[Math.floor(cands.length / 2)];
    if (!center) return;
    for (const c of island.values()) {
      if (c.zone === z && Math.hypot(c.x - center.x, c.y - center.y) <= 1.9 && (distTo.get(key(c.x, c.y)) ?? 0) >= 1) c.lake = true;
    }
  });

  // --- décors ---
  const onPath = new Set(path.map((c) => key(c.x, c.y)));
  const taken = new Set<string>();
  const props: PlacedProp[] = [];
  const BIG: PropKind[] = ["mountain", "wheel", "workshop", "bigTree", "chalet"];
  const free = (cx: number, cy: number, r: number) => {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (taken.has(key(cx + dx, cy + dy))) return false;
    return true;
  };
  const place = (kind: PropKind, c: IslandCell, r: number) => {
    props.push({ kind, x: c.x, y: c.y, zone: c.zone, seed: Math.floor(R() * 1e6) });
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) taken.add(key(c.x + dx, c.y + dy));
  };
  ZONES.forEach((zdef, z) => {
    const cells = [...island.values()].filter((c) => c.zone === z && !onPath.has(key(c.x, c.y)));
    const shuffled = cells.map((c) => ({ c, r: R() })).sort((a, b) => a.r - b.r).map((o) => o.c);
    for (const kind of zdef.landmarks) {
      const big = BIG.includes(kind);
      const want = (c: IslandCell) => {
        const d = distTo.get(key(c.x, c.y)) ?? 0;
        if (kind === "skater") return c.lake;
        if (c.lake) return false;
        return kind === "mountain" ? d >= 2.6 : big ? d >= 2 : d >= 1.2;
      };
      const c = shuffled.find((c) => want(c) && free(c.x, c.y, big ? 1 : 0));
      if (c) place(kind, c, big ? 1 : 0);
    }
    const total = zdef.props.reduce((s, p) => s + p.weight, 0);
    for (const c of shuffled) {
      if (c.lake || taken.has(key(c.x, c.y))) continue;
      const d = distTo.get(key(c.x, c.y)) ?? 0;
      if (d < 1 || R() > 0.42) continue;
      let pick = R() * total, kind = zdef.props[0].kind;
      for (const p of zdef.props) { pick -= p.weight; if (pick <= 0) { kind = p.kind; break; } }
      place(kind, c, 0);
    }
  });

  return { path, nodes, island, props };
}
