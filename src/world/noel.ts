// Les habitants ajoutés pour que chaque monde soit un lieu de vie de Noël (issue #155) :
// chien, bouvreuils, pingouins, chamois, Saint-Nicolas et son âne, chorale, marchand de marrons,
// enfants en luge, pêcheur sur la glace, feu de camp, bonhomme de neige en cours, carrousel,
// Père Noël, lucioles de glace ; et les promeneurs et rennes du décor, qui bougent pour de bon.
// Le dessin, les gestes et les réactions au toucher sont ici ; `life.ts` les appelle.
import { Container, Graphics, Text } from "pixi.js";
import type { Sfx } from "../core/contracts";
import { shade } from "./iso";
import { heightAt, key, type Terrain } from "./terrain";
import { ZONES } from "./zones";
import type { Critter, Species } from "./life";

type Pt2 = { x: number; y: number };

/** Outils de dessin prêtés par `drawCritter` */
export type Aide = {
  c: (n: number) => number;
  rnd: (n: number) => number;
  g: Graphics;
  shadow: Graphics;
  sh: (w: number) => void;
  leg: (x: number, w: number, h: number, col: number) => void;
  person: (coat: number, hat: number, scale?: number, opts?: { scarf?: number; elf?: boolean }) => void;
  coat: number;
  hat: number;
  coats: number[];
  night: boolean;
};

export const NOEL_VITESSE: Partial<Record<Species, number>> = {
  dog: 0.026, bird: 0, penguin: 0.007, chamois: 0.014, nicolas: 0.0055, singer: 0, chestnut: 0, sledder: 0.012,
  fisher: 0, campfire: 0, roller: 0.0045, carousel: 0, santa: 0.006, firefly: 0.009,
};
export const NOEL_HAUTEUR: Partial<Record<Species, number>> = {
  dog: 20, bird: 14, penguin: 26, chamois: 36, nicolas: 60, singer: 46, chestnut: 46, sledder: 30,
  fisher: 36, campfire: 40, roller: 34, carousel: 100, santa: 56, firefly: 14,
};
export const NOEL_CRIS: Partial<Record<Species, Sfx>> = {
  dog: "fox", bird: "owl", penguin: "seal", chamois: "reindeer", nicolas: "jingle", singer: "jingle", chestnut: "pop",
  sledder: "snowball", fisher: "pop", campfire: "whoosh", roller: "snowball", carousel: "jingle", santa: "jingle", firefly: "hover",
};
/** perchés ou en l'air : rangés un peu devant, pour passer devant le sapin qui les porte */
export const NOEL_PERCHES = new Set<Species>(["bird", "firefly"]);

/* ------------------------------------------------------------------ */
/* Dessin                                                               */
/* ------------------------------------------------------------------ */

