/**
 * Jour 6 — moteur d'une manche du duel (PixiJS).
 *
 * Tout est calculé en coordonnées « terrain » (x de 0 à 1000, t en ms depuis le début de la
 * manche) : l'écran n'est qu'une projection. Le début de la manche est une heure locale déjà
 * corrigée de l'horloge commune, donc en direct les deux écrans montrent la même pluie au même instant.
 *
 * L'autre hotte vient soit du direct (positions et prises reçues), soit d'un fantôme
 * (trace et prises enregistrées quand l'autre a joué cette manche).
 */

import { Container, Graphics, Text } from "pixi.js";
import type { SoundApi, Who } from "../../core/contracts";
import type { FriandisesContent, TypeFriandise } from "../../data/games/friandises-jour6";
import { creerSaisie, creerScene } from "../shared/scene";
import { DEMI_HOTTE, LIGNE, PAS_TRACE, decompter, pluie, type CoupManche, type Friandise, type Prise } from "./pluie";

const COULEUR: Record<Who, number> = { alexandre: 0x2f6fd6, flavie: 0xd9354b };
const EMOJI: Record<TypeFriandise, string> = { sucre: "🍭", papillote: "🍬", pain: "🍪", charbon: "", etoile: "⭐" };
/** Hauteur de la ligne des hottes à l'écran (fraction de la hauteur) */
const ECRAN_LIGNE = 0.8;

export type Hud = { reste: number; avant: number; points: Record<Who, number>; ralenti: boolean; etoiles: number };

export type OptionsManche = {
  hote: HTMLElement;
  contenu: FriandisesContent;
  m: number;
  moi: Who;
  autre: Who;
  prenoms: Record<Who, string>;
  /** Heure locale (Date.now) du début de la manche */
  debut: number;
  /** L'autre a déjà joué cette manche : on rejoue sa hotte */
  fantome: CoupManche | null;
  direct: boolean;
  sound: SoundApi;
  surHud: (h: Hud) => void;
  surFlash: (texte: string) => void;
  /** En direct : à diffuser */
  surPrise: (p: Prise) => void;
  surHotte: (x: number) => void;
  surFin: (coup: CoupManche) => void;
};

export type Manche = {
  priseDistante(p: Prise): void;
  hotteDistante(x: number): void;
  /** L'autre est parti : sa hotte disparaît */
  sansAutre(): void;
  arreter(): void;
};

type Vue = { f: Friandise; c: Container; prisePar: Who | null; etoileMoi: boolean; etoileLui: boolean };

function dessinerHotte(couleur: number, largeur: number, hauteur: number): Graphics {
  const g = new Graphics();
  const l = largeur / 2;
  // panier en osier, bord coloré
  g.poly([-l, 0, l, 0, l * 0.78, hauteur, -l * 0.78, hauteur]).fill(0x9b6a3c).stroke({ width: 2, color: 0x6b4423 });
  for (let i = 1; i < 3; i++) {
    const y = (hauteur * i) / 3;
    const k = 1 - 0.22 * (y / hauteur);
    g.moveTo(-l * k, y).lineTo(l * k, y).stroke({ width: 2, color: 0x7d5230, alpha: 0.7 });
  }
  g.roundRect(-l - 4, -6, largeur + 8, 10, 5).fill(couleur);
  return g;
}

function dessinerCharbon(r: number): Graphics {
  const g = new Graphics();
  g.poly([-r, -r * 0.2, -r * 0.5, -r * 0.9, r * 0.4, -r * 0.8, r, -r * 0.1, r * 0.6, r * 0.8, -r * 0.4, r * 0.85]).fill(0x2b2b33);
  g.circle(-r * 0.25, -r * 0.3, r * 0.18).fill({ color: 0x5a5a66, alpha: 0.8 });
  g.circle(r * 0.3, r * 0.2, r * 0.12).fill({ color: 0x5a5a66, alpha: 0.6 });
  return g;
}

