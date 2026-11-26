// Décors isométriques dessinés en vectoriel plat
import { Container, Graphics, Text } from "pixi.js";
import { P, box, onLeft, onRight, gableRoof, pyramid, tree, boulder, poly, shade, type Palette, type TreeKind } from "./iso";

export type PropKind =
  | "tree" | "treeSmall" | "house" | "chalet" | "snowman" | "lamp" | "rock" | "mountain"
  | "stall" | "bigTree" | "wheel" | "crystal" | "presents" | "cane" | "sleigh" | "workshop" | "deer" | "skater"
  | "bush" | "visitor" | "brazier" | "garland" | "bench" | "sled"
  | "caveMouth" | "icicle" | "iceLantern" | "igloo" | "fence"
  | "cloudBank" | "signpost" | "ridge" | "deepWood"
  | "santaHouse" | "postOffice" | "stable";

/** Parties animées d'un décor, que la scène fait vivre à chaque image */
export type AnimPart =
  | { kind: "wheel"; hub: Container; cars: Container[] }
  | { kind: "smoke"; puffs: Graphics[]; phase: number }
  | { kind: "takeoff"; node: Container; t: number }
  /** tapis roulant : des jouets glissent de a vers b */
  | { kind: "belt"; items: Container[]; a: { x: number; y: number }; b: { x: number; y: number }; phase: number }
  /** tête de renne qui dodeline à la porte de son box */
  | { kind: "bob"; node: Container; phase: number; y0: number };
export type PropNode = Container & { anim?: AnimPart[] };

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

/**
 * Lumière d'une fenêtre éclairée qui tombe sur la neige devant la façade (+y) : une nappe en trapèze, plus
 * vive contre le mur et qui s'élargit en s'effaçant. Plus la fenêtre est haute, plus la nappe va loin et pâlit.
 */
