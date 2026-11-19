// npm run qa:captures — captures automatiques téléphone / ordinateur, jour / nuit, plusieurs jours et positions.
// Sortie : docs/qa/captures/<date>/ (PNG ignorés par git) + planches contact JPEG + index.json (console, zones).
// Options (variables d'environnement) : QA_JOURS="1,9,24"  QA_APPAREILS="mobile,ordinateur"  QA_SANS_BUILD=1
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as C from "./commun.mjs";

const JOURS = (process.env.QA_JOURS ?? "1,9,24").split(",").map(Number);
const APP = (process.env.QA_APPAREILS ?? "mobile,ordinateur").split(",");
const MODES = ["jour", "nuit"];
// un cadeau par monde (4 jours par monde) + le haut et le bas de la page
const POSITIONS = [
  { nom: "haut", top: 0 },
  ...[1, 5, 9, 13, 17, 21, 24].map((d) => ({ nom: `case${String(d).padStart(2, "0")}`, cadeau: d })),
  { nom: "bas", top: "max" },
];

const sortie = path.join(C.RACINE, "docs/qa/captures", C.dateDuJour());
mkdirSync(sortie, { recursive: true });

C.construire();
const srv = await C.servir();
const navigateur = await C.lancerChrome();
const index = [];
let n = 0;
const t0 = Date.now();

