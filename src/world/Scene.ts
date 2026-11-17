// Scène PixiJS : terrain continu isométrique, caméra liée au défilement, ambiance, personnages
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { P, ZH, mix, poly, makePalette, type Palette, type Pt } from "./iso";
import { buildTerrain, heightAt, key, type Terrain, type DayNode } from "./terrain";
import { drawProp } from "./props";
import { ZONES } from "./zones";
import { Person, Penguin, type Who } from "./actors";

export type NodeState = "locked" | "available" | "opened";
export type SceneCallbacks = {
  onNodeTap: (day: number) => void;
  onZone: (zoneIndex: number) => void;
};

const GIFT_COLORS = [0xd9354b, 0x2fa37a, 0x3f7fb5, 0xf0a33a, 0x8e4fb5, 0xe0607a];
const ROAD = 0x3b3340;

function gradientTexture(stops: [number, string][], h = 256) {
  const cv = document.createElement("canvas");
  cv.width = 4; cv.height = h;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, h);
  return Texture.from(cv);
}
function cloudTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 110;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  for (const [x, y, r] of [[60, 70, 34], [105, 52, 44], [158, 60, 38], [196, 74, 28], [128, 80, 34]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return Texture.from(cv);
}

export class Scene {
  app: Application;
  cb: SceneCallbacks;
  terrain: Terrain = buildTerrain();
  world = new Container();
  ground = new Container();
  objects = new Container();
  tint = new Graphics();
  fog = new Sprite();
  clouds: { s: Sprite; v: number; base: number }[] = [];
  cloudLayer = new Container();
  snowLayer = new Container();
  whiteout = new Graphics();
  pal: Palette;
  scale = 1;
  minY = 0;
  maxY = 0;
  padTop = 120;
  scrollY = 0;
  camX = 0;
  people: Record<Who, Person> = {} as Record<Who, Person>;
  pos: Record<Who, number> = { alexandre: 0, flavie: 0 };
  penguin!: Penguin;
  penguinPos = 0;
  leader: Who = "alexandre";
  gifts = new Map<number, Container>();
  states = new Map<number, NodeState>();
  flakes: { s: Sprite; vy: number; ph: number; z: number }[] = [];
  zoneNow = -1;
  time = 0;
  boundaries: number[] = [];

  constructor(app: Application, cb: SceneCallbacks, night: boolean) {
    this.app = app;
    this.cb = cb;
    this.pal = makePalette(night);
    this.objects.sortableChildren = true;
    this.world.addChild(this.ground, this.objects);
    this.fog.texture = gradientTexture([[0, "rgba(255,255,255,0)"], [0.55, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,1)"]]);
    const ct = cloudTexture();
    for (let i = 0; i < 7; i++) {
      const s = new Sprite(ct);
      s.anchor.set(0.5);
      const sc = 0.8 + Math.random() * 1.6;
      s.scale.set(sc, sc * 0.8);
      s.x = Math.random() * innerWidth; s.y = Math.random() * innerHeight;
      this.cloudLayer.addChild(s);
      this.clouds.push({ s, v: 0.15 + Math.random() * 0.35, base: s.y });
    }
    app.stage.addChild(this.world, this.tint, this.fog, this.cloudLayer, this.whiteout, this.snowLayer);
    const flakeTex = app.renderer.generateTexture(new Graphics().circle(6, 6, 6).fill(0xffffff));
    for (let i = 0; i < 260; i++) {
      const s = new Sprite(flakeTex);
      s.anchor.set(0.5);
      const z = Math.random();
      s.scale.set(0.18 + z * 0.4);
      s.alpha = 0.45 + z * 0.55;
      s.x = Math.random() * innerWidth; s.y = Math.random() * innerHeight;
      this.snowLayer.addChild(s);
      this.flakes.push({ s, vy: 0.6 + z * 1.4, ph: Math.random() * 6, z });
    }
    const L = this.terrain.path;
    for (let i = 1; i < L.length; i++) if (L[i].zone !== L[i - 1].zone) this.boundaries.push(P(L[i].x + 0.5, L[i].y + 0.5).y);
    this.build();
    app.ticker.add((t) => this.tick(t.deltaTime));
  }

  get worldHeight() { return (this.maxY - this.minY) * this.scale + this.padTop + innerHeight * 0.5; }
  setNight(night: boolean) { this.pal = makePalette(night); this.build(); }
  setStates(states: Map<number, NodeState>) { this.states = states; this.build(); }

  /* ------------------------------------------------------------------ */
  build() {
    this.ground.removeChildren().forEach((c) => c.destroy());
    this.objects.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.gifts.clear();
    const { cells, path, props, nodes } = this.terrain;
    const c = this.pal.c;
    const g = new Graphics();
    const list = [...cells.values()].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
    const V = this.terrain.V;
    const hv = (x: number, y: number) => V.get(key(x, y)) ?? 0;
    // lumière venant de l'arrière-gauche : les faces tournées vers la gauche sont claires
    const Lx = -0.35, Ly = 0.55, Lz = 0.76;
    const flatB = Lz;
    const SHADOW = 0x9aa2d2;      // ombre de la neige : lavande froide
    const ROCK_SHADOW = 0x5d668f; // ombre de la roche : violet, mais qui garde de la matière
    const ROCK_T = 0.5;           // au-delà de cette pente, c'est de la roche
    const face = (pts: [number, number, number][], cell: typeof list[number]) => {
      const [a, b, d] = pts;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = (b[2] - a[2]) * 1.1;
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = (d[2] - a[2]) * 1.1;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const bright = nx * Lx + ny * Ly + nz * Lz - flatB;
      const steep = 1 - nz;
      const zdef = ZONES[cell.zone];
      let col: number;
      if (cell.lake) col = 0xbfe4f0;
      else if (steep > ROCK_T) {
        // roche : seuil franc sur la pente, sans tache au hasard.
        // juste au-dessus du seuil, un liseré de neige poudreuse accroche l'arête
        const dust = Math.max(0, 1 - (steep - ROCK_T) / 0.09);
        const base = mix(zdef.atmo.rock, 0xe9edf8, dust * 0.5);
        col = bright < 0
          ? mix(base, ROCK_SHADOW, Math.min(0.5, -bright * 1.7))
          : mix(base, 0xffffff, Math.min(0.55, bright * 1.9));
      } else {
        // neige : modelé très doux, elle doit rester lisse
        const base = zdef.ground;
        col = bright < 0
          ? mix(base, SHADOW, Math.min(0.42, -bright * 1.5))
          : mix(base, 0xffffff, Math.min(0.35, bright * 1.2));
      }
      poly(g, pts.map(([x, y, z]) => P(x, y, z)), c(col));
      g.poly(pts.flatMap(([x, y, z]) => { const q = P(x, y, z); return [q.x, q.y]; }), true).stroke({ width: 0.8, color: c(col) });
    };
    for (const cell of list) {
      const { x, y } = cell;
      const A: [number, number, number] = [x, y, hv(x, y)], B: [number, number, number] = [x + 1, y, hv(x + 1, y)];
      const C: [number, number, number] = [x + 1, y + 1, hv(x + 1, y + 1)], D: [number, number, number] = [x, y + 1, hv(x, y + 1)];
      face([A, B, C], cell);
      face([A, C, D], cell);
      if (cell.lake && (x + y) % 3 === 0) poly(g, [P(x + 0.2, y + 0.3, 0), P(x + 0.6, y + 0.1, 0), P(x + 0.65, y + 0.18, 0), P(x + 0.25, y + 0.38, 0)], c(0xeaf8fd));
    }
    // route posée sur le relief
    const T = this.terrain;
    const H = (x: number, y: number) => heightAt(T, x, y) + 0.01;
    const quad = (pts: [number, number][], col: number, alpha = 1) => poly(g, pts.map(([x, y]) => P(x, y, H(x, y))), c(col), alpha);
    const hw = 0.3;
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const onLake = cells.get(key(a.x, a.y))?.lake;
      const col = onLake ? 0x9fd0e2 : ROAD;
      const ax = a.x + 0.5, ay = a.y + 0.5;
      quad([[ax - hw, ay - hw], [ax + hw, ay - hw], [ax + hw, ay + hw], [ax - hw, ay + hw]], col);
      if (!b) continue;
      const along = b.x !== a.x;
      // segment découpé en petits morceaux pour suivre la pente
      for (let s2 = 0; s2 < 4; s2++) {
        const t0 = hw + (1 - 2 * hw) * (s2 / 4), t1 = hw + (1 - 2 * hw) * ((s2 + 1) / 4);
        if (along) quad([[ax + t0, ay - hw], [ax + t1, ay - hw], [ax + t1, ay + hw], [ax + t0, ay + hw]], col);
        else quad([[ax - hw, ay + t0], [ax + hw, ay + t0], [ax + hw, ay + t1], [ax - hw, ay + t1]], col);
      }
      if (!onLake) {
        if (along) quad([[ax + 0.38, ay - 0.04], [ax + 0.62, ay - 0.04], [ax + 0.62, ay + 0.04], [ax + 0.38, ay + 0.04]], 0xf3eee6, 0.75);
        else quad([[ax - 0.04, ay + 0.38], [ax + 0.04, ay + 0.38], [ax + 0.04, ay + 0.62], [ax - 0.04, ay + 0.62]], 0xf3eee6, 0.75);
      } else if (i % 2 === 0) {
        const p1 = P(ax - 0.1, ay - 0.1, 0), p2 = P(ax + 0.2, ay + 0.15, 0);
        g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ width: 1.5, color: c(0xffffff), alpha: 0.8 });
      }
    }
    this.ground.addChild(g);

    for (const p of props) {
      const o = drawProp(p.kind, p.x, p.y, this.pal, p.seed);
      o.y = -p.z * ZH;
      o.zIndex = p.x + p.y + (p.kind === "mountain" ? -1.4 : p.kind === "wheel" || p.kind === "workshop" ? -0.6 : 0.5);
      this.objects.addChild(o);
    }
    for (const n of nodes) this.objects.addChild(this.makeGift(n));
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const p = new Person(who, this.pal);
      this.people[who] = p;
      this.objects.addChild(p);
    }
    this.penguin = new Penguin(this.pal);
    this.objects.addChild(this.penguin);

    const ys = path.map((p) => P(p.x, p.y).y);
    this.minY = Math.min(...ys) - 260;
    this.maxY = Math.max(...ys) + 160;
    this.resize();
    this.placeActors();
  }

  makeGift(n: DayNode) {
    const st = this.states.get(n.day) ?? "locked";
    const c = this.pal.c;
    const cont = new Container();
    const inner = new Container();
    const base = st === "locked" ? 0xaab3c5 : GIFT_COLORS[n.day % GIFT_COLORS.length];
    const col = c(base), dark = c(mix(base, 0x000000, 0.22)), light = c(mix(base, 0xffffff, 0.15));
    const rib = c(st === "locked" ? 0xe6e9f0 : 0xffd66b);
    const g = new Graphics();
    const glow = new Graphics();
    if (st === "available") glow.ellipse(0, 0, 46, 22).fill({ color: 0xffd66b, alpha: 0.45 });
    const s = 0.5, x0 = n.x + 0.5 - s / 2, y0 = n.y + 0.5 - s / 2;
    const o = P(n.x + 0.5, n.y + 0.5);
    const rel = (p: Pt) => ({ x: p.x - o.x, y: p.y - o.y });
    const R = (gr: Graphics, pts: Pt[], color: number) => gr.poly(pts.map(rel).flatMap((p) => [p.x, p.y])).fill(color);
    const h = 0.55;
    R(g, [P(x0, y0 + s, h), P(x0 + s, y0 + s, h), P(x0 + s, y0 + s, 0), P(x0, y0 + s, 0)], col);
    R(g, [P(x0 + s, y0, h), P(x0 + s, y0 + s, h), P(x0 + s, y0 + s, 0), P(x0 + s, y0, 0)], dark);
    const m = s / 2, rw = 0.05;
    R(g, [P(x0 + m - rw, y0 + s, h), P(x0 + m + rw, y0 + s, h), P(x0 + m + rw, y0 + s, 0), P(x0 + m - rw, y0 + s, 0)], rib);
    R(g, [P(x0 + s, y0 + m - rw, h), P(x0 + s, y0 + m + rw, h), P(x0 + s, y0 + m + rw, 0), P(x0 + s, y0 + m - rw, 0)], mix(rib, 0x000000, 0.12));
    const lid = new Graphics();
    const lx = x0 - 0.04, ly = y0 - 0.04, ls = s + 0.08, lh = 0.14;
    R(lid, [P(lx, ly + ls, h + lh), P(lx + ls, ly + ls, h + lh), P(lx + ls, ly + ls, h), P(lx, ly + ls, h)], light);
    R(lid, [P(lx + ls, ly, h + lh), P(lx + ls, ly + ls, h + lh), P(lx + ls, ly + ls, h), P(lx + ls, ly, h)], col);
    R(lid, [P(lx, ly, h + lh), P(lx + ls, ly, h + lh), P(lx + ls, ly + ls, h + lh), P(lx, ly + ls, h + lh)], c(mix(base, 0xffffff, 0.3)));
    R(lid, [P(lx + ls / 2 - rw, ly, h + lh), P(lx + ls / 2 + rw, ly, h + lh), P(lx + ls / 2 + rw, ly + ls, h + lh), P(lx + ls / 2 - rw, ly + ls, h + lh)], rib);
    R(lid, [P(lx, ly + ls / 2 - rw, h + lh), P(lx + ls, ly + ls / 2 - rw, h + lh), P(lx + ls, ly + ls / 2 + rw, h + lh), P(lx, ly + ls / 2 + rw, h + lh)], rib);
    const top = rel(P(n.x + 0.5, n.y + 0.5, h + lh));
    lid.ellipse(top.x - 7, top.y - 4, 7, 4.5).stroke({ width: 3.5, color: rib });
    lid.ellipse(top.x + 7, top.y - 4, 7, 4.5).stroke({ width: 3.5, color: rib });
    lid.circle(top.x, top.y - 3, 3).fill(rib);
    if (st === "opened") { lid.x = 16; lid.y = -18; lid.rotation = 0.35; }
    const label = new Container();
    const txt = new Text({ text: String(n.day), style: { fontFamily: "Fredoka", fontWeight: "700", fontSize: 20, fill: st === "locked" ? 0x5b6680 : 0xffffff } });
    txt.anchor.set(0.5);
    const pill = new Graphics().roundRect(-20, -15, 40, 30, 15).fill(st === "locked" ? 0xffffff : st === "opened" ? 0x2fa37a : 0xd9354b);
    label.addChild(pill, txt);
    if (st === "opened") label.addChild(new Graphics().star(20, -14, 5, 8, 3.5).fill(0xffd66b));
    if (st === "locked") label.addChild(new Graphics().roundRect(10, -20, 14, 11, 3).fill(0x5b6680).circle(17, -21, 4.5).stroke({ width: 2.4, color: 0x5b6680 }));
    label.y = top.y - 48;
    inner.addChild(g, lid, label);
    cont.addChild(glow, inner);
    cont.position.set(o.x, o.y - heightAt(this.terrain, n.x + 0.5, n.y + 0.5) * ZH);
    cont.zIndex = n.x + n.y + 0.55;
    cont.eventMode = "static";
    cont.cursor = "pointer";
    cont.on("pointertap", () => this.cb.onNodeTap(n.day));
    (cont as Container & { meta: object }).meta = { inner, glow, st };
    this.gifts.set(n.day, cont);
    return cont;
  }

  /* --------------------------- personnages --------------------------- */
  pointAt(t: number, offset: number) {
    const L = this.terrain.path;
    const i = Math.max(0, Math.min(L.length - 1.001, t));
    const a = L[Math.floor(i)], b = L[Math.min(L.length - 1, Math.floor(i) + 1)];
    const f = i - Math.floor(i);
    const gx = a.x + (b.x - a.x) * f + 0.5 + offset, gy = a.y + (b.y - a.y) * f + 0.5 - offset;
    const z = heightAt(this.terrain, gx, gy);
    const zone = ZONES[a.zone].id;
    return { p: P(gx, gy, z), depth: gx + gy, right: b.x !== a.x, slope: b.z - a.z, zone, lake: !!this.terrain.cells.get(key(a.x, a.y))?.lake };
  }

  placeActors() {
    const off: Record<Who, number> = { alexandre: 0.2, flavie: -0.2 };
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const pt = this.pointAt(this.pos[who], off[who]);
      const p = this.people[who];
      p.position.set(pt.p.x, pt.p.y);
      p.zIndex = pt.depth + 0.3;
      if (p.walking) p.face(pt.right);
      p.setRide(p.walking ? (pt.lake ? "skates" : pt.zone === "montagnes" && pt.slope < 0 ? "sled" : null) : null);
    }
    const pg = this.pointAt(this.penguinPos, 0);
    this.penguin.position.set(pg.p.x, pg.p.y);
    this.penguin.zIndex = pg.depth + 0.3;
  }

  nodeIndex(day: number) { return this.terrain.nodes[day - 1].idx; }
  setPosition(who: Who, day: number) { this.pos[who] = day ? this.nodeIndex(day) - 0.6 : 0; }

  walkTo(who: Who, day: number): Promise<void> {
    this.leader = who;
    const target = this.nodeIndex(day) - 0.6;
    const p = this.people[who];
    return new Promise((res) => {
      p.walking = 1;
      const step = () => {
        const d = target - this.pos[who];
        if (Math.abs(d) < 0.08) { this.pos[who] = target; p.walking = 0; res(); return; }
        const pt = this.pointAt(this.pos[who], 0);
        const speed = pt.lake ? 0.16 : pt.slope < 0 && pt.zone === "montagnes" ? 0.2 : pt.slope > 0 ? 0.06 : 0.09;
        this.pos[who] += Math.sign(d) * Math.min(Math.abs(d), speed);
        requestAnimationFrame(step);
      };
      step();
    });
  }

  /* ------------------------------ caméra ----------------------------- */
  resize() {
    this.scale = Math.max(0.62, Math.min(1.25, innerWidth / 560));
    this.world.scale.set(this.scale);
    this.padTop = Math.min(300, innerHeight * 0.36);
    this.fog.width = innerWidth; this.fog.height = innerHeight * 0.75; this.fog.y = innerHeight * 0.25;
  }
  setScroll(y: number) { this.scrollY = y; }
  focusWorldY() { return (this.scrollY + innerHeight * 0.55 - this.padTop) / this.scale + this.minY; }
  scrollForDay(day: number) {
    const n = this.terrain.nodes[day - 1];
    const wy = P(n.x + 0.5, n.y + 0.5, heightAt(this.terrain, n.x + 0.5, n.y + 0.5)).y;
    return (wy - this.minY) * this.scale + this.padTop - innerHeight * 0.55;
  }
  zoneMix(wy: number) {
    for (let i = 0; i < this.boundaries.length; i++) {
      const b = this.boundaries[i];
      if (wy < b + 180) {
        const t = Math.max(0, Math.min(1, (wy - (b - 180)) / 360));
        return { a: i, b: i + 1, t: t * t * (3 - 2 * t) };
      }
    }
    const last = ZONES.length - 1;
    return { a: last, b: last, t: 0 };
  }

  tick(dt: number) {
    this.time += dt;
    const fy = this.focusWorldY();
    const L = this.terrain.path;
    let best = L[0], bd = Infinity;
    for (const c of L) { const d = Math.abs(P(c.x + 0.5, c.y + 0.5, c.z).y - fy); if (d < bd) { bd = d; best = c; } }
    const tx = innerWidth / 2 - P(best.x + 0.5, best.y + 0.5).x * this.scale;
    if (!this.camX) this.camX = tx;
    this.camX += (tx - this.camX) * Math.min(1, 0.05 * dt);
    this.world.x = this.camX;
    this.world.y = -this.scrollY + this.padTop - this.minY * this.scale;

    // ambiance
    const zm = this.zoneMix(fy);
    const za = ZONES[zm.a], zb = ZONES[zm.b];
    const lerp = (a: number, b: number) => a + (b - a) * zm.t;
    const zi = zm.t < 0.5 ? zm.a : zm.b;
    if (zi !== this.zoneNow) { this.zoneNow = zi; this.cb.onZone(zi); }
    const night = this.pal.night;
    const tintCol = mix(za.atmo.tint, zb.atmo.tint, zm.t);
    this.tint.clear().rect(0, 0, innerWidth, innerHeight).fill({ color: night ? 0x0b1030 : tintCol, alpha: night ? 0.12 : lerp(za.atmo.tintAlpha, zb.atmo.tintAlpha) });
    this.fog.tint = night ? 0x2a3566 : mix(za.atmo.fogColor, zb.atmo.fogColor, zm.t);
    this.fog.alpha = lerp(za.atmo.fog, zb.atmo.fog) * (night ? 0.7 : 1);
    // les nuages passent surtout en altitude (le col des montagnes)
    const alt = Math.min(1, best.z / 3);
    const cloudAmt = lerp(za.atmo.clouds, zb.atmo.clouds) * (0.35 + alt * 0.65);
    for (const cl of this.clouds) {
      cl.s.x += cl.v * dt;
      if (cl.s.x > innerWidth + 200) { cl.s.x = -200; cl.base = Math.random() * innerHeight; }
      cl.s.y = cl.base + Math.sin(this.time * 0.01 + cl.v * 10) * 10;
      cl.s.alpha = cloudAmt * 0.22;
      cl.s.tint = night ? 0x55608f : 0xffffff;
    }
    // neige
    const density = lerp(za.weather.snow, zb.weather.snow), wind = lerp(za.weather.wind, zb.weather.wind), speed = lerp(za.weather.speed, zb.weather.speed);
    const active = Math.floor(Math.min(1, density / 1.6) * this.flakes.length);
    this.flakes.forEach((f, i) => {
      f.s.visible = i < active;
      if (!f.s.visible) return;
      f.ph += 0.02 * dt;
      f.s.y += f.vy * speed * dt;
      f.s.x += (Math.sin(f.ph) * 0.4 + wind * (1 + f.z) * 1.6) * dt;
      if (f.s.y > innerHeight + 10) { f.s.y = -10; f.s.x = Math.random() * innerWidth; }
      if (f.s.x > innerWidth + 10) f.s.x = -10;
      if (f.s.x < -10) f.s.x = innerWidth + 10;
    });
    this.whiteout.clear();
    const wo = Math.max(0, density - 1) * 0.25;
    if (wo > 0.01) this.whiteout.rect(0, 0, innerWidth, innerHeight).fill({ color: 0xffffff, alpha: wo });

    for (const [, cont] of this.gifts) {
      const meta = (cont as Container & { meta: { inner: Container; glow: Graphics; st: NodeState } }).meta;
      if (meta.st === "available") {
        meta.inner.y = -Math.abs(Math.sin(this.time * 0.07)) * 8;
        meta.glow.alpha = 0.55 + Math.sin(this.time * 0.07) * 0.35;
      }
    }
    const target = this.pos[this.leader] - 1.1;
    const d = target - this.penguinPos;
    this.penguin.walking = Math.abs(d) > 0.05 ? 1 : 0;
    this.penguinPos += Math.sign(d) * Math.min(Math.abs(d), 0.12 * dt);
    this.placeActors();
    for (const who of ["alexandre", "flavie"] as Who[]) this.people[who].update(dt);
    this.penguin.update(dt);
  }
}
