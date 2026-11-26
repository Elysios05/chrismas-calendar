// Scène PixiJS : terrain continu isométrique, caméra liée au défilement, ambiance, personnages
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { P, ZH, mix, poly, makePalette, type Palette, type Pt } from "./iso";
import { buildTerrain, heightAt, key, type Cell, type DayNode, type PathCell, type PlacedProp, type Terrain } from "./terrain";
import { drawProp, type AnimPart, type PropKind } from "./props";
import { ZONES } from "./zones";
import { weatherAt } from "./weather";
import { Aurora } from "./aurora";
import { PLAYERS, Person, Penguin, type Who } from "./actors";
import { makeGround, poke, spawnLife, updateCritter, type Critter, type LifeEnv } from "./life";
import type { CouleursJoueur, JoueurSalon, SoundApi, ZoneId } from "../core/contracts";
import { Inclinaison } from "./inclinaison";
import { Survol, ZOOM_SURVOL, marquerPresente, mondesPresentes, oublierPresentations } from "./presentation";

export type NodeState = "locked" | "available" | "opened";
export type SceneCallbacks = {
  onNodeTap: (day: number) => void;
  onZone: (zoneIndex: number) => void;
  /** Le temps qu'il fait là où l'on regarde (« Tempête sur le lac »…), si l'interface veut l'afficher */
  onWeather?: (label: string) => void;
};

/** Jour 21 : le sapin décoré à deux, dessiné en petit à côté du cadeau */
const JOUR_SAPIN = 21;
/** Résumé du sapin pour la carte (même forme que `ResumeCarte` de src/games/sapin/regles.ts) */
export type SapinCarte = { points: { x: number; y: number; couleur: number }[]; guirlandes: number[]; etoile: boolean; total: number };
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
/** Halo rond, blanc au centre et transparent au bord : la lumière propre du cadeau du jour */
function haloTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
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

/** Les grands bâtiments débordent de leur case : on les range un peu plus loin pour qu'ils passent derrière ce qui les entoure */
const BATIMENTS_LARGES = new Set(["wheel", "workshop", "santaHouse", "postOffice", "stable"]);

/** Durée d'une tranche de reconstruction en arrière-plan (ms). Les tranches sont des tâches à part,
 *  pas liées aux images : le navigateur glisse ses images entre elles, et la reconstruction avance
 *  aussi vite sur un téléphone qui rame que sur un ordinateur (environ la moitié du temps chacun). */
const TRANCHE_MS = 8;

/** Issue #14 : on prépare d'avance ce qui est à moins d'un demi-écran, on détruit ce qui est à plus d'un écran */
const ECRANS_AVANCE = 0.5;
const ECRANS_GARDES = 1;
/** Hauteur maximale d'un décor au-dessus de son pied (px) : sert à placer une tranche jamais dessinée.
 *  Large exprès : une tranche chargée un peu tôt ne coûte rien, une tranche qui apparaît en retard se voit.
 *  En développement, la console signale un décor plus haut que prévu. */
const HAUTEUR_DECOR: Partial<Record<PropKind, number>> = { mountain: 520, ridge: 400, wheel: 260, workshop: 220, bigTree: 260 };

/** Un morceau du monde (bande de sol, tronçon de route ou tranche de décors) que l'on sait placer sans
 *  le dessiner. `min` / `max` : étendue verticale dans le monde, estimée puis mesurée au premier dessin. */
type Lot = {
  couche: "sol" | "objets";
  /** profondeur (x + y) du début du lot : sert au banc de nuages qui ferme la carte */
  k: number;
  zIndex: number;
  min: number;
  max: number;
  mesure?: boolean;
  cellules?: Cell[];
  route?: [number, number];
  decors?: PlacedProp[];
};
type Charge = { c: Container; anims: AnimPart[] };
/** Là où l'on range un lot dessiné : la scène affichée, ou une scène en construction */
type Cible = { pal: Palette; flying: boolean; ground: Container; objects: Container; charges: Map<number, Charge> };

/** Une scène complète dessinée avec une palette, prête à prendre la place de l'actuelle (issue #23) */
type Built = {
  pal: Palette;
  /** états des cases au moment où elle a été dessinée : on rattrape à l'échange ce qui a changé depuis */
  states: Map<number, NodeState>;
  flying: boolean;
  ground: Container;
  objects: Container;
  labels: Container;
  finCarte: Container;
  panneauFin: Container;
  gifts: Map<number, Container>;
  /** lots dessinés dans cette scène, par numéro de lot */
  charges: Map<number, Charge>;
  people: Record<Who, Person>;
  penguin: Penguin | null;
  life: Critter[];
};

export class Scene {
  app: Application;
  cb: SceneCallbacks;
  terrain: Terrain = buildTerrain();
  world = new Container();
  ground = new Container();
  objects = new Container();
  tint = new Graphics();
  /** « sous la montagne » : dans la grotte, tout ce qui est dehors (avant l'entrée, après la sortie) est plongé dans le noir */
  dehors = new Container();
  private dehorsVoiles: Sprite[] = [];
  // aurores en voiles (choix d'Alexandre, issue #48)
  aurora = new Aurora();
  fog = new Sprite();
  clouds: { s: Sprite; v: number; base: number }[] = [];
  cloudLayer = new Container();
  // au-dessus du voile de nuit et du brouillard (issue #24) : les numéros des cases et la lumière
  // du cadeau du jour ne s'assombrissent jamais. Le calque suit la caméra du monde à chaque image.
  overlay = new Container();
  giftLight = new Sprite();
  /** Halo doux autour de son propre personnage (issue #10), surtout le soir */
  playerLight = new Sprite();
  /** Pencher le téléphone fait dériver la neige (issue #10) */
  inclinaison = new Inclinaison();
  labels = new Container();
  snowLayer = new Container();
  whiteout = new Graphics();
  pal: Palette;
  scale = 1;
  minY = 0;
  maxY = 0;
  /** bord bas du terrain (monde) : la caméra ne descend jamais plus bas (#113) */
  basY = Infinity;
  padTop = 120;
  scrollY = 0;
  camX = 0;
  people: Record<Who, Person> = {} as Record<Who, Person>;
  /** Couleurs des personnages : celles du salon, sinon les valeurs par défaut */
  apparence: Record<Who, CouleursJoueur> = { alexandre: PLAYERS.alexandre, flavie: PLAYERS.flavie };
  pos: Record<Who, number> = { alexandre: 0, flavie: 0 };
  penguin!: Penguin;
  penguinPos = 0;
  leader: Who = "alexandre";
  gifts = new Map<number, Container>();
  states = new Map<number, NodeState>();
  flakes: { s: Sprite; vy: number; ph: number; z: number }[] = [];
  zoneNow = -1;
  light = 0;
  retirerNavigation: (() => void) | null = null;
  marcheScriptee = false;
  finCarte = new Container();
  /** Le panneau vit à part : il se range parmi les décors, à sa propre profondeur */
  panneauFin = new Container();
  limiteDepth = Infinity;
  /** Profondeur au-delà de laquelle aucun cadeau ne se montre */
  limiteCadeaux = Infinity;
  /** Ordonnée, dans le monde, du banc de nuages qui ferme la carte (null = carte entière ouverte) */
  yFin: number | null = null;
  focus: { x: number; y: number; zoom: number } | null = null;
  /** Présentation d'un monde à la première arrivée (issue #12) : survol de la route en cours */
  survol: Survol | null = null;
  /** Mondes déjà présentés au joueur qui tient la caméra (relus si le joueur change) */
  presentes: { who: Who; zones: Set<string> } | null = null;
  /** Dernier défilement vu, et depuis quand il n'a pas bougé : on n'arrive dans un monde qu'à l'arrêt */
  reposScroll = { y: -1, depuis: 0 };
  /** Crochet de test : instant figé du survol (ms depuis son début), pour le photographier */
  survolFige: number | null = null;
  /** Le monde d'où l'on vient (-1 au chargement) : décide du sens du survol */
  zoneAvant = -1;
  confetti: { g: Graphics; vx: number; vy: number; rot: number; life: number }[] = [];
  confettiLayer = new Container();
  time = 0;
  boundaries: number[] = [];
  nodeY: number[] = [];
  /** Le monde découpé en lots (issue #14) ; seuls ceux autour de l'écran sont dessinés (`charges`) */
  lots: Lot[] = this.decouperLots();
  charges = new Map<number, Charge>();
  /** Lots à préparer en arrière-plan, du plus proche au plus lointain, et celui en cours */
  aPrecharger: number[] = [];
  prechargement: { i: number; c: Container; gen: Generator<void, void> } | null = null;
  weatherNow = "";
  /** Animaux et personnages qui vivent dans le décor */
  life: Critter[] = [];
  lifeGround = makeGround(this.terrain);
  sound: SoundApi | null = null;
  /** Reconstruction en cours, morceau par morceau, à raison de quelques millisecondes par image */
  pending: { b: Built; steps: Generator<void, void> } | null = null;
  /** Jour 21 : le sapin décoré (null = pas encore de déco) */
  sapin: SapinCarte | null = null;
  /** Anciens dessins à détruire, eux aussi par petits paquets : tout détruire d'un coup gelait l'image */
  trash: Container[] = [];
  /** Boucle de tâches qui fait avancer la reconstruction et le ménage, hors des images */
  pompe = new MessageChannel();
  pompeEnAttente = false;
  /** Pour la Qualité : durée de la dernière reconstruction en arrière-plan */
  derniereReconstruction = { calculMs: 0, dureeMs: 0, tranches: 0, echangeMs: 0 };
  enCours = { calculMs: 0, debut: 0, tranches: 0 };
  lifeEnv: LifeEnv = {
    play: (s) => this.sound?.play(s),
    giftNear: (x, y) => {
      for (const n of this.terrain.nodes) if (Math.hypot(n.x + 0.5 - x, n.y + 0.5 - y) < 0.9) return n.day;
      return null;
    },
    tapGift: (day) => this.cb.onNodeTap(day),
  };

