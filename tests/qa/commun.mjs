// Outils partagés par les scripts Qualité : build, serveur de prévisualisation, navigateur, crochets de test.
// Aucun code de l'application n'est modifié : on s'appuie sur le crochet officiel des outils de dév PixiJS
// (globalThis.__PIXI_APP_INIT__) pour récupérer l'Application et viser les cadeaux dessinés dans le canvas.
import { spawn, execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PORT = Number(process.env.QA_PORT ?? 4180);
export const BASE = `http://localhost:${PORT}/`;
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

async function repond() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/`); return r.ok; } catch { return false; }
}
function demarrer() {
  const proc = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: RACINE, stdio: "ignore", detached: true });
  proc.unref();
  return proc;
}
/**
 * Lance `vite preview` sur le port Qualité et attend qu'il réponde.
 * `assurer()` le relance s'il est tombé en cours de route (vu une fois pendant une longue série de captures).
 */
export async function servir() {
  if (await repond()) { console.log(`› serveur déjà présent sur ${BASE}`); return { stop() {}, assurer: async () => {} }; }
  let proc = demarrer();
  const attendre = async () => { for (let i = 0; i < 100 && !(await repond()); i++) await new Promise((r) => setTimeout(r, 200)); };
  await attendre();
  console.log(`› vite preview sur ${BASE}`);
  return {
    async assurer() { if (!(await repond())) { console.log("› serveur tombé : relance"); proc = demarrer(); await attendre(); } },
    stop() { try { process.kill(-proc.pid); } catch { /* déjà arrêté */ } },
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

/** Attend que la scène Pixi soit construite (cadeaux présents) et que la police soit prête. */
export async function attendreScene(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const app = globalThis.__qaApp;
    if (!app?.stage) return false;
    let n = 0;
    const visit = (c) => { if (c.meta && c.eventMode === "static") n++; for (const k of c.children ?? []) visit(k); };
    visit(app.stage);
    return n >= 24;
  }, null, { timeout });
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
    const app = globalThis.__qaApp;
    const gifts = [];
    const visit = (c) => { if (c.meta && c.eventMode === "static") gifts.push(c); for (const k of c.children ?? []) visit(k); };
    visit(app.stage);
    // le numéro du jour est le seul Text du cadeau (pastille) ; l'ordre des enfants est trié par profondeur
    const jourDe = (c) => { let t = null; const v = (k) => { if (t === null && typeof k.text === "string") t = k.text; for (const e of k.children ?? []) v(e); }; v(c); return Number(t); };
    const g = gifts.find((c) => jourDe(c) === day);
    if (!g) return null;
    const b = g.meta.inner.children[0].getBounds(); // corps du paquet (hors pastille)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, etat: g.meta.st, n: gifts.length };
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
