// npm run qa:perf — performance en téléphone simulé (390×844, DPR 2, CPU ralenti 4× via CDP).
// Mesure : poids du bundle, temps de chargement (avec et sans réseau 4G simulé), images/s au repos et
// pendant un défilement complet du haut en bas, coût d'une reconstruction de scène (bascule jour/nuit).
// Sortie : docs/qa/perf-<date>.json + résumé console.
// Attention : WebGL est rendu par SwiftShader (logiciel, sans GPU) ; les images/s absolues sont pessimistes
// par rapport à un vrai téléphone, mais les comparaisons entre versions restent valables.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import * as C from "./commun.mjs";

const CPU = Number(process.env.QA_CPU ?? 4);
const DUREE_DEFILEMENT = Number(process.env.QA_DUREE_DEFILEMENT ?? 12000);

C.construire();

// ---- poids du bundle ----
const dist = path.join(C.RACINE, "dist/assets");
const fichiers = readdirSync(dist).map((f) => {
  const buf = readFileSync(path.join(dist, f));
  return { fichier: f, ko: +(statSync(path.join(dist, f)).size / 1024).toFixed(1), koGzip: +(gzipSync(buf).length / 1024).toFixed(1) };
}).sort((a, b) => b.ko - a.ko);
const bundle = { fichiers, totalKo: +fichiers.reduce((s, f) => s + f.ko, 0).toFixed(1), totalGzipKo: +fichiers.reduce((s, f) => s + f.koGzip, 0).toFixed(1) };

const srv = await C.servir();
const navigateur = await C.lancerChrome();

async function nouvellePage({ cpu = CPU, reseau = false, mode = "jour" } = {}) {
  await srv.assurer();
  const ctx = await navigateur.newContext({ ...C.APPAREILS.mobile, timezoneId: C.FUSEAU });
  // pas d'horloge simulée ici : page.clock remplace aussi `performance`, ce qui fausse les mesures.
  // Le mode jour/nuit dépend donc de l'heure réelle (impact négligeable : seule la palette change).
  void mode;
  await C.preparerContexte(ctx, {});
  await ctx.addInitScript(() => {
    // compteur d'images (requestAnimationFrame) et tâches longues
    globalThis.__qaFrames = [];
    globalThis.__qaLong = [];
    const loop = (t) => { globalThis.__qaFrames.push(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) globalThis.__qaLong.push({ t: e.startTime, d: e.duration }); }).observe({ type: "longtask", buffered: true }); } catch { /* non supporté */ }
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  if (reseau) {
    await cdp.send("Network.enable");
    // profil « 4G lente » de Lighthouse : 150 ms RTT, 1,6 Mb/s descendant, 750 kb/s montant
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  }
  const msgs = C.collecterConsole(page);
  return { ctx, page, cdp, msgs };
}

function stats(frames) {
  const dts = [];
  for (let i = 1; i < frames.length; i++) dts.push(frames[i] - frames[i - 1]);
  if (!dts.length) return null;
  const tri = [...dts].sort((a, b) => a - b);
  const q = (p) => tri[Math.min(tri.length - 1, Math.floor(p * tri.length))];
  const total = frames[frames.length - 1] - frames[0];
  return {
    images: dts.length,
    ips: +(dts.length / (total / 1000)).toFixed(1),
    medianeMs: +q(0.5).toFixed(1),
    p95Ms: +q(0.95).toFixed(1),
    maxMs: +tri[tri.length - 1].toFixed(1),
    saccades50ms: dts.filter((d) => d > 50).length,
  };
}

async function mesurerChargement(opts) {
  const { ctx, page, msgs } = await nouvellePage(opts);
  await page.goto(`${C.BASE}?jour=9`, { timeout: 120000 });
  await C.attendreScene(page, 120000);
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const canvas = document.querySelector("canvas");
    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
      loadMs: Math.round(nav.loadEventEnd),
      premierAffichageMs: fcp ? Math.round(fcp.startTime) : null,
      sceneMs: Math.round(performance.now()), // instant où les 24 cadeaux existent (≈ prêt)
      canvas: canvas ? `${canvas.width}×${canvas.height}` : null,
      octetsTransferes: performance.getEntriesByType("resource").reduce((s, e) => s + (e.transferSize || 0), nav.transferSize || 0),
    };
  });
  await ctx.close();
  return { ...r, erreurs: msgs.filter((m) => m.type !== "warning").length };
}