export const LUMIERE_SOL: "flaques" | "aucune" | "ellipse" = "flaques";
export function windowSpill(g: Graphics, yWall: number, a: number, b: number, z0: number) {
  const reach = 0.4 + z0 * 0.55, force = 1 / (1 + z0 * 1.2);
  for (let i = 0; i < 4; i++) {
    const t = 1 - i * 0.24; // de la nappe la plus large (pâle) à la plus serrée (vive)
    const L = reach * t, spread = 0.06 + L * 0.55;
    poly(g, [P(a + 0.02, yWall, 0), P(b - 0.02, yWall, 0), P(b + spread, yWall + L, 0), P(a - spread, yWall + L, 0)], 0xffc864, 0.1 * force);
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

function drawHouse(
  g: Graphics, cx: number, cy: number, pal: Palette, rnd: Rnd, style: HouseStyle, drop: number,
  hearth?: { extra: Container; anim: AnimPart[] },
) {
  const c = pal.c;
  // une maison sur deux a de la lumière derrière ses carreaux, même en plein jour : le village paraît habité
  const lit = rnd(50) < 0.5;
  const win = pal.night || lit ? 0xffd46b : pal.window;
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
  // fenêtres de la façade avant : on les retient pour poser leur lumière au sol la nuit
  const wins: [number, number, number][] = [];
  const fenetre = (a: number, b: number, z0: number, z1: number) => { onLeft(g, y0 + d, a, b, z0, z1, win); wins.push([a, b, z0]); };

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
      fenetre(a, a + 0.26, h * 0.46, h * 0.74);
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
    const roofCol = [0xc8362f, 0x3f6fa5, 0x2f7f5c, 0xd98a2b, 0x8a4fa0, 0xb5763f][Math.floor(rnd(23) * 6)];
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
      fenetre(a, a + 0.26, h * 0.58, h * 0.84);
      fenetre(a, a + 0.26, h * 0.12, h * 0.38);
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
    fenetre(x0 + 0.22, x0 + 0.46, h * 0.46, h * 0.76);
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
      fenetre(x0 + 0.18, x0 + 0.44, z, z + 0.2);
      fenetre(x0 + 0.56, x0 + 0.78, z, z + 0.2);
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
  // couronne de houx sur la porte
  if (style !== "cabane") {
    const q = P(x0 + w, y0 + d * 0.5, h * 0.44);
    g.circle(q.x, q.y, 6.5).stroke({ width: 3.5, color: c(0x2b6f52) });
    g.circle(q.x + 4, q.y - 4, 2).fill(c(0xd9354b));
    g.circle(q.x - 3, q.y + 4, 1.8).fill(c(0xd9354b));
  }
  // fumée à la cheminée : trois bouffées que la scène fait monter
  const flue: Record<HouseStyle, [number, number, number] | null> = {
    chalet: [0.68, 0.1, 0.6], colombages: [0.2, 0.2, 0.5], pignon: [0.6, 0.2, 0.42], cabane: null,
  };
  const f = flue[style];
  if (hearth && f && lit) {
    const sp = P(x0 + w * f[0] + 0.08, y0 + d * f[1] + 0.08, h + f[2] + 0.06);
    // les bouffées vivent dans un conteneur posé sur la cheminée : la scène n'a qu'à les faire monter
    const stack = new Container();
    stack.position.set(sp.x, sp.y);
    const puffs: Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const puff = new Graphics().circle(0, 0, 11 + i * 3).fill(0xc6cfe0); // gris bleuté : le blanc se perdrait dans la neige
      stack.addChild(puff);
      puffs.push(puff);
    }
    hearth.extra.addChild(stack);
    hearth.anim.push({ kind: "smoke", puffs, phase: rnd(51) * 6 });
  }
  if (pal.night && LUMIERE_SOL === "flaques") for (const [a, b, z0] of wins) windowSpill(g, y0 + d, a, b, z0);
  if (pal.night && LUMIERE_SOL === "ellipse") { const p = P(cx, y0 + d, h * 0.3); g.ellipse(p.x, p.y + 6, 44, 14).fill({ color: 0xffd46b, alpha: 0.18 }); }
}

/** Traîneau du Père Noël. En vol, on lui attelle deux rennes et une traînée d'étoiles. */
/** Bouffées de fumée posées sur une cheminée (même mécanique que les maisons) */
function chimneySmoke(extra: Container, anim: AnimPart[], at: { x: number; y: number }, phase: number) {
  const stack = new Container();
  stack.position.set(at.x, at.y);
  const puffs: Graphics[] = [];
  for (let i = 0; i < 3; i++) {
    const puff = new Graphics().circle(0, 0, 11 + i * 3).fill(0xc6cfe0);
    stack.addChild(puff);
    puffs.push(puff);
  }
  extra.addChild(stack);
  anim.push({ kind: "smoke", puffs, phase });
}

/** Enseigne peinte sur la face gauche (+y) d'un bâtiment, inclinée comme le mur */
function enseigne(extra: Container, g: Graphics, pal: Palette, text: string, x0: number, x1: number, y: number, z: number, bg: number, fg = 0xffffff) {
  const c = pal.c;
  const zh = 0.26;
  onLeft(g, y + 0.01, x0, x1, z, z + zh, c(bg));
  onLeft(g, y + 0.012, x0 + 0.04, x1 - 0.04, z + 0.03, z + zh - 0.03, c(shade(bg, 0.12)));
  const t = new Text({ text, style: { fontFamily: "Fredoka", fontWeight: "700", fontSize: 13, fill: c(fg) } });
  t.anchor.set(0.5);
  const m = P((x0 + x1) / 2, y + 0.02, z + zh / 2);
  t.position.set(m.x, m.y);
  // le mur gauche monte vers la droite de l'écran d'une demi-pente : le texte suit
  t.skew.y = Math.atan2(20, 40);
  const wpx = (x1 - x0) * 40 * 0.92;
  if (t.width > wpx) t.scale.x = wpx / t.width;
  extra.addChild(t);
}

function drawSleigh(g: Graphics, p: { x: number; y: number }, pal: Palette, flying: boolean) {
  const c = pal.c;
  if (flying) {
    // traînée d'étoiles derrière le traîneau
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      g.star(p.x - 60 - t * 90, p.y - 6 + Math.sin(t * 3) * 12, 5, 5 - t * 3, 2).fill({ color: 0xffd46b, alpha: 0.55 - t * 0.4 });
    }
    // l'attelage : deux rennes devant, au bout des guides
    for (const [dx, dy] of [[52, -14], [86, -26]] as const) {
      const b = c(0xa86b3d), d = c(0x7d4a26);
      g.roundRect(p.x + dx, p.y + dy - 10, 26, 11, 5).fill(b);
      for (const lx of [2, 18]) g.rect(p.x + dx + lx, p.y + dy + 1, 2.6, 9).fill(d);
      g.roundRect(p.x + dx + 20, p.y + dy - 18, 7, 12, 3).fill(b);
      g.roundRect(p.x + dx + 23, p.y + dy - 23, 12, 8, 3).fill(b);
      g.circle(p.x + dx + 34, p.y + dy - 19, 2.6).fill(c(0xd9354b));
      g.moveTo(p.x + dx + 25, p.y + dy - 23).lineTo(p.x + dx + 20, p.y + dy - 33)
        .moveTo(p.x + dx + 29, p.y + dy - 23).lineTo(p.x + dx + 34, p.y + dy - 33).stroke({ width: 2.2, color: d });
    }
    g.moveTo(p.x + 24, p.y - 18).lineTo(p.x + 54, p.y - 22).stroke({ width: 2, color: c(0x8a5a33) });
  }
  g.roundRect(p.x - 40, p.y - 34, 70, 26, 10).fill(c(0xd9354b));
  g.roundRect(p.x - 40, p.y - 34, 70, 8, 4).fill(c(0xf0b23a));
  g.moveTo(p.x - 46, p.y - 2).lineTo(p.x + 36, p.y - 2).arc(p.x + 36, p.y - 10, 8, Math.PI / 2, -Math.PI / 2, true).stroke({ width: 4, color: c(0xf0b23a) });
  // la cargaison, dessinée en relatif pour que le traîneau puisse pivoter sur lui-même :
  // un gros sac de toile noué, et deux paquets enrubannés posés devant (issue #49)
  const sx = p.x - 14, sb = p.y - 32;
  // sac : panse arrondie, ombre à droite, col froncé et lien rouge
  g.moveTo(sx - 15, sb).bezierCurveTo(sx - 21, sb - 20, sx - 12, sb - 34, sx - 4, sb - 37)
    .lineTo(sx + 4, sb - 37).bezierCurveTo(sx + 12, sb - 34, sx + 21, sb - 20, sx + 15, sb).closePath().fill(c(0xb08a5a));
  g.moveTo(sx + 4, sb - 36).bezierCurveTo(sx + 12, sb - 32, sx + 20, sb - 18, sx + 15, sb)
    .lineTo(sx + 6, sb).bezierCurveTo(sx + 11, sb - 16, sx + 8, sb - 30, sx + 4, sb - 36).closePath().fill(c(0x8a6a42));
  g.moveTo(sx - 9, sb - 26).quadraticCurveTo(sx - 12, sb - 14, sx - 8, sb - 5).stroke({ width: 1.5, color: c(0xcfae7c), alpha: 0.8 });
  g.moveTo(sx - 4, sb - 37).lineTo(sx - 7, sb - 45).lineTo(sx, sb - 41).lineTo(sx + 7, sb - 45).lineTo(sx + 4, sb - 37).closePath().fill(c(0x9c784c));
  g.roundRect(sx - 6, sb - 39, 12, 4, 2).fill(c(0xd9354b));
  // deux paquets devant le sac, chacun avec son ruban en croix et un nœud
  const paquet = (x: number, y: number, w: number, h: number, fond: number, ruban: number) => {
    g.roundRect(x, y - h, w, h, 1.5).fill(c(fond));
    g.rect(x + w * 0.62, y - h, w * 0.38, h).fill({ color: 0x000000, alpha: 0.16 });
    g.rect(x + w / 2 - 1.5, y - h, 3, h).fill(c(ruban));
    g.rect(x, y - h * 0.55 - 1.5, w, 3).fill(c(ruban));
    g.ellipse(x + w / 2 - 3, y - h - 2, 3.2, 2.2).fill(c(ruban));
    g.ellipse(x + w / 2 + 3, y - h - 2, 3.2, 2.2).fill(c(ruban));
  };
  paquet(sx + 6, sb + 2, 16, 13, 0x3a7bd5, 0xf0d54a);
  paquet(sx - 24, sb + 2, 13, 11, 0xffffff, 0xd9354b);
}

