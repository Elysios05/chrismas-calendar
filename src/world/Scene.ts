// Scène PixiJS : terrain continu isométrique, caméra liée au défilement, ambiance, personnages
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { P, ZH, mix, poly, makePalette, type Palette, type Pt } from "./iso";
import { buildTerrain, heightAt, key, type Terrain, type DayNode } from "./terrain";
import { drawProp, type AnimPart } from "./props";
import { ZONES } from "./zones";
import { weatherAt } from "./weather";
import { Person, Penguin, type Who } from "./actors";

export type NodeState = "locked" | "available" | "opened";
export type SceneCallbacks = {
  onNodeTap: (day: number) => void;
  onZone: (zoneIndex: number) => void;
  /** Le temps qu'il fait là où l'on regarde (« Tempête sur le lac »…), si l'interface veut l'afficher */
  onWeather?: (label: string) => void;
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
  aurora = new Graphics();
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
  light = 0;
  focus: { x: number; y: number; zoom: number } | null = null;
  confetti: { g: Graphics; vx: number; vy: number; rot: number; life: number }[] = [];
  confettiLayer = new Container();
  anims: AnimPart[] = [];
  time = 0;
  boundaries: number[] = [];
  nodeY: number[] = [];
  slabs: { c: Container; min: number; max: number }[] = [];
  groundBands: { c: Container; min: number; max: number }[] = [];
  weatherNow = "";

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
    app.stage.addChild(this.world, this.aurora, this.tint, this.fog, this.cloudLayer, this.whiteout, this.confettiLayer, this.snowLayer);
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
    // crochet de test : la Qualité interroge la scène sans dépendre de sa structure interne.
    // Seulement en développement ou quand on simule un jour (?jour=), jamais sur la vraie version.
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("jour")) {
      (window as unknown as { __calendrier: unknown }).__calendrier = {
        giftScreenPos: (day: number) => {
          const c = this.gifts.get(day);
          if (!c) return null;
          const m = (c as Container & { meta: { wx: number; wy: number } }).meta;
          const sc = this.world.scale.x;
          return { x: m.wx * sc + this.world.x, y: m.wy * sc + this.world.y, visible: c.visible };
        },
        giftState: (day: number) => this.states.get(day) ?? "locked",
        scrollForDay: (day: number) => this.scrollForDay(day),
        playOpen: (day: number) => this.playOpen(day),
      };
    }
  }

  get worldHeight() { return (this.maxY - this.minY) * this.scale + this.padTop + innerHeight * 0.5; }
  setNight(night: boolean) { this.setLight(night ? 1 : 0); }
  /** Ne redessine que les cases dont l'état a changé : reconstruire toute la scène gelait l'image */
  setStates(states: Map<number, NodeState>) {
    const before = this.states;
    this.states = states;
    if (!this.gifts.size) { this.build(); return; }
    // le traîneau du 24 dépend de l'état de la dernière case : là, il faut tout refaire (une fois)
    if ((before.get(24) ?? "locked") !== (states.get(24) ?? "locked")) { this.build(); return; }
    for (const n of this.terrain.nodes) {
      if ((before.get(n.day) ?? "locked") === (states.get(n.day) ?? "locked")) continue;
      const old = this.gifts.get(n.day);
      if (old) { this.objects.removeChild(old); old.destroy({ children: true }); }
      this.objects.addChild(this.makeGift(n));
    }
  }

  /** Lumière continue : 0 = plein jour, 1 = nuit noire. Ne reconstruit qu'au passage du seuil de nuit. */
  setLight(amount: number) {
    const a = Math.max(0, Math.min(1, amount));
    const wasNight = this.pal.night;
    this.light = a;
    const isNight = a >= 0.4;
    if (isNight !== wasNight) { this.pal = makePalette(isNight); this.build(); }
  }

  /* ------------------------------------------------------------------ */
  build() {
    this.ground.removeChildren().forEach((c) => c.destroy());
    this.objects.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.gifts.clear();
    const { cells, path, props, nodes } = this.terrain;
    const c = this.pal.c;
    // le terrain est lui aussi découpé en bandes de profondeur : au lieu d'un seul immense dessin
    // toujours envoyé en entier, on ne dessine que les bandes qui touchent l'écran
    let g = new Graphics();
    const bands: Graphics[] = [g];
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
      if (cell.lake) {
        // glace : un bleu franc, avec des plaques plus claires et un bord givré
        const ice = zdef.ice ?? 0x6fb9df;
        // plaques larges et irrégulières plutôt qu'un damier
        const s = Math.sin(cell.x * 0.31 + cell.y * 0.17) + Math.sin(cell.x * 0.11 - cell.y * 0.27) * 0.8;
        const border = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !cells.get(key(cell.x + dx, cell.y + dy))?.lake);
        col = border ? mix(ice, 0xffffff, 0.6) : mix(ice, 0xffffff, 0.1 + Math.max(0, s) * 0.16);
      } else if (steep > ROCK_T) {
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
    let bandK = list.length ? list[0].x + list[0].y : 0;
    for (const cell of list) {
      const { x, y } = cell;
      if (x + y >= bandK + 10) { bandK = x + y; g = new Graphics(); bands.push(g); }
      const A: [number, number, number] = [x, y, hv(x, y)], B: [number, number, number] = [x + 1, y, hv(x + 1, y)];
      const C: [number, number, number] = [x + 1, y + 1, hv(x + 1, y + 1)], D: [number, number, number] = [x, y + 1, hv(x, y + 1)];
      face([A, B, C], cell);
      face([A, C, D], cell);
      if (cell.lake && (x + y) % 3 === 0) poly(g, [P(x + 0.2, y + 0.3, 0), P(x + 0.6, y + 0.1, 0), P(x + 0.65, y + 0.18, 0), P(x + 0.25, y + 0.38, 0)], c(0xeaf8fd));
    }
    for (const b of bands) this.ground.addChild(b);
    // route posée sur le relief, dans son propre dessin (fine, et au-dessus de toutes les bandes)
    g = new Graphics();
    const T = this.terrain;
    const H = (x: number, y: number) => heightAt(T, x, y) + 0.01;
    const quad = (pts: [number, number][], col: number, alpha = 1) => poly(g, pts.map(([x, y]) => P(x, y, H(x, y))), c(col), alpha);
    const hw = 0.3;
    const rect = (x0: number, x1: number, y0: number, y1: number, col: number, alpha = 1) =>
      quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], col, alpha);
    // rue pavée : un fond de mortier clair, puis des pavés de gris chauds légèrement différents
    const JOINT = 0xb9afa4, COBBLE = [0x9d948c, 0xa79e96, 0x918880, 0xaba39b];
    const hash = (i: number, j: number) => { const s = Math.sin(i * 41.7 + j * 93.3) * 43758.5453; return s - Math.floor(s); };
    const pave = (x0: number, x1: number, y0: number, y1: number, nx: number, ny: number, seed: number) => {
      rect(x0, x1, y0, y1, JOINT);
      const m = 0.014;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const a0 = x0 + (x1 - x0) * (i / nx) + m, a1 = x0 + (x1 - x0) * ((i + 1) / nx) - m;
        const b0 = y0 + (y1 - y0) * (j / ny) + m, b1 = y0 + (y1 - y0) * ((j + 1) / ny) - m;
        rect(a0, a1, b0, b1, COBBLE[Math.floor(hash(seed * 3 + i, j) * COBBLE.length)]);
      }
    };
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const onLake = cells.get(key(a.x, a.y))?.lake;
      const paved = !onLake && !!ZONES[a.zone].paved;
      const col = onLake ? 0x8fcde6 : ZONES[a.zone].roadColor ?? ROAD;
      const ax = a.x + 0.5, ay = a.y + 0.5;
      if (paved) pave(ax - hw, ax + hw, ay - hw, ay + hw, 3, 3, i);
      else quad([[ax - hw, ay - hw], [ax + hw, ay - hw], [ax + hw, ay + hw], [ax - hw, ay + hw]], col);
      if (!b) continue;
      const along = b.x !== a.x;
      // segment découpé en petits morceaux pour suivre la pente
      for (let s2 = 0; s2 < 4; s2++) {
        const t0 = hw + (1 - 2 * hw) * (s2 / 4), t1 = hw + (1 - 2 * hw) * ((s2 + 1) / 4);
        if (paved) {
          if (along) pave(ax + t0, ax + t1, ay - hw, ay + hw, 1, 3, i * 7 + s2);
          else pave(ax - hw, ax + hw, ay + t0, ay + t1, 3, 1, i * 7 + s2);
        } else if (along) quad([[ax + t0, ay - hw], [ax + t1, ay - hw], [ax + t1, ay + hw], [ax + t0, ay + hw]], col);
        else quad([[ax - hw, ay + t0], [ax + hw, ay + t0], [ax + hw, ay + t1], [ax - hw, ay + t1]], col);
      }
      if (paved) {
        // pas de bande centrale sur les pavés : juste un peu de neige tassée au bord
        if (along) { rect(ax + 0.3, ax + 0.7, ay - hw, ay - hw + 0.045, 0xf1ece4, 0.5); rect(ax + 0.3, ax + 0.7, ay + hw - 0.045, ay + hw, 0xf1ece4, 0.5); }
        else { rect(ax - hw, ax - hw + 0.045, ay + 0.3, ay + 0.7, 0xf1ece4, 0.5); rect(ax + hw - 0.045, ax + hw, ay + 0.3, ay + 0.7, 0xf1ece4, 0.5); }
      } else if (!onLake && ZONES[a.zone].roadColor !== undefined) {
        // chemin de glace ou piste damée : des traces en travers, pas de bande centrale
        const m = ZONES[a.zone].roadColor!;
        const mark = mix(m, 0x000000, 0.08);
        for (let k = 0; k < 2; k++) {
          const t0 = 0.18 + k * 0.42, t1 = t0 + 0.1;
          if (along) rect(ax + t0, ax + t1, ay - hw + 0.03, ay + hw - 0.03, mark, 0.8);
          else rect(ax - hw + 0.03, ax + hw - 0.03, ay + t0, ay + t1, mark, 0.8);
        }
      } else if (!onLake) {
        if (along) quad([[ax + 0.38, ay - 0.04], [ax + 0.62, ay - 0.04], [ax + 0.62, ay + 0.04], [ax + 0.38, ay + 0.04]], 0xf3eee6, 0.75);
        else quad([[ax - 0.04, ay + 0.38], [ax + 0.04, ay + 0.38], [ax + 0.04, ay + 0.62], [ax - 0.04, ay + 0.62]], 0xf3eee6, 0.75);
      } else if (i % 2 === 0) {
        const p1 = P(ax - 0.1, ay - 0.1, 0), p2 = P(ax + 0.2, ay + 0.15, 0);
        g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ width: 1.5, color: c(0xffffff), alpha: 0.8 });
      }
    }
    this.ground.addChild(g);
    this.groundBands = bands.map((b) => { const r = b.getLocalBounds(); return { c: b, min: r.minY, max: r.maxY }; });

    this.anims = [];
    // Les décors sont rangés par tranche de profondeur plutôt qu'un par un : la scène trie et transforme
    // quelques dizaines de conteneurs au lieu de plusieurs centaines d'objets, et on peut masquer d'un coup
    // tout ce qui est hors de l'écran.
    const slabs = new Map<number, Container>();
    const slabOf = (depth: number) => {
      const k = Math.floor(depth);
      let c = slabs.get(k);
      if (!c) {
        c = new Container();
        c.zIndex = k + 0.5;
        slabs.set(k, c);
        this.objects.addChild(c);
      }
      return c;
    };
    for (const p of props) {
      const flying = p.kind === "sleigh" && this.states.get(24) === "opened";
      const o = drawProp(p.kind, p.x, p.y, this.pal, p.seed, { zone: ZONES[p.zone].id, drop: p.drop, alongX: p.alongX, flying });
      if (o.anim) this.anims.push(...o.anim);
      o.y = -p.z * ZH;
      const depth = p.x + p.y + (p.kind === "mountain" ? -1.4 : p.kind === "wheel" || p.kind === "workshop" ? -0.6 : 0.5);
      slabOf(depth).addChild(o);
    }
    for (const n of nodes) this.objects.addChild(this.makeGift(n));
    // hauteur occupée par chaque tranche, pour ne dessiner que celles qui entrent dans l'écran
    this.slabs = [...slabs.values()].map((c) => {
      const b = c.getLocalBounds();
      return { c, min: b.minY, max: b.maxY };
    });
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const p = new Person(who, this.pal);
      this.people[who] = p;
      this.objects.addChild(p);
    }
    this.penguin = new Penguin(this.pal);
    this.objects.addChild(this.penguin);

    this.nodeY = nodes.map((n) => P(n.x + 0.5, n.y + 0.5, heightAt(this.terrain, n.x + 0.5, n.y + 0.5)).y);
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
    (cont as Container & { meta: object }).meta = { inner, glow, lid, st, wx: o.x, wy: cont.y };
    this.gifts.set(n.day, cont);
    return cont;
  }

  /** Ouvre la case du jour : la caméra s'approche, le couvercle saute, des confettis partent.
   *  La promesse se résout quand l'animation est finie, pour que l'interface ouvre ensuite sa fenêtre.
   *  Respecte le réglage « animations » : en version courte, on se contente du couvercle. */
  playOpen(day: number): Promise<void> {
    const cont = this.gifts.get(day);
    if (!cont) return Promise.resolve();
    const meta = (cont as Container & { meta: { inner: Container; lid: Graphics; wx: number; wy: number } }).meta;
    const court = document.documentElement.dataset.animations === "non";
    const duree = court ? 270 : 1200; // en millisecondes, pas en images : sur un téléphone qui rame,
    const zoomMax = court ? 1 : 1.5;  // une animation comptée en images s'éterniserait
    return new Promise((res) => {
      const t0 = performance.now();
      let confettisLances = false;
      const lid = meta.lid;
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / duree);
        // zoom : on s'approche puis on repart (une cloche)
        const cloche = Math.sin(Math.min(1, k * 1.15) * Math.PI);
        this.focus = { x: meta.wx, y: meta.wy, zoom: 1 + (zoomMax - 1) * cloche };
        // le couvercle saute, tourne et retombe à côté
        const s2 = Math.min(1, k / 0.55);
        const saut = Math.sin(s2 * Math.PI);
        lid.y = -saut * 46 + s2 * 14;
        lid.x = s2 * 22;
        lid.rotation = s2 * 0.55;
        if (!confettisLances && k > 0.25) { confettisLances = true; if (!court) this.lancerConfettis(); }
        if (k >= 1) { this.focus = null; res(); return; }
        requestAnimationFrame(step);
      };
      step();
    });
  }

  /** Gerbe de confettis au centre de l'écran, là où la case vient de s'ouvrir */
  private lancerConfettis() {
    const cols = [0xd9354b, 0xffd66b, 0x2fa37a, 0x3f7fb5, 0xffffff, 0x8e4fb5];
    const cx = innerWidth / 2, cy = innerHeight * 0.44;
    for (let i = 0; i < 70; i++) {
      const g = new Graphics();
      const w = 5 + Math.random() * 6;
      g.rect(-w / 2, -w / 3, w, w * 0.66).fill(cols[i % cols.length]);
      g.position.set(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 20);
      this.confettiLayer.addChild(g);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 4 + Math.random() * 7;
      this.confetti.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: (Math.random() - 0.5) * 0.4, life: 60 + Math.random() * 40 });
    }
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
      // la vitesse est donnée par image à 60 i/s, mais mesurée au temps écoulé : sur un écran à
      // 120 Hz le personnage allait deux fois trop vite, et deux fois trop lentement sur un mobile qui rame
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(3, (now - last) / 16.667);
        last = now;
        const d = target - this.pos[who];
        if (Math.abs(d) < 0.08) { this.pos[who] = target; p.walking = 0; res(); return; }
        const pt = this.pointAt(this.pos[who], 0);
        const speed = (pt.lake ? 0.16 : pt.slope < 0 && pt.zone === "montagnes" ? 0.2 : pt.slope > 0 ? 0.06 : 0.09) * dt;
        this.pos[who] += Math.sign(d) * Math.min(Math.abs(d), speed);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
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
  /** Le jour que l'on regarde, en continu : 10,4 = entre le 10 et le 11, plus près du 10 */
  dayAt(wy: number) {
    const ys = this.nodeY;
    if (ys.length < 2) return 1;
    if (wy <= ys[0]) return 1;
    for (let i = 1; i < ys.length; i++) {
      if (wy <= ys[i]) {
        const span = ys[i] - ys[i - 1] || 1;
        return i + Math.max(0, Math.min(1, (wy - ys[i - 1]) / span));
      }
    }
    return ys.length;
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

  tick(raw: number) {
    // sur un appareil qui rame, une image peut valoir dix : sans borne, la neige et les confettis
    // feraient un bond et traverseraient l'écran d'un coup
    const dt = Math.min(3, raw);
    this.time += dt;
    const fy = this.focusWorldY();
    const L = this.terrain.path;
    let best = L[0], bd = Infinity;
    for (const c of L) { const d = Math.abs(P(c.x + 0.5, c.y + 0.5, c.z).y - fy); if (d < bd) { bd = d; best = c; } }
    const tx = innerWidth / 2 - P(best.x + 0.5, best.y + 0.5).x * this.scale;
    if (!this.camX) this.camX = tx;
    this.camX += (tx - this.camX) * Math.min(1, 0.05 * dt);
    if (this.focus) {
      // pendant l'ouverture d'une case : on zoome et on la cadre, sans toucher au défilement
      const sc = this.scale * this.focus.zoom;
      this.world.scale.set(sc);
      this.world.x = innerWidth / 2 - this.focus.x * sc;
      this.world.y = innerHeight * 0.44 - this.focus.y * sc;
    } else {
      this.world.scale.set(this.scale);
      this.world.x = this.camX;
      this.world.y = -this.scrollY + this.padTop - this.minY * this.scale;
    }

    // on ne dessine que les tranches de décor qui touchent l'écran
    const topY = (-this.world.y) / this.scale - 80;
    const botY = (innerHeight - this.world.y) / this.scale + 80;
    for (const s2 of this.slabs) s2.c.visible = s2.max > topY && s2.min < botY;
    for (const b of this.groundBands) b.c.visible = b.max > topY && b.min < botY;
    for (const [, cont] of this.gifts) {
      const gy = cont.y;
      cont.visible = gy > topY - 120 && gy < botY + 120;
    }

    // ambiance
    const zm = this.zoneMix(fy);
    // le temps qu'il fait suit le jour que l'on regarde, pas le monde seul
    const wx = weatherAt(this.dayAt(fy));
    if (wx.label !== this.weatherNow) { this.weatherNow = wx.label; this.cb.onWeather?.(wx.label); }
    const za = ZONES[zm.a], zb = ZONES[zm.b];
    const lerp = (a: number, b: number) => a + (b - a) * zm.t;
    const zi = zm.t < 0.5 ? zm.a : zm.b;
    if (zi !== this.zoneNow) { this.zoneNow = zi; this.cb.onZone(zi); }
    // aurores boréales : des voiles qui ondulent et teintent la neige, seulement au pôle Nord
    const polarForce = (ZONES[zm.a].id === "pole-nord" ? 1 - zm.t : 0) + (ZONES[zm.b].id === "pole-nord" ? zm.t : 0);
    this.aurora.clear();
    if (polarForce > 0.01) {
      // en plein jour un voile additif se perdrait dans la neige : on teinte, et on n'ajoute que la nuit
      this.aurora.blendMode = this.pal.night ? "add" : "normal";
      const boost = this.pal.night ? 1.6 : 1;
      const H = innerHeight * 0.62, N = 10;
      const cols = [0x4ef0a8, 0x8f7cf0, 0xf06fb0];
      for (let b = 0; b < 3; b++) {
        const base = ((b + 0.5) / 3) * innerWidth;
        for (let layer = 0; layer < 2; layer++) {
          const halfW = (90 - layer * 42) * (0.8 + 0.3 * Math.sin(this.time * 0.004 + b));
          const left: Pt[] = [], right: Pt[] = [];
          for (let i = 0; i <= N; i++) {
            const y = (i / N) * H;
            const dx = Math.sin(y * 0.012 + this.time * 0.008 + b * 2.1) * 70 + Math.sin(y * 0.03 - this.time * 0.004) * 22;
            const taper = 1 - (i / N) * 0.75; // le voile s'efface en descendant vers le sol
            left.push({ x: base + dx - halfW * taper, y });
            right.push({ x: base + dx + halfW * taper, y });
          }
          poly(this.aurora, [...left, ...right.reverse()], cols[b], (0.17 - layer * 0.06) * polarForce * boost);
        }
      }
    }
    const night = this.pal.night;
    const tintCol = mix(za.atmo.tint, zb.atmo.tint, zm.t);
    // Lumière du jour : l'ambiance du monde, puis un voile qui s'épaissit à mesure que le soir tombe.
    // C'est ce voile qui fait le crépuscule, en continu, sans rien redessiner.
    const l = this.light;
    this.tint.clear();
    this.tint.rect(0, 0, innerWidth, innerHeight)
      .fill({ color: night ? 0x0b1030 : tintCol, alpha: (night ? 0.12 : lerp(za.atmo.tintAlpha, zb.atmo.tintAlpha)) * (1 - l * 0.4) });
    if (l > 0.02) {
      // d'abord doré et rose (fin d'après-midi), puis bleu profond (nuit)
      const soir = Math.min(1, l / 0.45);
      const col = mix(0xff9a5a, 0x101a44, Math.max(0, (l - 0.3) / 0.7));
      this.tint.rect(0, 0, innerWidth, innerHeight).fill({ color: col, alpha: 0.3 * soir * (0.35 + l * 0.65) });
    }
    // un jour de vraie brume tire la couleur du voile vers un gris froid : un voile beige sur un
    // village beige ne se voit pas
    const fogCol = mix(za.atmo.fogColor, zb.atmo.fogColor, zm.t);
    this.fog.tint = night ? 0x2a3566 : mix(fogCol, 0xb6c4d6, Math.max(0, Math.min(0.8, (wx.fog - 1) * 0.6)));
    // un jour brumeux doit se sentir même dans un monde clair : d'où le plancher
    const fogBase = lerp(za.atmo.fog, zb.atmo.fog) * wx.fog;
    this.fog.alpha = Math.min(0.92, Math.max(fogBase, (wx.fog - 1) * 0.32)) * (night ? 0.7 : 1);
    // les nuages passent surtout en altitude (le col des montagnes)
    const alt = Math.min(1, best.z / 3);
    const cloudAmt = lerp(za.atmo.clouds, zb.atmo.clouds) * wx.clouds * (0.35 + alt * 0.65);
    for (const cl of this.clouds) {
      cl.s.x += cl.v * dt;
      if (cl.s.x > innerWidth + 200) { cl.s.x = -200; cl.base = Math.random() * innerHeight; }
      cl.s.y = cl.base + Math.sin(this.time * 0.01 + cl.v * 10) * 10;
      cl.s.alpha = cloudAmt * 0.22;
      cl.s.tint = night ? 0x55608f : 0xffffff;
    }
    // neige
    const density = wx.snow, wind = wx.wind, speed = wx.speed;
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
    const wo = Math.max(0, density - 1) * 0.16; // voile de tempête : assez pour aveugler, pas pour effacer le décor
    if (wo > 0.01) this.whiteout.rect(0, 0, innerWidth, innerHeight).fill({ color: 0xffffff, alpha: wo });

    // décors vivants : la grande roue tourne (nacelles toujours droites), la fumée monte des cheminées
    for (const a of this.anims) {
      if (a.kind === "wheel") {
        a.hub.rotation += 0.0045 * dt;
        for (const car of a.cars) car.rotation = -a.hub.rotation;
      } else if (a.kind === "takeoff") {
        // le traîneau s'arrache du sol une fois, puis file dans le ciel en se balançant
        a.t = Math.min(1, a.t + 0.004 * dt);
        const e = a.t * a.t * (3 - 2 * a.t);
        a.node.x = e * 110;
        a.node.y = -e * 140 + Math.sin(this.time * 0.03) * 6 * e;
        a.node.rotation = -e * 0.22;
        a.node.scale.set(1 - e * 0.18);
      } else {
        a.puffs.forEach((puff, i) => {
          const t = (((this.time * 0.012 + a.phase + i * 0.9) % 3) / 3);
          puff.y = -8 - t * 58;
          puff.x = Math.sin(t * 3.4 + a.phase) * 9 * t;
          puff.alpha = 0.9 * (1 - t) * (1 - t * 0.5);
          puff.scale.set(0.55 + t * 1.1);
        });
      }
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const f = this.confetti[i];
      f.life -= dt;
      f.vy += 0.22 * dt;
      f.g.x += f.vx * dt;
      f.g.y += f.vy * dt;
      f.g.rotation += f.rot * dt;
      f.g.alpha = Math.max(0, Math.min(1, f.life / 20));
      if (f.life <= 0) { f.g.destroy(); this.confetti.splice(i, 1); }
    }
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
