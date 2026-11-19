// npm run capture -- [options]   Photo(s) rapide(s) de l'appli, utilisable par toute équipe sans lire le code.
//   --jour=N            jour simulé 1-24 (défaut 1)         --heure=HH:MM  heure simulée (défaut 12:00 ; 21:00 = nuit)
//   --case=N            ouvre la fenêtre de la case N       --joueur=alexandre|flavie (défaut alexandre)
//   --appareils=mobile,ordinateur (défaut les deux)         --attente=ms  délai avant la photo (défaut 1500)
//   --sortie=dossier    défaut /tmp/captures                --sans-build  n'automatise pas le build (échoue si dist/ absent)
// Connexion démo passée, carte vérifiée, bulle de Pingou fermée, caméra sur la case du jour, puis photo.
// Sans --sans-build : construit seulement si dist/ est absent ou plus ancien que src/.
// Détails et exemples : docs/qa/capture.md
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import * as C from "./commun.mjs";

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const connues = ["jour", "heure", "case", "joueur", "appareils", "attente", "sortie", "sans-build"];
const inconnues = Object.keys(opt).filter((k) => !connues.includes(k));
if (inconnues.length) { console.error(`Option inconnue : --${inconnues.join(", --")}. Options : ${connues.map((k) => "--" + k).join(" ")}`); process.exit(2); }

const jour = Number(opt.jour ?? 1);
const heure = String(opt.heure ?? "12:00");
const caseN = opt.case !== undefined ? Number(opt.case) : null;
const joueur = String(opt.joueur ?? "alexandre");
const appareils = String(opt.appareils ?? "mobile,ordinateur").split(",").map((s) => s.trim());
const attente = Number(opt.attente ?? 1500);
const sortie = path.resolve(String(opt.sortie ?? "/tmp/captures"));
const sansBuild = opt["sans-build"] === true;
const hm = heure.match(/^(\d{1,2}):(\d{2})$/);
if (!(jour >= 1 && jour <= 24) || (caseN !== null && !(caseN >= 1 && caseN <= 24))) { console.error("--jour et --case : nombre de 1 à 24."); process.exit(2); }
if (!hm) { console.error("--heure : format HH:MM (ex. 21:00)."); process.exit(2); }
if (!["alexandre", "flavie"].includes(joueur)) { console.error("--joueur : alexandre ou flavie."); process.exit(2); }
for (const a of appareils) if (!C.APPAREILS[a]) { console.error(`--appareils : mobile ou ordinateur (reçu « ${a} »).`); process.exit(2); }

const t0 = Date.now();
if (sansBuild) {
  if (!existsSync(path.join(C.RACINE, "dist/index.html"))) { console.error("--sans-build mais dist/ n'existe pas : lance d'abord `npm run build`."); process.exit(1); }
} else if (C.buildRecent()) console.log("› build récent, on le réutilise");
else C.construire();

mkdirSync(sortie, { recursive: true });
const srv = await C.servir();
const navigateur = await C.lancerChrome();
const fichiers = [], erreurs = [];
let echec = null;
try {
  // heure locale de Paris simulée
  const date = `2026-11-30T${hm[1].padStart(2, "0")}:${hm[2]}:00+01:00`; // novembre = heure d hiver (UTC+1)
  for (const app of appareils) {
    const ctx = await navigateur.newContext({ ...C.APPAREILS[app], timezoneId: C.FUSEAU, locale: "fr-FR" });
    await C.preparerContexte(ctx, { heure: date });
    const page = await ctx.newPage();
    const msgs = C.collecterConsole(page);
    try {
      await C.ouvrirDemo(page, { jour, moi: joueur }); // connexion démo + carte vérifiée (échoue clairement sinon)
      await C.fermerPingou(page);
      const cible = caseN ?? jour;
      await page.evaluate((j) => window.scrollTo({ top: globalThis.__calendrier?.scrollForDay(j) ?? scrollY, behavior: "instant" }), cible);
      await C.attendreImages(page, 2);
      await C.avancerCamera(page); // la caméra se lisse sur ~20 images : on la fait arriver tout de suite
      if (caseN !== null) {
        const p = await C.positionCadeau(page, caseN); // déjà centrée et caméra arrivée : on touche directement
        if (!p) throw new Error(`cadeau ${caseN} introuvable dans la scène`);
        if (app === "mobile") await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
        await C.renduActif(page, false); // sans rendu, l'animation d'ouverture ne traîne plus (SwiftShader)
        await page.locator(".sheet-panel").first().waitFor({ timeout: 90000 })
          .catch(() => { throw new Error(`la fenêtre de la case ${caseN} ne s'est pas ouverte (case verrouillée ? jour=${jour})`); });
        await C.renduActif(page, true);
        await C.attendreImages(page, 3);
      }
      await page.waitForTimeout(attente);
      await C.fermerPingou(page); // il peut reparler après le défilement
      if (await page.locator(".mascot").count()) throw new Error("la bulle de Pingou n'a pas pu être fermée");
      await C.renduActif(page, false); // image figée : la photo ne dépend plus du rendu lent de SwiftShader
      const nom = `${app}-j${String(jour).padStart(2, "0")}-${hm[1].padStart(2, "0")}h${hm[2]}${caseN !== null ? `-case${caseN}` : ""}-${joueur}.png`;
      const f = path.join(sortie, nom);
      await page.screenshot({ path: f });
      fichiers.push(f);
    } catch (e) { echec = echec ?? e; console.error(`✗ ${app} : ${e.message}`); }
    erreurs.push(...msgs.filter((m) => m.type !== "warning").map((m) => `${app} [${m.type}] ${m.texte.split("\n")[0]}`));
    await ctx.close();
  }
} finally { await navigateur.close(); srv.stop(); }

console.log(`\n${fichiers.length} image(s) en ${Math.round((Date.now() - t0) / 1000)} s :`);
fichiers.forEach((f) => console.log("  " + f));
console.log(`Erreurs console : ${erreurs.length}`); erreurs.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(echec ? 1 : 0);
