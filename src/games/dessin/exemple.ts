/**
 * Mode démo : trois dessins « de l'autre » tracés par le code (pizza, plage, câlin), horodatés
 * comme de vrais dessins pour que le rejeu fonctionne. Toujours les mêmes.
 * Couleurs : indices de PALETTE (0 noir, 1 rouge, 2 vert, 3 bleu, 4 jaune, 5 marron, 6 violet, 7 rose).
 */

import type { Element, Trait } from "../pictionary/dessin";

class Crayon {
  t = 0;
  elements: Element[] = [];
  /** Un trait qui suit les points donnés, 18 ms entre deux points, 250 ms de pause après */
  trait(c: number, e: number, points: [number, number][]) {
    const p: number[] = [];
    for (const [x, y] of points) { p.push(Math.round(x), Math.round(y), this.t); this.t += 18; }
    this.elements.push({ c, e, p } as Trait);
    this.t += 250;
  }
  cercle(c: number, e: number, cx: number, cy: number, r: number, n = 36) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    this.trait(c, e, pts);
  }
  point(c: number, e: number, x: number, y: number) { this.trait(c, e, [[x, y]]); }
}

function pizza(): Element[] {
  const k = new Crayon();
  k.cercle(5, 2, 500, 500, 330);
  k.cercle(4, 1, 500, 500, 290);
  for (const [x, y] of [[420, 380], [600, 420], [380, 560], [560, 600], [480, 480], [650, 560], [470, 690], [330, 450]]) {
    k.cercle(1, 1, x, y, 22, 12);
  }
  k.trait(5, 0, [[500, 210], [500, 790]]);
  k.trait(5, 0, [[210, 500], [790, 500]]);
  k.trait(5, 0, [[295, 295], [705, 705]]);
  k.trait(5, 0, [[705, 295], [295, 705]]);
  return k.elements;
}

function plage(): Element[] {
  const k = new Crayon();
  k.cercle(4, 2, 720, 260, 90);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.trait(4, 1, [[720 + Math.cos(a) * 125, 260 + Math.sin(a) * 125], [720 + Math.cos(a) * 175, 260 + Math.sin(a) * 175]]);
  }
  for (const y of [520, 600, 680]) {
    const pts: [number, number][] = [];
    for (let x = 60; x <= 940; x += 30) pts.push([x, y + Math.sin(x / 45) * 18]);
    k.trait(3, 1, pts);
  }
  const sable: [number, number][] = [];
  for (let x = 60; x <= 940; x += 40) sable.push([x, 800 + Math.sin(x / 120) * 25]);
  k.trait(5, 1, sable);
  // un petit bateau
  k.trait(0, 1, [[200, 470], [360, 470], [330, 510], [230, 510], [200, 470]]);
  k.trait(0, 1, [[280, 470], [280, 330], [350, 450], [280, 450]]);
  return k.elements;
}

function calin(): Element[] {
  const k = new Crayon();
  // deux bonshommes qui se serrent
  k.cercle(0, 1, 380, 330, 70);
  k.cercle(0, 1, 620, 330, 70);
  k.trait(0, 1, [[380, 400], [400, 650]]);
  k.trait(0, 1, [[620, 400], [600, 650]]);
  k.trait(0, 1, [[400, 650], [340, 850]]);
  k.trait(0, 1, [[400, 650], [450, 850]]);
  k.trait(0, 1, [[600, 650], [550, 850]]);
  k.trait(0, 1, [[600, 650], [660, 850]]);
  k.trait(0, 1, [[390, 470], [520, 520], [610, 470]]);
  k.trait(0, 1, [[610, 480], [480, 540], [390, 480]]);
  // un cœur au-dessus
  const coeur: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = 16 * Math.sin(a) ** 3;
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    coeur.push([500 + x * 6, 150 - y * 6]);
  }
  k.trait(1, 2, coeur);
  return k.elements;
}

export const DESSINS_EXEMPLE: Element[][] = [pizza(), plage(), calin()];