  constructor(app: Application, cb: SceneCallbacks, night: boolean) {
    this.app = app;
    this.cb = cb;
    this.pal = makePalette(night);
    this.objects.sortableChildren = true;
    this.world.addChild(this.ground, this.aurora, this.objects);
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
    this.giftLight.texture = haloTexture();
    this.giftLight.anchor.set(0.5);
    this.giftLight.blendMode = "add";
    this.giftLight.tint = 0xffc95e;
    this.giftLight.visible = false;
    this.playerLight.texture = this.giftLight.texture;
    this.playerLight.anchor.set(0.5);
    this.playerLight.blendMode = "add";
    this.playerLight.tint = 0xffe2a8;
    this.overlay.addChild(this.playerLight, this.giftLight, this.labels);
    app.stage.addChild(this.world, this.tint, this.dehors, this.fog, this.cloudLayer, this.overlay, this.whiteout, this.confettiLayer, this.snowLayer);
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
    this.pompe.port1.onmessage = () => this.pomper();
    this.installerNavigation(app.canvas as HTMLCanvasElement);
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
        /** Simule l'inclinaison du téléphone (-1…1), et rend l'inclinaison lissée */
        incliner: (x: number, y = 0) => { this.inclinaison.simuler(x, y); return { x: this.inclinaison.x, y: this.inclinaison.y }; },
        scrollForDay: (day: number) => this.scrollForDay(day),
        playOpen: (day: number) => this.playOpen(day),
        /** issue #61 : instantané du décor autour d'une case (data URL PNG) */
        instantane: (day: number, w = 800, h = 600) => this.snapshotAround(day, w, h),
        /** bascule jour/nuit : reconstruction en cours ? et durée de la dernière (calcul pur et totale) */
        reconstruction: () => ({ enCours: !!this.pending, ...this.derniereReconstruction }),
        /** issue #14 : combien de lots du monde sont dessinés en ce moment, sur combien */
        lots: () => ({ total: this.lots.length, dessines: this.charges.size, enAttente: this.aPrecharger.length + (this.prechargement ? 1 : 0) }),
        joueurs: (j: Record<Who, JoueurSalon> | null) => this.setJoueurs(j),
        /** jour 21 : dessine le petit sapin décoré à côté du cadeau (null = l'enlève) */
        sapin: (sp: SapinCarte | null) => this.setSapin(sp),
        /** issue #12 : présenter un monde tout de suite (index dans ZONES), ou tout oublier pour revoir les survols */
        presenter: (zone: number) => this.presenterMonde(zone),
        oublierPresentations: () => { oublierPresentations(this.leader); this.presentes = null; },
        survol: () => (this.survol ? { zone: this.survol.zone, ...this.survol.etat(performance.now()) } : null),
        /** fige le survol à `ms` depuis son début (null = il reprend le temps réel) */
        figerSurvol: (ms: number | null) => { this.survolFige = ms; },
        personnageEcran: (who: Who) => { const p = this.people[who]; const g = p.getGlobalPosition(); return { x: g.x, y: g.y, couleurs: p.couleurs }; },
        /** habitants visibles à l'écran : espèce, position du milieu du corps, réaction en cours */
        life: () => this.life.filter((cr) => cr.visible).map((cr) => {
          const b = cr.getBounds();
          return { species: cr.species, x: b.x + b.width / 2, y: b.y + b.height / 2, react: cr.react?.k ?? null };
        }),
      };
    }
  }

  get worldHeight() { return Math.min(this.fullHeight, this.maxScroll + innerHeight); }
  /** Hauteur de tout le monde, sans tenir compte de ce qui est encore verrouillé */
  get fullHeight() { return (this.maxY - this.minY) * this.scale + this.padTop + innerHeight * 0.5; }
  /** Le dernier jour que l'on a le droit de voir : on s'arrête un peu après, le reste est dans le brouillard */
  get lastOpenDay() {
    let d = 1;
    for (const [day, st] of this.states) if (st !== "locked" && day > d) d = day;
    return d;
  }
  /** Défilement maximal autorisé : un peu au-delà de la dernière case ouverte */
  get maxScroll() {
    // jamais sous le bord du terrain, quel que soit l'écran : on y verrait le vide en dents de scie (#113)
    const parBord = (this.basY - this.minY) * this.scale + this.padTop - innerHeight;
    return Math.max(0, Math.min(parBord, this.maxScrollVoulu));
  }
  private get maxScrollVoulu() {
    const d = Math.min(24, this.lastOpenDay);
    // tout est ouvert : on peut descendre voir la place du pôle Nord et la piste d'envol (choix d'Alexandre),
    // jusqu'à ce que le bout de la piste soit aux trois quarts de l'écran (au-delà, ce n'est plus que la forêt)
    if (this.lastOpenDay >= 24 && this.terrain.bout) {
      const yBout = P(this.terrain.bout.x, this.terrain.bout.y).y;
      return Math.max(this.scrollForDay(24) + innerHeight * 0.15, (yBout - this.minY) * this.scale + this.padTop - innerHeight * 0.75);
    }
    if (this.yFin === null) return Math.max(0, this.scrollForDay(d) + innerHeight * 0.15);
    // on s'arrête juste sous la case du jour (choix d'Alexandre), et jamais au-delà du moment où
    // la barrière de nuages touche le bas de l'écran : pas de vide derrière elle
    const parCase = this.scrollForDay(d) + innerHeight * 0.15;
    const parNuages = (this.yFin - this.minY) * this.scale + this.padTop - innerHeight * 0.88;
    return Math.max(0, this.scrollForDay(d), Math.min(parCase, parNuages));
  }
  setNight(night: boolean) { this.setLight(night ? 1 : 0); }

  /** Les cris des animaux et les rires des lutins quand on les touche (branché par App.tsx, issue #11) */
  setSound(sound: SoundApi) { this.sound = sound; }

  /**
   * Couleurs des personnages selon le salon (#84). Branché par App.tsx :
   * `backend.salons?.onSalonChange((s) => scene.setJoueurs(s?.config.joueurs ?? null))`.
   * null = valeurs par défaut (`PLAYERS`). Redessine les deux personnages sur place, sans reconstruire la scène ;
   * une reconstruction en cours (jour/nuit) reprend aussi ces couleurs, car elle les lit à la création.
   */
  setJoueurs(joueurs: Record<Who, JoueurSalon> | null) {
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const c = joueurs?.[who]?.couleurs ?? PLAYERS[who];
      this.apparence[who] = c;
      if (this.people[who]) this.people[who].habiller(c);
      if (this.pending?.b.people[who]) this.pending.b.people[who].habiller(c);
    }
  }
  /**
   * Jour 21 : le sapin que l'on décore à deux, en miniature à côté du cadeau, jusqu'au 24.
   * Branché par App.tsx : `lireSapinCarte(backend).then((s) => scene.setSapin(s))` (src/games/sapin/carte.ts),
   * à l'ouverture et à la fermeture de la case 21. null ou aucune déco = pas de sapin.
   */
  setSapin(s: SapinCarte | null) {
    this.sapin = s && s.total > 0 ? s : null;
    const c = this.gifts.get(JOUR_SAPIN);
    if (c) this.dessinerSapin(c, this.pal);
    const p = this.pending?.b.gifts.get(JOUR_SAPIN);
    if (p && this.pending) this.dessinerSapin(p, this.pending.b.pal);
  }

  private dessinerSapin(cont: Container, pal: Built["pal"]) {
    const ancien = cont.getChildByLabel("sapin");
    if (ancien) { cont.removeChild(ancien); ancien.destroy({ children: true }); }
    const s = this.sapin;
    if (!s) return;
    const pos = (cont as Container & { meta: { sapinPos: { x: number; y: number; u: number } } }).meta.sapinPos;
    const c = pal.c;
    const g = new Graphics();
    g.label = "sapin";
    // il grandit un peu à mesure qu'on le décore
    const H = pos.u * (1.9 + 0.6 * Math.min(1, s.total / 16)), W = H * 0.72;
    const X = (x: number) => pos.x + x * W / 2;
    const Y = (y: number) => pos.y - H + y * H;
    g.ellipse(pos.x, pos.y + 2, W * 0.45, W * 0.16).fill({ color: 0x1b2340, alpha: 0.18 });
    g.rect(X(-0.1), Y(0.86), W * 0.1, H * 0.16).fill(c(0x7a4a2c));
    const etages: [number, number, number][] = [[0.5, 1.0, 0.9], [0.27, 0.72, 0.68], [0, 0.45, 0.46]];
    for (const [a, b, w] of etages) {
      g.poly([X(0), Y(a), X(w), Y(b), X(-w), Y(b)]).fill(c(0x2f8a55));
      g.poly([X(0), Y(a), X(w), Y(b), X(0), Y(b)]).fill(c(0x22693f));
      g.ellipse(X(0), Y(b), w * W / 2, H * 0.025).fill(c(0xf4f8fd));
    }
    // sapin allumé : les décos gardent leur vraie couleur la nuit, comme des lumières
    const lum = s.etoile ? pal.lit : c;
    s.guirlandes.forEach((couleur, i) => {
      const y0 = 0.3 + i * 0.17;
      g.moveTo(X(-0.35 - i * 0.1), Y(y0)).quadraticCurveTo(X(0), Y(y0 + 0.12), X(0.4 + i * 0.1), Y(y0 + 0.05))
        .stroke({ width: Math.max(1, H * 0.025), color: lum(couleur) });
    });
    for (const p of s.points) g.circle(X(p.x * 0.95), Y(p.y * 0.92 + 0.04), Math.max(1.3, H * 0.035)).fill(lum(p.couleur));
    if (s.etoile) {
      // allumé : un halo doux et l'étoile au sommet
      g.circle(X(0), Y(0.42), H * 0.55).fill({ color: 0xffd66b, alpha: pal.night ? 0.2 : 0.08 });
      g.star(X(0), Y(-0.02), 5, H * 0.11, H * 0.05).fill(0xffd25e).stroke({ width: 1, color: 0xc98a12 });
    }
    cont.addChild(g);
  }

  /** Ne redessine que les cases dont l'état a changé : reconstruire toute la scène gelait l'image */
  setStates(states: Map<number, NodeState>) {
    const before = this.states;
    const limiteAvant = this.gifts.size ? this.maxScroll : -1;
    this.states = states;
    // une case de plus = la carte s'allonge. L'interface recalcule la hauteur de page sur `resize` ;
    // on le lui signale ainsi, faute d'un canal dédié (proposé au chef de projet dans l'issue #9).
    if (limiteAvant >= 0 && Math.abs(this.maxScroll - limiteAvant) > 1) {
      this.majFinDeCarte();
      setTimeout(() => dispatchEvent(new Event("resize")), 0);
    }
    if (!this.gifts.size) { this.build(); return; }
    this.refreshGifts(before);
    // le traîneau du 24 dépend de l'état de la dernière case : là, il faut tout redessiner (une fois),
    // en arrière-plan ; le cadeau, lui, a déjà changé
    if (this.wantsFlying() !== (this.pending ? this.pending.b.flying : this.flying)) this.rebuildLater(this.pending?.b.pal ?? this.pal);
  }

  /** Redessine les cadeaux dont l'état diffère de `before` */
  refreshGifts(before: Map<number, NodeState>) {
    for (const n of this.terrain.nodes) {
      if ((before.get(n.day) ?? "locked") === (this.states.get(n.day) ?? "locked")) continue;
      const old = this.gifts.get(n.day);
      if (old) { this.objects.removeChild(old); this.dropLabel(old); old.destroy({ children: true }); }
      this.objects.addChild(this.makeGift(n));
    }
  }

  wantsFlying() { return this.states.get(24) === "opened"; }
  /** le traîneau dessiné actuellement est-il en vol ? */
  flying = false;

  /** Lumière continue : 0 = plein jour, 1 = nuit noire. Ne reconstruit qu'au passage du seuil de nuit. */
  setLight(amount: number) {
    const a = Math.max(0, Math.min(1, amount));
    const wasNight = this.pal.night;
    this.light = a;
    // la teinte du ciel (`tint`) suit `light` tout de suite ; les couleurs du décor suivent dès que
    // la scène de nuit est prête, une fraction de seconde plus tard
    const isNight = a >= 0.4;
    const vise = this.pending ? this.pending.b.pal.night : wasNight;
    if (isNight !== vise) this.rebuildLater(makePalette(isNight));
  }

  /* ------------------------------------------------------------------ */
  /** Reconstruit tout, d'un coup : au démarrage seulement (la page n'est pas encore affichée) */
  build() {
    this.abortPending();
    const b = this.emptyBuilt(this.pal);
    for (const _ of this.buildSteps(b)) void _;
    this.commit(b, false);
  }

  /** Reconstruit en arrière-plan avec la palette donnée, quelques millisecondes par image, puis
   *  échange d'un coup (issue #23) : la bascule jour/nuit ne gèle plus l'écran. */
  rebuildLater(pal: Palette) {
    this.abortPending();
    // retour à la palette affichée avant la fin du travail (double toucher jour/nuit) : rien à refaire,
    // sauf si c'est le traîneau du 24 qui a changé
    if (pal.night === this.pal.night && this.wantsFlying() === this.flying) return;
    const b = this.emptyBuilt(pal);
    this.pending = { b, steps: this.buildSteps(b) };
    this.enCours = { calculMs: 0, debut: performance.now(), tranches: 0 };
    this.relancer();
  }

  relancer() {
    if (this.pompeEnAttente) return;
    this.pompeEnAttente = true;
    this.pompe.port2.postMessage(0);
  }

  /** Une tranche : avance la reconstruction, sinon fait le ménage ; se relance s'il reste du travail */
  pomper() {
    this.pompeEnAttente = false;
    const t0 = performance.now();
    // ce qui va entrer à l'écran passe avant tout le reste : sinon il serait dessiné d'un coup, à l'image près
    if (this.prechargement || this.aPrecharger.length) {
      this.precharger(t0, Math.max(TRANCHE_MS, Math.min(50, this.app.ticker.deltaMS * 0.5)));
    } else if (this.pending) {
      this.stepPending();
      this.enCours.calculMs += performance.now() - t0;
      this.enCours.tranches++;
    } else if (this.trash.length) this.emptyTrash();
    if (this.pending && this.focus) { setTimeout(() => this.relancer(), 250); return; }
    if (this.pending || this.trash.length || this.prechargement || this.aPrecharger.length) this.relancer();
  }

  emptyBuilt(pal: Palette): Built {
    const objects = new Container();
    objects.sortableChildren = true;
    const finCarte = new Container();
    finCarte.sortableChildren = true;
    const ground = new Container();
    ground.sortableChildren = true; // la route passe au-dessus de toutes les bandes de sol
    return {
      pal, states: new Map(this.states), flying: this.wantsFlying(),
      ground, objects, labels: new Container(), finCarte, panneauFin: new Container(),
      gifts: new Map(), charges: new Map(), people: {} as Record<Who, Person>, penguin: null, life: [],
    };
  }

  abortPending() {
    if (!this.pending) return;
    const b = this.pending.b;
    this.pending = null;
    this.trash.push(b.ground, b.objects, b.labels);
    // pas encore rangés dans `objects` si l'on s'est arrêté avant : à détruire à part
    for (const c of [b.finCarte, b.panneauFin]) if (!c.parent) this.trash.push(c);
    this.relancer();
  }

  /** Avance la reconstruction en cours dans le budget de l'image ; échange quand elle est finie */
  stepPending() {
    const t0 = performance.now();
    // sur un appareil dont chaque image est longue, des tranches plus longues : la reconstruction garde
    // environ la moitié du temps au lieu de s'étirer sur des dizaines d'images
    const tranche = Math.max(TRANCHE_MS, Math.min(50, this.app.ticker.deltaMS * 0.5));
    while (this.pending && performance.now() - t0 < tranche) {
      if (!this.pending.steps.next().done) continue;
      // pendant l'ouverture d'une case, l'animation tient les anciens cadeaux : on attend qu'elle finisse
      if (this.focus) return;
      const b = this.pending.b;
      this.pending = null;
      const tc = performance.now();
      this.commit(b, true);
      const echangeMs = performance.now() - tc;
      this.enCours.calculMs += performance.now() - t0;
      this.derniereReconstruction = { calculMs: Math.round(this.enCours.calculMs), dureeMs: Math.round(performance.now() - this.enCours.debut), tranches: this.enCours.tranches + 1, echangeMs: Math.round(echangeMs) };
      return;
    }
  }

  /** Détruit les anciens dessins par petits paquets */
  emptyTrash() {
    const t0 = performance.now();
    while (this.trash.length && performance.now() - t0 < TRANCHE_MS) {
      const c = this.trash[this.trash.length - 1];
      const enfant = c.children[c.children.length - 1];
      if (enfant) { c.removeChild(enfant); enfant.destroy({ children: true }); }
      else { this.trash.pop(); c.destroy(); }
    }
  }

  /** Met la scène construite à la place de l'actuelle */
  commit(b: Built, later: boolean) {
    const oldGround = this.ground, oldObjects = this.objects, oldLabels = this.labels;
    const oldPeople = this.people, oldPenguin = this.penguin;
    this.world.addChildAt(b.ground, this.world.getChildIndex(oldGround));
    this.world.removeChild(oldGround);
    this.world.addChildAt(b.objects, this.world.getChildIndex(oldObjects));
    this.world.removeChild(oldObjects);
    this.overlay.addChildAt(b.labels, this.overlay.getChildIndex(oldLabels));
    this.overlay.removeChild(oldLabels);
    this.pal = b.pal;
    this.flying = b.flying;
    this.ground = b.ground; this.objects = b.objects; this.labels = b.labels;
    this.finCarte = b.finCarte; this.panneauFin = b.panneauFin;
    this.gifts = b.gifts;
    this.arreterPrechargement(); // il dessinait avec l'ancienne palette
    this.charges = b.charges; this.life = b.life;
    this.people = b.people; this.penguin = b.penguin!;
    // les personnages continuent ce qu'ils faisaient
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const o = oldPeople[who];
      if (o) { b.people[who].walking = o.walking; b.people[who].t = o.t; b.people[who].body.scale.x = o.body.scale.x; }
    }
    if (oldPenguin) { this.penguin.walking = oldPenguin.walking; this.penguin.t = oldPenguin.t; }
    if (later) {
      this.trash.push(oldGround, oldObjects, oldLabels);
      this.relancer();
      // ce qui a changé pendant la reconstruction : cadeaux, fin de carte, traîneau
      if ([...this.terrain.nodes].some((n) => (b.states.get(n.day) ?? "locked") !== (this.states.get(n.day) ?? "locked"))) {
        this.refreshGifts(b.states);
        if (this.lastOpenDayOf(b.states) !== this.lastOpenDay) this.majFinDeCarte();
      }
      if (this.wantsFlying() !== this.flying) this.rebuildLater(this.pal);
    } else {
      for (const c of [oldGround, oldObjects, oldLabels]) c.destroy({ children: true });
    }
    this.nodeY = this.terrain.nodes.map((n) => P(n.x + 0.5, n.y + 0.5, heightAt(this.terrain, n.x + 0.5, n.y + 0.5)).y);
    const ys = this.terrain.path.map((p) => P(p.x, p.y).y);
    this.minY = Math.min(...ys) - 260;
    this.maxY = Math.max(...ys) + 160;
    // bas du terrain sans dents de scie : les tuiles de la dernière rangée k montent jusqu'à k + 1
    let kBas = -Infinity;
    for (const c of this.terrain.cells.values()) if (c.x + c.y > kBas) kBas = c.x + c.y;
    this.basY = P((kBas + 1) / 2, (kBas + 1) / 2).y;
    // au jour 24, on peut descendre jusqu'au bas du monde : la hauteur de page doit le permettre
    this.maxY = Math.max(this.maxY, this.basY);
    this.resize();
    this.placeActors();
  }

  lastOpenDayOf(states: Map<number, NodeState>) {
    let d = 1;
    for (const [day, st] of states) if (st !== "locked" && day > d) d = day;
    return d;
  }

  /** Dessine toute la scène dans `b`, en rendant la main régulièrement (chaque `yield`) */
  *buildSteps(b: Built): Generator<void, void> {
    const pal = b.pal;
    // ce qui ne dépend pas de l'endroit où l'on regarde : cadeaux, fin de carte, personnages, habitants
    for (const n of this.terrain.nodes) b.objects.addChild(this.makeGift(n, b));
    b.objects.addChild(b.finCarte, b.panneauFin);
    yield;
    yield* this.majFinDeCarteSteps(b);
    yield;
    for (const who of ["alexandre", "flavie"] as Who[]) {
      const p = new Person(who, pal, this.apparence[who]);
      b.people[who] = p;
      b.objects.addChild(p);
    }
    b.penguin = new Penguin(pal);
    b.objects.addChild(b.penguin);
    yield;
    // les habitants : recréés à chaque reconstruction (leur dessin suit la palette jour / nuit)
    b.life = spawnLife(this.terrain, pal);
    yield;
    for (const cr of b.life) {
      cr.on("pointertap", (e) => {
        // un cadeau sous l'habitant passe en priorité (issue #113) : sinon un patineur sur le cadeau du jour l'empêche de s'ouvrir
        const day = this.cadeauSous(e.global.x, e.global.y);
        if (day !== null) this.cb.onNodeTap(day);
        else poke(cr, this.lifeEnv, this.lifeGround);
      });
      updateCritter(cr, 0, this.lifeGround, this.terrain);
      b.objects.addChild(cr);
    }
    yield* this.prepareGpu(b);
    // le monde lui-même (issue #14) : seulement les lots chargés dans la scène affichée. On revérifie
    // jusqu'au bout, la caméra a pu bouger et en charger d'autres pendant le travail.
    for (;;) {
      const manque = [...this.charges.keys()].filter((i) => !b.charges.has(i));
      if (!manque.length) break;
      for (const i of manque) if (!b.charges.has(i)) yield* this.chargerLot(i, b, new Container());
    }
  }

  /** Découpe le monde en lots que l'on sait placer sans les dessiner (issue #14). Calculé une seule fois :
   *  ni la palette ni les cases ouvertes ne changent leur place. */
  decouperLots(): Lot[] {
    const { cells, path, props } = this.terrain;
    const V = this.terrain.V;
    const hv = (x: number, y: number) => V.get(key(x, y)) ?? 0;
    const lots: Lot[] = [];
    // sol : bandes de 10 diagonales ; leur étendue est exacte (coins des cases)
    const list = [...cells.values()].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
    let bande: Cell[] = [];
    let bandK = list.length ? list[0].x + list[0].y : 0;
    const fermerBande = () => {
      if (!bande.length) return;
      let min = Infinity, max = -Infinity;
      for (const { x, y } of bande) for (const [cx, cy] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) {
        const py = P(cx, cy, hv(cx, cy)).y;
        if (py < min) min = py;
        if (py > max) max = py;
      }
      lots.push({ couche: "sol", k: bandK, zIndex: bandK, min: min - 4, max: max + 4, cellules: bande });
      bande = [];
    };
    for (const cell of list) {
      if (cell.x + cell.y >= bandK + 10) { fermerBande(); bandK = cell.x + cell.y; }
      bande.push(cell);
    }
    fermerBande();
    // route : même découpage, au-dessus de tout le sol
    let i0 = 0;
    const fermerRoute = (i1: number) => {
      if (i1 <= i0) return;
      let min = Infinity, max = -Infinity;
      for (let i = i0; i < Math.min(i1 + 1, path.length); i++) {
        const py = P(path[i].x + 0.5, path[i].y + 0.5, heightAt(this.terrain, path[i].x + 0.5, path[i].y + 0.5)).y;
        if (py < min) min = py;
        if (py > max) max = py;
      }
      const k = path[i0].x + path[i0].y;
      lots.push({ couche: "sol", k, zIndex: 1e6 + k, min: min - 24, max: max + 24, route: [i0, i1] });
      i0 = i1;
    };
    for (let i = 0; i < path.length; i++) {
      if (path[i].x + path[i].y >= path[i0].x + path[i0].y + 10) fermerRoute(i);
    }
    fermerRoute(path.length);
    // décors : une tranche par unité de profondeur ; leur hauteur est estimée large, puis mesurée au dessin
    const tranches = new Map<number, PlacedProp[]>();
    for (const p of props) {
      const k = Math.floor(p.x + p.y + (p.kind === "mountain" ? -1.4 : BATIMENTS_LARGES.has(p.kind) ? -0.6 : 0.5));
      let t = tranches.get(k);
      if (!t) tranches.set(k, (t = []));
      t.push(p);
    }
    for (const [k, decors] of tranches) {
      let min = Infinity, max = -Infinity;
      for (const p of decors) {
        const py = P(p.x + 0.5, p.y + 0.5).y - p.z * ZH;
        min = Math.min(min, py - (HAUTEUR_DECOR[p.kind] ?? 200));
        max = Math.max(max, py + (p.kind === "mountain" || p.kind === "ridge" ? 200 : 140));
      }
      lots.push({ couche: "objets", k, zIndex: k + 0.5, min, max, decors });
    }
    return lots;
  }

  /** Dessine un lot dans `c`, en rendant la main régulièrement */
  *dessinerLot(lot: Lot, pal: Palette, flying: boolean, c: Container, anims: AnimPart[]): Generator<void, void> {
    if (lot.cellules) {
      const g = new Graphics();
      c.addChild(g);
      let n = 0;
      for (const cell of lot.cellules) {
        if (++n % 150 === 0) yield;
        this.dessinerCase(g, cell, pal);
      }
    } else if (lot.route) {
      const g = new Graphics();
      c.addChild(g);
      yield* this.dessinerRoute(g, lot.route[0], lot.route[1], pal);
    } else if (lot.decors) {
      let n = 0;
      for (const p of lot.decors) {
        if (++n % 12 === 0) yield;
        // le 24 ouvert, l'attelage est parti avec le traîneau
        if (p.attelage && flying) continue;
        const o = drawProp(p.kind, p.x, p.y, pal, p.seed, { zone: ZONES[p.zone].id, drop: p.drop, alongX: p.alongX, flying: p.kind === "sleigh" && flying });
        if (o.anim) anims.push(...o.anim);
        o.y = -p.z * ZH;
        c.addChild(o);
      }
    }
  }

  /** Une case de terrain : deux triangles éclairés selon leur pente */
  /** couleurs de sol et de roche fondues le long du chemin, autour de la grotte (indexées par case du chemin) */
  private fondu?: { ground: number; rock: number }[];
  couleursSol(pi: number, zone: number) {
    if (!this.fondu) {
      const path = this.terrain.path, R = 6;
      const avg = (cols: number[]) => {
        const s = [0, 0, 0];
        for (const c of cols) { s[0] += (c >> 16) & 255; s[1] += (c >> 8) & 255; s[2] += c & 255; }
        return (Math.round(s[0] / cols.length) << 16) | (Math.round(s[1] / cols.length) << 8) | Math.round(s[2] / cols.length);
      };
      this.fondu = path.map((_, i) => {
        const win = path.slice(Math.max(0, i - R), i + R + 1).map((p) => ZONES[p.zone]);
        if (!win.some((z) => z.id === "grotte")) return { ground: ZONES[path[i].zone].ground, rock: ZONES[path[i].zone].atmo.rock };
        return { ground: avg(win.map((z) => z.ground)), rock: avg(win.map((z) => z.atmo.rock)) };
      });
    }
    return this.fondu[pi] ?? { ground: ZONES[zone].ground, rock: ZONES[zone].atmo.rock };
  }

  dessinerCase(g: Graphics, cell: Cell, pal: Palette) {
    const { cells } = this.terrain;
    const fondu = this.couleursSol(cell.pi, cell.zone);
    const c = pal.c;
    const V = this.terrain.V;
    const hv = (x: number, y: number) => V.get(key(x, y)) ?? 0;
    // lumière venant de l'arrière-gauche : les faces tournées vers la gauche sont claires
    const Lx = -0.35, Ly = 0.55, Lz = 0.76;
    const flatB = Lz;
    const SHADOW = 0x9aa2d2;      // ombre de la neige : lavande froide
    const ROCK_SHADOW = 0x5d668f; // ombre de la roche : violet, mais qui garde de la matière
    const ROCK_T = 0.5;           // au-delà de cette pente, c'est de la roche
    const face = (pts: [number, number, number][]) => {
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
        const base = mix(fondu.rock, 0xe9edf8, dust * 0.5);
        col = bright < 0
          ? mix(base, ROCK_SHADOW, Math.min(0.5, -bright * 1.7))
          : mix(base, 0xffffff, Math.min(0.55, bright * 1.9));
      } else {
        // neige : modelé très doux, elle doit rester lisse
        const base = fondu.ground;
        col = bright < 0
          ? mix(base, SHADOW, Math.min(0.42, -bright * 1.5))
          : mix(base, 0xffffff, Math.min(0.35, bright * 1.2));
      }
      poly(g, pts.map(([x, y, z]) => P(x, y, z)), c(col));
      g.poly(pts.flatMap(([x, y, z]) => { const q = P(x, y, z); return [q.x, q.y]; }), true).stroke({ width: 0.8, color: c(col) });
    };
    const { x, y } = cell;
    const A: [number, number, number] = [x, y, hv(x, y)], B: [number, number, number] = [x + 1, y, hv(x + 1, y)];
    const C: [number, number, number] = [x + 1, y + 1, hv(x + 1, y + 1)], D: [number, number, number] = [x, y + 1, hv(x, y + 1)];
    face([A, B, C]);
    face([A, C, D]);
    if (cell.sol) this.dessinerSol(g, cell, pal);
    if (cell.lake && (x + y) % 3 === 0) poly(g, [P(x + 0.2, y + 0.3, 0), P(x + 0.6, y + 0.1, 0), P(x + 0.65, y + 0.18, 0), P(x + 0.25, y + 0.38, 0)], c(0xeaf8fd));
  }

  /** Place du pôle Nord (dalles de glace) et piste d'envol (neige damée balisée), posées sur la case */
  dessinerSol(g: Graphics, cell: Cell, pal: Palette) {
    const c = pal.c, T = this.terrain, { x, y } = cell;
    const quad = (pts: [number, number][], col: number, alpha = 1) => poly(g, pts.map(([a, b]) => P(a, b, heightAt(T, a, b) + 0.01)), c(col), alpha);
    const rect = (x0: number, x1: number, y0: number, y1: number, col: number, alpha = 1) => quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], col, alpha);
    const meme = (dx: number, dy: number) => T.cells.get(key(x + dx, y + dy))?.sol === cell.sol;
    if (cell.sol === "place") {
      // dalles de glace claires, un liseré plus soutenu sur le pourtour
      rect(x, x + 1, y, y + 1, 0xb9c8dc);
      const m = 0.04;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const v = Math.sin((x * 2 + i) * 12.9 + (y * 2 + j) * 78.2) * 43758.5;
        rect(x + i / 2 + m, x + (i + 1) / 2 - m, y + j / 2 + m, y + (j + 1) / 2 - m, [0xe4ebf5, 0xdbe4f0, 0xd2dcea][Math.floor((v - Math.floor(v)) * 3)]);
      }
      if (!meme(-1, 0)) rect(x, x + 0.08, y, y + 1, 0x8fa6c4);
      if (!meme(1, 0)) rect(x + 0.92, x + 1, y, y + 1, 0x8fa6c4);
      if (!meme(0, -1)) rect(x, x + 1, y, y + 0.08, 0x8fa6c4);
      if (!meme(0, 1)) rect(x, x + 1, y + 0.92, y + 1, 0x8fa6c4);
    } else {
      // piste : neige damée, bords bleus, tirets au milieu
      rect(x, x + 1, y, y + 1, 0xd7e1ee);
      if (!meme(-1, 0)) rect(x, x + 0.1, y, y + 1, 0x6f8fb8);
      if (!meme(1, 0)) rect(x + 0.9, x + 1, y, y + 1, 0x6f8fb8);
      if (meme(-1, 0) && meme(1, 0) && y % 2 === 0) rect(x + 0.44, x + 0.56, y + 0.15, y + 0.85, 0xffffff, 0.9);
    }
  }

  /** Un tronçon de route posé sur le relief, des pas i0 à i1 (exclu) */
  *dessinerRoute(g: Graphics, i0: number, i1: number, pal: Palette): Generator<void, void> {
    const { cells, path } = this.terrain;
    const c = pal.c;
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
    for (let i = i0; i < i1; i++) {
      if (i % 30 === 29) yield;
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
  }

  /** Dessine le lot `i` dans `c` pour la scène `cible` (l'affichée ou une en construction), le triangule
   *  d'avance, puis l'y range. `c` est fourni par l'appelant pour pouvoir le détruire si on abandonne. */
  *chargerLot(i: number, cible: Cible, c: Container): Generator<void, void> {
    const lot = this.lots[i];
    c.zIndex = lot.zIndex;
    const anims: AnimPart[] = [];
    yield* this.dessinerLot(lot, cible.pal, cible.flying, c, anims);
    if (c.children.length) {
      const r = c.getLocalBounds();
      if (import.meta.env.DEV && !lot.mesure && (r.minY < lot.min - 1 || r.maxY > lot.max + 1)) {
        console.warn(`[monde] lot ${i} (${lot.couche}, k=${lot.k}) plus grand que prévu : ${Math.round(r.minY)}…${Math.round(r.maxY)} au lieu de ${Math.round(lot.min)}…${Math.round(lot.max)}`);
      }
      lot.min = r.minY; lot.max = r.maxY; lot.mesure = true;
    }
    const sys = this.triangulateur();
    if (sys) {
      const pile: Container[] = [c];
      let n = 0;
      while (pile.length) {
        const o = pile.pop()!;
        if (o instanceof Graphics) {
          try { sys.updateGpuContext(o.context); } catch { break; }
          if (++n % 8 === 0) yield;
        }
        for (const k of o.children) pile.push(k);
      }
    }
    if (cible.charges.has(i)) { this.trash.push(c); this.relancer(); return; } // chargé entre-temps par un autre chemin
    (lot.couche === "sol" ? cible.ground : cible.objects).addChild(c);
    cible.charges.set(i, { c, anims });
  }

  /** Charge tout de suite un lot qui entre à l'écran (on termine son préchargement s'il était commencé) */
  chargerMaintenant(i: number) {
    const p = this.prechargement;
    if (p?.i === i) {
      this.prechargement = null;
      for (const _ of p.gen) void _;
      return;
    }
    for (const _ of this.chargerLot(i, this, new Container())) void _;
  }

  dechargerLot(i: number) {
    const ch = this.charges.get(i);
    if (!ch) return;
    this.charges.delete(i);
    ch.c.parent?.removeChild(ch.c);
    this.trash.push(ch.c);
    this.relancer();
  }

  /** Abandonne le préchargement en cours (la scène qu'il visait va changer) */
  arreterPrechargement() {
    const p = this.prechargement;
    if (!p) return;
    this.prechargement = null;
    p.gen.return();
    if (!p.c.parent) { this.trash.push(p.c); this.relancer(); }
  }

  /** Issue #14 : ne garde dessiné que ce qui entoure l'écran. Ce qui entre à l'écran est dessiné tout de
   *  suite ; un demi-écran d'avance est préparé en arrière-plan ; au-delà d'un écran, on détruit. */
  diffuser(topY: number, botY: number, limiteDecor: number) {
    const h = botY - topY;
    const attente: { i: number; d: number }[] = [];
    for (let i = 0; i < this.lots.length; i++) {
      const lot = this.lots[i];
      const utile = lot.k <= (lot.couche === "sol" ? this.limiteDepth : limiteDecor);
      const d = lot.max < topY ? topY - lot.max : lot.min > botY ? lot.min - botY : 0;
      const ch = this.charges.get(i);
      if (ch) {
        if (!utile || d > h * ECRANS_GARDES) this.dechargerLot(i);
        else ch.c.visible = d === 0;
      } else if (utile && d === 0) this.chargerMaintenant(i);
      else if (utile && d < h * ECRANS_AVANCE) attente.push({ i, d });
    }
    attente.sort((a, b) => a.d - b.d);
    this.aPrecharger = attente.map((a) => a.i);
    if (this.aPrecharger.length && !this.prechargement) this.relancer();
  }

  /** Prépare le prochain lot attendu, dans le temps donné */
  precharger(t0: number, tranche: number) {
    while (performance.now() - t0 < tranche) {
      if (!this.prechargement) {
        const i = this.aPrecharger.shift();
        if (i === undefined) return;
        if (this.charges.has(i)) continue;
        const c = new Container();
        this.prechargement = { i, c, gen: this.chargerLot(i, this, c) };
      }
      if (this.prechargement.gen.next().done) this.prechargement = null;
    }
  }

  /** Accès à la triangulation de PixiJS 8 (API interne : on s'en passe si elle change) */
  triangulateur() {
    const sys = (this.app.renderer as unknown as { graphicsContext?: { updateGpuContext?: (c: unknown) => void } }).graphicsContext;
    return typeof sys?.updateGpuContext === "function" ? sys as { updateGpuContext: (c: unknown) => void } : null;
  }

  /** Triangule d'avance tous les dessins de la nouvelle scène. Sans cela, PixiJS le fait au premier
   *  rendu qui suit l'échange, pour tout ce qui est à l'écran d'un coup : c'était le plus gros du gel. */
  *prepareGpu(b: Built): Generator<void, void> {
    const sys = this.triangulateur();
    if (!sys) return;
    const pile: Container[] = [b.ground, b.objects, b.labels];
    let n = 0;
    while (pile.length) {
      const c = pile.pop()!;
      if (c instanceof Graphics) {
        try { sys.updateGpuContext(c.context); } catch { return; }
        if (++n % 8 === 0) yield;
      }
      for (const k of c.children) pile.push(k);
    }
  }

  /** Dessine un cadeau ; par défaut dans la scène affichée, sinon dans une scène en construction */
  /** Le cadeau (ou son étiquette) qu'on toucherait à ce point de l'écran si les habitants n'étaient pas là */
  private cadeauSous(x: number, y: number): number | null {
    const avant = this.life.map((cr) => cr.eventMode);
    for (const cr of this.life) cr.eventMode = "none";
    let cible: Container | null;
    try {
      cible = this.app.renderer.events.rootBoundary.hitTest(x, y) as Container | null;
    } finally {
      this.life.forEach((cr, i) => { cr.eventMode = avant[i]; });
    }
    for (; cible; cible = cible.parent) {
      for (const [day, cont] of this.gifts) {
        if (cont === cible || (cont as Container & { meta?: { label?: Container } }).meta?.label === cible) return day;
      }
    }
    return null;
  }

  makeGift(n: DayNode, b?: Built) {
    const st = (b ? b.states : this.states).get(n.day) ?? "locked";
    const c = (b?.pal ?? this.pal).c;
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
    // étiquette (choix d'Alexandre, issue #24) : pastille cerclée et ombre portée, pour se détacher de la neige
    const SLATE = 0x3f4a66;
    const txt = new Text({ text: String(n.day), style: { fontFamily: "Fredoka", fontWeight: "700", fontSize: 20, fill: st === "locked" ? SLATE : 0xffffff } });
    txt.anchor.set(0.5);
    const pill = new Graphics().roundRect(-20, -12, 40, 30, 15).fill({ color: 0x1b2340, alpha: 0.28 });
    pill.roundRect(-20, -15, 40, 30, 15).fill(st === "locked" ? 0xffffff : st === "opened" ? 0x2fa37a : 0xd9354b)
      .stroke({ width: st === "locked" ? 3 : 2.5, color: st === "locked" ? SLATE : 0xffffff });
    label.addChild(pill, txt);
    if (st === "opened") label.addChild(new Graphics().star(20, -14, 5, 8, 3.5).fill(0xffd66b));
    // cadenas blanc dans un badge rond
    if (st === "locked") label.addChild(new Graphics().circle(17, -17, 11).fill(SLATE)
      .roundRect(10, -20, 14, 11, 3).fill(0xffffff).circle(17, -21, 4.5).stroke({ width: 2.4, color: 0xffffff }));
    // toucher l'étiquette ouvre la case, comme toucher le cadeau
    label.eventMode = "static";
    label.cursor = "pointer";
    label.on("pointertap", () => this.cb.onNodeTap(n.day));
    inner.addChild(g, lid);
    cont.addChild(glow, inner);
    cont.position.set(o.x, o.y - heightAt(this.terrain, n.x + 0.5, n.y + 0.5) * ZH);
    // l'étiquette vit dans le calque du dessus ; on retient sa hauteur de repos pour la faire sauter avec le cadeau
    const labelY = cont.y + top.y - 48;
    label.position.set(o.x, labelY);
    (b?.labels ?? this.labels).addChild(label);
    cont.zIndex = n.x + n.y + 0.55;
    cont.eventMode = "static";
    cont.cursor = "pointer";
    cont.on("pointertap", () => this.cb.onNodeTap(n.day));
    // jour 21 : la place du petit sapin décoré, derrière le cadeau à droite (u = hauteur du cadeau en pixels)
    const pied = rel(P(n.x + 1.0, n.y + 0.2));
    const sapinPos = { x: pied.x, y: pied.y, u: o.y - P(n.x + 0.5, n.y + 0.5, h).y };
    (cont as Container & { meta: object }).meta = { inner, glow, lid, st, wx: o.x, wy: cont.y, label, labelY, sapinPos };
    if (n.day === JOUR_SAPIN) this.dessinerSapin(cont, b?.pal ?? this.pal);
    (b?.gifts ?? this.gifts).set(n.day, cont);
    return cont;
  }

  /** Retire l'étiquette d'un cadeau que l'on va détruire (elle vit dans un autre calque) */
  dropLabel(cont: Container) {
    const lab = (cont as Container & { meta?: { label?: Container } }).meta?.label;
    if (lab) { this.labels.removeChild(lab); lab.destroy({ children: true }); }
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
    this.marcheScriptee = true;
    return new Promise((res) => {
      p.walking = 1;
      // la vitesse est donnée par image à 60 i/s, mais mesurée au temps écoulé : sur un écran à
      // 120 Hz le personnage allait deux fois trop vite, et deux fois trop lentement sur un mobile qui rame
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(3, (now - last) / 16.667);
        last = now;
        const d = target - this.pos[who];
        // `this.people[who]` et non `p` : la scène a pu être redessinée (jour/nuit) pendant la marche
        if (Math.abs(d) < 0.08) { this.pos[who] = target; this.people[who].walking = 0; this.marcheScriptee = false; res(); return; }
        const pt = this.pointAt(this.pos[who], 0);
        const speed = (pt.lake ? 0.16 : pt.slope < 0 && pt.zone === "montagnes" ? 0.2 : pt.slope > 0 ? 0.06 : 0.09) * dt;
        this.pos[who] += Math.sign(d) * Math.min(Math.abs(d), speed);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** Ferme la carte après la dernière case ouverte : le monde s'arrête dans un banc de nuages,
   *  et un panneau planté au bord du chemin dit que la suite est pour demain. */
  majFinDeCarte() { for (const _ of this.majFinDeCarteSteps()) void _; }

  /** Version découpée : dans la scène affichée, ou dans une scène en construction (`b`) */
  *majFinDeCarteSteps(b?: Built): Generator<void, void> {
    const finCarte = b?.finCarte ?? this.finCarte, panneauFin = b?.panneauFin ?? this.panneauFin;
    const pal = b?.pal ?? this.pal;
    finCarte.removeChildren().forEach((c) => c.destroy({ children: true }));
    panneauFin.removeChildren().forEach((c) => c.destroy({ children: true }));
    const L = this.terrain.path;
    const dernier = Math.min(24, b ? this.lastOpenDayOf(b.states) : this.lastOpenDay);
    // une scène en construction dessinée avec d'anciens états ne touche pas aux limites actuelles
    const aJour = !b || this.lastOpenDayOf(b.states) === this.lastOpenDay;
    if (dernier >= 24) { if (aJour) { this.limiteDepth = Infinity; this.limiteCadeaux = Infinity; this.yFin = null; } return; } // tout est ouvert : plus rien à cacher
    const nd = this.terrain.nodes[dernier - 1];

    // La lisière de nuages est une seule droite, à x constant, comme le bord du lac : elle part du
    // bas de l'écran et monte vers la droite. Elle ne sert pas à cacher le cadeau suivant, mais à
    // empêcher de parcourir toute la carte dès le premier jour. Elle laisse donc six pas de chemin
    // libres après la case du jour, et englobe la case de demain si elle est proche (entre deux
    // mondes, le chemin est long : l'attendre repousserait les nuages hors de l'écran).
    const iJour = this.nodeIndex(dernier);
    const iSuiv = dernier < 24 ? this.nodeIndex(dernier + 1) : iJour;
    const iDemain = Math.min(L.length - 1, iSuiv - iJour <= 10 ? iSuiv : iJour + 6);
    const vus = L.slice(0, Math.min(L.length, Math.max(iJour + 6, iDemain + 2) + 1));
    const xLis = Math.max(...vus.map((p) => p.x)) + 2.5;
    // jusqu'où on peut descendre : là où le chemin entre dans les nuages, ou quelques pas après
    // la case de demain s'il file le long de la lisière ; le bas de l'écran fait le reste
    const iCroise = L.findIndex((p, k) => k > iDemain && p.x >= xLis);
    const iFin = Math.min(L.length - 1, iCroise >= 0 ? Math.min(iCroise, iDemain + 5) : iDemain + 5);
    const bout = L[iFin];
    const profondeur = bout.x + bout.y;
    const demain = L[iDemain];
    // sol et décors un peu au-delà du bas de l'écran (le défilement s'arrête avant) ;
    // les cadeaux verrouillés s'arrêtent après celui de demain
    if (aJour) {
      this.limiteDepth = profondeur + 14;
      this.limiteCadeaux = demain.x + demain.y + 1;
    }
    // les nuages passent devant tout : une ligne en diagonale ne se range pas dans une tranche de profondeur
    finCarte.zIndex = 1e6;
    if (aJour) this.yFin = P(bout.x + 0.5, bout.y + 0.5, heightAt(this.terrain, bout.x + 0.5, bout.y + 0.5)).y;

    // pavage de la zone cachée : la première rangée dessine la lisière, les suivantes remplissent.
    // Elle court sur toute la largeur du monde, d'un bord à l'autre.
    for (let rang = 0; rang < 10; rang++) {
      yield;
      for (let t = -40; t <= 40; t += 2.5) {
        const gx = xLis + 0.6 + rang * 2.6;
        const gy = nd.y + t + (rang % 2) * 1.25;
        const n = drawProp("cloudBank", gx, gy, pal, Math.floor(Math.abs(t) * 7919 + rang * 101 + 7));
        n.zIndex = gx + gy;
        finCarte.addChild(n);
      }
    }
    // le panneau « route barrée » : planté en travers du chemin, juste devant les nuages, là où la
    // route s'y enfonce. Sur le bas-côté, il sortait de l'écran du téléphone.
    // Sur téléphone, l'écran ne couvre qu'environ quatre colonnes de part et d'autre de la case du
    // jour : on prend le dernier point du chemin avant les nuages qui reste dans cette bande.
    const colJour = nd.x - nd.y;
    const iMax = Math.min(L.length - 1, (iCroise >= 0 ? iCroise : iFin) - 2);
    let iPano = Math.min(iMax, iJour + 2);
    for (let i = iJour + 2; i <= iMax; i++) if (Math.abs(L[i].x - L[i].y - colJour) <= 4) iPano = i;
    const pano = L[iPano];
    const sx = pano.x, sy = pano.y;
    const sg = drawProp("signpost", sx, sy, pal, 4242, {});
    sg.y = -heightAt(this.terrain, sx + 0.5, sy + 0.5) * ZH;
    // au-dessus des nuages : il est planté devant eux, et ne doit jamais s'y perdre
    panneauFin.zIndex = 1e6 + 1;
    panneauFin.addChild(sg);
  }

  /* ---------------------------- navigation --------------------------- */
  /** Doigt, souris et clavier. Le défilement de la page reste le maître : on ne fait que l'alimenter. */
  private installerNavigation(canvas: HTMLCanvasElement) {
    // PixiJS met `touch-action: none` sur le canvas, ce qui empêchait le pouce de faire défiler la carte.
    // `pan-y` rend le glissement vertical au navigateur (avec son inertie) sans casser le toucher des cases.
    canvas.style.touchAction = "pan-y";

    // --- glisser à la souris : on attrape le paysage et on le tire ---
    let tireur = false, departY = 0, departScroll = 0, bouge = false;
    const bas = (e: PointerEvent) => {
      this.survol?.couper(performance.now());
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      tireur = true; bouge = false; departY = e.clientY; departScroll = scrollY;
    };
    const deplace = (e: PointerEvent) => {
      if (!tireur) return;
      const d = e.clientY - departY;
      if (!bouge && Math.abs(d) < 4) return; // un simple clic doit rester un clic
      bouge = true;
      canvas.style.cursor = "grabbing";
      scrollTo({ top: Math.max(0, Math.min(this.maxScroll, departScroll - d)) });
    };
    const haut = () => { tireur = false; canvas.style.cursor = ""; };
    canvas.addEventListener("pointerdown", bas);
    addEventListener("pointermove", deplace);
    addEventListener("pointerup", haut);
    addEventListener("pointercancel", haut);

    // --- clavier : on saute de date en date ---
    const coupe = () => this.survol?.couper(performance.now());
    addEventListener("wheel", coupe, { passive: true });
    const touche = (e: KeyboardEvent) => {
      coupe();
      const vers = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
      if (!vers) return;
      // on laisse le clavier tranquille dès qu'on écrit ou qu'une fenêtre est ouverte
      const actif = document.activeElement;
      if (actif && actif !== document.body && actif.tagName !== "CANVAS") return;
      if (document.querySelector("[role=dialog], dialog[open]")) return;
      e.preventDefault();
      const jour = Math.max(1, Math.min(this.lastOpenDay, Math.round(this.dayAt(this.focusWorldY())) + vers));
      scrollTo({ top: Math.max(0, Math.min(this.maxScroll, this.scrollForDay(jour))), behavior: "smooth" });
    };
    addEventListener("keydown", touche);

    // --- inclinaison du téléphone : sans autorisation (Android), tout de suite ; sur iOS, au premier
    // toucher de la carte, seul moment où le navigateur accepte de poser la question ---
    const gyro = () => { canvas.removeEventListener("pointerup", gyro); void this.inclinaison.demarrer(); };
    if (Inclinaison.demandeAutorisation()) canvas.addEventListener("pointerup", gyro);
    else gyro();
    this.retirerNavigation = () => {
      canvas.removeEventListener("pointerup", gyro);
      this.inclinaison.arreter();
      canvas.removeEventListener("pointerdown", bas);
      removeEventListener("pointermove", deplace);
      removeEventListener("pointerup", haut);
      removeEventListener("pointercancel", haut);
      removeEventListener("keydown", touche);
      removeEventListener("wheel", coupe);
    };
  }

  /* ------------------------------ caméra ----------------------------- */
  resize() {
    this.scale = Math.max(0.62, Math.min(1.25, innerWidth / 560));
    this.world.scale.set(this.scale);
    this.padTop = Math.min(300, innerHeight * 0.36);
    this.fog.width = innerWidth; this.fog.height = innerHeight * 0.75; this.fog.y = innerHeight * 0.25;
  }
  setScroll(y: number) {
    // on ne va pas voir les cases encore verrouillées : la suite reste une surprise
    const max = this.maxScroll;
    if (y > max + 2) { this.scrollY = max; scrollTo({ top: max }); return; }
    this.scrollY = y;
  }
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

  /** Dans la grotte, le dehors disparaît (choix d'Alexandre, 27 nov) : avant l'entrée et après la sortie, l'écran
   *  passe au noir, avec un fondu sur le seuil. Le seuil suit la frontière des mondes, perpendiculaire au chemin
   *  sur la carte (donc en biais à l'écran) : un voile par seuil, tourné dans ce sens. `force` (0 à 1) suit la
   *  proximité de la grotte : en ressortant, le dehors se rallume. */
  dessinerDehors(force: number) {
    const L = this.terrain.path, caveZ = ZONES.findIndex((z) => z.id === "grotte");
    const i0 = L.findIndex((p) => p.zone === caveZ);
    let i1 = -1;
    for (let i = L.length - 1; i >= 0; i--) if (L[i].zone === caveZ) { i1 = i; break; }
    const t = Math.max(0, Math.min(1, (force - 0.15) / 0.45));
    const alpha = 0.97 * t * t * (3 - 2 * t);
    this.dehors.visible = alpha > 0.01 && i0 > 0 && i1 > 0 && i1 < L.length - 1;
    if (!this.dehors.visible) return;
    if (!this.dehorsVoiles.length) {
      // texture blanche : opaque en haut, fondu sur le dernier seizième (le seuil), teintée ensuite
      const cv = document.createElement("canvas");
      cv.width = 4; cv.height = 1024;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, 0, 1024);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(15 / 16, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 1024);
      const tex = Texture.from(cv);
      for (let k = 0; k < 2; k++) {
        const v = new Sprite(tex);
        v.anchor.set(0.5, 1);
        this.dehors.addChild(v);
        this.dehorsVoiles.push(v);
      }
    }
    const sc = this.world.scale.x, FONDU = 150 * sc;
    const seuils: [PathCell, PathCell][] = [[L[i0], L[i0 - 1]], [L[i1], L[i1 + 1]]]; // [dedans, dehors]
    seuils.forEach(([a, b], k) => {
      const v = this.dehorsVoiles[k];
      const pa = P(a.x + 0.5, a.y + 0.5, a.z), pb = P(b.x + 0.5, b.y + 0.5, b.z);
      // vers le dehors, à l'écran, et la frontière perpendiculaire sur la carte
      const out = { x: pb.x - pa.x, y: pb.y - pa.y };
      const ligne = b.x !== a.x ? P(0, 1) : P(1, 0);
      let rot = Math.atan2(ligne.y, ligne.x);
      if (Math.sin(rot) * out.x - Math.cos(rot) * out.y < 0) rot += Math.PI; // le haut du voile regarde dehors
      const n = Math.hypot(out.x, out.y) || 1;
      // le fondu est presque tout entier dans la grotte : le dehors est noir dès le seuil
      const m = { x: (pa.x + pb.x) / 2 - (out.x / n) * 120, y: (pa.y + pb.y) / 2 - (out.y / n) * 120 };
      v.position.set(this.world.x + m.x * sc, this.world.y + m.y * sc);
      v.rotation = rot;
      v.width = 8000;
      v.height = FONDU * 16;
      v.tint = this.pal.night ? 0x02060f : 0x0a1a2c;
      v.alpha = alpha;
    });
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
      if (this.survol) this.cameraSurvol(this.survol);
    }

    // on ne dessine que les tranches de décor qui touchent l'écran (à l'échelle réelle : le survol recule)
    const ech = this.world.scale.x;
    const topY = (-this.world.y) / ech - 80;
    const botY = (innerHeight - this.world.y) / ech + 80;
    // les décors s'arrêtent un peu avant le banc de nuages : sinon un toit émerge de la brume
    const limiteDecor = this.limiteDepth === Infinity ? Infinity : this.limiteDepth - 4;
    // (issue #14) : seul ce qui entoure l'écran est dessiné. Une bande de sol commence à `k` et court
    // sur 10 : celle qui contient la limite reste visible, juste assez pour porter le banc de nuages
    this.diffuser(topY, botY, limiteDecor);
    // habitants : seuls ceux qui sont à l'écran vivent ; les autres attendent, figés
    const leftX = (-this.world.x) / ech - 60, rightX = (innerWidth - this.world.x) / ech + 60;
    for (const cr of this.life) {
      // les pylônes du télésiège portent leur câble loin au-dessus de leur pied : marge plus large
      const m = cr.species === "pylon" ? 240 : cr.species === "chair" ? 120 : 60;
      const vis = cr.zIndex <= limiteDecor && cr.y > topY - 60 && cr.y < botY + m && cr.x > leftX - m + 60 && cr.x < rightX + m - 60;
      cr.visible = vis;
      if (vis) updateCritter(cr, dt, this.lifeGround, this.terrain);
    }
    for (const [, cont] of this.gifts) {
      const gy = cont.y;
      // un cadeau encore verrouillé au-delà des nuages flotterait au-dessus du vide
      cont.visible = cont.zIndex <= this.limiteCadeaux && gy > topY - 120 && gy < botY + 120;
    }

    // ambiance
    const zm = this.zoneMix(fy);
    // le temps qu'il fait suit le jour que l'on regarde, pas le monde seul
    const wx = weatherAt(this.dayAt(fy));
    if (wx.label !== this.weatherNow) { this.weatherNow = wx.label; this.cb.onWeather?.(wx.label); }
    const za = ZONES[zm.a], zb = ZONES[zm.b];
    const lerp = (a: number, b: number) => a + (b - a) * zm.t;
    const zi = zm.t < 0.5 ? zm.a : zm.b;
    if (zi !== this.zoneNow) { this.zoneAvant = this.zoneNow; this.zoneNow = zi; this.cb.onZone(zi); }
    // aurores boréales, seulement au pôle Nord : rubans glissés entre le sol et le décor (aurora.ts)
    const polarForce = (ZONES[zm.a].id === "pole-nord" ? 1 - zm.t : 0) + (ZONES[zm.b].id === "pole-nord" ? zm.t : 0);
    const caveForce = (ZONES[zm.a].id === "grotte" ? 1 - zm.t : 0) + (ZONES[zm.b].id === "grotte" ? zm.t : 0);
    this.dessinerDehors(caveForce);
    {
      // le calque vit dans le monde (pour passer sous le décor) mais se dessine en coordonnées d'écran
      const sc = this.world.scale.x;
      this.aurora.position.set(-this.world.x / sc, -this.world.y / sc);
      this.aurora.scale.set(1 / sc);
      this.aurora.update(this.time * 16.67, polarForce, this.pal.night, innerWidth, innerHeight);
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
    // sous la montagne, il ne neige presque plus
    const active = Math.floor(Math.min(1, density / 1.6) * this.flakes.length * (1 - caveForce * 0.85));
    this.inclinaison.update(dt);
    const tilt = this.inclinaison;
    this.flakes.forEach((f, i) => {
      f.s.visible = i < active;
      if (!f.s.visible) return;
      f.ph += 0.02 * dt;
      // pencher le téléphone : les flocons proches (z grand) réagissent plus que les lointains
      f.s.y += f.vy * speed * Math.max(0.45, 1 + tilt.y * 0.6) * dt;
      f.s.x += (Math.sin(f.ph) * 0.4 + wind * (1 + f.z) * 1.6 + tilt.x * (0.8 + f.z * 2.4)) * dt;
      if (f.s.y > innerHeight + 10) { f.s.y = -10; f.s.x = Math.random() * innerWidth; }
      if (f.s.x > innerWidth + 10) f.s.x = -10;
      if (f.s.x < -10) f.s.x = innerWidth + 10;
    });
    // mur de brouillard : au-delà de la dernière case ouverte, la suite du chemin se perd dans le blanc
    this.whiteout.clear();
    const wo = Math.max(0, density - 1) * 0.16; // voile de tempête : assez pour aveugler, pas pour effacer le décor
    if (wo > 0.01) this.whiteout.rect(0, 0, innerWidth, innerHeight).fill({ color: 0xffffff, alpha: wo });

    // décors vivants : la grande roue tourne (nacelles toujours droites), la fumée monte des cheminées
    for (const ch of this.charges.values()) for (const a of ch.anims) this.animerDecor(a, dt);
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
    this.overlay.position.copyFrom(this.world.position);
    this.overlay.scale.copyFrom(this.world.scale);
    this.giftLight.visible = false;
    for (const [, cont] of this.gifts) {
      const meta = (cont as Container & { meta: { inner: Container; glow: Graphics; st: NodeState; label: Container; labelY: number; wx: number } }).meta;
      meta.label.visible = cont.visible;
      if (meta.st === "available") {
        meta.inner.y = -Math.abs(Math.sin(this.time * 0.07)) * 8;
        meta.glow.alpha = 0.55 + Math.sin(this.time * 0.07) * 0.35;
        meta.label.y = meta.labelY + meta.inner.y;
        // sa propre lumière, qui monte avec le soir : le cadeau du jour reste le plus lumineux de l'écran
        if (cont.visible && this.light > 0.05) {
          const pulse = 0.85 + Math.sin(this.time * 0.07) * 0.15;
          this.giftLight.visible = true;
          this.giftLight.position.set(meta.wx, cont.y - 22);
          this.giftLight.scale.set(1.9 * pulse, 1.5 * pulse);
          this.giftLight.alpha = Math.min(1, this.light) * 0.55;
        }
      }
    }
    // le personnage rejoint en marchant l'endroit que l'on regarde, sans dépasser la dernière case ouverte
    if (!this.marcheScriptee && !this.focus) {
      const limite = this.nodeIndex(Math.min(24, this.lastOpenDay)) - 0.6;
      const vise = Math.max(0, Math.min(limite, best.i - 0.6));
      const moi = this.people[this.leader];
      const ecart = vise - this.pos[this.leader];
      if (Math.abs(ecart) > 0.12) {
        moi.walking = 1;
        this.pos[this.leader] += Math.sign(ecart) * Math.min(Math.abs(ecart), 0.11 * dt);
      } else if (moi.walking) {
        this.pos[this.leader] = vise;
        moi.walking = 0;
      }
    }
    const target = this.pos[this.leader] - 1.1;
    const d = target - this.penguinPos;
    this.penguin.walking = Math.abs(d) > 0.05 ? 1 : 0;
    this.penguinPos += Math.sign(d) * Math.min(Math.abs(d), 0.12 * dt);
    this.placeActors();
    for (const who of ["alexandre", "flavie"] as Who[]) this.people[who].update(dt);
    this.penguin.update(dt);
    this.eclairerJoueur();
    this.guetterArrivee();
  }

  /** Largeur du monde (px du monde) montrée par un instantané : un peu plus qu'un écran de téléphone */
  static LARGEUR_INSTANTANE = 640;

  /**
   * Issue #61 : image (data URL PNG) du décor centré sur la case `day`, pour le PDF des souvenirs.
   * Dessinée à part, hors écran et toujours de jour : ni interface (étiquettes), ni personnages, ni habitants,
   * ni brouillard, ni banc de nuages ; le cadeau du jour est ouvert. Elle reprend le décor actuel (rien de figé).
   * Le dessin se fait lot par lot en rendant la main entre deux, pour ne pas geler l'écran.
   */
  async snapshotAround(day: number, width: number, height: number): Promise<string> {
    const n = this.terrain.nodes[day - 1];
    if (!n || width < 1 || height < 1) return "";
    const pal = makePalette(false);
    const W = Scene.LARGEUR_INSTANTANE, H = (W * height) / width;
    const o = P(n.x + 0.5, n.y + 0.5, heightAt(this.terrain, n.x + 0.5, n.y + 0.5));
    // le cadeau un peu sous le milieu : on voit davantage le décor qui le domine
    const cadre = new Rectangle(o.x - W / 2, o.y - H * 0.55, W, H);
    const racine = new Container();
    const ciel = ZONES[this.terrain.path.find((c) => c.x === n.x && c.y === n.y)?.zone ?? 0].bgDay;
    const fond = new Graphics().rect(cadre.x, cadre.y, W, H).fill(ciel);
    const ground = new Container(), objects = new Container();
    ground.sortableChildren = objects.sortableChildren = true;
    racine.addChild(fond, ground, objects);
    const cible: Cible = { pal, flying: this.wantsFlying(), ground, objects, charges: new Map() };
    const anims: AnimPart[] = [];
    // on rend la main toutes les ~30 ms de dessin : assez pour que l'écran respire, sans traîner
    const laMain = () => new Promise<void>((r) => setTimeout(r, 0));
    let t0 = performance.now();
    try {
      for (let i = 0; i < this.lots.length; i++) {
        const lot = this.lots[i];
        if (lot.max < cadre.top || lot.min > cadre.bottom) continue;
        for (const _ of this.chargerLot(i, cible, new Container())) void _;
        const ch = cible.charges.get(i);
        if (ch) anims.push(...ch.anims);
        if (performance.now() - t0 > 30) { await laMain(); t0 = performance.now(); }
      }
      // les décors animés dans une pose naturelle (sans cela, les jouets du tapis attendent à l'origine)
      for (const a of anims) {
        if (a.kind === "takeoff") a.t = 0.55;
        this.animerDecor(a, 0);
      }
      // les cadeaux : ceux de la carte dans leur état actuel, celui du jour ouvert
      const etats = new Map(this.states);
      etats.set(day, "opened");
      const faux = { pal, states: etats, labels: new Container(), gifts: new Map<number, Container>() } as unknown as Built;
      for (const m of this.terrain.nodes) {
        const g = P(m.x + 0.5, m.y + 0.5).y;
        if (g < cadre.top - 80 || g > cadre.bottom + 80) continue;
        const cont = this.makeGift(m, faux);
        cont.eventMode = "none";
        objects.addChild(cont);
      }
      faux.labels.destroy({ children: true });
      return await this.app.renderer.extract.base64({ target: racine, frame: cadre, resolution: width / W, format: "png" });
    } finally {
      racine.destroy({ children: true });
    }
  }

  /** Une image d'un décor animé : grande roue, tapis roulant, renne, traîneau, fumée */
  animerDecor(a: AnimPart, dt: number) {
    if (a.kind === "wheel") {
      a.hub.rotation += 0.0045 * dt;
      for (const car of a.cars) car.rotation = -a.hub.rotation;
    } else if (a.kind === "belt") {
      // les jouets défilent sur le tapis, apparaissent à une bouche et disparaissent à l'autre
      const n = a.items.length;
      a.items.forEach((it, i) => {
        const u = (((this.time * 0.0035 + a.phase + i / n) % 1) + 1) % 1;
        it.x = a.a.x + (a.b.x - a.a.x) * u;
        it.y = a.a.y + (a.b.y - a.a.y) * u;
        it.alpha = Math.min(1, u * 10, (1 - u) * 10);
      });
    } else if (a.kind === "bob") {
      a.node.rotation = Math.sin(this.time * 0.035 + a.phase) * 0.12;
      a.node.y = a.y0 + Math.sin(this.time * 0.05 + a.phase) * 1.5;
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

  /** Le halo suit son personnage ; presque rien de jour, une vraie lanterne la nuit */
  private eclairerJoueur() {
    const moi = this.people[this.leader];
    const l = Math.min(1, this.light);
    this.playerLight.visible = !!moi && moi.visible && l > 0.02;
    if (!this.playerLight.visible) return;
    const p = this.overlay.toLocal(moi.getGlobalPosition());
    const souffle = 1 + Math.sin(this.time * 0.035) * 0.04;
    this.playerLight.position.set(p.x, p.y - 20);
    this.playerLight.scale.set(1.5 * souffle, 1.15 * souffle);
    this.playerLight.alpha = l * 0.42;
  }

  /* ------------------- présentation des mondes (issue #12) ------------------- */
  /** Centre de l'écran visé par la caméra : là où `focusWorldY` regarde */
  private static readonly CENTRE_Y = 0.55;

  /** Mélange la caméra normale (posée par le défilement) et celle du survol */
  private cameraSurvol(sv: Survol) {
    const now = this.survolFige !== null ? sv.t0 + this.survolFige : performance.now();
    const e = sv.etat(now);
    if (e.fini) {
      this.survol = null;
      if (!sv.interrompu) this.retenirPresente(sv.zone);
      return;
    }
    const sc0 = this.scale, cy = innerHeight * Scene.CENTRE_Y;
    // point du monde au centre de l'écran avec la caméra normale
    const c0x = (innerWidth / 2 - this.world.x) / sc0, c0y = (cy - this.world.y) / sc0;
    const x = c0x + (e.x - c0x) * e.poids, y = c0y + (e.y - c0y) * e.poids;
    const sc = sc0 * e.zoom;
    this.world.scale.set(sc);
    this.world.x = innerWidth / 2 - x * sc;
    this.world.y = cy - y * sc;
  }

  private retenirPresente(zone: number) {
    const id = ZONES[zone]?.id;
    if (!id) return;
    marquerPresente(this.leader, id);
    this.dejaPresentes().add(id);
  }

  private dejaPresentes() {
    if (!this.presentes || this.presentes.who !== this.leader) this.presentes = { who: this.leader, zones: mondesPresentes(this.leader) };
    return this.presentes.zones;
  }

  /** Arrivée dans un monde jamais présenté : la caméra s'est posée dedans depuis un moment, rien d'autre ne se passe */
  private guetterArrivee() {
    const now = performance.now();
    if (Math.abs(this.scrollY - this.reposScroll.y) > 1) {
      this.reposScroll = { y: this.scrollY, depuis: now };
      // le défilement a bougé sans geste du joueur (bouton « aujourd'hui », ouverture d'une case…) : on rend la main
      this.survol?.couper(now, false);
      return;
    }
    // l'ouverture d'une case prend la caméra : le survol s'efface, il reviendra plus tard
    if (this.focus && this.survol) this.survol = null;
    // navigateur piloté (captures, tests de bout en bout) : jamais de survol surprise au milieu d'une photo ;
    // la Qualité le déclenche à la demande avec `__calendrier.presenter(zone)`
    if (navigator.webdriver) return;
    if (this.survol || this.focus || this.marcheScriptee || this.zoneNow < 0 || !this.states.size) return;
    if (now - this.reposScroll.depuis < 1200) return;
    const id = ZONES[this.zoneNow]?.id;
    if (!id || this.dejaPresentes().has(id)) return;
    // une fenêtre ouverte, un onglet caché : ce sera pour plus tard
    if (document.visibilityState !== "visible" || document.querySelector("[role=dialog], dialog[open]")) return;
    this.presenterMonde(this.zoneNow);
  }

  /** Lance le survol du monde `zone` (index dans ZONES) depuis l'endroit que l'on regarde */
  presenterMonde(zone: number) {
    const id = ZONES[zone]?.id;
    if (!id) return;
    this.sound?.playJingle(id as ZoneId);
    if (document.documentElement.dataset.animations === "non") { this.retenirPresente(zone); return; }
    const L = this.terrain.path;
    const pt = (c: (typeof L)[number]) => P(c.x + 0.5, c.y + 0.5, c.z);
    // le bout de la route visible : la fin du monde, sans passer derrière le banc de nuages
    // (on s'arrête quand le banc de nuages atteint le bas de l'écran : un écran de nuages ne présente rien)
    const yMax = this.yFin === null ? Infinity : this.yFin - (innerHeight * (1 - Scene.CENTRE_Y) * 0.7) / (this.scale * ZOOM_SURVOL);
    let debut = L.findIndex((c) => c.zone === zone), fin = debut;
    if (debut < 0) return;
    while (fin + 1 < L.length && L[fin + 1].zone === zone && pt(L[fin + 1]).y <= yMax) fin++;
    // départ : la case de la route la plus proche de ce que l'on regarde
    const fy = this.focusWorldY();
    let ici = debut, bd = Infinity;
    let finZone = debut;
    while (finZone + 1 < L.length && L[finZone + 1].zone === zone) finZone++;
    for (let i = debut; i <= finZone; i++) { const d = Math.abs(pt(L[i]).y - fy); if (d < bd) { bd = d; ici = i; } }
    // arrivé par le haut (cas normal, ou au chargement) : on file vers la suite, s'il y en a ;
    // revenu par le bas (on remonte la carte) : on remonte jusqu'à l'entrée du monde
    const indices: number[] = [];
    if (this.zoneAvant > zone) for (let i = ici; i >= debut; i--) indices.push(i);
    else for (let i = ici; i <= Math.max(ici, fin); i++) indices.push(i);
    this.survol = new Survol(zone, indices.map((i) => pt(L[i])), performance.now());
  }
}