export function drawProp(kind: PropKind, x: number, y: number, pal: Palette, seed: number, opts: { zone?: string; drop?: number; alongX?: boolean; flying?: boolean } = {}): PropNode {
  const g = new Graphics();
  const c = pal.c;
  const cx = x + 0.5, cy = y + 0.5;
  const drop = opts.drop ?? 0;
  const rnd = (n: number) => { const s = Math.sin(seed * 9301 + n * 49297) * 233280; return s - Math.floor(s); };
  // parties animées éventuelles : la scène les anime, le reste est dessiné une fois pour toutes
  const anim: AnimPart[] = [];
  const extra = new Container();

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
      drawHouse(g, cx, cy, pal, rnd, style, drop, { extra, anim });
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
      // trois modèles d'échoppe : auvent rayé, chalet de bois, stand ouvert habillé de sapinage.
      // Toutes font un peu moins d'une case de large : deux voisines se touchent sans se chevaucher.
      const W = 0.98, D = 0.72;
      const x0 = cx - W / 2, y0 = cy - D / 2;
      const model = rnd(30) < 0.5 ? 0 : rnd(31) < 0.55 ? 1 : 2;
      socle(g, x0, y0, W, D, drop, pal, rnd);
      const counter = () => {
        box(g, x0, y0, 0, W, D, 0.5, { top: c(0xc8a06a), left: c(0xb5763f), right: c(0x8f5a2e) });
        onLeft(g, y0 + D, x0 + 0.08, x0 + W - 0.08, 0.3, 0.5, c(0xf2d7a8));
      };
      // marchandises posées sur le comptoir
      const goods = () => {
        const cols = [0xd9354b, 0x2fa37a, 0xe0a63a, 0xf2e6d2];
        for (let i = 0; i < 3; i++) {
          const s = 0.1 + rnd(32 + i) * 0.06;
          box(g, x0 + 0.12 + i * 0.28, y0 + D * 0.5, 0.5, s, s, s * 0.8,
            { top: c(shade(cols[(i + Math.floor(rnd(33) * 4)) % 4], 0.12)), left: c(cols[(i + 1) % 4]), right: c(shade(cols[i % 4], -0.2)) });
        }
      };

      if (model === 0) {
        counter();
        goods();
        for (const px of [x0 + 0.04, x0 + W - 0.1]) box(g, px, y0 + D * 0.82, 0.5, 0.06, 0.06, 0.45, { top: c(0x6b3b22), left: c(0x6b3b22), right: c(0x4e2a18) });
        // auvent rayé, débordant un peu sur l'allée
        const z = 0.95, ox = 0.08, oy = 0.18;
        const stripes = 5, sw = (W + 2 * ox) / stripes;
        for (let i = 0; i < stripes; i++) {
          const a = x0 - ox + i * sw, b = a + sw;
          poly(g, [P(a, y0 + D + oy, z - 0.2), P(b, y0 + D + oy, z - 0.2), P(b, y0 + D * 0.45, z + 0.2), P(a, y0 + D * 0.45, z + 0.2)], c(i % 2 ? 0xffffff : 0xd9354b));
        }
        poly(g, [P(x0 - ox, y0 + D + oy, z - 0.2), P(x0 + W + ox, y0 + D + oy, z - 0.2), P(x0 + W + ox, y0 + D + oy, z - 0.32), P(x0 - ox, y0 + D + oy, z - 0.32)], c(0xb02a3c));
      } else if (model === 1) {
        // chalet de vin chaud : murs de bois, toit à deux pans enneigé, guichet éclairé, cheminée qui fume
        const wood = 0x8a5a33;
        box(g, x0, y0, 0, W, D, 0.78, { top: c(wood), left: c(shade(wood, 0.1)), right: c(shade(wood, -0.22)) });
        for (let i = 0; i < 6; i++) onLeft(g, y0 + D, x0 + 0.03 + i * (W - 0.06) / 6, x0 + 0.045 + i * (W - 0.06) / 6, 0, 0.78, c(shade(wood, -0.3)));
        onLeft(g, y0 + D, x0 + 0.16, x0 + W - 0.16, 0.34, 0.6, pal.night ? 0xffd46b : c(0xffe6a8));
        box(g, x0 + 0.1, y0 + D - 0.02, 0.3, W - 0.2, 0.1, 0.05, { top: c(0xd6a86a), left: c(0xa5713f), right: c(0x8a5a33) });
        box(g, x0 + W * 0.68, y0 + D * 0.2, 0.78, 0.12, 0.12, 0.3, { top: c(0x5a4a48), left: c(0x8a5a4a), right: c(0x6e463a) });
        gableRoof(g, x0, y0, 0.78, W, D, 0.38, c(SNOW.left), c(SNOW.top), c(shade(wood, -0.3)), 0.14);
        // fumée : trois bouffées que la scène fait monter
        const sp = P(x0 + W * 0.74, y0 + D * 0.26, 1.08);
        const stack = new Container();
        stack.position.set(sp.x, sp.y);
        const puffs: Graphics[] = [];
        for (let i = 0; i < 3; i++) {
          const puff = new Graphics().circle(0, 0, 8 + i * 2.2).fill(0xd3dae8);
          stack.addChild(puff);
          puffs.push(puff);
        }
        extra.addChild(stack);
        anim.push({ kind: "smoke", puffs, phase: rnd(34) * 6 });
      } else {
        // stand ouvert : comptoir, quatre poteaux, toit de planches, sapinage et lanternes
        counter();
        goods();
        const z = 0.9;
        for (const px of [x0 + 0.03, x0 + W - 0.09]) for (const py of [y0 + 0.02, y0 + D - 0.08]) {
          box(g, px, py, 0.5, 0.06, 0.06, z - 0.5, { top: c(0x6b3b22), left: c(0x6b3b22), right: c(0x4e2a18) });
        }
        box(g, x0 - 0.06, y0 - 0.06, z, W + 0.12, D + 0.12, 0.07, { top: c(SNOW.top), left: c(0x6b4328), right: c(0x53341f) });
        // guirlande de sapinage sur le fronton, avec des baies rouges
        const fy = y0 + D + 0.06;
        for (let i = 0; i < 7; i++) {
          const a = x0 - 0.04 + i * (W + 0.08) / 7;
          const dip = Math.sin((i / 6) * Math.PI) * 0.045;
          poly(g, [P(a, fy, z - dip), P(a + 0.14, fy, z - dip - 0.01), P(a + 0.14, fy, z - dip - 0.075), P(a, fy, z - dip - 0.065)], c(i % 2 ? 0x2b6f52 : 0x225c45));
          if (i % 2 === 0) { const q = P(a + 0.07, fy, z - dip - 0.05); g.circle(q.x, q.y, 2.2).fill(c(0xd9354b)); }
        }
        for (const px of [x0 + 0.02, x0 + W - 0.02]) {
          const q = P(px, fy, z - 0.04);
          g.roundRect(q.x - 4, q.y, 8, 10, 2).fill(pal.night ? 0xffd46b : c(0xf4e6b0));
          if (pal.night) g.circle(q.x, q.y + 5, 16).fill({ color: 0xffd46b, alpha: 0.18 });
        }
      }
      break;
    }
    case "bench": {
      // banc enneigé
      const p = P(cx, cy);
      for (const dx of [-16, 10]) g.rect(p.x + dx, p.y - 12, 5, 12).fill(c(0x5a3c25));
      g.roundRect(p.x - 20, p.y - 16, 40, 6, 2).fill(c(0x8a5a33));
      g.roundRect(p.x - 20, p.y - 19, 40, 4, 2).fill(c(0xf7f5f0));
      g.roundRect(p.x - 20, p.y - 30, 40, 5, 2).fill(c(0x7a4a2b));
      for (const dx of [-19, 14]) g.rect(p.x + dx, p.y - 31, 5, 16).fill(c(0x6b3b22));
      break;
    }
    case "sled": {
      // luge de bois posée de profil, patins recourbés à l'avant
      const p = P(cx, cy), col = [0xd9354b, 0x3f7fb5, 0x2fa37a][Math.floor(rnd(1) * 3)];
      g.ellipse(p.x, p.y, 15, 5).fill({ color: c(0x9aa3b8), alpha: 0.28 });
      // patins : une barre basse qui remonte en crosse devant
      for (const dy of [0, -4]) {
        g.moveTo(p.x - 15, p.y - 3 + dy).lineTo(p.x + 9, p.y - 3 + dy)
          .arc(p.x + 9, p.y - 9 + dy, 6, Math.PI / 2, -Math.PI / 4, true)
          .stroke({ width: 2.6, color: c(0x7a4a2b) });
      }
      // montants et plateau de lattes
      for (const dx of [-11, 2]) g.rect(p.x + dx, p.y - 11, 2.4, 8).fill(c(0x8a5a33));
      g.roundRect(p.x - 14, p.y - 15, 26, 5, 2).fill(c(0xd6a86a));
      for (let i = 0; i < 4; i++) g.rect(p.x - 13 + i * 6.4, p.y - 15, 1.4, 5).fill(c(0xa5713f));
      // dossier incliné, peint
      g.roundRect(p.x - 15, p.y - 26, 5, 12, 2).fill(c(col));
      g.roundRect(p.x - 15, p.y - 26, 20, 4, 2).fill(c(shade(col, -0.18)));
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
      // grande roue qui tourne : les montants sont fixes, la roue tourne, les nacelles restent droites
      const p = P(cx, cy), r = 62, hy = p.y - 86;
      poly(g, [{ x: p.x - 30, y: p.y }, { x: p.x, y: hy }, { x: p.x - 24, y: p.y }], c(0x8a93a8));
      poly(g, [{ x: p.x + 30, y: p.y }, { x: p.x, y: hy }, { x: p.x + 24, y: p.y }], c(0x6b7489));
      const hub = new Container();
      hub.position.set(p.x, hy);
      const rim = new Graphics();
      rim.circle(0, 0, r).stroke({ width: 5, color: c(0xd9354b) });
      rim.circle(0, 0, r - 12).stroke({ width: 2, color: c(0xe8a0a8) });
      const cars: Container[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        rim.moveTo(0, 0).lineTo(Math.cos(a) * r, Math.sin(a) * r).stroke({ width: 2, color: c(0xb9c0cf) });
        const car = new Container();
        car.position.set(Math.cos(a) * r, Math.sin(a) * r);
        const cg = new Graphics();
        const col = [0xffc85a, 0x3f7fb5, 0x2fa37a, 0xffffff][i % 4];
        cg.roundRect(-7, 0, 14, 12, 3).fill(c(col));
        if (pal.night) cg.circle(0, 6, 3).fill(0xffd46b);
        car.addChild(cg);
        cars.push(car);
        hub.addChild(car);
      }
      hub.addChildAt(rim, 0);
      const axle = new Graphics().circle(p.x, hy, 6).fill(c(0x2b2f45));
      extra.addChild(hub, axle);
      anim.push({ kind: "wheel", hub, cars });
      break;
    }
    case "caveMouth": {
      // vraie voûte : une paroi de glace percée d'une arche, dans le sens de la marche
      const along = opts.alongX ?? true;
      const half = 1.9, open = 0.95, top = 1.5, peak = 2.5;
      const ice = { top: 0x9ecfe6, left: 0x79b2d2, right: 0x4b84a8 };
      // u : le long de la paroi (elle barre le passage), v : son épaisseur
      const face = (u0: number, u1: number, z0: number, z1: number, col: number) => {
        const q = (u: number, z: number) => (along ? P(cx + u, cy + 0.42, z) : P(cx + 0.42, cy + u, z));
        poly(g, [q(u0, z1), q(u1, z1), q(u1, z0), q(u0, z0)], c(col));
      };
      const slab = (u0: number, u1: number, z0: number, z1: number) => {
        // dessus de la paroi, pour lui donner de l'épaisseur
        const t = (u: number, v: number, z: number) => (along ? P(cx + u, cy + v, z) : P(cx + v, cy + u, z));
        poly(g, [t(u0, -0.42, z1), t(u1, -0.42, z1), t(u1, 0.42, z1), t(u0, 0.42, z1)], c(ice.top));
        face(u0, u1, z0, z1, along ? ice.left : ice.right);
      };
      slab(-half, -open, 0, peak * 0.86);
      slab(open, half, 0, peak * 0.86);
      // le cintre de l'arche, en gradins
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const u = open - (open * 0.55 * (i + 1)) / steps;
        const z = top + ((peak - top) * (i + 1)) / steps;
        slab(-u - 0.001, -0.001, top + ((peak - top) * i) / steps, z);
        slab(0.001, u + 0.001, top + ((peak - top) * i) / steps, z);
      }
      // stalactites sous le cintre, et l'ombre du porche sur le sol
      for (let i = 0; i < 6; i++) {
        const u = -open + 0.1 + (i * (2 * open - 0.2)) / 5;
        const h2 = top + (peak - top) * (1 - Math.abs(u) / open) * 0.8;
        const q = along ? P(cx + u, cy + 0.42, h2) : P(cx + 0.42, cy + u, h2);
        poly(g, [{ x: q.x - 4, y: q.y }, { x: q.x + 4, y: q.y }, { x: q.x, y: q.y + 9 + rnd(i) * 15 }], c(0x8fd0e8));
      }
      const o = P(cx, cy, 0);
      g.ellipse(o.x, o.y, 58, 28).fill({ color: 0x0c2740, alpha: 0.32 });
      break;
    }
    case "icicle": {
      // grappe de stalactites suspendue au-dessus du passage
      const p = P(cx, cy, 1.6 + rnd(1) * 1.1);
      for (let i = 0; i < 4; i++) {
        const dx = (rnd(2 + i) - 0.5) * 34, w = 4 + rnd(6 + i) * 4, len = 14 + rnd(10 + i) * 34;
        poly(g, [{ x: p.x + dx - w, y: p.y }, { x: p.x + dx + w, y: p.y }, { x: p.x + dx, y: p.y + len }], pal.night ? 0x9fe6ff : c(0xa8dcf0));
        poly(g, [{ x: p.x + dx, y: p.y }, { x: p.x + dx + w, y: p.y }, { x: p.x + dx, y: p.y + len * 0.8 }], pal.night ? 0x6fc4e4 : c(0x7fbcd8));
      }
      break;
    }
    case "iceLantern": {
      // lanterne de glace posée au sol : elle éclaire le chemin
      const p = P(cx, cy);
      g.ellipse(p.x, p.y, 15, 6).fill({ color: c(0x1f4c6d), alpha: 0.4 });
      // socle de blocs de glace empilés, cerclé de sombre pour se détacher de la paroi
      for (let i = 0; i < 3; i++) {
        const w = 12 - i * 2.6, z = p.y - 9 - i * 9;
        g.roundRect(p.x - w, z, w * 2, 10, 2).fill(c(i % 2 ? 0x8ac6e2 : 0xaadcf0));
        g.roundRect(p.x - w, z, w * 2, 10, 2).stroke({ width: 1.3, color: c(0x3f7899) });
      }
      g.circle(p.x, p.y - 42, 30).fill({ color: 0x7fd8ff, alpha: 0.16 });
      g.circle(p.x, p.y - 42, 16).fill({ color: 0x9fe8ff, alpha: 0.35 });
      g.circle(p.x, p.y - 42, 8).fill(0xe4fbff);
      break;
    }
    case "igloo": {
      // igloo : dôme de blocs de neige et porche d'entrée
      const p = P(cx, cy), r = 30 + rnd(1) * 10;
      g.ellipse(p.x, p.y, r * 1.15, r * 0.5).fill({ color: c(0x9aa8c8), alpha: 0.3 });
      g.ellipse(p.x, p.y - r * 0.45, r, r * 0.78).fill(c(0xdfe8f4));
      g.ellipse(p.x - r * 0.18, p.y - r * 0.5, r * 0.78, r * 0.66).fill(c(0xf6f9fd));
      g.ellipse(p.x, p.y - r * 0.45, r, r * 0.78).stroke({ width: 1.6, color: c(0xaebfd6) });
      for (let i = 0; i < 3; i++) {
        const ry = p.y - r * 0.2 - i * r * 0.3;
        g.moveTo(p.x - r * (0.95 - i * 0.22), ry).lineTo(p.x + r * (0.95 - i * 0.22), ry).stroke({ width: 1.4, color: c(0xd8e2ee) });
      }
      g.moveTo(p.x - r * 0.95, p.y - r * 0.2).lineTo(p.x + r * 0.95, p.y - r * 0.2).stroke({ width: 1.4, color: c(0xc3d2e4) });
      g.roundRect(p.x - 11, p.y - 20, 22, 20, 9).fill(c(0xeef3f9));
      g.roundRect(p.x - 11, p.y - 20, 22, 20, 9).stroke({ width: 1.5, color: c(0xaebfd6) });
      g.ellipse(p.x, p.y - 4, 8, 9).fill(c(0x3a4d6b));
      if (pal.night) g.ellipse(p.x, p.y - 4, 18, 14).fill({ color: 0xffd46b, alpha: 0.22 });
      break;
    }
    case "fence": {
      // barrière de bois : enclos des rennes
      const p = P(cx, cy);
      for (const dx of [-22, 22]) g.rect(p.x + dx - 2, p.y - 26, 4.5, 26).fill(c(0x6b4328));
      for (const dz of [8, 18]) g.rect(p.x - 24, p.y - dz - 4, 48, 4.5).fill(c(0x8a5a33));
      g.rect(p.x - 24, p.y - 30, 48, 3).fill(c(0xf7f5f0));
      break;
    }
    case "cloudBank": {
      // Banc de nuages posé dans le décor : c'est lui qui ferme la carte, pas un voile sur l'écran.
      // Les bulles s'alignent le long de la lisière (axe y de la carte, sauf `alongX`), et se
      // chevauchent avec celles des bancs voisins : de loin, on lit un seul mur continu.
      const p = P(cx, cy);
      const ax = opts.alongX ? P(1, 0) : P(0, 1); // pas d'une case le long de la lisière, à l'écran
      const o0 = P(0, 0);
      const ux = ax.x - o0.x, uy = ax.y - o0.y;
      // ombre portée sur la neige, étirée le long du mur
      for (let t = -1.5; t <= 1.5; t += 1.5) g.ellipse(p.x + ux * t, p.y + uy * t + 8, 70, 22).fill({ color: c(0x7f8db6), alpha: 0.3 });
      const puffs: [number, number, number][] = [];
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) * 0.75 + (rnd(10 + i) - 0.5) * 0.3;
        const r = (48 + rnd(20 + i) * 26) * (i === 2 ? 1.15 : 1);
        puffs.push([p.x + ux * t, p.y + uy * t - r * 0.35 - 6, r]);
      }
      // une rangée basse plus petite devant, pour que le pied du mur soit épais et non découpé
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) * 0.9 + (rnd(40 + i) - 0.5) * 0.3;
        const r = 32 + rnd(50 + i) * 14;
        puffs.push([p.x + ux * t, p.y + uy * t + 10, r]);
      }
      // bulles arrondies (choix d'Alexandre) : dessous ombré, corps, puis un reflet en haut à gauche
      // le dessous est franchement bleuté : sur la neige en plein jour, sinon, le mur se fondait au sol
      const BLANC = 0xffffff, CLAIR = 0xe9eef8, DESSOUS = 0x95a4ca;
      for (const [x, y, r] of puffs) g.ellipse(x + r * 0.05, y + r * 0.16, r * 0.98, r * 0.66).fill(c(DESSOUS));
      for (const [x, y, r] of puffs) g.ellipse(x, y, r * 0.95, r * 0.7).fill(c(CLAIR));
      for (const [x, y, r] of puffs) g.ellipse(x - r * 0.18, y - r * 0.16, r * 0.66, r * 0.46).fill(c(BLANC));
      break;
    }
    case "signpost": {
      // Panneau « route barrée » planté au pied des nuages : deux poteaux, une planche large, une
      // lanterne. Il doit se lire de loin, de jour comme de nuit.
      const p = P(cx, cy);
      const bois = c(0x8a5530), boisClair = c(0xd9a868), bord = c(0x6b3f22);
      g.ellipse(p.x, p.y + 2, 46, 13).fill({ color: c(0x7d89aa), alpha: 0.35 });
      for (const dx of [-30, 30]) g.rect(p.x + dx - 3.5, p.y - 70, 7, 72).fill(bois);
      // planche principale, avec ses lattes
      g.roundRect(p.x - 52, p.y - 92, 104, 42, 6).fill(boisClair).stroke({ width: 3, color: bord });
      for (const yy of [-78, -64]) g.rect(p.x - 50, p.y + yy, 100, 1.6).fill({ color: bord, alpha: 0.35 });
      // bandes rouges et blanches de barrière, au-dessous
      g.roundRect(p.x - 46, p.y - 40, 92, 12, 3).fill(c(0xffffff)).stroke({ width: 2, color: bord });
      for (let i = 0; i < 4; i++) poly(g, [{ x: p.x - 44 + i * 24, y: p.y - 39 }, { x: p.x - 34 + i * 24, y: p.y - 39 }, { x: p.x - 42 + i * 24, y: p.y - 29 }, { x: p.x - 52 + i * 24, y: p.y - 29 }].map((q) => ({ x: Math.max(p.x - 45, Math.min(p.x + 45, q.x)), y: q.y })), c(0xd23b3b));
      // un flocon peint au centre de la planche : « on repasse demain »
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        g.moveTo(p.x - Math.cos(a) * 11, p.y - 71 - Math.sin(a) * 11).lineTo(p.x + Math.cos(a) * 11, p.y - 71 + Math.sin(a) * 11).stroke({ width: 3, color: c(0x3b6fb6) });
      }
      // lanterne : toujours allumée, c'est elle qu'on repère de nuit
      g.rect(p.x + 26, p.y - 108, 8, 16).fill(c(0x3a3a46));
      g.roundRect(p.x + 24, p.y - 104, 12, 11, 2).fill(0xffd46b);
      g.circle(p.x + 30, p.y - 99, pal.night ? 40 : 18).fill({ color: 0xffd46b, alpha: pal.night ? 0.22 : 0.12 });
      break;
    }
    case "ridge": {
      // crête de montagne en lisière : masque le bord du terrain
      const h = 4.5 + rnd(2) * 3;
      pyramid(g, cx, cy, 2.6 + rnd(3) * 1.2, h, c(0x6e789a), c(0x515b7d), c(0xf2f5fb), c(0xd9e0ec), 0.5);
      break;
    }
    case "deepWood": {
      // futaie serrée en lisière : plusieurs sapins hauts les uns derrière les autres
      for (let i = 0; i < 5; i++) {
        const dx = (rnd(10 + i) - 0.5) * 1.5, dy = (rnd(20 + i) - 0.5) * 1.2;
        tree(g, P(cx + dx, cy + dy), 1.15 + rnd(30 + i) * 0.5, pal, {
          kind: rnd(40 + i) < 0.6 ? "epicea" : "sapin",
          variant: Math.floor(rnd(50 + i) * 4),
          snowAmount: rnd(60 + i),
        });
      }
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
      // le 24, le traîneau quitte le sol : on le met dans un conteneur que la scène fait décoller
      if (opts.flying) {
        // ancré sur sa case, avec un conteneur interne : la scène le fait monter, pencher et s'éloigner
        // sans que l'échelle ni la rotation ne le projettent à l'autre bout du monde
        const anchor = new Container();
        anchor.position.set(p.x, p.y);
        const inner = new Container();
        const gf = new Graphics();
        drawSleigh(gf, { x: 0, y: 0 }, pal, true);
        inner.addChild(gf);
        anchor.addChild(inner);
        extra.addChild(anchor);
        anim.push({ kind: "takeoff", node: inner, t: 0 });
      } else {
        drawSleigh(g, p, pal, false);
      }
      break;
    }
    case "workshop": {
      // la fabrique de jouets : grande halle de briques, deux cheminées qui fument, enseigne,
      // et un tapis roulant le long de la façade où défilent les jouets
      const w = 2.5, d = 1.7, h = 1.25;
      const x0 = cx - w / 2, y0 = cy - d / 2;
      socle(g, x0, y0, w, d, drop, pal, rnd);
      box(g, x0, y0, 0, w, d, h, { top: c(0x9a3b3b), left: c(0xc8463b), right: c(0x9a2f2a) });
      // assises de briques plus sombres
      for (let r = 1; r < 5; r++) onLeft(g, y0 + d + 0.005, x0, x0 + w, r * 0.25 - 0.012, r * 0.25, c(0xa83a31));
      // fenêtres hautes à petits carreaux, toujours allumées : on travaille jour et nuit
      for (let i = 0; i < 4; i++) {
        const a = x0 + 0.22 + i * 0.58;
        onLeft(g, y0 + d + 0.008, a, a + 0.36, 0.62, 1.02, c(0xf2e6d2));
        onLeft(g, y0 + d + 0.01, a + 0.03, a + 0.33, 0.65, 0.99, 0xffd46b);
        onLeft(g, y0 + d + 0.012, a + 0.165, a + 0.195, 0.65, 0.99, c(0xf2e6d2));
      }
      for (let i = 0; i < 2; i++) onRight(g, x0 + w + 0.008, y0 + 0.3 + i * 0.7, y0 + 0.65 + i * 0.7, 0.62, 1.0, 0xffd46b);
      // les deux bouches du tapis : les jouets sortent d'un côté et rentrent de l'autre
      const bz = 0.18;
      onLeft(g, y0 + d + 0.01, x0 + 0.2, x0 + 0.5, bz, bz + 0.3, c(0x3d2a1a));
      onLeft(g, y0 + d + 0.01, x0 + w - 0.5, x0 + w - 0.2, bz, bz + 0.3, c(0x3d2a1a));
      box(g, x0 + 0.3, y0 + d, 0, w - 0.6, 0.22, bz, { top: c(0x4d5265), left: c(0x6b6f80), right: c(0x3d4152) });
      for (let i = 0; i < 8; i++) { const a = x0 + 0.4 + i * ((w - 0.8) / 7); onLeft(g, y0 + d + 0.221, a, a + 0.04, 0.03, bz - 0.03, c(0x2b2f45)); }
      gableRoof(g, x0, y0, h, w, d, 0.7, c(SNOW.left), c(SNOW.top), c(0x7a2622));
      enseigne(extra, g, pal, "Fabrique de jouets", x0 + 0.55, x0 + w - 0.55, y0 + d, 0.28 + 0.07, 0x2fa37a);
      // cheminées de briques sur le faîtage
      for (const [fx, ph] of [[0.25, 0], [0.72, 2.3]] as const) {
        const ccx = x0 + w * fx, ccy = y0 + d * 0.32;
        box(g, ccx, ccy, h + 0.3, 0.2, 0.2, 0.62, { top: c(0x5b2a24), left: c(0xb5473b), right: c(0x8a3329) });
        chimneySmoke(extra, anim, P(ccx + 0.1, ccy + 0.1, h + 0.98), rnd(70) * 6 + ph);
      }
      const st = P(x0 + w / 2, y0 + d / 2, h + 0.78);
      g.star(st.x, st.y, 5, 12, 5).fill(0xffd46b);
      // les jouets du tapis : ours, toupie, cube, petite voiture
      const items: Container[] = [];
      const toys = [
        (t: Graphics) => t.circle(0, -7, 5).fill(c(0xa86b3d)).circle(-4, -11, 2).fill(c(0xa86b3d)).circle(4, -11, 2).fill(c(0xa86b3d)).circle(0, -2, 4.5).fill(c(0xa86b3d)),
        (t: Graphics) => t.poly([-6, -8, 6, -8, 0, 0]).fill(c(0x3f7fb5)).rect(-1, -12, 2, 4).fill(c(0xd9354b)),
        (t: Graphics) => t.rect(-5, -10, 10, 10).fill(c(0xffd46b)).rect(-5, -10, 10, 3).fill(c(0xe0a63a)),
        (t: Graphics) => t.roundRect(-7, -7, 14, 5, 2).fill(c(0xd9354b)).roundRect(-4, -10, 7, 4, 1.5).fill(c(0x7fb3e0)).circle(-4, -1.5, 2).fill(c(0x2b2f45)).circle(4, -1.5, 2).fill(c(0x2b2f45)),
      ];
      for (let i = 0; i < 5; i++) { const t = new Graphics(); toys[i % 4](t); extra.addChild(t); items.push(t); }
      const bouche = P(x0 + 0.35, y0 + d + 0.11, bz);
      // posés à la bouche du tapis avant leur première image (sinon ils attendaient à l'origine du monde)
      for (const it of items) it.position.set(bouche.x, bouche.y);
      anim.push({ kind: "belt", items, a: bouche, b: P(x0 + w - 0.35, y0 + d + 0.11, bz), phase: rnd(71) });
      break;
    }
    case "santaHouse": {
      // la maison du Père Noël : grande maison rouge à colombages blancs, véranda, couronne, enseigne
      const w = 2.1, d = 1.5, h = 1.35;
      const x0 = cx - w / 2, y0 = cy - d / 2;
      socle(g, x0, y0, w, d, drop, pal, rnd);
      box(g, x0, y0, 0, w, d, h, { top: c(0xb02f2f), left: c(0xd9354b), right: c(0xa82a35) });
      // poutres blanches : chaînages d'angle, lisse d'étage
      onLeft(g, y0 + d + 0.006, x0, x0 + 0.07, 0, h, c(0xfbf3ea));
      onLeft(g, y0 + d + 0.006, x0 + w - 0.07, x0 + w, 0, h, c(0xfbf3ea));
      onLeft(g, y0 + d + 0.006, x0, x0 + w, 0.66, 0.72, c(0xfbf3ea));
      onRight(g, x0 + w + 0.006, y0, y0 + 0.07, 0, h, c(0xe8ddd0));
      onRight(g, x0 + w + 0.006, y0, y0 + d, 0.66, 0.72, c(0xe8ddd0));
      // fenêtres chaudes, à volets verts
      const win = (a: number, z: number) => {
        onLeft(g, y0 + d + 0.008, a - 0.06, a, z, z + 0.3, c(0x2fa37a));
        onLeft(g, y0 + d + 0.008, a + 0.26, a + 0.32, z, z + 0.3, c(0x2fa37a));
        onLeft(g, y0 + d + 0.01, a, a + 0.26, z, z + 0.3, 0xffd46b);
        onLeft(g, y0 + d + 0.012, a + 0.115, a + 0.145, z, z + 0.3, c(0xfbf3ea));
      };
      win(x0 + 0.25, 0.22); win(x0 + 1.55, 0.22);
      if (pal.night && LUMIERE_SOL === "flaques") for (const [a, z] of [[x0 + 0.25, 0.22], [x0 + 1.55, 0.22], [x0 + 0.35, 0.86], [x0 + 0.9, 0.86], [x0 + 1.45, 0.86]]) windowSpill(g, y0 + d, a, a + 0.26, z);
      win(x0 + 0.35, 0.86); win(x0 + 0.9, 0.86); win(x0 + 1.45, 0.86);
      onRight(g, x0 + w + 0.008, y0 + 0.35, y0 + 0.62, 0.86, 1.14, 0xffd46b);
      onRight(g, x0 + w + 0.008, y0 + 0.88, y0 + 1.15, 0.86, 1.14, 0xffd46b);
      // porte verte et couronne
      onLeft(g, y0 + d + 0.01, x0 + 0.86, x0 + 1.24, 0, 0.56, c(0x1f6b4f));
      const wr = P(x0 + 1.05, y0 + d + 0.02, 0.42);
      g.circle(wr.x, wr.y, 6).stroke({ width: 3.5, color: c(0x2b6f52) });
      g.circle(wr.x, wr.y + 5, 2).fill(c(0xd9354b));
      // véranda : auvent enneigé sur deux poteaux devant la porte
      const vz = 0.62;
      for (const vx of [x0 + 0.7, x0 + 1.4]) { const a = P(vx, y0 + d + 0.35, 0), b = P(vx, y0 + d + 0.35, vz); g.rect(a.x - 1.5, b.y, 3, a.y - b.y).fill(c(0xfbf3ea)); }
      poly(g, [P(x0 + 0.62, y0 + d, vz + 0.12), P(x0 + 1.48, y0 + d, vz + 0.12), P(x0 + 1.48, y0 + d + 0.42, vz), P(x0 + 0.62, y0 + d + 0.42, vz)], c(SNOW.top));
      gableRoof(g, x0, y0, h, w, d, 0.75, c(SNOW.left), c(SNOW.top), c(0x8a2626));
      enseigne(extra, g, pal, "Père Noël", x0 + 0.62, x0 + 1.48, y0 + d + 0.42, vz + 0.12, 0xfbf3ea, 0xb02f2f);
      const ccx = x0 + w * 0.7, ccy = y0 + d * 0.3;
      box(g, ccx, ccy, h + 0.25, 0.22, 0.22, 0.55, { top: c(0x5b5f70), left: c(0x9a9286), right: c(0x7d7667) });
      chimneySmoke(extra, anim, P(ccx + 0.11, ccy + 0.11, h + 0.86), rnd(72) * 6);
      if (pal.night && LUMIERE_SOL === "ellipse") { const p = P(cx, y0 + d, 0.4); g.ellipse(p.x, p.y + 8, 60, 18).fill({ color: 0xffd46b, alpha: 0.2 }); }
      break;
    }
    case "postOffice": {
      // le bureau du courrier : maison bleu pâle, enseigne, sacs de lettres et boîte aux lettres rouge
      const w = 1.5, d = 1.15, h = 1.05;
      const x0 = cx - w / 2, y0 = cy - d / 2;
      socle(g, x0, y0, w, d, drop, pal, rnd);
      box(g, x0, y0, 0, w, d, h, { top: c(0x7fa6c8), left: c(0xa9c7e0), right: c(0x7f9fbf) });
      for (const a of [x0 + 0.18, x0 + 1.04]) {
        onLeft(g, y0 + d + 0.01, a, a + 0.28, 0.4, 0.72, pal.night ? 0xffd46b : c(0xffe9a8));
        onLeft(g, y0 + d + 0.012, a + 0.125, a + 0.155, 0.4, 0.72, c(0xfbf3ea));
      }
      onLeft(g, y0 + d + 0.01, x0 + 0.58, x0 + 0.92, 0, 0.6, c(0x3d5a80));
      gableRoof(g, x0, y0, h, w, d, 0.55, c(SNOW.left), c(SNOW.top), c(0x5f7fa0));
      enseigne(extra, g, pal, "Courrier", x0 + 0.25, x0 + w - 0.25, y0 + d, 0.76, 0xd9354b);
      // enveloppe peinte sur le pignon
      const e = P(x0 + w + 0.01, y0 + d / 2, h + 0.18);
      g.rect(e.x - 8, e.y - 5, 16, 11).fill(c(0xfbf3ea)).poly([e.x - 8, e.y - 5, e.x + 8, e.y - 5, e.x, e.y + 2]).stroke({ width: 1.2, color: c(0xd9354b) });
      // sacs de lettres devant la porte
      for (const [sx, sy, k] of [[x0 + 0.25, y0 + d + 0.35, 0], [x0 + 0.48, y0 + d + 0.5, 1], [x0 + 1.25, y0 + d + 0.38, 2]] as const) {
        const q = P(sx, sy);
        g.ellipse(q.x, q.y - 8, 9, 10).fill(c(k === 1 ? 0xd8c39a : 0xc9b07f));
        g.rect(q.x - 3, q.y - 19, 6, 3).fill(c(0x8a6a3d));
        g.rect(q.x - 4, q.y - 10, 8, 5).fill(c(0xfbf3ea)).poly([q.x - 4, q.y - 10, q.x + 4, q.y - 10, q.x, q.y - 7]).stroke({ width: 0.8, color: c(0xd9354b) });
      }
      const mb = P(x0 + w + 0.3, y0 + d + 0.2);
      g.rect(mb.x - 1.5, mb.y - 18, 3, 18).fill(c(0x3d4152));
      g.roundRect(mb.x - 7, mb.y - 30, 14, 13, 4).fill(c(0xd9354b));
      g.rect(mb.x - 4, mb.y - 26, 8, 1.6).fill(c(0x2b2f45));
      break;
    }
    case "stable": {
      // l'écurie des rennes : grange de bois, trois box dont les rennes sortent la tête, bottes de foin
      const w = 2.1, d = 1.3, h = 0.95;
      const x0 = cx - w / 2, y0 = cy - d / 2;
      socle(g, x0, y0, w, d, drop, pal, rnd);
      box(g, x0, y0, 0, w, d, h, { top: c(0x7d4a26), left: c(0xa86b3d), right: c(0x7d4a26) });
      for (let i = 1; i < 9; i++) onLeft(g, y0 + d + 0.004, x0 + i * (w / 9) - 0.008, x0 + i * (w / 9) + 0.008, 0, h, c(0x8a5a2b));
      gableRoof(g, x0, y0, h, w, d, 0.55, c(SNOW.left), c(SNOW.top), c(0x6b3a1c));
      for (let i = 0; i < 3; i++) {
        const a = x0 + 0.2 + i * 0.62;
        onLeft(g, y0 + d + 0.01, a, a + 0.42, 0.5, 0.8, c(0x3d2a1a)); // ouverture du haut
        onLeft(g, y0 + d + 0.01, a, a + 0.42, 0, 0.5, c(0xc8463b)); // demi-porte rouge
        poly(g, [P(a, y0 + d + 0.012, 0.02), P(a + 0.42, y0 + d + 0.012, 0.48), P(a + 0.42, y0 + d + 0.012, 0.42), P(a, y0 + d + 0.012, 0.08)], c(0xfbf3ea));
        // la tête du renne, qui dodeline
        const head = new Container();
        const hg = new Graphics();
        const b = c(0xa86b3d), dk = c(0x7d4a26);
        hg.roundRect(-4, -12, 8, 12, 3).fill(b);
        hg.roundRect(-2, -18, 13, 8, 4).fill(b);
        hg.circle(11, -15, 2.4).fill(c(i === 1 ? 0xd9354b : 0x3d2a1a));
        hg.circle(3, -16, 1).fill(c(0x2b2f45));
        hg.moveTo(0, -18).lineTo(-5, -28).lineTo(-9, -29).moveTo(-3, -23).lineTo(2, -29).stroke({ width: 2, color: dk });
        head.addChild(hg);
        const hp = P(a + 0.21, y0 + d + 0.05, 0.52);
        head.position.set(hp.x, hp.y);
        extra.addChild(head);
        anim.push({ kind: "bob", node: head, phase: i * 2.1 + rnd(73) * 3, y0: hp.y });
      }
      for (const [bx, by] of [[x0 + w + 0.25, y0 + 0.3], [x0 + w + 0.25, y0 + 0.75], [x0 + w + 0.55, y0 + 0.5]] as const) {
        box(g, bx, by, 0, 0.28, 0.4, 0.22, { top: c(0xf0d27a), left: c(0xd8b55a), right: c(0xc29d45) });
      }
      enseigne(extra, g, pal, "Écurie", x0 + 0.55, x0 + w - 0.55, y0 + d, h - 0.02, 0x6b3a1c, 0xffd46b);
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
    case "bush": {
      // buisson enneigé : trois touffes basses coiffées de neige
      const p = P(cx, cy);
      const s = 0.55 + rnd(1) * 0.4;
      for (const [dx, dy, r] of [[-7, 0, 11], [7, -2, 10], [0, -6, 12]] as const) {
        const bx = p.x + dx * s, by = p.y + dy * s, br = r * s;
        g.ellipse(bx, by - br * 0.4, br, br * 0.75).fill(c(rnd(2) > 0.5 ? 0x2b6f52 : 0x225c45));
        g.ellipse(bx - br * 0.2, by - br * 0.85, br * 0.6, br * 0.3).fill(c(0xf7f5f0));
      }
      break;
    }
    case "visitor": {
      // promeneur emmitouflé
      const p = P(cx, cy);
      const coat = [0xd9354b, 0x3f7fb5, 0x2fa37a, 0x8e4fb5, 0xe0a63a, 0xc8463b][Math.floor(rnd(3) * 6)];
      const hat = [0xd9354b, 0xffffff, 0x2b2f45][Math.floor(rnd(4) * 3)];
      g.ellipse(p.x, p.y, 10, 4).fill({ color: c(0x9aa3b8), alpha: 0.3 });
      g.rect(p.x - 5, p.y - 12, 4, 12).fill(c(0x2b2f45));
      g.rect(p.x + 1, p.y - 12, 4, 12).fill(c(0x2b2f45));
      g.roundRect(p.x - 8, p.y - 30, 16, 20, 6).fill(c(coat));
      g.rect(p.x - 8, p.y - 32, 16, 5).fill(c(rnd(5) > 0.5 ? 0xf2e6d2 : 0xd9354b)); // écharpe
      g.circle(p.x, p.y - 37, 6.5).fill(c(0xf2c9a6));
      g.circle(p.x, p.y - 41, 6.5).fill(c(hat));
      g.circle(p.x, p.y - 47, 2.6).fill(c(0xffffff));
      break;
    }
    case "brazier": {
      // brasero : un feu autour duquel on se réchauffe
      const p = P(cx, cy);
      for (const dx of [-7, 0, 7]) g.rect(p.x + dx - 1, p.y - 16, 2.5, 16).fill(c(0x3d4152));
      g.ellipse(p.x, p.y - 18, 13, 6).fill(c(0x4d5265));
      g.ellipse(p.x, p.y - 20, 11, 5).fill(c(0x2b2f45));
      for (let i = 0; i < 3; i++) {
        const fx = p.x + (rnd(6 + i) - 0.5) * 9, fh = 10 + rnd(9 + i) * 12;
        poly(g, [{ x: fx, y: p.y - 20 - fh }, { x: fx - 5, y: p.y - 19 }, { x: fx + 5, y: p.y - 19 }], i === 0 ? 0xffb03a : i === 1 ? 0xff7a2f : 0xffd96b);
      }
      g.circle(p.x, p.y - 26, pal.night ? 40 : 24).fill({ color: 0xffa83a, alpha: pal.night ? 0.22 : 0.1 });
      break;
    }
    case "garland": {
      // guirlande lumineuse tendue entre deux mâts
      const a = P(cx - 0.75, cy - 0.75), b = P(cx + 0.75, cy + 0.75);
      const top = 1.55; // au-dessus des toits d'échoppes
      const pa = P(cx - 0.75, cy - 0.75, top), pb = P(cx + 0.75, cy + 0.75, top);
      g.rect(a.x - 1.6, pa.y, 3.2, a.y - pa.y).fill(c(0x3d4152));
      g.rect(b.x - 1.6, pb.y, 3.2, b.y - pb.y).fill(c(0x3d4152));
      const sag = 16, cols = [0xffd46b, 0xd9354b, 0x7fe3ff, 0x9af2b0];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const x = pa.x + (pb.x - pa.x) * t;
        const y = pa.y + (pb.y - pa.y) * t + Math.sin(t * Math.PI) * sag;
        if (i > 0) {
          const t0 = (i - 1) / 10;
          const x0 = pa.x + (pb.x - pa.x) * t0;
          const y0 = pa.y + (pb.y - pa.y) * t0 + Math.sin(t0 * Math.PI) * sag;
          g.moveTo(x0, y0).lineTo(x, y).stroke({ width: 1.6, color: c(0x4a4f63) });
        }
        const col = cols[i % 4];
        g.circle(x, y + 3, 3.8).fill(pal.night ? col : c(col));
        if (pal.night) g.circle(x, y + 3, 10).fill({ color: col, alpha: 0.18 });
      }
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
  if (!anim.length && !extra.children.length) return g;
  const node: PropNode = new Container();
  node.addChild(g, extra);
  node.anim = anim;
  return node;
}
