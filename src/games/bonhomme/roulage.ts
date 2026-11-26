/**
 * Jour 13, phase 1 — rouler sa boule dans la neige de la place du marché.
 *
 * Vue de dessus : le doigt (ou la souris, ou les flèches) guide la boule, qui ramasse la neige
 * sous elle et grossit. Les pavés réapparaissent derrière elle : on ne ramasse pas deux fois la même neige.
 * Rouler toujours dans le même sens fait un boudin ; tourner garde la boule ronde.
 *
 * Canvas 2D plutôt que PixiJS : une seule texture qu'on gomme au passage, rien que Pixi ne simplifie.
 * Calibrage indépendant de l'écran : la neige est comptée en part du champ, donc téléphone et
 * ordinateur donnent les mêmes tailles de boule.
 */

import type { BonhommeContent } from "../../data/games/bonhomme-jour13";
import { creerAlea } from "../shared/alea";
import type { Boule } from "./modele";

export type HudRoulage = { avant: number; reste: number; cm: number; rondeur: number };

export type Roulage = {
  /** « C'est bon ! » : on arrête de rouler avant la fin du temps */
  finir(): void;
  arreter(): void;
};

export type OptionsRoulage = {
  hote: HTMLElement;
  contenu: BonhommeContent;
  /** Heure locale (ms) où le chrono démarre ; avant, compte à rebours */
  debut: number;
  /** Taille visée en cm (cercle pointillé), ou null */
  cible: () => number | null;
  surHud: (h: HudRoulage) => void;
  /** Conseil ponctuel de Pingou pendant la partie */
  surConseil: (texte: string) => void;
  surFin: (b: Boule) => void;
};

const AXES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

