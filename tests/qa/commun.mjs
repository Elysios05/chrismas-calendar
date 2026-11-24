// Outils partagés par les scripts Qualité : build, serveur de prévisualisation, navigateur, crochets de test.
// Aucun code de l'application n'est modifié : on s'appuie sur le crochet officiel des outils de dév PixiJS
// (globalThis.__PIXI_APP_INIT__) pour récupérer l'Application et viser les cadeaux dessinés dans le canvas.
import { execSync } from "node:child_process";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export let PORT = Number(process.env.QA_PORT ?? 4180);
export let BASE = `http://localhost:${PORT}/`; // liaisons vivantes : servir() peut les changer (port libre)
export const CHROME = process.env.QA_CHROME ?? "/usr/bin/google-chrome";
export const ARGS_CHROME = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export const APPAREILS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ordinateur: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

/** Heure locale simulée (Europe/Paris) : 12 h = jour, 21 h = nuit (le site passe en nuit entre 17 h et 7 h). */
export const HEURES = { jour: "2026-11-30T12:00:00", nuit: "2026-11-30T21:00:00" };
export const FUSEAU = "Europe/Paris";

export const dateDuJour = () => new Date().toISOString().slice(0, 10);

export function construire() {
  if (process.env.QA_SANS_BUILD) return;
  console.log("› npm run build");
  execSync("npm run build", { cwd: RACINE, stdio: "inherit" });
}

/** Vrai si dist/ existe et est plus récent que tout le code source (src/, index.html, package.json). */
export function buildRecent() {
  const dist = path.join(RACINE, "dist/index.html");
  if (!existsSync(dist)) return false;
  const t = statSync(dist).mtimeMs;
  let plusRecent = Math.max(...["index.html", "package.json", "vite.config.ts"].map((f) => { try { return statSync(path.join(RACINE, f)).mtimeMs; } catch { return 0; } }));
  const visite = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) visite(f); else plusRecent = Math.max(plusRecent, statSync(f).mtimeMs); } };
  for (const d of ["src", "public"]) if (existsSync(path.join(RACINE, d))) visite(path.join(RACINE, d));
  return t >= plusRecent;
}

/** Renvoie le dossier dist/ servi sur le port (en-tête x-cc-dist), "?" si un autre serveur répond, null si rien. */
async function distServi(port) {
  try { const r = await fetch(`http://127.0.0.1:${port}/`); return r.headers.get("x-cc-dist") ?? "?"; } catch { return null; }
}
const repond = async () => (await distServi(PORT)) !== null;
/**
 * Sert dist/ de CETTE copie de travail. Si le port est déjà pris par le serveur d'une autre copie
 * (ou par autre chose), on ne le réutilise pas : on prend un port libre et on met PORT/BASE à jour.
 */
export async function servir() {
  const { demarrerServeur, DIST } = await import("./serveur.mjs");
  const deja = await distServi(PORT);
  if (deja === DIST) { console.log(`› serveur déjà présent sur ${BASE} (même dist/)`); return { stop() {}, assurer: async () => {} }; }
  let port = PORT;
  if (deja !== null) {
    console.log(`› le port ${PORT} sert un autre dossier (${deja}) : port libre à la place`);
    port = 0;
  }
  let srv = await demarrerServeur(port);
  PORT = srv.address().port; BASE = `http://localhost:${PORT}/`;
  console.log(`› dist/ servi sur ${BASE}`);
  return {
    async assurer() { if (!(await repond())) { console.log("› serveur tombé : relance"); srv.close(); srv = await demarrerServeur(PORT); } },
    stop() { srv.close(); srv.closeAllConnections?.(); },
  };
}

export function lancerChrome(extra = []) {
  return chromium.launch({ executablePath: CHROME, args: [...ARGS_CHROME, ...extra] });
}

// La police Fredoka vient de Google Fonts, injoignable depuis l'environnement de test :
// on la sert depuis @fontsource/fredoka (mêmes fichiers) pour que les captures soient fidèles.
const require = createRequire(import.meta.url);
let cssPolice = null;
function policeLocale() {
  if (cssPolice) return cssPolice;
  const dir = path.dirname(require.resolve("@fontsource/fredoka/package.json"));
  cssPolice = [400, 500, 600, 700].map((w) => `@font-face{font-family:'Fredoka';font-style:normal;font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/qa/fredoka-${w}.woff2) format('woff2');}`).join("\n");
  cssPolice = { css: cssPolice, dir };
  return cssPolice;
}

