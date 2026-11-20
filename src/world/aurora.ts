// Aurores boréales du pôle Nord (issue #48).
// Trois voiles texturés (maillage à colonnes verticales, variante « voiles » choisie par Alexandre) qui ondulent lentement dans le haut de l'écran, glissés entre le sol et
// le décor : les sapins, maisons et lutins passent devant. Les textures sont générées une seule fois sur
// un canevas, puis seuls les points des rubans bougent à chaque image. Un halo doux teinte la neige.
import { Container, MeshSimple, Sprite, Texture } from "pixi.js";

type Rgb = [number, number, number];
type Band = { mesh: MeshSimple; y: number; h: number; amp: number; speed: number; phase: number; alpha: number };

const N = 40; // colonnes par rideau

/** Texture d'un ruban : x le long du ruban, y à travers (0 = haut). Bas vert vif, milieu turquoise, haut violet qui s'efface. */
function ribbonTexture(haut: [number, number, number], seed: number): Texture {
  const W = 512, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  // intensité par colonne : une ondulation lente, sans stries (variante « voiles » choisie par Alexandre)
  const col = new Float32Array(W);
  for (let x = 0; x < W; x++) col[x] = 0.75 + 0.25 * Math.sin((x / W) * Math.PI * 4 + seed);
  const vert: [number, number, number] = [80, 245, 170];
  const mid: [number, number, number] = [70, 210, 220];
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1); // 0 en haut, 1 en bas
    // couleur : violet (haut) → turquoise → vert (bas)
    const c = t < 0.55
      ? haut.map((v, i) => v + (mid[i] - v) * (t / 0.55))
      : mid.map((v, i) => v + (vert[i] - v) * ((t - 0.55) / 0.45));
    // opacité : s'efface vers le haut, bord bas adouci
    const a = Math.pow(t, 1.1) * Math.min(1, (1 - t) * 3.5);
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2];
      img.data[k + 3] = 255 * a * col[x];
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(cv);
}

/** Halo radial pour le reflet sur la neige */
function glowTexture(): Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(110,240,190,1)");
  g.addColorStop(0.5, "rgba(120,170,240,0.45)");
  g.addColorStop(1, "rgba(150,120,240,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return Texture.from(cv);
}

export class Aurora extends Container {
  private bands: Band[] = [];
  private glow: Sprite;

  constructor() {
    super();
    this.eventMode = "none";
    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.addChild(this.glow);
    // y : bas du rideau (fraction de la hauteur d'écran) ; h : sa hauteur ; amp : ondulation du bas
    const defs = [
      { y: 0.42, h: 0.3, amp: 34, speed: 0.00022, phase: 0, alpha: 0.85, haut: [140, 110, 240] as Rgb },
      { y: 0.33, h: 0.26, amp: 28, speed: -0.00018, phase: 1.7, alpha: 0.7, haut: [210, 120, 220] as Rgb },
      { y: 0.25, h: 0.2, amp: 22, speed: 0.00015, phase: 3.9, alpha: 0.55, haut: [120, 140, 240] as Rgb },
    ];
    defs.forEach((d, i) => {
      // deux sommets par colonne (haut, bas) : les stries restent verticales quelle que soit l'ondulation
      const uvs = new Float32Array(N * 4), indices = new Uint32Array((N - 1) * 6);
      for (let j = 0; j < N; j++) {
        const u = j / (N - 1);
        uvs.set([u, 0, u, 1], j * 4);
        if (j < N - 1) indices.set([j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2], j * 6);
      }
      const mesh = new MeshSimple({ texture: ribbonTexture(d.haut, 1234 + i * 777), vertices: new Float32Array(N * 4), uvs, indices });
      this.addChild(mesh);
      this.bands.push({ mesh, ...d });
    });
  }

  /** `force` : 0 hors du pôle Nord, 1 en plein dedans ; `ms` : temps écoulé total */
  update(ms: number, force: number, night: boolean, W: number, H: number) {
    this.visible = force > 0.01;
    if (!this.visible) return;
    const blend = night ? "add" : "normal";
    // de jour on teinte franchement (l'additif se perdrait dans la neige), la nuit on illumine
    const k = force * (night ? 0.9 : 0.95);
    const s = Math.min(W, H) / 700; // ondulations proportionnées à l'écran
    for (const b of this.bands) {
      const v = b.mesh.vertices;
      for (let j = 0; j < N; j++) {
        const u = j / (N - 1);
        // le rideau déborde de l'écran à gauche et à droite pour que ses extrémités ne se voient pas
        const x = -W * 0.15 + u * W * 1.3;
        const t = ms * b.speed;
        const bas = b.y * H + (Math.sin(u * 4.1 + t * 6 + b.phase) + 0.35 * Math.sin(u * 9 - t * 9 + b.phase * 2)) * b.amp * s;
        const h = b.h * H * (0.6 + 0.4 * Math.sin(u * 3.3 - t * 4 + b.phase * 1.3));
        // le haut penche un peu : le rideau a l'air de se plisser au vent solaire
        const pente = Math.sin(u * 2.7 + t * 5 + b.phase) * 18 * s;
        v.set([x + pente, bas - h, x, bas], j * 4);
      }
      b.mesh.vertices = v;
      b.mesh.blendMode = blend;
      // respiration lente de l'intensité
      b.mesh.alpha = b.alpha * k * (0.8 + 0.2 * Math.sin(ms * 0.0006 + b.phase));
    }
    // reflet : une grande tache douce sur la neige, sous les voiles
    this.glow.position.set(W * 0.5, H * 0.55);
    this.glow.width = W * 1.4;
    this.glow.height = H * 0.45;
    this.glow.blendMode = blend;
    this.glow.alpha = force * (night ? 0.22 : 0.14) * (0.85 + 0.15 * Math.sin(ms * 0.0005));
  }
}