export function lancerRoulage(o: OptionsRoulage): Roulage {
  const { hote, contenu: c } = o;
  const canvas = document.createElement("canvas");
  hote.prepend(canvas);
  const g = canvas.getContext("2d")!;
  const neige = document.createElement("canvas");
  const gn = neige.getContext("2d")!;
  const fond = document.createElement("canvas");
  const gf = fond.getContext("2d")!;

  let L = 0, H = 0, m = 0, dpr = 1;
  /* grille de neige, en coordonnées normalisées (0..1 sur la largeur et la hauteur) */
  const alea = creerAlea(c.graine);
  const NC = 26; // cellules sur le plus petit côté
  let nx = 0, ny = 0, cs = 0;
  let grille = new Float32Array(0);
  let neigeTotale = 1;
  let k = 0; // cm² par unité de neige ramassée

  const r0 = c.rayonDepart;
  let aire = Math.PI * r0 * r0; // cm²
  const rCm = () => Math.min(c.rayonMax, Math.sqrt(aire / Math.PI));
  const rPx = (r: number) => m * (0.028 + 0.075 * (r - r0) / (c.rayonMax - r0));

  let px = 0.5, py = 0.55; // position normalisée de la boule
  let tour = 0; // roulement accumulé (radians), pour les taches qui tournent
  let dirX = 1, dirY = 0;
  const axes = [0, 0, 0, 0];

  let doigt: { x: number; y: number } | null = null;
  const touches = { g: false, d: false, h: false, b: false };

  /* ---------- dimensions et dessin du fond ---------- */
  const dimensionner = () => {
    const nl = hote.clientWidth, nh = hote.clientHeight;
    if (!nl || !nh) return;
    const premiere = !grille.length;
    L = nl; H = nh; m = Math.min(L, H); dpr = Math.min(devicePixelRatio || 1, 2);
    for (const cv of [canvas, neige, fond]) { cv.width = Math.round(L * dpr); cv.height = Math.round(H * dpr); }
    canvas.style.width = `${L}px`; canvas.style.height = `${H}px`;
    if (premiere) {
      cs = m / NC; nx = Math.ceil(L / cs); ny = Math.ceil(H / cs);
      grille = new Float32Array(nx * ny);
      neigeTotale = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        // un peu de relief : des congères plus épaisses, quelques plaques déjà tassées
        const v = 0.55 + 0.45 * alea.reel();
        const tasse = alea.chance(0.05);
        grille[j * nx + i] = tasse ? 0.15 : v;
        neigeTotale += grille[j * nx + i];
      }
      // une neige parfaitement ramassée à 80 % donne la plus grosse boule
      k = (Math.PI * (c.rayonMax ** 2 - r0 ** 2)) / (0.8 * neigeTotale);
      // la petite boule de départ est ronde : un peu de « rondeur » d'avance sur chaque axe
      axes.fill(neigeTotale * 0.012);
    }
    dessinerFond();
    dessinerNeige();
  };

  const dessinerFond = () => {
    gf.setTransform(dpr, 0, 0, dpr, 0, 0);
    gf.fillStyle = "#8e98a6";
    gf.fillRect(0, 0, L, H);
    // pavés de la place du marché
    const a = creerAlea(c.graine + 7);
    const p = m / 16;
    for (let y = 0, rang = 0; y < H + p; y += p * 0.62, rang++) {
      for (let x = (rang % 2) * p * 0.5; x < L + p; x += p) {
        const t = 0.9 + a.reel() * 0.2;
        gf.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(158 * t)},${Math.round(170 * t)})`;
        gf.beginPath();
        gf.ellipse(x, y, p * 0.44, p * 0.27, 0, 0, Math.PI * 2);
        gf.fill();
      }
    }
  };

  /** Couche de neige reconstruite depuis la grille (au départ et après un changement de taille) */
  const dessinerNeige = () => {
    gn.setTransform(dpr, 0, 0, dpr, 0, 0);
    gn.clearRect(0, 0, L, H);
    const sx = L / nx, sy = H / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = grille[j * nx + i];
      if (v <= 0.01) continue;
      const b = Math.round(236 + 19 * v);
      gn.fillStyle = `rgba(${b - 6},${b - 2},${b},${0.55 + 0.45 * v})`;
      gn.beginPath();
      gn.arc((i + 0.5) * sx, (j + 0.5) * sy, Math.max(sx, sy) * (0.72 + 0.12 * v), 0, Math.PI * 2);
      gn.fill();
    }
  };

  /* ---------- saisie ---------- */
  const versLocal = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    return { x: (e.clientX - b.left) / L, y: (e.clientY - b.top) / H };
  };
  const bas = (e: PointerEvent) => { doigt = versLocal(e); hote.setPointerCapture?.(e.pointerId); };
  const bouge = (e: PointerEvent) => { if (doigt) doigt = versLocal(e); };
  const haut = () => { doigt = null; };
  const touche = (e: KeyboardEvent, v: boolean) => {
    const t = e.key.toLowerCase();
    if (t === "arrowleft" || t === "q" || t === "a") touches.g = v;
    else if (t === "arrowright" || t === "d") touches.d = v;
    else if (t === "arrowup" || t === "z" || t === "w") touches.h = v;
    else if (t === "arrowdown" || t === "s") touches.b = v;
    else return;
    e.preventDefault();
  };
  const kd = (e: KeyboardEvent) => touche(e, true);
  const ku = (e: KeyboardEvent) => touche(e, false);
  const flou = () => { doigt = null; touches.g = touches.d = touches.h = touches.b = false; };
  hote.addEventListener("pointerdown", bas);
  hote.addEventListener("pointermove", bouge);
  hote.addEventListener("pointerup", haut);
  hote.addEventListener("pointercancel", haut);
  addEventListener("keydown", kd);
  addEventListener("keyup", ku);
  addEventListener("blur", flou);

  /* ---------- boucle ---------- */
  let fini = false, arrete = false;
  let dernier = performance.now();
  let dernierHud = 0;
  let dernierConseil = -10_000;
  let cibleAtteinte = false;
  let raf = 0;

  const rondeur = () => {
    const mx = Math.max(...axes), mn = Math.min(...axes);
    return mx <= 0 ? 1 : mn / mx;
  };

  const terminer = () => {
    if (fini) return;
    fini = true;
    o.surFin({ r: Math.round(rCm() * 10) / 10, rondeur: Math.round(rondeur() * 1000) / 1000 });
  };

  const ramasser = (rp: number) => {
    // cellules sous la boule
    const sx = L / nx, sy = H / ny;
    const cx = px * L, cy = py * H;
    const i0 = Math.max(0, Math.floor((cx - rp) / sx)), i1 = Math.min(nx - 1, Math.floor((cx + rp) / sx));
    const j0 = Math.max(0, Math.floor((cy - rp) / sy)), j1 = Math.min(ny - 1, Math.floor((cy + rp) / sy));
    let gain = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5) * sx - cx, dy = (j + 0.5) * sy - cy;
      if (dx * dx + dy * dy > rp * rp) continue;
      gain += grille[j * nx + i];
      grille[j * nx + i] = 0;
    }
    if (gain > 0) {
      gn.save();
      gn.globalCompositeOperation = "destination-out";
      gn.beginPath();
      gn.arc(cx, cy, rp, 0, Math.PI * 2);
      gn.fill();
      gn.restore();
    }
    return gain;
  };

  const image = (t: number) => {
    if (arrete) return;
    raf = requestAnimationFrame(image);
    const dt = Math.min(0.05, (t - dernier) / 1000);
    dernier = t;
    if (!grille.length) { dimensionner(); if (!grille.length) return; }
    const maintenant = Date.now();
    const avant = Math.ceil((o.debut - maintenant) / 1000);
    const reste = Math.max(0, c.secondesRouler - (maintenant - o.debut) / 1000);
    const enJeu = avant <= 0 && !fini;

    let r = rCm();
    let rp = rPx(r);
    if (enJeu) {
      // direction voulue : vers le doigt, ou les flèches
      let vx = 0, vy = 0;
      const vmax = 0.6 * m; // px/s
      if (doigt) {
        const dx = (doigt.x - px) * L, dy = (doigt.y - py) * H;
        const d = Math.hypot(dx, dy);
        if (d > 2) { const v = Math.min(vmax, d * 6); vx = (dx / d) * v; vy = (dy / d) * v; }
      } else {
        const ax = (touches.d ? 1 : 0) - (touches.g ? 1 : 0), ay = (touches.b ? 1 : 0) - (touches.h ? 1 : 0);
        const n = Math.hypot(ax, ay);
        if (n) { vx = (ax / n) * vmax; vy = (ay / n) * vmax; }
      }
      const dx = vx * dt, dy = vy * dt;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        px = Math.min(1 - rp / L, Math.max(rp / L, px + dx / L));
        py = Math.min(1 - rp / H, Math.max(rp / H, py + dy / H));
        dirX = dx / dist; dirY = dy / dist;
        tour += dist / Math.max(4, rp);
        const gain = ramasser(rp * 0.92);
        if (gain > 0) {
          aire += gain * k;
          const th = Math.atan2(dirY, dirX);
          for (let a = 0; a < 4; a++) axes[a] += gain * Math.abs(Math.cos(th - AXES[a]));
          r = rCm(); rp = rPx(r);
        }
      }
      // conseils de Pingou (pas plus d'un toutes les 5 s)
      const total = axes.reduce((a, b) => a + b, 0);
      if (maintenant - dernierConseil > 5000 && total > neigeTotale * 0.12 && rondeur() < 0.45) {
        dernierConseil = maintenant;
        o.surConseil("Tourne un peu ! Ta boule devient un boudin 🌭");
      }
      const cible = o.cible();
      if (cible && !cibleAtteinte && Math.abs(r - cible) / cible < 0.07) {
        cibleAtteinte = true;
        o.surConseil("Pile la bonne taille ! Tu peux t'arrêter là 👌");
      }
      if (reste <= 0) terminer();
    }

    // HUD à 10 Hz
    if (maintenant - dernierHud > 100) {
      dernierHud = maintenant;
      o.surHud({ avant: Math.max(0, avant), reste: Math.ceil(reste), cm: Math.round(r), rondeur: rondeur() });
    }

    /* ----- dessin ----- */
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L, H);
    g.drawImage(fond, 0, 0, L, H);
    g.drawImage(neige, 0, 0, L, H);
    const cx = px * L, cy = py * H;
    // cercle de la taille visée
    const cible = o.cible();
    if (cible) {
      g.save();
      g.setLineDash([6, 6]);
      g.lineWidth = 2.5;
      g.strokeStyle = cibleAtteinte ? "rgba(47,163,122,.95)" : "rgba(27,39,71,.55)";
      g.beginPath(); g.arc(cx, cy, rPx(Math.min(cible, c.rayonMax)), 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    // ombre
    g.fillStyle = "rgba(27,39,71,.22)";
    g.beginPath(); g.ellipse(cx + rp * 0.18, cy + rp * 0.22, rp * 1.02, rp * 0.9, 0, 0, Math.PI * 2); g.fill();
    // boule : aplatie perpendiculairement au sens où on l'a le plus roulée
    const rd = rondeur();
    const imax = axes.indexOf(Math.max(...axes));
    const ang = AXES[imax] + Math.PI / 2;
    const ex = rp * (1 + 0.38 * (1 - rd)), ey = rp * (1 - 0.22 * (1 - rd));
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    const grad = g.createRadialGradient(-ex * 0.35, -ey * 0.4, rp * 0.1, 0, 0, Math.max(ex, ey));
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.7, "#eef4fb");
    grad.addColorStop(1, "#c9d7e8");
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // taches qui tournent avec la boule (impression de roulement)
    g.fillStyle = "rgba(140,160,185,.55)";
    for (let i = 0; i < 4; i++) {
      const ph = tour + i * (Math.PI / 2);
      const avantArriere = Math.cos(ph);
      if (avantArriere < 0) continue;
      const lat = (i % 2 ? 0.35 : -0.3) * rp;
      const x = cx + dirX * Math.sin(ph) * rp * 0.7 - dirY * lat;
      const y = cy + dirY * Math.sin(ph) * rp * 0.7 + dirX * lat;
      g.beginPath(); g.arc(x, y, rp * 0.08 * (0.5 + avantArriere * 0.5), 0, Math.PI * 2); g.fill();
    }
  };
  raf = requestAnimationFrame(image);

  const obs = new ResizeObserver(() => dimensionner());
  obs.observe(hote);

  return {
    finir: () => { if (Date.now() >= o.debut) terminer(); },
    arreter: () => {
      arrete = true;
      cancelAnimationFrame(raf);
      obs.disconnect();
      hote.removeEventListener("pointerdown", bas);
      hote.removeEventListener("pointermove", bouge);
      hote.removeEventListener("pointerup", haut);
      hote.removeEventListener("pointercancel", haut);
      removeEventListener("keydown", kd);
      removeEventListener("keyup", ku);
      removeEventListener("blur", flou);
      canvas.remove();
    },
  };
}