/** Prépare un contexte : fuseau, heure figée, police locale, crochet PixiJS, collecte console. */
export async function preparerContexte(context, { heure } = {}) {
  const { css, dir } = policeLocale();
  await context.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: css }));
  await context.route(/fonts\.gstatic\.com/, (r) => {
    const m = r.request().url().match(/fredoka-(\d+)\.woff2/);
    const f = m && path.join(dir, "files", `fredoka-latin-${m[1]}-normal.woff2`);
    if (f && existsSync(f)) return r.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(f) });
    return r.fulfill({ status: 404, body: "" });
  });
  await context.addInitScript(() => {
    // crochet des outils de dév PixiJS : appelé par Application.init()
    globalThis.__PIXI_APP_INIT__ = (app) => { globalThis.__qaApp = app; };
  });
  if (heure) await context.clock.setFixedTime(new Date(`${heure}`));
}

/** Branche la collecte des erreurs de console et des exceptions sur une page. */
export function collecterConsole(page) {
  const msgs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push({ type: m.type(), texte: m.text() }); });
  page.on("pageerror", (e) => msgs.push({ type: "exception", texte: String(e?.stack ?? e) }));
  page.on("requestfailed", (r) => msgs.push({ type: "requête", texte: `${r.url()} — ${r.failure()?.errorText}` }));
  return msgs;
}

/**
 * Attend que la carte soit là (scène Pixi construite, 24 cadeaux) et que la police soit prête.
 * Échoue EXPLICITEMENT si on est resté sur l'écran de connexion (ou tout autre écran sans carte) :
 * aucune capture ni mesure ne doit se faire en silence sur le mauvais écran.
 */
export async function attendreScene(page, timeout = 30000) {
  try {
    await page.waitForFunction(() => {
      const app = globalThis.__qaApp;
      if (!app?.stage || !document.querySelector(".hud")) return false;
      let n = 0;
      const visit = (c) => { if (c.meta && c.eventMode === "static") n++; for (const k of c.children ?? []) visit(k); };
      visit(app.stage);
      return n >= 24;
    }, null, { timeout });
  } catch (e) {
    const login = await page.locator(".login-card").count().catch(() => 0);
    throw new Error(login
      ? `Carte non atteinte : la page est restée sur l'écran de connexion (${page.url()}).`
      : `Carte non atteinte en ${timeout} ms (${page.url()}) : ${e.message.split("\n")[0]}`);
  }
  await page.evaluate(() => document.fonts.ready);
}

/** Ferme la bulle de Pingou (clics successifs). */
export async function fermerPingou(page) {
  for (let i = 0; i < 20; i++) {
    const m = page.locator(".mascot");
    if (!(await m.count())) return;
    await m.click({ force: true }).catch(() => {});
    await page.waitForTimeout(80);
  }
}

/**
 * Position écran (px CSS) du cadeau du jour `day`, retrouvé dans l'arbre Pixi :
 * les cadeaux sont les conteneurs interactifs portant `meta` ; l'ordre d'ajout suit les jours 1→24.
 */
export async function positionCadeau(page, day) {
  return page.evaluate((day) => {
    // crochet de test fourni par l'équipe Monde (Scene.ts, présent avec ?jour= ou en dev)
    const h = globalThis.__calendrier;
    const app = globalThis.__qaApp;
    const gifts = [];
    const visit = (c) => { if (c.meta && c.eventMode === "static") gifts.push(c); for (const k of c.children ?? []) visit(k); };
    visit(app.stage);
    const jourDe = (c) => { let t = null; const v = (k) => { if (t === null && typeof k.text === "string") t = k.text; for (const e of k.children ?? []) v(e); }; v(c); return Number(t); };
    const g = gifts.find((c) => jourDe(c) === day);
    if (!g && !h) return null;
    // centre du paquet : on vise le corps (hors pastille) ; à défaut, le point fourni par le crochet
    let x, y, w = 0, hh = 0;
    if (g) { const b = g.meta.inner.children[0].getBounds(); x = b.x + b.width / 2; y = b.y + b.height / 2; w = b.width; hh = b.height; }
    else { const p = h.giftScreenPos(day); x = p.x; y = p.y; }
    const etat = h ? h.giftState(day) : g.meta.st;
    return { x, y, w, h: hh, etat, n: gifts.length };
  }, day);
}