export async function lancerManche(o: OptionsManche): Promise<Manche | null> {
  const scene = await creerScene(o.hote);
  if (!scene) return null;
  const { app, monde } = scene;
  const saisie = creerSaisie(app.canvas);
  const c = o.contenu;
  const duree = c.secondes * 1000;
  const liste = pluie(c, o.m);

  let W = scene.largeur, H = scene.hauteur;
  const taille = () => Math.max(28, Math.min(54, W * 0.085));
  const px = (x: number) => (x / 1000) * W;
  const py = (frac: number) => (frac / LIGNE) * H * ECRAN_LIGNE;

  /* ---------- décor : neige au sol ---------- */
  const sol = new Graphics();
  const dessinerSol = () => {
    sol.clear();
    const y = H * ECRAN_LIGNE + H * 0.06;
    sol.rect(0, y, W, H - y).fill(0xf4f8fd);
    sol.ellipse(W * 0.2, y + 4, W * 0.32, 14).fill(0xf4f8fd);
    sol.ellipse(W * 0.75, y + 2, W * 0.35, 12).fill(0xf4f8fd);
  };
  dessinerSol();
  monde.addChild(sol);

  const couchePluie = new Container();
  monde.addChild(couchePluie);

  /* ---------- hottes ---------- */
  const creerHotte = (qui: Who, alpha: number) => {
    const ct = new Container();
    const corps = new Container();
    ct.addChild(corps);
    const nom = new Text({ text: o.prenoms[qui], style: { fontFamily: "Fredoka, system-ui, sans-serif", fontSize: 13, fontWeight: "700", fill: COULEUR[qui] } });
    nom.anchor.set(0.5, 0);
    ct.addChild(nom);
    ct.alpha = alpha;
    const refaire = () => {
      corps.removeChildren().forEach((e) => e.destroy());
      const l = (2 * DEMI_HOTTE / 1000) * W;
      corps.addChild(dessinerHotte(COULEUR[qui], l, Math.max(26, H * 0.06)));
      nom.y = Math.max(26, H * 0.06) + 4;
    };
    refaire();
    return { ct, refaire };
  };
  const autreHotte = creerHotte(o.autre, o.fantome ? 0.5 : 0.8);
  const maHotte = creerHotte(o.moi, 1);
  monde.addChild(autreHotte.ct, maHotte.ct);
  autreHotte.ct.visible = o.direct || !!o.fantome;

  scene.surTaille((l, h) => { W = l; H = h; dessinerSol(); maHotte.refaire(); autreHotte.refaire(); for (const v of vues.values()) v.c.destroy({ children: true }); vues.clear(); });

  /* ---------- état ---------- */
  let hx = 500, autreX = 500, autreCible = 500;
  let tmAvant = -Infinity;
  let ralentiJusqua = -Infinity;
  let fini = false;
  let prochaineTrace = 0;
  let prochaineHotte = 0;
  const trace: number[] = [];
  const mesPrises: Prise[] = [];
  const sesPrises: Prise[] = [];
  const prisePar = new Map<string, Who>();
  const etoiles = new Map<string, { moi: boolean; lui: boolean }>();
  const vues = new Map<string, Vue>();
  const parId = new Map(liste.map((f) => [f.id, f]));
  const fantomePrises = (o.fantome?.prises ?? []).slice().sort((a, b) => a.t - b.t);
  let iFantome = 0;
  let annonceEtoiles = 0;

  const enregistrerSienne = (p: Prise) => {
    const f = parId.get(p.id);
    if (!f) return;
    sesPrises.push(p);
    if (f.type === "etoile") {
      const e = etoiles.get(p.id) ?? { moi: false, lui: false };
      e.lui = true; etoiles.set(p.id, e);
      if (e.moi) { o.sound.play("good"); o.surFlash(`✨ +${c.points.etoile} chacun !`); }
      return;
    }
    // la mienne, si je l'avais touchée plus tôt, reste à moi
    const mienne = mesPrises.find((q) => q.id === p.id);
    if (!mienne || mienne.t > p.t) prisePar.set(p.id, o.autre);
  };

  const hud = (tm: number) => {
    const d = decompter(c, liste, { [o.moi]: mesPrises, [o.autre]: sesPrises } as Record<Who, Prise[]>);
    o.surHud({
      reste: Math.max(0, Math.ceil((duree - Math.max(0, tm)) / 1000)),
      avant: tm < 0 ? Math.ceil(-tm / 1000) : 0,
      points: d.points,
      ralenti: tm < ralentiJusqua,
      etoiles: d.etoiles,
    });
    if (d.etoiles > annonceEtoiles) annonceEtoiles = d.etoiles;
  };

  let dernierHud = 0;

  scene.surImage((dt) => {
    if (fini) return;
    const tm = Date.now() - o.debut;

    /* --- déplacement de ma hotte --- */
    const lent = tm < ralentiJusqua ? 0.4 : 1;
    const g = saisie.prendreGlissement();
    hx += (g * 1000 / Math.max(1, W)) * lent + saisie.axeClavier() * dt * 1100 * lent;
    hx = Math.max(DEMI_HOTTE * 0.8, Math.min(1000 - DEMI_HOTTE * 0.8, hx));

    if (tm >= 0) {
      while (prochaineTrace <= tm && prochaineTrace <= duree) { trace.push(Math.round(hx)); prochaineTrace += PAS_TRACE; }
      if (o.direct && tm >= prochaineHotte) { prochaineHotte = tm + 66; o.surHotte(Math.round(hx)); }
    }

    /* --- l'autre hotte : direct ou fantôme --- */
    if (o.fantome) {
      const tr = o.fantome.trace;
      const i = Math.max(0, tm) / PAS_TRACE;
      const a = tr[Math.min(tr.length - 1, Math.floor(i))] ?? 500;
      const b = tr[Math.min(tr.length - 1, Math.floor(i) + 1)] ?? a;
      autreX = a + (b - a) * (i - Math.floor(i));
    } else {
      autreX += (autreCible - autreX) * Math.min(1, dt * 14);
    }

    /* --- mes prises : la friandise franchit la ligne au-dessus de ma hotte --- */
    if (tm >= 0) {
      for (const f of liste) {
        const tLigne = f.t0 + f.chute * LIGNE;
        if (tLigne <= tmAvant || tLigne > tm) continue;
        const ecart = Math.abs(f.x - hx);
        if (ecart > DEMI_HOTTE) continue;
        if (f.type === "etoile") {
          const e = etoiles.get(f.id) ?? { moi: false, lui: false };
          if (e.moi) continue;
          e.moi = true; etoiles.set(f.id, e);
        } else if (prisePar.has(f.id)) continue;
        else prisePar.set(f.id, o.moi);
        // l'écart au centre départage deux hottes qui touchent au même instant
        const p: Prise = { id: f.id, t: tLigne + ecart / 1000 };
        mesPrises.push(p);
        if (o.direct) o.surPrise(p);
        if (f.type === "charbon") {
          ralentiJusqua = tm + c.ralentissement * 1000;
          o.sound.play("bad");
          o.surFlash(`${c.points.charbon} · charbon !`);
        } else if (f.type === "etoile") {
          const e = etoiles.get(f.id)!;
          if (e.lui) { o.sound.play("good"); o.surFlash(`✨ +${c.points.etoile} chacun !`); }
          else { o.sound.play("pop"); o.surFlash(o.direct || o.fantome ? "⭐ À deux, vite !" : "⭐ Il faut être deux…"); }
        } else o.sound.play("pop");
      }
      // le fantôme prend les siennes à l'heure où il les avait prises
      while (iFantome < fantomePrises.length && fantomePrises[iFantome].t <= tm) enregistrerSienne(fantomePrises[iFantome++]);
    }
    tmAvant = tm;

    /* --- affichage de la pluie --- */
    const tailleF = taille();
    for (const f of liste) {
      const frac = (tm - f.t0) / f.chute;
      let v = vues.get(f.id);
      const prise = f.type !== "etoile" && prisePar.has(f.id);
      if (frac < -0.02 || frac > 1.15 || prise) {
        if (v) { v.c.destroy({ children: true }); vues.delete(f.id); }
        continue;
      }
      if (!v) {
        const ct = new Container();
        if (f.type === "charbon") ct.addChild(dessinerCharbon(tailleF * 0.42));
        else {
          const t = new Text({ text: EMOJI[f.type], style: { fontSize: tailleF } });
          t.anchor.set(0.5);
          ct.addChild(t);
        }
        if (f.type === "etoile") {
          const halo = new Graphics().circle(0, 0, tailleF * 0.62).fill({ color: 0xfff3b0, alpha: 0.55 });
          ct.addChildAt(halo, 0);
        }
        couchePluie.addChild(ct);
        v = { f, c: ct, prisePar: null, etoileMoi: false, etoileLui: false };
        vues.set(f.id, v);
      }
      v.c.x = px(f.x);
      v.c.y = py(frac);
      if (f.type === "etoile") {
        const e = etoiles.get(f.id);
        v.c.rotation = Math.sin(tm / 300 + f.x) * 0.25;
        v.c.alpha = e?.moi && e?.lui ? 0.5 : 1;
        v.c.scale.set(e?.moi || e?.lui ? 1.25 : 1);
      } else if (f.type !== "charbon") v.c.rotation = Math.sin(tm / 400 + f.x) * 0.15;
    }

    /* --- hottes --- */
    const yH = H * ECRAN_LIGNE;
    maHotte.ct.x = px(hx); maHotte.ct.y = yH;
    maHotte.ct.alpha = tm < ralentiJusqua ? 0.55 + 0.45 * Math.abs(Math.sin(tm / 90)) : 1;
    autreHotte.ct.x = px(autreX); autreHotte.ct.y = yH;

    if (tm - dernierHud > 120 || tm < 0) { dernierHud = tm; hud(tm); }

    if (tm >= duree + 300) {
      fini = true;
      hud(tm);
      o.surFin({ m: o.m, prises: mesPrises, trace, direct: o.direct });
    }
  });

  return {
    priseDistante: (p) => { if (!fini) enregistrerSienne(p); },
    hotteDistante: (x) => { autreCible = x; },
    sansAutre: () => { autreHotte.ct.visible = false; },
    arreter: () => { fini = true; saisie.detruire(); scene.detruire(); },
  };
}