export function drawNoel(cr: Critter, A: Aide) {
  const { c, rnd, g, sh, leg } = A;
  const B = cr.body;
  switch (cr.species) {
    case "dog": {
      // chien joueur, collier rouge ; la queue frétille
      sh(11);
      const f = c(0x9a6a3d), d = c(0x6b4328);
      leg(-7, 3, 7, 0x6b4328); leg(4, 3, 7, 0x6b4328);
      g.ellipse(0, -10, 10, 5.5).fill(f);
      g.ellipse(1, -8, 6, 3).fill(c(0xe9d3b0));
      g.circle(9, -16, 5.2).fill(f);
      g.ellipse(13.5, -14.5, 3.6, 2.6).fill(c(0xe9d3b0));
      g.circle(16.5, -15, 1.4).fill(c(0x2b2f45));
      g.circle(10.5, -17.5, 1).fill(c(0x2b2f45));
      g.ellipse(6, -15, 2.4, 4.4).fill(d); // oreille tombante
      g.rect(5, -13, 3, 4).fill(c(0xd9354b)); // collier
      const tail = new Graphics().roundRect(-1.5, -9, 3, 9, 1.5).fill(d);
      tail.position.set(-9, -12);
      cr.parts.tail = tail;
      B.addChild(tail, g);
      break;
    }
    case "bird": {
      // bouvreuil : dos gris, ventre rouge, calotte noire
      A.shadow.alpha = 0;
      g.roundRect(-9, -8, 6, 2.5, 1).fill(c(0x2b2f45)); // queue
      g.circle(0, -6, 5).fill(c(0x5c6275));
      g.ellipse(1.5, -4.5, 4, 3.6).fill(c(0xe0533d));
      g.circle(3.5, -10.5, 3.4).fill(c(0x2b2f45));
      g.ellipse(4.2, -9, 2.4, 1.6).fill(c(0xe0533d));
      g.poly([6.5, -11, 9, -10, 6.5, -9]).fill(c(0x3d4152));
      g.circle(4.4, -11.2, 0.7).fill(0xffffff);
      const w1 = new Graphics().ellipse(0, 0, 3, 5).fill(c(0x3d4152));
      w1.position.set(-2, -7);
      const w2 = new Graphics().ellipse(0, 0, 3, 5).fill(c(0x3d4152));
      w2.position.set(1, -7);
      cr.parts.w1 = w1; cr.parts.w2 = w2;
      B.addChild(w1, g, w2);
      break;
    }
    case "penguin": {
      sh(8);
      leg(-4, 4, 2, 0xe0a63a); leg(1, 4, 2, 0xe0a63a);
      const k = c(0x2b2f45);
      g.ellipse(0, -11, 7, 11).fill(k);
      g.ellipse(1.8, -10, 4.6, 8.4).fill(c(0xffffff));
      g.circle(1, -22, 5.5).fill(k);
      g.ellipse(2.6, -21.5, 3, 2.8).fill(c(0xffffff));
      g.circle(3.4, -22.5, 0.9).fill(k);
      g.poly([5.5, -21.5, 9, -20.5, 5.5, -19.5]).fill(c(0xe0a63a));
      // certains portent une écharpe de Noël
      if (rnd(40) < 0.5) g.rect(-5, -17.5, 11, 2.6).fill(c(rnd(41) < 0.5 ? 0xd9354b : 0x2fa37a));
      const fl = new Graphics().ellipse(0, 4, 2.2, 6).fill(k);
      fl.position.set(-4, -15);
      cr.arm = fl;
      B.addChild(g, fl);
      break;
    }
    case "chamois": {
      // chamois des sommets : pelage brun gris, masque clair, petites cornes en crochet
      sh(13);
      const b = c(0x8a6a4a), d = c(0x5a4330);
      for (const lx of [-9, -4, 5, 9]) leg(lx, 2.6, 13, 0x5a4330);
      g.roundRect(-12, -22, 24, 11, 5).fill(b);
      g.ellipse(-11, -17, 3, 3).fill(c(0xefe4d2));
      g.roundRect(7, -33, 7, 14, 3).fill(b);
      g.roundRect(9, -38, 11, 7, 3).fill(c(0xe9dfcc));
      g.rect(11, -38, 2, 7).fill(d);
      g.circle(14, -36, 1).fill(c(0x2b2f45));
      g.moveTo(11, -38).quadraticCurveTo(10, -46, 7, -45).moveTo(14, -38).quadraticCurveTo(13, -46, 10, -45)
        .stroke({ width: 1.8, color: c(0x2b2f45) });
      B.addChild(g);
      break;
    }
    case "nicolas": {
      // Saint-Nicolas, mitre et crosse, qui mène son âne chargé de cadeaux (l'âne marche derrière lui)
      sh(12);
      A.shadow.ellipse(-30, 0, 16, 5).fill({ color: 0x1b2347, alpha: 0.2 });
      const ane = c(0x8f8a86), aneD = c(0x6f6a66);
      for (const lx of [-41, -36, -26, -21]) leg(lx, 3, 13, 0x5f5a56);
      g.ellipse(-31, -19, 14, 7.5).fill(ane);
      g.ellipse(-31, -15, 10, 3).fill(c(0xd8d2cc));
      g.roundRect(-46, -22, 4, 10, 2).fill(aneD); // queue
      g.roundRect(-20, -32, 7, 14, 3).fill(ane); // cou
      g.roundRect(-18, -35, 12, 8, 4).fill(ane);
      g.ellipse(-7, -30.5, 3.4, 2.8).fill(c(0xd8d2cc));
      g.roundRect(-19, -46, 3, 12, 1.5).fill(aneD); g.roundRect(-15, -45, 3, 11, 1.5).fill(ane); // longues oreilles
      g.circle(-11, -33, 1).fill(c(0x2b2f45));
      // les paniers de cadeaux sur le bât
      g.roundRect(-40, -30, 18, 6, 2).fill(c(0xb5562a));
      for (const [x, w, h, col] of [[-39, 6, 6, 0xd9354b], [-33, 5, 8, 0x2fa37a], [-28, 5, 5, 0xffd46b]] as const) {
        g.rect(x, -30 - h, w, h).fill(c(col)).rect(x + w / 2 - 0.6, -30 - h, 1.2, h).fill(c(0xffffff));
      }
      g.moveTo(-8, -30).quadraticCurveTo(-2, -22, 5, -23).stroke({ width: 1, color: c(0x5a3c25) }); // longe
      // le saint : longue robe rouge bordée d'or, chape, barbe blanche
      leg(-4, 4, 4, 0x3d2a1a); leg(1, 4, 4, 0x3d2a1a);
      g.roundRect(-8, -34, 16, 31, 5).fill(c(0xb3262f));
      g.rect(-1.5, -34, 3, 31).fill(c(0xe8c25a));
      g.roundRect(-9, -35, 18, 7, 3).fill(c(0xe8c25a));
      g.circle(0, -39, 6).fill(c(0xf2c9a6));
      g.ellipse(1, -34.5, 6.2, 6.5).fill(c(0xffffff));
      g.circle(2.6, -40, 0.9).fill(c(0x2b2f45));
      // mitre
      g.poly([-6, -43, 6, -43, 5, -52, 0, -58, -5, -52]).fill(c(0xd9354b));
      g.rect(-0.8, -56, 1.6, 12).fill(c(0xe8c25a)).rect(-4, -50, 8, 1.6).fill(c(0xe8c25a));
      // crosse dorée
      g.moveTo(10, -2).lineTo(10, -56).stroke({ width: 2, color: c(0xe8c25a) });
      g.arc(13.5, -56, 3.5, Math.PI, Math.PI * 2.4).stroke({ width: 2, color: c(0xe8c25a) });
      const arm = new Graphics().roundRect(-2, 0, 4, 11, 2).fill(c(0x8f1f27));
      arm.position.set(6, -30); arm.rotation = -0.25;
      cr.arm = arm;
      B.addChild(g, arm);
      break;
    }
    case "singer": {
      // choriste : aube rouge à col blanc, carnet de chants
      A.person(rnd(42) < 0.5 ? 0xb3262f : 0x2f6f5a, rnd(43) < 0.5 ? 0xffffff : 0xd9354b);
      g.roundRect(-9, -14, 18, 13, 4).fill(c(rnd(42) < 0.5 ? 0xb3262f : 0x2f6f5a)); // bas de l'aube
      g.rect(-8, -32, 16, 5).fill(c(0xffffff));
      g.rect(3, -27, 9, 7).fill(c(0xffffff)).rect(7.2, -27, 0.8, 7).fill(c(0x9aa3b8));
      const mouth = new Graphics().ellipse(0, 0, 1.4, 1.4).fill(c(0x8f1f27));
      mouth.position.set(1.5, -34.2);
      cr.parts.mouth = mouth;
      B.addChild(mouth);
      break;
    }
    case "chestnut": {
      // marchand de marrons chauds : chariot, brasero rougeoyant, petite cheminée qui fume
      A.person(0x7d4a26, 0x2b2f45, 1, { scarf: 0xd9354b });
      const cart = new Graphics()
        .roundRect(8, -20, 24, 13, 2).fill(c(0x9a5a2b))
        .rect(8, -15, 24, 1.6).fill(c(0x7d4a26))
        .circle(12, -4, 4).fill(c(0x3d4152)).circle(28, -4, 4).fill(c(0x3d4152))
        .circle(12, -4, 1.3).fill(c(0xb9c0cf)).circle(28, -4, 1.3).fill(c(0xb9c0cf))
        .ellipse(20, -22, 10, 4).fill(c(0x2b2f45))
        .rect(26, -38, 3.4, 15).fill(c(0x3d4152));
      const coals = new Graphics().ellipse(20, -23, 7.5, 2.6).fill(0xff8a3d);
      for (let i = 0; i < 6; i++) coals.circle(14 + i * 2.4, -23.5 + (i % 2), 1.6).fill(0x6b3b22);
      const sign = new Graphics().roundRect(9, -33, 14, 8, 2).fill(c(0xf2e6d2));
      const txt = new Text({ text: "Marrons", style: { fontFamily: "Fredoka", fontWeight: "700", fontSize: 5, fill: c(0xb3262f) } });
      txt.anchor.set(0.5); txt.position.set(16, -29);
      cr.parts.coals = coals;
      const puffs = new Container();
      puffs.position.set(27.7, -40);
      for (let i = 0; i < 3; i++) puffs.addChild(new Graphics().circle(0, 0, 4 + i).fill(0xdfe4ee));
      cr.parts.puffs = puffs;
      B.addChild(cart, coals, sign, txt, puffs);
      break;
    }
    case "sledder": {
      // deux poses : assis sur la luge à la descente, debout qui la tire à la remontée
      const ride = new Container(), walk = new Container();
      const coat = A.coat, hat = A.hat;
      const sled = (x: number) => new Graphics()
        .roundRect(x - 13, -7, 26, 4, 2).fill(c(0xd9354b))
        .moveTo(x - 14, -1).lineTo(x + 11, -1).quadraticCurveTo(x + 16, -1, x + 15, -6).stroke({ width: 1.6, color: c(0x7d4a26) })
        .rect(x - 9, -3, 1.6, 2.4).fill(c(0x7d4a26)).rect(x + 6, -3, 1.6, 2.4).fill(c(0x7d4a26));
      ride.addChild(sled(0));
      ride.addChild(new Graphics()
        .roundRect(0, -12, 11, 4.5, 2).fill(c(0x2b2f45))
        .roundRect(-6, -24, 11, 14, 4).fill(c(coat))
        .rect(-12, -22, 9, 3).fill(c(0xd9354b)).rect(-6, -24, 11, 3.5).fill(c(0xd9354b))
        .circle(0, -28, 5).fill(c(0xf2c9a6)).circle(2, -28.5, 0.8).fill(c(0x2b2f45))
        .circle(0, -31, 5).fill(c(hat)).circle(0, -35.5, 2).fill(c(0xffffff)));
      const s = 0.74;
      walk.addChild(sled(-24));
      walk.addChild(new Graphics().moveTo(-12, -6).lineTo(5, -18).stroke({ width: 1, color: c(0x5a3c25) }));
      for (const lx of [-5 * s, 1 * s]) {
        const l = new Graphics().roundRect(lx, -12 * s, 4 * s, 12 * s, 2 * s).fill(c(0x2b2f45));
        cr.legs.push(l); walk.addChild(l);
      }
      walk.addChild(new Graphics()
        .roundRect(-8 * s, -30 * s, 16 * s, 20 * s, 6 * s).fill(c(coat))
        .rect(-8 * s, -32 * s, 16 * s, 5 * s).fill(c(0xd9354b))
        .circle(0, -37 * s, 6.5 * s).fill(c(0xf2c9a6)).circle(2.6 * s, -37.5 * s, 0.9 * s).fill(c(0x2b2f45))
        .circle(0, -41 * s, 6.5 * s).fill(c(hat)).circle(0, -47 * s, 2.6 * s).fill(c(0xffffff)));
      sh(12);
      cr.parts.ride = ride; cr.parts.walk = walk;
      B.addChild(ride, walk);
      break;
    }
    case "fisher": {
      // pêcheur assis sur son tabouret, au bord d'un trou dans la glace
      sh(12);
      A.shadow.tint = 0x5f86a8;
      g.ellipse(18, 0, 7, 3.4).fill(c(0xeaf8fd)).ellipse(18, 0, 5, 2.4).fill(c(0x1f4f78));
      g.rect(-6, -10, 3, 10).fill(c(0x7d4a26)).rect(3, -10, 3, 10).fill(c(0x7d4a26)).roundRect(-8, -12, 16, 3, 1.5).fill(c(0x9a5a2b));
      g.roundRect(2, -17, 11, 5, 2).fill(c(0x3d4152)).roundRect(10, -17, 4, 15, 2).fill(c(0x3d4152)); // jambes repliées
      g.roundRect(-7, -32, 14, 20, 5).fill(c(0x2f6f5a));
      g.rect(-7, -33, 14, 4).fill(c(0xe0a63a));
      g.circle(0, -38, 6).fill(c(0xf2c9a6)).circle(2.4, -38.5, 0.9).fill(c(0x2b2f45));
      g.roundRect(-7, -46, 14, 7, 3).fill(c(0x7d4a26)).rect(-8, -41, 3, 6).fill(c(0x7d4a26)); // chapka
      g.rect(-14, -6, 8, 6).fill(c(0x9a5a2b)).rect(-14, -6, 8, 1.4).fill(c(0x7d4a26)); // seau
      // canne : pivote à la main ; le fil descend du bout jusqu'au trou
      const rod = new Graphics().moveTo(0, 0).lineTo(16, -14).stroke({ width: 1.4, color: c(0x5a3c25) });
      rod.position.set(6, -22);
      const line = new Graphics();
      const fish = new Graphics().ellipse(0, 0, 5, 2.4).fill(0xe0a63a).poly([-4, 0, -8, -3, -8, 3]).fill(0xe0a63a).circle(2.6, -0.6, 0.7).fill(0x2b2f45);
      fish.visible = false;
      cr.parts.rod = rod; cr.parts.line = line; cr.parts.fish = fish;
      B.addChild(g, line, rod, fish);
      break;
    }
    case "campfire": {
      // une clairière : un feu qui crépite, deux promeneurs assis sur des rondins qui se réchauffent les mains
      sh(30);
      const glow = new Graphics().circle(0, -8, 46).fill({ color: 0xffa040, alpha: 1 });
      glow.alpha = A.night ? 0.22 : 0.08;
      glow.blendMode = "add";
      const seat = (x: number, y: number, dir: 1 | -1, coat: number, hat: number) => {
        const s = new Container();
        s.position.set(x, y);
        s.scale.x = dir;
        s.addChild(new Graphics()
          .roundRect(-12, -6, 20, 6, 3).fill(c(0x7d4a26)).ellipse(8, -3, 2, 3).fill(c(0xc8a06a))
          .roundRect(-2, -12, 10, 4, 2).fill(c(0x2b2f45)).roundRect(5, -12, 4, 12, 2).fill(c(0x2b2f45))
          .roundRect(-8, -28, 13, 18, 5).fill(c(coat))
          .rect(-8, -29, 13, 4).fill(c(0xf2e6d2))
          .circle(-1.5, -34, 5.5).fill(c(0xf2c9a6)).circle(0.8, -34.5, 0.8).fill(c(0x2b2f45))
          .circle(-1.5, -37.5, 5.5).fill(c(hat)).circle(-1.5, -42.5, 2.2).fill(c(0xffffff)));
        const arm = new Graphics().roundRect(-1.8, 0, 3.6, 10, 1.8).fill(c(shade(coat, -0.15)));
        arm.position.set(2, -25); arm.rotation = -1.2;
        s.addChild(arm);
        return { s, arm };
      };
      const L = seat(-22, -2, 1, A.coat, A.hat);
      const R = seat(22, 2, -1, A.coats[Math.floor(rnd(44) * A.coats.length)], 0x2b2f45);
      const ring = new Graphics();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ring.circle(Math.cos(a) * 10, Math.sin(a) * 4.5, 2.6).fill(c(0x8a8f9e)); }
      ring.roundRect(-8, -4, 16, 3.4, 1.7).fill(c(0x6b4328)).roundRect(-3, -6, 6, 8, 2).fill(c(0x5a3c25));
      const flame = new Graphics()
        .poly([-7, 0, 0, -22, 7, 0]).fill(0xff7a2f)
        .poly([-4.5, 0, -1, -15, 2.5, 0]).fill(0xffc24a)
        .poly([0, 0, 3, -12, 6, 0]).fill(0xffc24a)
        .poly([-2, 0, 0.5, -7, 3, 0]).fill(0xfff2b0);
      flame.position.set(0, -3);
      cr.parts.flame = flame; cr.parts.glow = glow; cr.parts.armL = L.arm; cr.parts.armR = R.arm;
      B.addChild(glow, L.s, ring, flame, R.s);
      break;
    }
    case "roller": {
      // enfant qui roule une grosse boule de neige : la boule grossit en avançant
      A.person(A.coat, A.hat, 0.74, { scarf: 0xd9354b });
      if (cr.arm) cr.arm.rotation = -1.35;
      const ball = new Graphics().circle(0, 0, 10).fill(c(0xffffff)).circle(0, 0, 10).stroke({ width: 1, color: c(0xc6cfe0) })
        .moveTo(-6, -3).lineTo(5, 4).stroke({ width: 1, color: c(0xdde3ee) });
      cr.parts.ball = ball;
      B.addChild(ball);
      break;
    }
    case "carousel": {
      // manège de chevaux de bois : plateau, mât doré, chapiteau rayé ; les chevaux tournent et montent
      sh(48);
      const base = new Graphics()
        .ellipse(0, 2, 44, 20).fill(c(0x8f1f27))
        .ellipse(0, -2, 44, 20).fill(c(0xd9354b))
        .ellipse(0, -3, 38, 16.5).fill(c(0xf2e6d2));
      const ride = new Container();
      ride.sortableChildren = true;
      const mat = new Graphics().rect(-4, -80, 8, 78).fill(c(0xe8c25a));
      mat.zIndex = 0;
      ride.addChild(mat);
      const horses: Container[] = [];
      const cols = [0xffffff, 0xf2d9b8, 0xffffff, 0xd8d2cc, 0xffffff, 0xf2d9b8];
      const saddles = [0xd9354b, 0x3f7fb5, 0x2fa37a, 0xe0a63a, 0x8e4fb5, 0xd9354b];
      for (let i = 0; i < 6; i++) {
        const h = new Container();
        const pole = new Graphics().rect(-0.8, -66, 1.6, 66).fill(c(0xe8c25a));
        const hg = new Graphics()
          .roundRect(-9, -26, 18, 8, 4).fill(c(cols[i]))
          .roundRect(6, -34, 5, 11, 2).fill(c(cols[i]))
          .roundRect(7, -36, 9, 5, 2).fill(c(cols[i]))
          .rect(5, -35, 3, 9).fill(c(0xe0a63a))
          .roundRect(-12, -26, 4, 8, 2).fill(c(0xe0a63a))
          .rect(-7, -19, 2, 8).fill(c(cols[i])).rect(4, -19, 2, 8).fill(c(cols[i]))
          .rect(-3, -27, 7, 4).fill(c(saddles[i]))
          .circle(11.5, -34.5, 0.8).fill(c(0x2b2f45));
        h.addChild(pole);
        const body = new Container();
        body.addChild(hg);
        h.addChild(body);
        horses.push(h);
        ride.addChild(h);
      }
      const roof = new Graphics();
      const n = 12, rx = 50, ry = 18, top = -104, rim = -78;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
        // seule la moitié avant du chapiteau se voit
        roof.poly([0, top, Math.cos(a0) * rx, rim + Math.sin(a0) * ry, Math.cos(a1) * rx, rim + Math.sin(a1) * ry]).fill(c(i % 2 ? 0xffffff : 0xd9354b));
      }
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI;
        roof.circle(Math.cos(a) * rx, rim + Math.sin(a) * ry + 2, 4).fill(c(i % 2 ? 0xd9354b : 0xffffff));
      }
      roof.star(0, top - 4, 5, 6, 3).fill(0xffd46b);
      const lights = new Graphics();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI;
        lights.circle(Math.cos(a) * rx, rim + Math.sin(a) * ry + 7, 1.8).fill(A.night ? 0xfff2b0 : c(0xffd46b));
      }
      cr.parts.ride = ride; cr.parts.lights = lights;
      cr.parts.horses = horses;
      B.addChild(base, ride, roof, lights);
      break;
    }
    case "santa": {
      // le Père Noël en personne
      sh(14);
      leg(-7, 6, 12, 0x2b2f45); leg(1, 6, 12, 0x2b2f45);
      g.roundRect(-12, -38, 24, 30, 10).fill(c(0xd9354b));
      g.rect(-12, -12, 24, 4).fill(c(0xffffff));
      g.rect(-1.8, -38, 3.6, 27).fill(c(0xffffff));
      g.rect(-12, -25, 24, 4).fill(c(0x2b2f45)).rect(-3.5, -26, 7, 6).fill(c(0xe8c25a)).rect(-1.8, -24.5, 3.6, 3).fill(c(0x2b2f45));
      g.circle(0, -44, 7).fill(c(0xf2c9a6));
      g.ellipse(0.5, -38.5, 8.5, 7.5).fill(c(0xffffff));
      g.ellipse(-2, -42, 3.4, 1.6).fill(c(0xffffff)).ellipse(3, -42, 3.4, 1.6).fill(c(0xffffff));
      g.circle(1.5, -43.5, 1.6).fill(c(0xf0a0a0));
      g.circle(-2.4, -46, 1).fill(c(0x2b2f45)); g.circle(3.6, -46, 1).fill(c(0x2b2f45));
      g.poly([-7.5, -49, 7.5, -49, 13, -60]).fill(c(0xd9354b));
      g.roundRect(-8.5, -51.5, 17, 4.5, 2).fill(c(0xffffff));
      g.circle(13.5, -60, 3).fill(c(0xffffff));
      const arm = new Graphics().roundRect(-2.5, 0, 5, 13, 2.5).fill(c(0xb82c40)).rect(-2.5, 10, 5, 2.4).fill(c(0xffffff)).circle(0, 14.5, 2.8).fill(c(0x2b2f45));
      arm.position.set(10, -35); arm.rotation = -0.25;
      cr.arm = arm;
      const bubble = new Container();
      const t = new Text({ text: "Oh oh oh !", style: { fontFamily: "Fredoka", fontWeight: "700", fontSize: 13, fill: 0xb3262f } });
      t.anchor.set(0.5);
      const bg = new Graphics().roundRect(-t.width / 2 - 8, -11, t.width + 16, 22, 11).fill(0xffffff).poly([-4, 10, 4, 10, -2, 17]).fill(0xffffff);
      bubble.addChild(bg, t);
      bubble.position.set(4, -80);
      bubble.visible = false;
      cr.parts.bubble = bubble;
      B.addChild(g, arm);
      cr.addChild(bubble);
      cr.scale.set(1.12);
      break;
    }
    case "firefly": {
      // luciole de glace : un point bleu clair qui flotte et palpite
      A.shadow.alpha = 0;
      const glow = new Graphics().circle(0, 0, 9).fill({ color: 0x7fe3ff, alpha: 0.28 }).circle(0, 0, 4.5).fill({ color: 0xbff4ff, alpha: 0.55 }).circle(0, 0, 2).fill(0xffffff);
      glow.blendMode = "add";
      B.addChild(glow);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Gestes de chaque image                                               */
/* ------------------------------------------------------------------ */

/** Une bouffée ou une étincelle éphémère, dans le repère de l'habitant */
function particule(cr: Critter, x: number, y: number, col: number, r: number, vx: number, vy: number, vie: number) {
  const p = new Graphics().circle(0, 0, r).fill(col) as Graphics & { v?: { vx: number; vy: number; vie: number; t: number } };
  p.position.set(x, y);
  p.v = { vx, vy, vie, t: 0 };
  cr.addChild(p);
  cr.fx.push(p);
}

export function gesteNoel(cr: Critter, dt: number, moving: boolean) {
  const s = cr.species;
  const t = cr.t;
  const P2 = cr.parts;
  switch (s) {
    case "dog":
      if (P2.tail) P2.tail.rotation = -0.6 + Math.sin(t * (moving ? 0.5 : 0.25)) * 0.5;
      break;
    case "bird": {
      const flying = cr.zoff > cr.base + 0.05 || cr.react?.k === "fly";
      for (const [i, w] of [P2.w1, P2.w2].entries()) if (w) w.rotation = flying ? Math.sin(t * 0.9) * 1.2 * (i ? -1 : 1) : 0;
      if (!flying && !cr.react) {
        // petits sautillements sur la branche, et il regarde de l'autre côté
        cr.body.y = -(Math.max(0, Math.sin(t * 0.12)) ** 8) * 4;
        if (Math.random() < 0.004 * dt) cr.body.scale.x *= -1;
      }
      break;
    }
    case "penguin":
      // il se dandine en marchant ; à plat ventre quand il glisse
      if (cr.react?.k === "flee") { cr.body.rotation = 1.25 * cr.body.scale.x; cr.body.y = -3; }
      else if (!cr.react) cr.inner.rotation = moving ? Math.sin(t * 0.3) * 0.16 : 0;
      if (cr.arm && !cr.react) cr.arm.rotation = moving ? Math.sin(t * 0.3) * 0.5 : 0.2;
      break;
    case "nicolas":
      if (cr.arm && !cr.react) cr.arm.rotation = -0.5;
      break;
    case "singer": {
      // la chorale chante en chœur : tous se balancent au même rythme
      const ph = performance.now() * 0.004;
      cr.body.rotation = Math.sin(ph) * 0.06;
      if (P2.mouth) P2.mouth.scale.y = 0.6 + Math.abs(Math.sin(ph * 2.2 + cr.gx)) * 1.2;
      if (Math.random() < 0.006 * dt) cr.chanter();
      break;
    }
    case "chestnut": {
      if (P2.coals) P2.coals.alpha = 0.75 + Math.sin(t * 0.2) * 0.25;
      if (P2.puffs) (P2.puffs as Container).children.forEach((pf: Container, i: number) => {
        const u = ((t * 0.012 + i / 3) % 1);
        pf.y = -u * 30; pf.x = Math.sin(u * 4 + i) * 4 * u; pf.alpha = 0.8 * (1 - u); pf.scale.set(0.6 + u * 1.2);
      });
      if (cr.arm && !cr.react) cr.arm.rotation = -0.9 + Math.sin(t * 0.08) * 0.3; // il remue les marrons
      break;
    }
    case "sledder": {
      const m = cr.mover;
      const down = m.kind === "sled" && m.t < 1;
      if (P2.ride) P2.ride.visible = down;
      if (P2.walk) P2.walk.visible = !down;
      break;
    }
    case "fisher": {
      const rod = P2.rod, line = P2.line;
      if (rod && !cr.react) {
        // la canne frémit de temps en temps : ça mord ?
        const bite = Math.sin(t * 0.02) > 0.93;
        rod.rotation = bite ? Math.sin(t * 0.9) * 0.12 : Math.sin(t * 0.03) * 0.03;
      }
      if (rod && line) {
        const a = rod.rotation;
        const tx = rod.x + Math.cos(a - 0.72) * 21.3, ty = rod.y + Math.sin(a - 0.72) * 21.3;
        line.clear().moveTo(tx, ty).lineTo(18, 0).stroke({ width: 0.7, color: 0x3d4152, alpha: 0.7 });
      }
      break;
    }
    case "campfire": {
      const f = P2.flame;
      const boost = cr.react?.k === "flare" ? 1 + Math.sin(Math.min(1, cr.react.t / 90) * Math.PI) * 0.8 : 1;
      if (f) { f.scale.set((0.9 + Math.sin(t * 0.5) * 0.08) * boost, (0.85 + Math.sin(t * 0.37) * 0.15 + Math.random() * 0.06) * boost); }
      if (P2.glow) P2.glow.scale.set(0.95 + Math.sin(t * 0.3) * 0.05);
      if (Math.random() < 0.05 * dt * boost) particule(cr, (Math.random() - 0.5) * 8, -16, 0xffc24a, 1.2, (Math.random() - 0.5) * 0.3, -0.6 - Math.random() * 0.5, 50);
      const warm = (a: Graphics | undefined, k: number) => { if (a) a.rotation = cr.react?.k === "flare" ? -2.5 + Math.sin(t * 0.3 + k) * 0.4 : -1.25 + Math.sin(t * 0.06 + k) * 0.12; };
      warm(P2.armL, 0); warm(P2.armR, 2);
      break;
    }
    case "roller": {
      // la boule grossit en roulant ; arrivée au bout, elle est finie : on en recommence une
      const b = P2.ball;
      if (!b) break;
      if (moving) cr.etat = Math.min(1, cr.etat + 0.0016 * dt);
      const r = 4 + cr.etat * 10;
      b.scale.set(r / 10);
      b.position.set(9 + r, -r);
      if (moving) b.rotation += 0.06 * dt;
      if (cr.etat >= 1 && cr.wait > 0) { b.alpha = Math.max(0, b.alpha - 0.01 * dt); if (b.alpha <= 0) { cr.etat = 0; b.alpha = 1; } }
      break;
    }
    case "carousel": {
      const fast = cr.react?.k === "spin2" ? 1 + Math.sin(Math.min(1, cr.react.t / 200) * Math.PI) * 2.5 : 1;
      cr.etat += 0.012 * dt * fast;
      const horses = P2.horses as Container[] | undefined;
      horses?.forEach((h, i) => {
        const a = cr.etat + (i / horses.length) * Math.PI * 2;
        h.position.set(Math.cos(a) * 31, Math.sin(a) * 12.5 - 4);
        h.zIndex = Math.sin(a);
        h.scale.x = -Math.sin(a) >= 0 ? 1 : -1;
        const body = h.children[1];
        if (body) body.y = -6 - Math.sin(cr.etat * 2.2 + i * 1.7) * 5;
      });
      if (P2.lights) P2.lights.alpha = 0.7 + Math.sin(t * 0.15) * 0.3;
      break;
    }
    case "santa":
      if (cr.arm && !cr.react) cr.arm.rotation = moving ? Math.sin(t * 0.32) * 0.3 - 0.1 : -0.25;
      if (P2.bubble && !cr.react) P2.bubble.visible = false;
      break;
    case "firefly": {
      cr.zoff = cr.base + Math.sin(t * 0.04 + cr.gx) * 0.35;
      cr.body.alpha = 0.55 + Math.sin(t * 0.09 + cr.gy * 3) * 0.45;
      break;
    }
    case "elfHammer":
      // étincelles à chaque coup de marteau
      if (cr.arm && cr.arm.rotation > 0.05 && cr.etat === 0) {
        cr.etat = 1;
        for (let i = 0; i < 4; i++) particule(cr, 16 + (Math.random() - 0.5) * 6, -17, 0xffd46b, 1.1, (Math.random() - 0.5) * 1.4, -0.6 - Math.random() * 0.8, 24);
      } else if (cr.arm && cr.arm.rotation < -0.5) cr.etat = 0;
      break;
    case "owl":
      // la chouette tourne la tête de temps en temps
      if (!cr.react && Math.random() < 0.003 * dt) cr.body.scale.x *= -1;
      break;
  }
  // bouffées et étincelles
  for (let i = cr.fx.length - 1; i >= 0; i--) {
    const p = cr.fx[i] as Graphics & { v?: { vx: number; vy: number; vie: number; t: number } };
    const v = p.v!;
    v.t += dt;
    p.x += v.vx * dt; p.y += v.vy * dt; v.vy += 0.01 * dt;
    p.alpha = Math.max(0, 1 - v.t / v.vie);
    if (v.t >= v.vie) { p.destroy(); cr.fx.splice(i, 1); }
  }
}

/** Ces espèces gèrent leurs pattes elles-mêmes (ou n'en ont pas) */
export const SANS_PATTES = new Set<Species>(["bird", "fisher", "campfire", "carousel", "firefly", "chestnut", "singer"]);

/* ------------------------------------------------------------------ */
/* Toucher                                                              */
/* ------------------------------------------------------------------ */

/** Réaction propre aux nouveaux habitants ; faux si `life.ts` doit s'en charger */
export function pokeNoel(cr: Critter): boolean {
  switch (cr.species) {
    case "dog": case "roller": case "sledder": cr.react = { k: "hop", t: 0 }; return true;
    case "bird": cr.react = { k: "fly", t: 0 }; return true;
    case "nicolas": case "chestnut": cr.react = { k: "wave", t: 0 }; return true;
    case "singer": cr.react = { k: "sing", t: 0 }; for (let i = 0; i < 5; i++) cr.chanter(); return true;
    case "fisher": cr.react = { k: "catch", t: 0 }; return true;
    case "campfire": cr.react = { k: "flare", t: 0 }; return true;
    case "carousel": cr.react = { k: "spin2", t: 0 }; return true;
    case "santa": cr.react = { k: "laugh", t: 0 }; if (cr.parts.bubble) cr.parts.bubble.visible = true; return true;
  }
  return false;
}

/** Fait avancer les réactions propres aux nouveaux habitants ; null si ce n'en est pas une */
export function reactNoel(cr: Critter, _dt: number, end: () => void): boolean | null {
  const r = cr.react!;
  switch (r.k) {
    case "sing": {
      cr.body.y = -Math.abs(Math.sin(r.t * 0.2)) * 5;
      if (cr.arm) cr.arm.rotation = -2.4 + Math.sin(r.t * 0.25) * 0.4;
      if (r.t > 80) end();
      return false;
    }
    case "catch": {
      // il ferre et sort un poisson, qui frétille au bout du fil avant de replonger
      const f = cr.parts.fish, rod = cr.parts.rod;
      const u = Math.min(1, r.t / 120);
      if (rod) rod.rotation = -Math.sin(Math.min(1, u * 3) * Math.PI / 2) * 0.5;
      if (f) {
        f.visible = u > 0.12 && u < 0.92;
        const e = Math.sin(((u - 0.12) / 0.8) * Math.PI);
        f.position.set(18 + e * 2, -e * 26);
        f.rotation = Math.sin(r.t * 0.8) * 0.5;
      }
      if (u >= 1) { if (f) f.visible = false; end(); }
      return false;
    }
    case "flare":
      if (r.t > 90) end();
      return false;
    case "spin2":
      if (r.t > 200) end();
      return false;
    case "laugh": {
      // « Oh oh oh ! » : le ventre tressaute, il fait coucou
      cr.body.scale.y = 1 + Math.abs(Math.sin(r.t * 0.35)) * 0.06;
      if (cr.arm) cr.arm.rotation = -2.6 + Math.sin(r.t * 0.3) * 0.45;
      const b = cr.parts.bubble;
      if (b) { b.visible = true; b.alpha = Math.min(1, (130 - r.t) / 20); b.y = -80 - Math.min(8, r.t * 0.3); }
      if (r.t > 130) { if (b) b.visible = false; end(); }
      return false;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Placement                                                            */
/* ------------------------------------------------------------------ */

type Ground = { ok: (x: number, y: number, o?: { lake?: boolean; road?: boolean }) => boolean; clear: (a: Pt2, b: Pt2, o?: { lake?: boolean; road?: boolean }) => boolean };
type Mover = Critter["mover"];
export type Semeur = {
  t: Terrain;
  G: Ground;
  R: () => number;
  add: (sp: Species, x: number, y: number, mover: Mover) => Critter;
  /** ce point est caché (pied de la montagne de la grotte) : n'y rien poser */
  cache: (x: number, y: number) => boolean;
};

/** Décors qui deviennent de vrais habitants : ils ne sont plus dessinés comme décor */
export function vivant(p: { kind: string; attelage?: boolean }) {
  return p.kind === "visitor" || (p.kind === "deer" && !p.attelage);
}

export function spawnNoel({ t, G, R, add, cache }: Semeur) {
  const zoneIdx = (id: string) => ZONES.findIndex((z) => z.id === id);
  const cellOf = (x: number, y: number) => t.cells.get(key(Math.floor(x), Math.floor(y)));
  const libre = (x: number, y: number) => G.ok(x, y) && !cache(x, y);
  // jamais collé à une case : son étiquette le cacherait, et il volerait le doigt
  const loinDesCases = (x: number, y: number, d = 2) => t.nodes.every((n) => Math.hypot(n.x + 0.5 - x, n.y + 0.5 - y) > d);
  const cases = (id: string, f: (c: { d: number; road: boolean; lake: boolean; front: boolean }) => boolean) => {
    const z = zoneIdx(id);
    return [...t.cells.values()].filter((c) => c.zone === z && f(c));
  };
  const tirer = <T,>(a: T[]) => a.splice(Math.floor(R() * a.length), 1)[0];
  /** rien de haut juste devant (côté caméra) : un sapin cacherait le feu ou le manège */
  const HAUTS = new Set(["tree", "treeSmall", "house", "stall", "bigTree", "lamp", "garland", "wheel", "chalet", "igloo", "crystal", "icicle", "cane"]);
  const devantLibre = (q: Pt2, r = 2.6) => t.props.every((p) => !HAUTS.has(p.kind)
    || p.x + 0.5 + p.y + 0.5 <= q.x + q.y + 0.3 || Math.hypot(p.x + 0.5 - q.x, p.y + 0.5 - q.y) > r);
  /** écart au milieu du monde, le long du chemin (0 au milieu, 1 aux frontières) */
  const milieu = (id: string) => {
    const z = zoneIdx(id);
    const pis = t.path.map((p, i) => (p.zone === z ? i : -1)).filter((i) => i >= 0);
    const a = Math.min(...pis), b = Math.max(...pis);
    return (x: number, y: number) => { const c = cellOf(x, y); return c ? Math.abs(c.pi - (a + b) / 2) / ((b - a) / 2 || 1) : 9; };
  };
  const errants = (id: string, sp: Species, n: number, dMin: number, dMax: number, r: number) => {
    const cands = cases(id, (c) => !c.road && !c.lake && c.d > dMin && c.d < dMax).filter((c) => libre(c.x + 0.5, c.y + 0.5));
    const out: Critter[] = [];
    for (let i = 0; i < n && cands.length; i++) {
      const c = tirer(cands);
      out.push(add(sp, c.x + 0.5, c.y + 0.5, { kind: "wander", home: { x: c.x + 0.5, y: c.y + 0.5 }, r }));
    }
    return out;
  };
  /** une place libre autour d'un point, la plus proche de la route (on la voit mieux) */
  const placeAutour = (cx: number, cy: number, rMin: number, rMax: number, marge: [number, number][] = [[0, 0]]) => {
    const spots: Pt2[] = [];
    for (let r = rMin; r <= rMax; r += 0.35) for (let a = 0; a < 6.28; a += 0.3) spots.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    return spots
      .filter((q) => marge.every(([ex, ey]) => libre(q.x + ex, q.y + ey)) && loinDesCases(q.x, q.y))
      .sort((a, b) => (cellOf(a.x, a.y)?.d ?? 99) - (cellOf(b.x, b.y)?.d ?? 99))[0] ?? null;
  };
  /** une ligne de pente : de `a`, vers l'aval, sur 3 cases praticables */
  const pente = (id: string, dMin: number, dMax: number, drop: number) => {
    const z = zoneIdx(id);
    const cands = [...t.cells.values()].filter((c) => c.zone === z && !c.road && !c.lake && c.d > dMin && c.d < dMax && !c.front);
    for (let k = 0; k < 80 && cands.length; k++) {
      const c = cands[Math.floor(R() * cands.length)];
      const a = { x: c.x + 0.5, y: c.y + 0.5 };
      if (!libre(a.x, a.y) || !loinDesCases(a.x, a.y, 2.4)) continue;
      let best: Pt2 | null = null, bh = heightAt(t, a.x, a.y);
      for (let ang = 0; ang < 6.28; ang += 0.4) {
        const b = { x: a.x + Math.cos(ang) * 3, y: a.y + Math.sin(ang) * 3 };
        const h = heightAt(t, b.x, b.y);
        if (h < bh - drop && G.clear(a, b) && !cache(b.x, b.y) && loinDesCases(b.x, b.y, 2.4)) { bh = h; best = b; }
      }
      if (best) return { a, b: best };
    }
    return null;
  };

  /* --- les promeneurs et les rennes du décor prennent vie --- */
  for (const p of t.props) {
    if (!vivant(p) || cache(p.x + 0.5, p.y + 0.5)) continue;
    const home = { x: p.x + 0.5, y: p.y + 0.5 };
    if (p.kind === "visitor") add("villager", home.x, home.y, { kind: "wander", home, r: 1.3 });
    else add("reindeer", home.x, home.y, { kind: "wander", home, r: 1.8 });
  }

  /* --- montagnes : chamois, enfants en luge, bouvreuils --- */
  errants("montagnes", "chamois", 3, 3, 7, 2);
  for (let i = 0; i < 2; i++) {
    const L = pente("montagnes", 1.8, 4.5, 0.6);
    if (L) add("sledder", L.a.x, L.a.y, { kind: "sled", a: L.a, b: L.b, t: R() * 2 });
  }
  const perches = (id: string, n: number, dMax: number) => {
    const z = zoneIdx(id);
    const trees = t.props.filter((p) => p.kind === "tree" && p.zone === z && (t.cells.get(key(Math.round(p.x), Math.round(p.y)))?.d ?? 99) < dMax && !cache(p.x + 0.5, p.y + 0.5));
    for (let i = 0; i < n && trees.length; i++) {
      const p = tirer(trees);
      const o = add("bird", p.x + 0.5, p.y + 0.5, { kind: "still" });
      o.base = 1.25 + R() * 0.25; o.zoff = o.base;
    }
  };
  perches("montagnes", 2, 4);

  /* --- village : Saint-Nicolas et son âne, chorale, marrons, chien, bonhomme de neige en cours --- */
  {
    const z = zoneIdx("saint-nicolas");
    const road = t.path.filter((p) => p.zone === z);
    if (road.length > 10) {
      const side = 0.4;
      const pts = road.slice(2, road.length - 2).map((p, j, a) => {
        const q = a[Math.min(a.length - 1, j + 1)], o = a[Math.max(0, j - 1)];
        const dx = q.x - o.x, dy = q.y - o.y, L = Math.hypot(dx, dy) || 1;
        return { x: p.x + 0.5 - (dy / L) * side, y: p.y + 0.5 + (dx / L) * side };
      });
      add("nicolas", pts[0].x, pts[0].y, { kind: "route", pts, t: (pts.length - 1) * 0.35, dir: 1 });
    }
    const n6 = t.nodes.find((n) => n.day === 6);
    const sapin = t.props.find((p) => p.kind === "bigTree" && p.zone === z);
    if (sapin) {
      // la chorale se tient sur la place, à côté du grand sapin, tournée vers la rue
      const spot = placeAutour(sapin.x + 0.5, sapin.y + 0.5, 1.2, 3.2, [[0, 0], [0.55, -0.35], [-0.55, 0.35]]);
      if (spot) for (const [i, [dx, dy]] of ([[-0.55, 0.35], [0, 0], [0.55, -0.35]] as const).entries()) {
        const s = add("singer", spot.x + dx, spot.y + dy, { kind: "still" });
        s.face(n6 ? n6.x - spot.x : 1, n6 ? n6.y - spot.y : 0);
        s.t = i * 40;
      }
    }
    const bord = cases("saint-nicolas", (c) => !c.road && c.d > 1.1 && c.d < 1.9).filter((c) => libre(c.x + 0.5, c.y + 0.5) && libre(c.x + 1.2, c.y + 0.5) && loinDesCases(c.x + 0.5, c.y + 0.5, 2.6));
    if (bord.length) { const c = tirer(bord); add("chestnut", c.x + 0.5, c.y + 0.5, { kind: "still" }).face(1, -1); }
    const pres = cases("saint-nicolas", (c) => !c.road && c.d > 1.5 && c.d < 4).filter((c) => loinDesCases(c.x + 0.5, c.y + 0.5, 2.4));
    for (let k = 0; k < 60 && pres.length; k++) {
      const c = tirer(pres);
      const a = { x: c.x + 0.5, y: c.y + 0.5 }, b = { x: a.x + 2.6, y: a.y - 0.6 };
      if (!libre(a.x, a.y) || !libre(b.x, b.y) || !G.clear(a, b)) continue;
      add("roller", a.x, a.y, { kind: "route", pts: [a, b], t: 0, dir: 1 });
      break;
    }
    // le chien du village gambade autour des passants
    errants("saint-nicolas", "dog", 2, 1.3, 3.5, 2.6);
    perches("saint-nicolas", 2, 5);
  }

  /* --- forêt et lac : pêcheur, feu de camp, bouvreuils --- */
  {
    const z = zoneIdx("lac");
    const lake = [...t.cells.values()].filter((c) => c.lake && c.zone === z);
    // au bord du lac, sur la glace, côté route : on le voit bien
    const bords = lake.filter((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !t.cells.get(key(c.x + dx, c.y + dy))?.lake)
      && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => t.cells.get(key(c.x + dx, c.y + dy))?.lake).length >= 3
      && loinDesCases(c.x + 0.5, c.y + 0.5, 2.6) && !c.road)
      .sort((a, b) => a.d - b.d);
    if (bords.length) { const c = bords[Math.min(bords.length - 1, Math.floor(R() * Math.min(4, bords.length)))]; add("fisher", c.x + 0.5, c.y + 0.5, { kind: "still" }).face(1, -1); }
    const mL = milieu("lac");
    const clairieres = cases("lac", (c) => !c.road && !c.lake && !c.front && c.d > 1.8 && c.d < 4.5)
      .map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }))
      .filter((q) => [[0, 0], [-0.6, 0], [0.6, 0], [0, -0.5], [0, 0.5]].every(([ex, ey]) => libre(q.x + ex, q.y + ey)) && loinDesCases(q.x, q.y, 2.8) && devantLibre(q));
    // derrière la route (le brouillard mange le premier plan), plutôt vers le milieu de la forêt
    clairieres.sort((a, b) => mL(a.x, a.y) - mL(b.x, b.y));
    if (clairieres.length) { const q = clairieres[Math.floor(R() * Math.min(3, clairieres.length))]; add("campfire", q.x, q.y, { kind: "still" }); }
    perches("lac", 4, 5);
  }

  /* --- marché : carrousel --- */
  {
    // au cœur du marché, près de l'allée ; s'il est trop serré, on élargit peu à peu la recherche
    const mM = milieu("marche");
    const croix = [[0, 0], [-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]];
    const essais: [number, number, number][] = [[0.7, 6, 2.4], [0.85, 8, 1.8], [1, 10, 0]];
    let q: Pt2 | null = null;
    for (const [mMax, dMax, rDevant] of essais) {
      const big = cases("marche", (c) => !c.road && c.d > 1.5 && c.d < dMax)
        .map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }))
        .filter((p) => mM(p.x, p.y) < mMax && croix.every(([ex, ey]) => libre(p.x + ex, p.y + ey)) && loinDesCases(p.x, p.y, 3)
          && (!rDevant || devantLibre(p, rDevant)));
      const score = (p: Pt2) => mM(p.x, p.y) * 4 + (cellOf(p.x, p.y)?.d ?? 99) * 0.3;
      q = big.sort((a, b) => score(a) - score(b))[0] ?? null;
      if (q) break;
    }
    if (q) add("carousel", q.x, q.y, { kind: "still" });
    else console.warn("[monde] pas de place pour le carrousel");
  }

  /* --- grotte : pingouins qui glissent, lucioles de glace --- */
  errants("grotte", "penguin", 4, 1.1, 3, 1.5);
  for (const f of errants("grotte", "firefly", 10, 1, 3.5, 1.6)) { f.base = 0.7 + R() * 0.6; f.zoff = f.base; }

  /* --- pôle Nord : le Père Noël devant chez lui --- */
  {
    const z = zoneIdx("pole-nord");
    const sh = t.props.find((p) => p.kind === "santaHouse" && p.zone === z);
    const spot = sh && placeAutour(sh.x + 0.5, sh.y + 0.5, 2.6, 4.5);
    if (spot) add("santa", spot.x, spot.y, { kind: "wander", home: spot, r: 1.2 });
    else console.warn("[monde] pas de place pour le Père Noël");
    errants("pole-nord", "penguin", 2, 2, 5, 1.6);
  }
}