/** Attend que la scène ait rendu `n` images (le tick Pixi applique le défilement à la caméra). */
export async function attendreImages(page, n = 3) {
  await page.evaluate((n) => new Promise((r) => {
    const app = globalThis.__qaApp; let k = 0;
    const f = () => { if (++k >= n) { app.ticker.remove(f); r(); } };
    app.ticker.add(f);
  }), n);
}

/** Défile pour que le cadeau `day` soit au centre de l'écran (via sa position dans la scène). */
export async function defilerVersCadeau(page, day) {
  for (let i = 0; i < 4; i++) {
    await attendreImages(page, 3);
    const p = await positionCadeau(page, day);
    const h = await page.evaluate(() => innerHeight);
    const delta = p.y - h * 0.5;
    if (Math.abs(delta) < 30) break;
    const avant = await page.evaluate(() => scrollY);
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: "instant" }), delta);
    if ((await page.evaluate(() => scrollY)) === avant) break; // bord de page atteint
  }
  await attendreImages(page, 3);
}

/**
 * Attend que la caméra horizontale (lissée image par image dans Scene.tick) soit immobile.
 * Indispensable sous SwiftShader où la scène ne tourne qu'à 1–3 images/s.
 */
export async function attendreCamera(page, max = 40) {
  await page.evaluate((max) => new Promise((r) => {
    const app = globalThis.__qaApp; const monde = app.stage.children[0];
    let prec = monde.x, k = 0, calme = 0;
    const f = () => {
      k++; calme = Math.abs(monde.x - prec) < 0.5 ? calme + 1 : 0; prec = monde.x;
      if (calme >= 2 || k >= max) { app.ticker.remove(f); r(); }
    };
    app.ticker.add(f);
  }), max);
}

/** Touche (mobile) ou clique (ordinateur) le paquet cadeau du jour donné, après l'avoir centré. */
export async function toucherCadeau(page, day, tactile = false) {
  await defilerVersCadeau(page, day);
  await attendreCamera(page);
  const p = await positionCadeau(page, day);
  if (!p) throw new Error(`cadeau ${day} introuvable dans la scène`);
  if (tactile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  return p;
}

/** Ouvre le calendrier en mode démo, session forcée (?moi=) et données remises à zéro. */
export async function ouvrirDemo(page, { jour, moi = "alexandre", reset = true } = {}) {
  const q = new URLSearchParams();
  if (jour !== undefined) q.set("jour", String(jour));
  q.set("moi", moi);
  let url = `${BASE}?${q}`;
  if (reset) url += "&demo-reset";
  await page.goto(url);
  await attendreScene(page);
  await page.waitForTimeout(1500); // défilement automatique vers la case du jour
}

/**
 * Amène la caméra à sa position finale sans attendre : SwiftShader ne fait qu'~1 image/s et la caméra
 * se lisse sur ~20 images. On coupe le rendu, on fait tourner le ticker par pas de 50 ms simulées, puis on rétablit.
 */
export async function avancerCamera(page, pas = 40) {
  await page.evaluate((pas) => {
    const app = globalThis.__qaApp; const r = app.renderer; const rendu = r.render;
    r.render = () => {};
    try { let t = app.ticker.lastTime; for (let i = 0; i < pas; i++) { t += 50; app.ticker.update(t); } }
    finally { r.render = rendu; }
  }, pas);
  await attendreImages(page, 2);
}

/** Coupe / rétablit le rendu Pixi : les clics et lectures du DOM deviennent instantanés (SwiftShader est lent). */
export async function renduActif(page, actif) {
  await page.evaluate((actif) => {
    const r = globalThis.__qaApp.renderer;
    if (!r.__rendu) r.__rendu = r.render;
    r.render = actif ? r.__rendu : () => {};
  }, actif);
}
