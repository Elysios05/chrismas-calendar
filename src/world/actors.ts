// Personnages (Alexandre, Flavie) et la mascotte pingouin, dessinés en vectoriel
import { Container, Graphics } from "pixi.js";
import type { Palette } from "./iso";

export type Who = "alexandre" | "flavie";

export const PLAYERS: Record<Who, { name: string; coat: number; hat: number; pompom: number; hair: number; longHair: boolean }> = {
  alexandre: { name: "Alexandre", coat: 0x2f6fb5, hat: 0x1f3d6b, pompom: 0xffffff, hair: 0x4a2e1f, longHair: false },
  flavie: { name: "Flavie", coat: 0xd9354b, hat: 0xffffff, pompom: 0xd9354b, hair: 0x6b3a22, longHair: true },
};

export class Person extends Container {
  body = new Container();
  legL = new Graphics();
  legR = new Graphics();
  walking = 0;
  t = Math.random() * 10;
  sled = new Graphics();
  skates = new Graphics();
  ride: "sled" | "skates" | null = null;

  who: Who;

  constructor(who: Who, pal: Palette) {
    super();
    this.who = who;
    const p = PLAYERS[who], c = pal.c;
    const shadow = new Graphics().ellipse(0, 0, 13, 5).fill({ color: 0x1b2347, alpha: 0.22 });
    this.legL.roundRect(-6, -14, 5, 14, 2).fill(c(0x2b2f45));
    this.legR.roundRect(1, -14, 5, 14, 2).fill(c(0x2b2f45));
    const g = new Graphics();
    if (p.longHair) g.roundRect(-9, -40, 18, 22, 7).fill(c(p.hair));
    g.roundRect(-10, -34, 20, 22, 7).fill(c(p.coat));
    g.roundRect(-13, -31, 5, 14, 2.5).fill(c(p.coat)); // bras
    g.roundRect(8, -31, 5, 14, 2.5).fill(c(p.coat));
    g.roundRect(-9, -36, 18, 6, 3).fill(c(who === "alexandre" ? 0xffc85a : 0xffffff)); // écharpe
    g.circle(0, -43, 9).fill(c(0xf6cfae));
    g.circle(-3, -43, 1.3).fill(c(0x2b2f45));
    g.circle(3, -43, 1.3).fill(c(0x2b2f45));
    g.circle(-5, -40, 2).fill({ color: c(0xff9a9a), alpha: 0.7 });
    g.circle(5, -40, 2).fill({ color: c(0xff9a9a), alpha: 0.7 });
    g.moveTo(-9.5, -46).arc(0, -46, 9.5, Math.PI, 0).fill(c(p.hat)); // bonnet
    g.rect(-10, -47, 20, 4).fill(c(p.hat === 0xffffff ? 0xe3e6ee : 0x2a5288)); // revers du bonnet
    g.circle(0, -57, 3.5).fill(c(p.pompom));
    // luge (descente des montagnes) et patins (lac gelé)
    this.sled.roundRect(-16, -6, 32, 7, 3).fill(c(0xd9354b)).roundRect(-18, 0, 36, 3, 1.5).fill(c(0xf0b23a));
    this.skates.roundRect(-8, -1, 8, 2, 1).fill(c(0xb9c0cf)).roundRect(1, -1, 8, 2, 1).fill(c(0xb9c0cf));
    this.sled.visible = this.skates.visible = false;
    this.body.addChild(this.legL, this.legR, g, this.skates);
    this.addChild(shadow, this.sled, this.body);
  }

  setRide(r: "sled" | "skates" | null) {
    if (r === this.ride) return;
    this.ride = r;
    this.sled.visible = r === "sled";
    this.skates.visible = r === "skates";
    this.body.y = 0;
    this.body.scale.y = r === "sled" ? 0.82 : 1; // assis sur la luge
  }

  face(right: boolean) { this.body.scale.x = right ? 1 : -1; }

  update(dt: number) {
    this.t += dt * (this.walking ? 0.35 : 0.06);
    const s = Math.sin(this.t);
    if (this.ride) {
      this.legL.y = this.legR.y = 0;
      this.body.y = this.ride === "sled" ? -4 : Math.sin(this.t * 0.5) * 1.5;
      this.rotation = this.ride === "skates" ? Math.sin(this.t * 0.5) * 0.12 : 0;
      return;
    }
    this.rotation = 0;
    if (this.walking) {
      this.legL.y = Math.max(0, s) * -3; this.legR.y = Math.max(0, -s) * -3;
      this.body.y = -Math.abs(s) * 2;
    } else {
      this.legL.y = this.legR.y = 0;
      this.body.y = s * 0.8;
    }
  }
}

export class Penguin extends Container {
  inner = new Container();
  bubble = new Graphics();
  t = 0;
  walking = 0;
  talking = false;

  constructor(pal: Palette) {
    super();
    const c = pal.c;
    const shadow = new Graphics().ellipse(0, 0, 12, 4.5).fill({ color: 0x1b2347, alpha: 0.22 });
    const g = new Graphics();
    g.ellipse(-5, -1, 5, 2.5).fill(c(0xff9a3d)); // pieds
    g.ellipse(5, -1, 5, 2.5).fill(c(0xff9a3d));
    g.ellipse(0, -15, 12, 15).fill(c(0x223056)); // corps
    g.ellipse(0, -12, 8, 11).fill(c(0xffffff)); // ventre
    g.ellipse(-12, -14, 3.5, 8).fill(c(0x1a2546)); // ailes
    g.ellipse(12, -14, 3.5, 8).fill(c(0x1a2546));
    g.circle(0, -31, 10).fill(c(0x223056)); // tête
    g.ellipse(0, -29, 7, 6).fill(c(0xffffff));
    g.circle(-3, -31, 1.8).fill(c(0x1b2340));
    g.circle(3, -31, 1.8).fill(c(0x1b2340));
    g.circle(-2.5, -31.6, 0.6).fill(0xffffff);
    g.circle(3.5, -31.6, 0.6).fill(0xffffff);
    g.poly([-2.5, -28, 2.5, -28, 0, -25]).fill(c(0xff9a3d)); // bec
    g.circle(-5.5, -27, 1.8).fill({ color: c(0xff8fa3), alpha: 0.8 });
    g.circle(5.5, -27, 1.8).fill({ color: c(0xff8fa3), alpha: 0.8 });
    g.roundRect(-9, -23, 18, 4, 2).fill(c(0xd9354b)); // écharpe
    g.roundRect(4, -22, 4, 9, 2).fill(c(0xd9354b));
    g.moveTo(-9, -35).arc(0, -35, 9, Math.PI, 0).fill(c(0xd9354b)); // bonnet
    g.rect(-9.5, -36, 19, 3.5).fill(c(0xffffff));
    g.circle(6, -45, 3.5).fill(c(0xffffff));
    this.bubble.roundRect(-9, -70, 18, 18, 6).fill(0xffffff).poly([-3, -53, 3, -53, 0, -48]).fill(0xffffff);
    this.bubble.roundRect(-1.5, -66, 3, 7, 1.5).fill(0xd9354b).circle(0, -56.5, 1.6).fill(0xd9354b);
    this.inner.addChild(g, this.bubble);
    this.addChild(shadow, this.inner);
  }

  update(dt: number) {
    this.t += dt * (this.walking ? 0.3 : 0.05);
    this.inner.rotation = Math.sin(this.t) * (this.walking ? 0.16 : 0.05);
    this.bubble.visible = this.talking;
    this.bubble.y = Math.sin(this.t * 2) * 1.5;
  }
}
