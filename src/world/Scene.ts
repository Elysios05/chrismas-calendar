// Scène PixiJS : monde isométrique, caméra liée au défilement, météo, personnages
import { Application, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { P, TH, box, mix, poly, makePalette, type Palette, type Pt } from "./iso";
import { buildLayout, key, type Layout, type DayNode } from "./layout";
import { drawProp } from "./props";
import { ZONES } from "./zones";
import { Person, Penguin, type Who } from "./actors";

export type NodeState = "locked" | "available" | "opened";
export type SceneCallbacks = {
  onNodeTap: (day: number) => void;
  onZone: (zoneIndex: number) => void;
  onBg: (css: string) => void;
};

const GIFT_COLORS = [0xd9354b, 0x2fa37a, 0x3f7fb5, 0xf0a33a, 0x8e4fb5, 0xe0607a];

export class Scene {
  layout: Layout = buildLayout();
  world = new Container();
  ground = new Container();
  objects = new Container();
  snowLayer = new Container();
  fog = new Graphics();
  pal: Palette;
  scale = 1;
  minY = 0;
  maxY = 0;
  padTop = 120;
  scrollY = 0;
  camX = 0;
  people: Record<Who, Person> = {} as Record<Who, Person>;
  pos: Record<Who, number> = { alexandre: 0, flavie: 0 }; // index (réel) sur la route
  penguin!: Penguin;
  penguinPos = 0;
  leader: Who = "alexandre";
  gifts = new Map<number, Container>();
  states = new Map<number, NodeState>();
  flakes: { s: Sprite; vx: number; vy: number; ph: number; z: number }[] = [];
  flakeTex!: Texture;
  zoneNow = -1;
  time = 0;
  boundaries: number[] = []; // y (monde) des frontières entre zones

  app: Application;
  cb: SceneCallbacks;

  constructor(app: Application, cb: SceneCallbacks, night: boolean) {
    this.app = app;
    this.cb = cb;
    this.pal = makePalette(night);
    this.objects.sortableChildren = true;
    this.world.addChild(this.ground, this.objects);
    app.stage.addChild(this.world, this.fog, this.snowLayer);
    this.flakeTex = app.renderer.generateTexture(new Graphics().circle(6, 6, 6).fill(0xffffff));
    for (let i = 0; i < 260; i++) {
      const s = new Sprite(this.flakeTex);
      s.anchor.set(0.5);
      const z = Math.random();
      s.scale.set(0.18 + z * 0.4);
      s.alpha = 0.45 + z * 0.55;
      s.x = Math.random() * innerWidth; s.y = Math.random() * innerHeight;
      this.snowLayer.addChild(s);
      this.flakes.push({ s, vx: 0, vy: 0.6 + z * 1.4, ph: Math.random() * 6, z });
    }
    // frontières de zones = milieu des ponts
    const L = this.layout.path;
    for (let i = 1; i < L.length; i++) if (L[i].zone !== L[i - 1].zone) {
      const mid = L[i - 4] ?? L[i];
      this.boundaries.push(P(mid.x + 0.5, mid.y + 0.5).y);
    }
    this.pos.alexandre = this.pos.flavie = this.penguinPos = 0;
    this.build();
    app.ticker.add((t) => this.tick(t.deltaTime));
  }

  /* ------------------------------------------------------------------ */
  get worldHeight() { return (this.maxY - this.minY) * this.scale + this.padTop + innerHeight * 0.6; }

  setNight(night: boolean) { this.pal = makePalette(night); this.build(); }
  setStates(states: Map<number, NodeState>) { this.states = states; this.build(); }

  build() {
    this.ground.removeChildren().forEach((c) => c.destroy());
    this.objects.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.gifts.clear();
    const { island, path, props, nodes } = this.layout;
    const c = this.pal.c;
    const g = new Graphics();
    // --- îlots (algorithme du peintre) ---
    const cells = [...island.values()].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
    for (const cell of cells) {
      const z = ZONES[cell.zone];
      const T = 0.55 + cell.edgeNoise * 0.9;
      const { x, y } = cell;
      if (!island.has(key(x, y + 1))) {
        poly(g, [P(x, y + 1, 0), P(x + 1, y + 1, 0), P(x + 1, y + 1, -0.16), P(x, y + 1, -0.16)], c(0xe9e6e2));
        poly(g, [P(x, y + 1, -0.16), P(x + 1, y + 1, -0.16), P(x + 1, y + 1, -T), P(x, y + 1, -T * 0.9)], c(0x9a6744));
      }
      if (!island.has(key(x + 1, y))) {
        poly(g, [P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x + 1, y + 1, -0.16), P(x + 1, y, -0.16)], c(0xd2cdd0));
        poly(g, [P(x + 1, y, -0.16), P(x + 1, y + 1, -0.16), P(x + 1, y + 1, -T), P(x + 1, y, -T * 0.9)], c(0x74482c));
      }
      const top = cell.lake ? c(0xbfe4f0) : c(z.ground);
      poly(g, [P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)], top);
      if (cell.lake && (x + y) % 3 === 0) poly(g, [P(x + 0.2, y + 0.3), P(x + 0.6, y + 0.1), P(x + 0.65, y + 0.18), P(x + 0.25, y + 0.38)], c(0xe9f8fd));
    }
    // --- route ---
    const hw = 0.3;
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const ax = a.x + 0.5, ay = a.y + 0.5;
      if (a.bridge) {
        // planches du pont
        box(g, a.x + 0.5 - (b && b.x !== a.x ? 0.5 : hw + 0.08), a.y + 0.5 - (b && b.y !== a.y ? 0.5 : hw + 0.08), -0.12,
          b && b.x !== a.x ? 1 : (hw + 0.08) * 2, b && b.y !== a.y ? 1 : (hw + 0.08) * 2, 0.12, { top: c(0xc58a55), left: c(0xa06b3e), right: c(0x83552f) });
        const dirX = b ? b.x !== a.x : true;
        for (const s of [-1, 1]) {
          const px = dirX ? ax : ax + s * (hw + 0.05), py = dirX ? ay + s * (hw + 0.05) : ay;
          box(g, px - 0.03, py - 0.03, 0, 0.06, 0.06, 0.35, { top: c(0x83552f), left: c(0x83552f), right: c(0x6a4426) });
        }
        continue;
      }
      if (!b || b.bridge) { poly(g, [P(ax - hw, ay - hw), P(ax + hw, ay - hw), P(ax + hw, ay + hw), P(ax - hw, ay + hw)], c(0x3b3340)); continue; }
      const bx = b.x + 0.5, by = b.y + 0.5;
      const along = b.x !== a.x;
      const q = along
        ? [P(ax - hw, ay - hw), P(bx + hw, by - hw), P(bx + hw, by + hw), P(ax - hw, ay + hw)]
        : [P(ax - hw, ay - hw), P(ax + hw, ay - hw), P(bx + hw, by + hw), P(bx - hw, by + hw)];
      poly(g, q, c(0x3b3340));
      // tirets
      const m = along ? [P(ax + 0.35, ay - 0.04), P(ax + 0.65, ay - 0.04), P(ax + 0.65, ay + 0.04), P(ax + 0.35, ay + 0.04)]
        : [P(ax - 0.04, ay + 0.35), P(ax + 0.04, ay + 0.35), P(ax + 0.04, ay + 0.65), P(ax - 0.04, ay + 0.65)];
      poly(g, m, c(0xf3eee6), 0.75);
    }
    this.ground.addChild(g);

    // --- décors ---
    for (const p of props) {
      const o = drawProp(p.kind, p.x, p.y, this.pal, p.seed);
      o.zIndex = p.x + p.y + (p.kind === "mountain" ? -1.4 : p.kind === "wheel" || p.kind === "workshop" ? -0.6 : 0.5);
      this.objects.addChild(o);
    }
    // --- cases (cadeaux) ---
    for (const n of nodes) this.objects.addChild(this.makeGift(n));

    // --- personnages ---
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const p = new Person(who, this.pal);
      this.people[who] = p;
      this.objects.addChild(p);
    }
    this.penguin = new Penguin(this.pal);
    this.objects.addChild(this.penguin);

    // bornes
    const ys = cells.map((cl) => P(cl.x, cl.y).y);
    this.minY = Math.min(...ys) - 200;
    this.maxY = Math.max(...ys) + 120;
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
    const R = (pts: Pt[], color: number) => g.poly(pts.map(rel).flatMap((p) => [p.x, p.y])).fill(color);
    const h = 0.55;
    R([P(x0, y0 + s, h), P(x0 + s, y0 + s, h), P(x0 + s, y0 + s, 0), P(x0, y0 + s, 0)], col);
    R([P(x0 + s, y0, h), P(x0 + s, y0 + s, h), P(x0 + s, y0 + s, 0), P(x0 + s, y0, 0)], dark);
    // rubans
    const m = s / 2, rw = 0.05;
    R([P(x0 + m - rw, y0 + s, h), P(x0 + m + rw, y0 + s, h), P(x0 + m + rw, y0 + s, 0), P(x0 + m - rw, y0 + s, 0)], rib);
    R([P(x0 + s, y0 + m - rw, h), P(x0 + s, y0 + m + rw, h), P(x0 + s, y0 + m + rw, 0), P(x0 + s, y0 + m - rw, 0)], mix(rib, 0x000000, 0.12));
    // couvercle
    const lid = new Graphics();
    const lo = st === "opened" ? 0.25 : 0;
    const L = (pts: Pt[], color: number) => lid.poly(pts.map(rel).flatMap((p) => [p.x, p.y])).fill(color);
    const lx = x0 - 0.04, ly = y0 - 0.04, ls = s + 0.08, lh = 0.14;
    L([P(lx, ly + ls, h + lh), P(lx + ls, ly + ls, h + lh), P(lx + ls, ly + ls, h), P(lx, ly + ls, h)], light);
    L([P(lx + ls, ly, h + lh), P(lx + ls, ly + ls, h + lh), P(lx + ls, ly + ls, h), P(lx + ls, ly, h)], col);
    L([P(lx, ly, h + lh), P(lx + ls, ly, h + lh), P(lx + ls, ly + ls, h + lh), P(lx, ly + ls, h + lh)], c(mix(base, 0xffffff, 0.3)));
    L([P(lx + ls / 2 - rw, ly, h + lh), P(lx + ls / 2 + rw, ly, h + lh), P(lx + ls / 2 + rw, ly + ls, h + lh), P(lx + ls / 2 - rw, ly + ls, h + lh)], rib);
    L([P(lx, ly + ls / 2 - rw, h + lh), P(lx + ls, ly + ls / 2 - rw, h + lh), P(lx + ls, ly + ls / 2 + rw, h + lh), P(lx, ly + ls / 2 + rw, h + lh)], rib);
    const top = rel(P(n.x + 0.5, n.y + 0.5, h + lh));
    lid.ellipse(top.x - 7, top.y - 4, 7, 4.5).stroke({ width: 3.5, color: rib });
    lid.ellipse(top.x + 7, top.y - 4, 7, 4.5).stroke({ width: 3.5, color: rib });
    lid.circle(top.x, top.y - 3, 3).fill(rib);
    if (lo) { lid.x = 16; lid.y = -18; lid.rotation = 0.35; }
    // étiquette
    const label = new Container();
    const txt = new Text({ text: String(n.day), style: { fontFamily: "Fredoka", fontWeight: "700", fontSize: 20, fill: st === "locked" ? 0x5b6680 : 0xffffff } });
    txt.anchor.set(0.5);
    const pill = new Graphics().roundRect(-20, -15, 40, 30, 15).fill(st === "locked" ? 0xffffff : st === "opened" ? 0x2fa37a : 0xd9354b);
    label.addChild(pill, txt);
    if (st === "opened") { const star = new Graphics().star(20, -14, 5, 8, 3.5).fill(0xffd66b); label.addChild(star); }
    if (st === "locked") { const lk = new Graphics().roundRect(10, -20, 14, 11, 3).fill(0x5b6680).circle(17, -21, 4.5).stroke({ width: 2.4, color: 0x5b6680 }); label.addChild(lk); }
    label.y = top.y - 48;
    inner.addChild(g, lid, label);
    cont.addChild(glow, inner);
    cont.position.set(o.x, o.y);
    cont.zIndex = n.x + n.y + 0.55;
    cont.eventMode = "static";
    cont.cursor = "pointer";
    cont.on("pointertap", () => this.cb.onNodeTap(n.day));
    (cont as Container & { meta: object }).meta = { inner, glow, st, label };
    this.gifts.set(n.day, cont);
    return cont;
  }

  /* --------------------------- personnages --------------------------- */
  pointAt(t: number, offset: number): { p: Pt; z: number; right: boolean } {
    const L = this.layout.path;
    const i = Math.max(0, Math.min(L.length - 1.001, t));
    const a = L[Math.floor(i)], b = L[Math.min(L.length - 1, Math.floor(i) + 1)];
    const f = i - Math.floor(i);
    const gx = a.x + (b.x - a.x) * f + 0.5 + offset, gy = a.y + (b.y - a.y) * f + 0.5 - offset;
    return { p: P(gx, gy), z: gx + gy, right: b.x !== a.x };
  }

  placeActors() {
    const off: Record<Who, number> = { alexandre: 0.2, flavie: -0.2 };
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const pt = this.pointAt(this.pos[who], off[who]);
      const p = this.people[who];
      p.position.set(pt.p.x, pt.p.y);
      p.zIndex = pt.z + 0.3;
      if (p.walking) p.face(pt.right);
    }
    const pg = this.pointAt(this.penguinPos, 0);
    this.penguin.position.set(pg.p.x, pg.p.y);
    this.penguin.zIndex = pg.z + 0.3;
  }

  nodeIndex(day: number) { return this.layout.nodes[day - 1].idx; }

  /** Place un personnage directement sur une case */
  setPosition(who: Who, day: number) { this.pos[who] = day ? this.nodeIndex(day) - 0.6 : 0; }

  /** Fait marcher un personnage jusqu'à une case */
  walkTo(who: Who, day: number): Promise<void> {
    this.leader = who;
    const target = this.nodeIndex(day) - 0.6;
    const p = this.people[who];
    return new Promise((res) => {
      p.walking = 1;
      const dir = Math.sign(target - this.pos[who]);
      const step = () => {
        const d = target - this.pos[who];
        if (Math.abs(d) < 0.08) { this.pos[who] = target; p.walking = 0; res(); return; }
        this.pos[who] += dir * Math.min(Math.abs(d), 0.09);
        requestAnimationFrame(step);
      };
      step();
    });
  }

  /* ------------------------------ caméra ----------------------------- */
  resize() {
    this.scale = Math.max(0.62, Math.min(1.35, innerWidth / 520));
    this.world.scale.set(this.scale);
    this.padTop = Math.min(260, innerHeight * 0.32);
  }

  setScroll(y: number) { this.scrollY = y; }

  /** ordonnée monde au centre de l'écran */
  focusWorldY() { return (this.scrollY + innerHeight * 0.55 - this.padTop) / this.scale + this.minY; }

  scrollForDay(day: number) {
    const n = this.layout.nodes[day - 1];
    const wy = P(n.x + 0.5, n.y + 0.5).y;
    return (wy - this.minY) * this.scale + this.padTop - innerHeight * 0.55;
  }

  zoneMix(wy: number) {
    for (let i = 0; i < this.boundaries.length; i++) {
      const b = this.boundaries[i];
      if (wy < b + 160) {
        const t = Math.max(0, Math.min(1, (wy - (b - 160)) / 320));
        return { a: i, b: i + 1, t: t * t * (3 - 2 * t) };
      }
    }
    const last = ZONES.length - 1;
    return { a: last, b: last, t: 0 };
  }

  tick(dt: number) {
    this.time += dt;
    const fy = this.focusWorldY();
    // caméra : suit la route horizontalement
    const L = this.layout.path;
    let best = L[0], bd = Infinity;
    for (const c of L) { const d = Math.abs(P(c.x + 0.5, c.y + 0.5).y - fy); if (d < bd) { bd = d; best = c; } }
    const tx = innerWidth / 2 - P(best.x + 0.5, best.y + 0.5).x * this.scale;
    this.camX += (tx - this.camX) * Math.min(1, 0.06 * dt);
    if (!this.camX) this.camX = tx;
    this.world.x = this.camX;
    this.world.y = -this.scrollY + this.padTop - this.minY * this.scale;

    // ambiance de la zone
    const zm = this.zoneMix(fy);
    const za = ZONES[zm.a], zb = ZONES[zm.b];
    const bgA = this.pal.night ? za.bgNight : za.bgDay, bgB = this.pal.night ? zb.bgNight : zb.bgDay;
    const bg = mix(bgA, bgB, zm.t);
    this.cb.onBg("#" + bg.toString(16).padStart(6, "0"));
    const zi = zm.t < 0.5 ? zm.a : zm.b;
    if (zi !== this.zoneNow) { this.zoneNow = zi; this.cb.onZone(zi); }

    // météo
    const lerp = (a: number, b: number) => a + (b - a) * zm.t;
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
    this.fog.clear();
    const fogA = Math.max(0, density - 1) * 0.28;
    if (fogA > 0.01) this.fog.rect(0, 0, innerWidth, innerHeight).fill({ color: 0xffffff, alpha: fogA });

    // animations
    for (const [, cont] of this.gifts) {
      const meta = (cont as Container & { meta: { inner: Container; glow: Graphics; st: NodeState; label: Container } }).meta;
      if (meta.st === "available") {
        meta.inner.y = -Math.abs(Math.sin(this.time * 0.07)) * 8;
        meta.glow.alpha = 0.55 + Math.sin(this.time * 0.07) * 0.35;
      }
      meta.label.y += 0;
    }
    // la mascotte suit le dernier personnage qui a bougé
    const target = this.pos[this.leader] - 1.1;
    const d = target - this.penguinPos;
    this.penguin.walking = Math.abs(d) > 0.05 ? 1 : 0;
    this.penguinPos += Math.sign(d) * Math.min(Math.abs(d), 0.07 * dt);
    this.placeActors();
    for (const who of ["alexandre", "flavie"] as Who[]) this.people[who].update(dt);
    this.penguin.update(dt);
  }

  /** Position écran (CSS) d'une case, pour y ancrer des effets HTML */
  screenOfDay(day: number) {
    const n = this.layout.nodes[day - 1];
    const p = P(n.x + 0.5, n.y + 0.5, 0.8);
    return { x: this.world.x + p.x * this.scale, y: this.world.y + p.y * this.scale };
  }
}

export const TILE_H = TH;