const resultat = { date: new Date().toISOString(), cpu: CPU, appareil: "mobile 390×844 DPR 2", rendu: "SwiftShader (logiciel)", bundle };
try {
  console.log("› chargement (CPU ×%d)…", CPU);
  resultat.chargement = await mesurerChargement({});
  console.log("› chargement (CPU ×%d + 4G lente)…", CPU);
  resultat.chargement4G = await mesurerChargement({ reseau: true });

  for (const [nom, cpu] of [["cpu4", CPU], ["cpu1", 1]]) {
    console.log(`› images/s (CPU ×${cpu})…`);
    const { ctx, page } = await nouvellePage({ cpu });
    await page.goto(`${C.BASE}?jour=9`);
    await C.attendreScene(page, 120000);
    await page.waitForTimeout(3000);
    await C.fermerPingou(page);
    // repos : rien ne bouge côté utilisateur, mais la scène anime neige / nuages / cadeau
    await page.evaluate(() => { globalThis.__qaFrames.length = 0; });
    await page.waitForTimeout(4000);
    const repos = stats(await page.evaluate(() => globalThis.__qaFrames));
    // temps JS (thread principal) par image : du début du tick Pixi à la fin de app.render (priorité LOW),
    // indépendant de la vitesse de rastérisation SwiftShader → indicateur fiable du coût CPU sur téléphone.
    const jsParImage = await page.evaluate(() => new Promise((res) => {
      const app = globalThis.__qaApp; const js = []; let t0 = 0;
      const a = () => { t0 = performance.now(); }; const z = () => { js.push(performance.now() - t0); };
      app.ticker.add(a, null, 100); app.ticker.add(z, null, -100);
      setTimeout(() => { app.ticker.remove(a); app.ticker.remove(z); js.sort((x, y) => x - y);
        res({ images: js.length, moyenneMs: +(js.reduce((s, x) => s + x, 0) / js.length).toFixed(1), p95Ms: +js[Math.floor(js.length * 0.95)]?.toFixed(1) }); }, 5000);
    }));
    // défilement complet, haut → bas, piloté image par image (vitesse constante)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(1000);
    const def = await page.evaluate(async (duree) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      globalThis.__qaFrames.length = 0; globalThis.__qaLong.length = 0;
      const t0 = performance.now();
      await new Promise((res) => {
        const step = (t) => { const f = Math.min(1, (t - t0) / duree); window.scrollTo(0, f * max); if (f < 1) requestAnimationFrame(step); else res(); };
        requestAnimationFrame(step);
      });
      return { frames: [...globalThis.__qaFrames], long: [...globalThis.__qaLong], hauteur: max };
    }, DUREE_DEFILEMENT);
    const memoire = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
    // coût d'une reconstruction complète (Scene.build) : bascule jour/nuit
    await page.evaluate(() => { globalThis.__qaLong.length = 0; globalThis.__qaFrames.length = 0; });
    const tBascule = await page.evaluate(async () => {
      const t0 = performance.now();
      document.querySelector("button[title='Jour / nuit']").click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    });
    const longBascule = await page.evaluate(() => globalThis.__qaLong.map((l) => Math.round(l.d)));
    resultat[nom] = {
      repos,
      jsParImage,
      defilement: { ...stats(def.frames), dureeMs: DUREE_DEFILEMENT, hauteurPx: def.hauteur, tachesLongues: def.long.length, tachesLonguesMaxMs: Math.round(Math.max(0, ...def.long.map((l) => l.d))) },
      basculeNuitMs: Math.round(tBascule),
      basculeTachesLonguesMs: longBascule,
      tasJsMo: memoire,
    };
    await ctx.close();
  }
} finally {
  await navigateur.close();
  srv.stop();
}

const dir = path.join(C.RACINE, "docs/qa");
mkdirSync(dir, { recursive: true });
const f = path.join(dir, `perf-${C.dateDuJour()}.json`);
writeFileSync(f, JSON.stringify(resultat, null, 2));
const c = resultat.cpu4, c1 = resultat.cpu1;
console.log(`
Bundle            : ${bundle.totalKo} Ko (${bundle.totalGzipKo} Ko gzip) — plus gros : ${fichiers[0].fichier} ${fichiers[0].ko} Ko
Chargement CPU×${CPU} : 1er affichage ${resultat.chargement.premierAffichageMs} ms, scène prête ${resultat.chargement.sceneMs} ms
  + 4G lente      : 1er affichage ${resultat.chargement4G.premierAffichageMs} ms, scène prête ${resultat.chargement4G.sceneMs} ms
Repos     CPU×${CPU} : ${c.repos?.ips} img/s (p95 ${c.repos?.p95Ms} ms)   | CPU×1 : ${c1.repos?.ips} img/s
Défilement CPU×${CPU} : ${c.defilement.ips} img/s, p95 ${c.defilement.p95Ms} ms, max ${c.defilement.maxMs} ms, ${c.defilement.saccades50ms} saccades >50 ms
           CPU×1  : ${c1.defilement.ips} img/s, p95 ${c1.defilement.p95Ms} ms, ${c1.defilement.saccades50ms} saccades >50 ms
JS par image (tick + préparation du rendu) : ${c.jsParImage.moyenneMs} ms (CPU×${CPU}), ${c1.jsParImage.moyenneMs} ms (CPU×1) — budget 60 img/s = 16,7 ms
Bascule nuit (reconstruction) : ${c.basculeNuitMs} ms (CPU×${CPU}), ${c1.basculeNuitMs} ms (CPU×1)
→ ${path.relative(C.RACINE, f)}`);
