/**
 * Base commune aux jeux d'adresse : une application PixiJS qui remplit un élément,
 * une boucle de jeu en secondes, et la saisie « le doigt glisse, la luge suit ».
 */

import { Application, Container } from "pixi.js";

export type ScenePixi = {
  app: Application;
  /** Racine à utiliser pour le jeu (vidée au nettoyage) */
  monde: Container;
  largeur: number;
  hauteur: number;
  /** Appelée à chaque image : dt en secondes (plafonné pour éviter les sauts après un onglet en arrière-plan) */
  surImage(cb: (dt: number) => void): void;
  surTaille(cb: (largeur: number, hauteur: number) => void): void;
  detruire(): void;
};

export async function creerScene(hote: HTMLElement): Promise<ScenePixi | null> {
  const app = new Application();
  await app.init({
    resizeTo: hote,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(devicePixelRatio, 2),
    autoDensity: true,
  });
  // L'hôte peut avoir disparu pendant l'initialisation (jeu fermé très vite).
  if (!hote.isConnected) { app.destroy(true, { children: true }); return null; }
  hote.appendChild(app.canvas);

  const monde = new Container();
  app.stage.addChild(monde);

  const rappelsImage: ((dt: number) => void)[] = [];
  const rappelsTaille: ((l: number, h: number) => void)[] = [];
  // Vrai pendant les rappels d'une image : détruire l'application à ce moment-là casse
  // le rendu qui suit dans la même image (issue #109), on reporte donc la destruction.
  let dansImage = false;
  let detruite = false;

  const scene: ScenePixi = {
    app, monde,
    largeur: app.screen.width,
    hauteur: app.screen.height,
    surImage: (cb) => { rappelsImage.push(cb); },
    surTaille: (cb) => { rappelsTaille.push(cb); },
    detruire: () => {
      if (detruite) return;
      detruite = true;
      rappelsImage.length = 0;
      rappelsTaille.length = 0;
      const detruireApp = () => {
        try { app.destroy(true, { children: true }); } catch { /* déjà détruite */ }
      };
      if (dansImage) {
        // Plus d'image suivante ; celle en cours se termine (rendu compris), puis on détruit.
        app.ticker.stop();
        setTimeout(detruireApp, 0);
      } else detruireApp();
    },
  };

  app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS, 50) / 1000;
    dansImage = true;
    try {
      // Copie : un rappel peut vider la liste (fin de partie) pendant le parcours.
      for (const cb of [...rappelsImage]) { if (detruite) break; cb(dt); }
    } finally { dansImage = false; }
  });

  app.renderer.on("resize", (l: number, h: number) => {
    scene.largeur = l; scene.hauteur = h;
    for (const cb of rappelsTaille) cb(l, h);
  });

  return scene;
}

/* ------------------------------------------------------------------ */
/* Saisie : glissement du doigt + flèches du clavier                   */
/* ------------------------------------------------------------------ */

export type Saisie = {
  /** Pixels de glissement horizontal depuis le dernier appel (0 si aucun doigt) */
  prendreGlissement(): number;
  /** -1 (gauche), 0, +1 (droite) d'après les flèches ou Q/D */
  axeClavier(): number;
  /** Vrai si un doigt / la souris est posé */
  appuye(): boolean;
  detruire(): void;
};

export function creerSaisie(cible: HTMLElement): Saisie {
  let dernierX: number | null = null;
  let cumul = 0;
  let gauche = false, droite = false;

  const bas = (e: PointerEvent) => { dernierX = e.clientX; cible.setPointerCapture?.(e.pointerId); };
  const bouge = (e: PointerEvent) => {
    if (dernierX === null) return;
    cumul += e.clientX - dernierX;
    dernierX = e.clientX;
  };
  const haut = () => { dernierX = null; };

  const touche = (e: KeyboardEvent, enfonce: boolean) => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "q" || k === "a") { gauche = enfonce; e.preventDefault(); }
    else if (k === "arrowright" || k === "d") { droite = enfonce; e.preventDefault(); }
  };
  const kd = (e: KeyboardEvent) => touche(e, true);
  const ku = (e: KeyboardEvent) => touche(e, false);

  cible.addEventListener("pointerdown", bas);
  cible.addEventListener("pointermove", bouge);
  cible.addEventListener("pointerup", haut);
  cible.addEventListener("pointercancel", haut);
  cible.addEventListener("pointerleave", haut);
  addEventListener("keydown", kd);
  addEventListener("keyup", ku);
  // Si la fenêtre perd le focus, on relâche tout (sinon la luge part toute seule).
  const flou = () => { gauche = droite = false; dernierX = null; };
  addEventListener("blur", flou);

  return {
    prendreGlissement: () => { const d = cumul; cumul = 0; return d; },
    axeClavier: () => (gauche ? -1 : 0) + (droite ? 1 : 0),
    appuye: () => dernierX !== null,
    detruire: () => {
      cible.removeEventListener("pointerdown", bas);
      cible.removeEventListener("pointermove", bouge);
      cible.removeEventListener("pointerup", haut);
      cible.removeEventListener("pointercancel", haut);
      cible.removeEventListener("pointerleave", haut);
      removeEventListener("keydown", kd);
      removeEventListener("keyup", ku);
      removeEventListener("blur", flou);
    },
  };
}