try {
  // écran de connexion (un par appareil et par mode)
  for (const app of APP) for (const mode of MODES) {
    const ctx = await navigateur.newContext({ ...C.APPAREILS[app], timezoneId: C.FUSEAU, locale: "fr-FR" });
    await C.preparerContexte(ctx, { heure: C.HEURES[mode] });
    const page = await ctx.newPage();
    const consoleMsgs = C.collecterConsole(page);
    await page.goto(`${C.BASE}?demo-reset`);
    await page.locator(".login-card").waitFor();
    await page.waitForTimeout(800);
    const fichier = `${app}-${mode}-connexion.png`;
    await page.screenshot({ path: path.join(sortie, fichier) });
    index.push({ appareil: app, mode, jour: 0, captures: [{ nom: "connexion", fichier }], console: consoleMsgs });
    n++;
    await ctx.close();
  }
  for (const app of APP) for (const mode of MODES) for (const jour of JOURS) {
    await srv.assurer();
    const ctx = await navigateur.newContext({ ...C.APPAREILS[app], timezoneId: C.FUSEAU, locale: "fr-FR" });
    await C.preparerContexte(ctx, { heure: C.HEURES[mode] });
    const page = await ctx.newPage();
    const consoleMsgs = C.collecterConsole(page);
    const entree = { appareil: app, mode, jour, captures: [], console: consoleMsgs };
    index.push(entree);
    const tDebut = Date.now();
    await page.goto(`${C.BASE}?jour=${jour}&moi=alexandre&demo-reset`);
    await C.attendreScene(page);
    entree.sceneMs = Date.now() - tDebut;
    await page.waitForTimeout(2500); // défilement automatique vers la case du jour (600 ms + animation)
    await C.attendreCamera(page);
    entree.modeAffiche = (await page.locator("button[title='Jour / nuit']").textContent())?.trim();
    const shoot = async (nom) => {
      const fichier = `${app}-${mode}-j${String(jour).padStart(2, "0")}-${nom}.png`;
      await page.screenshot({ path: path.join(sortie, fichier) });
      const info = await page.evaluate(() => ({ scrollY: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, zone: document.querySelector(".zone-pill")?.textContent }));
      entree.captures.push({ nom, fichier, ...info });
      n++;
    };
    await shoot("accueil");
    if (jour === 9) {
      // fenêtre de la case du jour, puis éditeur de case préparée
      await C.fermerPingou(page);
      await C.toucherCadeau(page, 9, app === "mobile");
      await page.locator(".sheet-panel").waitFor({ timeout: 180000 }).catch(() => {});
      await page.waitForTimeout(600);
      await shoot("fenetre-case");
      await page.keyboard.press("Escape");
      const crayon = page.locator("button[title^='Préparer la case']");
      if (await crayon.count()) { await crayon.click(); await page.waitForTimeout(800); await shoot("editeur"); await page.locator(".modal").click({ position: { x: 5, y: 5 } }).catch(() => {}); }
    }
    await C.fermerPingou(page);
    for (const pos of POSITIONS) {
      if (pos.cadeau) await C.defilerVersCadeau(page, pos.cadeau);
      else await page.evaluate((t) => window.scrollTo({ top: t === "max" ? document.documentElement.scrollHeight : t, behavior: "instant" }), pos.top);
      await C.attendreCamera(page); // la caméra horizontale suit avec un lissage
      await shoot(pos.nom);
    }
    await ctx.close();
    process.stdout.write(`  ${app} ${mode} jour ${jour} : ${entree.captures.length} captures, ${consoleMsgs.length} message(s) console\n`);
  }

  // planches contact (une par appareil et par mode), générées en HTML puis capturées
  const planches = [];
  for (const app of APP) for (const mode of MODES) {
    const lignes = index.filter((e) => e.appareil === app && e.mode === mode);
    const largeur = app === "mobile" ? 130 : 220;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{font:12px system-ui;margin:12px;background:#222;color:#eee}h1{font-size:16px;margin:4px 0 10px}
      .l{display:flex;gap:6px;margin-bottom:10px}.c{width:${largeur}px}.c img{width:100%;display:block;border:1px solid #555}
      .c span{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.t{width:60px;font-weight:bold}</style>
      <h1>${app} · ${mode} · ${C.dateDuJour()}</h1>
      ${lignes.map((e) => `<div class="l"><div class="t">?jour=${e.jour}<br>${e.console.filter((m) => m.type !== "warning").length} err.</div>${e.captures.map((c) => `<div class="c"><img src="${c.fichier}"><span>${c.nom} · ${c.zone ?? ""}</span></div>`).join("")}</div>`).join("")}`;
    const fHtml = path.join(sortie, `planche-${app}-${mode}.html`);
    writeFileSync(fHtml, html);
    const ctx = await navigateur.newContext({ viewport: { width: 80 + (largeur + 6) * (POSITIONS.length + 1), height: 400 } });
    const p = await ctx.newPage();
    await p.goto(`file://${fHtml}`);
    await p.waitForLoadState("load");
    const fJpg = `planche-${app}-${mode}.jpg`;
    await p.screenshot({ path: path.join(sortie, fJpg), fullPage: true, type: "jpeg", quality: 70 });
    planches.push(fJpg);
    await ctx.close();
  }

  writeFileSync(path.join(sortie, "index.json"), JSON.stringify({ date: new Date().toISOString(), heures: C.HEURES, index, planches }, null, 2));
  const erreurs = index.flatMap((e) => e.console.filter((m) => m.type !== "warning").map((m) => `${e.appareil}/${e.mode}/j${e.jour}: [${m.type}] ${m.texte}`));
  const avert = new Set(index.flatMap((e) => e.console.filter((m) => m.type === "warning").map((m) => m.texte.replace(/0x[0-9a-f]+/g, "…"))));
  console.log(`\n${n} captures en ${Math.round((Date.now() - t0) / 1000)} s → ${path.relative(C.RACINE, sortie)}/`);
  console.log(`Planches : ${planches.join(", ")}`);
  console.log(`Erreurs console : ${erreurs.length}`); erreurs.slice(0, 20).forEach((e) => console.log("  " + e));
  console.log(`Avertissements distincts : ${avert.size}`); [...avert].slice(0, 10).forEach((e) => console.log("  " + e));
  const malNuit = index.filter((e) => e.jour && (e.mode === "nuit") !== (e.modeAffiche === "🌙"));
  if (malNuit.length) console.log(`⚠ mode jour/nuit inattendu : ${malNuit.map((e) => `${e.appareil}/${e.mode}/j${e.jour}=${e.modeAffiche}`).join(", ")}`);
} finally {
  await navigateur.close();
  srv.stop();
}
