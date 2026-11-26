// Un parcours complet par jeu fini (jours 2, 3, 7, 9, 10, 11, 13, 15, 17, 21, 22 ; le quiz du jour 1 est dans calendrier.spec.ts) :
// ouvrir la case, jouer jusqu'à l'écran de fin, « Fermer », puis vérifier ce qui est enregistré dans la démo.
// Le jeu en direct à deux onglets reste en fixme tant que #56 (joinLive) n'est pas livré.
import { test, expect, type Page } from "@playwright/test";
// @ts-expect-error module JS sans types
import * as C from "../qa/commun.mjs";

type Msg = { type: string; texte: string };
let msgs: Msg[] = [];

test.beforeEach(async ({ context, page }, info) => {
  test.skip(info.project.name !== "mobile", "parcours joués une fois, en téléphone 390×844");
  await C.preparerContexte(context, { heure: C.HEURES.jour });
  msgs = C.collecterConsole(page);
});

const erreurs = (tolere?: RegExp) => msgs.filter((m) => m.type !== "warning" && !(tolere && tolere.test(m.texte)));
const fenetre = (page: Page) => page.locator(".sheet-panel");

async function ouvrirCase(page: Page, jour: number) {
  await C.fermerPingou(page);
  await C.toucherCadeau(page, jour, false);
  await expect(fenetre(page)).toBeVisible({ timeout: 180_000 });
  await expect(fenetre(page)).toContainText(`${jour} décembre`);
  await page.getByRole("button", { name: /C'est parti/ }).click();
}

/** La bulle de Pingou dans la fenêtre masque parfois les boutons (ticket #31). */
async function fermerBulle(page: Page) {
  for (let i = 0; i < 10 && (await page.locator(".mascot--inline").count()); i++) {
    await page.locator(".mascot--inline").click({ force: true });
    await page.waitForTimeout(100);
  }
}

/** Écran de règles du jeu : « C'est parti ! » (ou le bouton propre au jeu). */
async function passerRegles(page: Page, bouton = "C'est parti") {
  await fermerBulle(page);
  await page.locator(".jeu-btn", { hasText: bouton }).click();
  await fermerBulle(page);
}

/** « Fermer » → écran « case finie » → retour à la route, puis relit le stockage de la démo. */
async function terminerEtVerifier(page: Page, jour: number, { score = true, tolere }: { score?: boolean; tolere?: RegExp } = {}) {
  const fermer = page.locator(".jeu-btn", { hasText: "Fermer" });
  await expect(fermer).toBeVisible({ timeout: 300_000 });
  await fermerBulle(page);
  await fermer.click();
  await expect(page.locator(".sheet-fini")).toBeVisible();
  await page.getByRole("button", { name: "Retour à la route" }).click();
  await expect(fenetre(page)).toHaveCount(0);
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem("cc-demo:data-v2") ?? "null"));
  expect(d?.progress?.alexandre?.completed, "la case doit être marquée terminée").toContain(jour);
  if (score) expect(Object.keys(d.gameState ?? {}), "le score doit être enregistré").toContain(`${jour}:meilleur:alexandre`);
  expect(erreurs(tolere), JSON.stringify(erreurs(tolere), null, 1)).toEqual([]);
}

test("jour 2 : la luge se joue jusqu'à la fin (arrivée ou dernier choc)", async ({ page }) => {
  test.setTimeout(600_000);
  test.info().annotations.push({ type: "ticket", description: "#30 (exceptions Tone.js par intermittence)" });
  await C.ouvrirDemo(page, { jour: 2 });
  await ouvrirCase(page, 2);
  await passerRegles(page, "En luge");
  await expect(page.locator(".jeu-canvas canvas")).toBeVisible();
  // pas de pilotage : la luge file droit et finit par un choc ou l'arrivée
  await terminerEtVerifier(page, 2);
});

// PNG 8×8 rouge, pour « prendre » la photo du défi du jour 3 sans caméra
const PNG_ROUGE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMLQkAjVr/ARnBGkoAAAAASUVORK5CYII=", "base64");

test("jour 3 : le défi photo se joue jusqu'au bout (photo, légende, devinette)", async ({ page }) => {
  test.setTimeout(300_000);
  await C.ouvrirDemo(page, { jour: 3 });
  await ouvrirCase(page, 3);
  await fermerBulle(page);
  await page.getByRole("button", { name: /Prendre ma photo/ }).click();
  await page.locator("input[type=file]:not([capture])").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_ROUGE });
  await page.locator(".photo-champ input[type=text]").fill("Notre test");
  await page.locator(".photo-question").first().click();
  await page.locator(".photo-champ .quiz-option").first().click();
  await fermerBulle(page);
  await page.getByRole("button", { name: /^Envoyer à/ }).click();
  // démo : une photo d'exemple tient lieu de celle de Flavie
  await fermerBulle(page);
  await page.locator(".photo-dos").click();
  await page.locator(".quiz-options .quiz-option:enabled").first().click();
  await expect(page.locator(".photo-bilan")).toBeVisible({ timeout: 30_000 });
  await terminerEtVerifier(page, 3, { score: false });
});

test("jour 7 : le rébus se joue jusqu'au bout (on passe les 8 énigmes)", async ({ page }) => {
  test.setTimeout(300_000);
  await C.ouvrirDemo(page, { jour: 7 });
  await ouvrirCase(page, 7);
  await passerRegles(page);
  // une mauvaise réponse, une lettre demandée, puis on passe tout
  await page.getByLabel("Ta réponse").fill("zzz");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.locator(".rebus-retour")).toContainText("Pas tout à fait");
  await page.getByRole("button", { name: /Une lettre/ }).click();
  const fin = page.locator(".jeu-btn", { hasText: "Fermer" });
  for (let i = 0; i < 60 && !(await fin.isVisible()); i++) {
    const passer = page.locator(".jeu-actions .jeu-btn", { hasText: "Passer" });
    if (await passer.isEnabled().catch(() => false)) await passer.click().catch(() => {});
    await page.waitForTimeout(700);
  }
  await expect(page.locator(".jeu-panneau h2")).toContainText(/\d+ rébus sur 8/);
  await terminerEtVerifier(page, 7);
});

test("jour 9 : le dessin à deviner se joue jusqu'au bout (3 dessins envoyés, une devinette, galerie)", async ({ page }) => {
  test.setTimeout(600_000);
  await C.ouvrirDemo(page, { jour: 9 });
  await ouvrirCase(page, 9);
  await passerRegles(page, "Prendre mes crayons");
  for (let i = 1; i <= 3; i++) {
    // choix d'un thème encore libre
    await page.locator(".des-theme:not([disabled])").first().click();
    await expect(page.locator(".pic-toile")).toBeVisible();
    // un trait à la souris sur le tableau, puis « J'ai fini »
    const b = (await page.locator(".pic-toile").boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.6, { steps: 6 });
    await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.35, { steps: 6 });
    await page.mouse.up();
    await page.locator(".pic-fini").click();
    // légende : ce que l'autre doit trouver, puis envoi
    await page.getByLabel(/Ce que .* doit trouver/).fill(`réponse ${i}`);
    await page.getByRole("button", { name: /^Envoyer à/ }).click();
  }
  // galerie : en démo, les dessins de l'autre côté sont des exemples → on devine le premier (langue au chat)
  await expect(page.locator(".des-galerie")).toBeVisible();
  await expect(page.getByText("Mode démo : les dessins de")).toBeVisible();
  await page.getByRole("button", { name: /Deviner/ }).click();
  await expect(page.locator(".pic-toile")).toBeVisible();
  await page.getByRole("button", { name: /Langue au chat/ }).click();
  await expect(page.locator(".des-revele")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator(".des-galerie")).toBeVisible();
  await terminerEtVerifier(page, 9, { score: false });
  // les 3 dessins sont bien enregistrés
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem("cc-demo:data-v2") ?? "null"));
  const cles = Object.keys(d?.gameState ?? {}).filter((k) => k.startsWith("9:") && k.includes("alexandre"));
  expect(cles.length, `clés du jeu 9 : ${cles}`).toBeGreaterThanOrEqual(3);
});

test("jour 10 : les flocons se jouent jusqu'au bout (sans bouger : les glaçons ou le temps mettent fin à la partie)", async ({ page }) => {
  test.setTimeout(900_000);
  await C.ouvrirDemo(page, { jour: 10 });
  await ouvrirCase(page, 10);
  await passerRegles(page, "C'est parti");
  await expect(page.locator(".jeu-canvas canvas")).toBeVisible();
  // #109 : malgré la correction #112, l'erreur « reading 'clear' » arrive toujours en fin de partie (constaté le 26 nov) :
  // seule cette erreur est tolérée, retirer `tolere` quand elle ne sort plus.
  test.info().annotations.push({ type: "bug", description: "#109 : exception Pixi à la fin du jeu 10" });
  await terminerEtVerifier(page, 10, { tolere: /reading 'clear'[\s\S]*RenderTargetSystem/ });
});

test("jour 11 : Synchro se joue en solo jusqu'au bout (Flavie absente)", async ({ page }) => {
  test.setTimeout(300_000);
  await C.ouvrirDemo(page, { jour: 11 });
  await ouvrirCase(page, 11);
  await passerRegles(page);
  await expect(page.getByText("J'appelle Flavie")).toBeVisible();
  await page.getByRole("button", { name: "Jouer quand même" }).click({ timeout: 40_000 }); // attente solo : 20 s
  const fin = page.locator(".jeu-btn", { hasText: "Fermer" });
  for (let i = 0; i < 40 && !(await fin.isVisible()); i++) {
    const opt = page.locator(".quiz-options button:enabled").first();
    if (await opt.isVisible().catch(() => false)) { await opt.click(); continue; }
    const suite = page.getByRole("button", { name: /Question suivante|Voir le résultat/ });
    if (await suite.isVisible().catch(() => false)) await suite.click();
    await page.waitForTimeout(300);
  }
  await terminerEtVerifier(page, 11, { score: false }); // Synchro n'a pas de « meilleur score »
});

test("jour 13 : le bonhomme de neige se fait en solo jusqu'au bout (boule roulée, décor, souvenir)", async ({ page }) => {
  test.setTimeout(600_000);
  await C.ouvrirDemo(page, { jour: 13 });
  await ouvrirCase(page, 13);
  await passerRegles(page);
  await expect(page.getByText("J'appelle Flavie")).toBeVisible();
  await page.getByRole("button", { name: "Jouer quand même" }).click({ timeout: 40_000 }); // attente solo : 20 s
  // on laisse le compte à rebours finir, puis on valide la boule telle quelle (« C'est bon ! »)
  const cestBon = page.getByRole("button", { name: "C'est bon !" });
  // l'horloge de la page est figée (Date.now constant) : le compte à rebours du jeu ne bouge pas tout seul, on la fait avancer
  let t = new Date(C.HEURES.jour).getTime();
  for (let i = 0; i < 60 && !(await cestBon.isVisible()); i++) { t += 1000; await page.clock.setFixedTime(new Date(t)); await page.waitForTimeout(1000); }
  await expect(cestBon).toBeVisible({ timeout: 10_000 });
  await cestBon.click();
  await page.getByRole("button", { name: "J'ai fini" }).click({ timeout: 120_000 });
  await expect(page.locator(".bh-fin")).toBeVisible({ timeout: 60_000 });
  await terminerEtVerifier(page, 13, { score: false }); // le bonhomme n'a pas de « meilleur score » : son journal est enregistré (`13:journal`)
});

test("jour 15 : le pendu se joue jusqu'au bout (on tape les lettres dans l'ordre)", async ({ page }) => {
  test.setTimeout(300_000);
  await C.ouvrirDemo(page, { jour: 15 });
  await ouvrirCase(page, 15);
  await passerRegles(page);
  const fin = page.locator(".jeu-btn", { hasText: "Fermer" });
  for (let i = 0; i < 400 && !(await fin.isVisible()); i++) {
    const touche = page.locator(".pendu-touche:enabled").first();
    if (await touche.isVisible().catch(() => false)) await touche.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
  await expect(page.locator(".jeu-panneau h2")).toContainText(/mots? sur \d+/);
  await terminerEtVerifier(page, 15);
});

test("jour 17 : les mots croisés se jouent jusqu'au bout (lettres révélées, vérifier, j'arrête)", async ({ page }) => {
  test.setTimeout(300_000);
  await C.ouvrirDemo(page, { jour: 17 });
  await ouvrirCase(page, 17);
  await passerRegles(page);
  await expect(page.locator(".mc-grille")).toBeVisible();
  await page.locator(".mc-grille button").first().click();
  await page.getByRole("button", { name: /Une lettre/ }).click();
  await page.locator(".pendu-touche", { hasText: /^A$/ }).click();
  await page.getByRole("button", { name: "Vérifier" }).click();
  await page.getByRole("button", { name: "J'arrête" }).click();
  await expect(page.locator(".jeu-panneau h2")).toBeVisible();
  await terminerEtVerifier(page, 17);
});

test.fixme("jeu en direct à deux onglets (?moi=alexandre / ?moi=flavie)", async () => {
  // À FAIRE quand #56 (jeux en direct via joinLive) est livré : deux pages du même contexte, jour 11,
  // une réponse d'un côté visible de l'autre (« Flavie est là », cartes retournées ensemble).
});

test("jour 21 : le sapin se décore en solo (6 décos posées, l'étoile attend l'autre, le sapin est enregistré)", async ({ page }) => {
  test.setTimeout(300_000);
  // Le direct à deux (tenir l'étoile en même temps) n'est pas atteignable en démo : on joue « chacun son tour ».
  // La case n'est marquée terminée qu'une fois l'étoile posée à deux : ici elle reste ouverte mais non terminée.
  await C.ouvrirDemo(page, { jour: 21 });
  await ouvrirCase(page, 21);
  await passerRegles(page, "Décorer !");
  const zone = page.locator(".sapin-canvas");
  await expect(zone.locator("canvas")).toBeVisible({ timeout: 60_000 });
  const b = (await zone.boundingBox())!;
  for (let i = 0; i < 6; i++) {
    await page.locator('[role=radiogroup][aria-label="Déco"] button').nth(i % 2 ? 3 : 0).click();
    await page.mouse.click(b.x + b.width * (0.42 + 0.03 * i), b.y + b.height * (0.55 + 0.02 * i));
    await page.waitForTimeout(400);
  }
  await expect(page.getByText(/⭐ 6\/6/)).toBeVisible({ timeout: 30_000 });
  // l'étoile n'arrive que quand l'autre a posé ses 6 décos aussi : en solo, la puce reste à « 0/6 » pour Flavie
  await expect(page.getByText(/⭐ 6\/6 · 0\/6/)).toBeVisible();
  await expect(page.getByText("Tenez l'étoile à deux !")).toHaveCount(0);
  // fermer par la croix de la case
  await page.getByRole("button", { name: "Fermer la case" }).click();
  await expect(fenetre(page)).toHaveCount(0);
  // le sapin posé est enregistré dans le journal de la démo (il sera retrouvé à la réouverture, et sur la carte)
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem("cc-demo:data-v2") ?? "null"));
  const cles = Object.keys(d?.gameState ?? {}).filter((k) => k.startsWith("21:"));
  expect(cles.length, `clés du jeu 21 : ${Object.keys(d?.gameState ?? {})}`).toBeGreaterThan(0);
  // même erreur Pixi que #109, à la fermeture du sapin (constaté le 26 nov) : seule celle-ci est tolérée
  test.info().annotations.push({ type: "bug", description: "#109 : exception Pixi à la fermeture du jeu 21" });
  const tolere = /reading 'clear'[\s\S]*RenderTargetSystem/;
  expect(erreurs(tolere), JSON.stringify(erreurs(tolere), null, 1)).toEqual([]);
});

test("jour 22 : le tri des cadeaux se joue jusqu'au bout (sans trier : les vies ou le temps mettent fin à la partie)", async ({ page }) => {
  test.setTimeout(900_000);
  await C.ouvrirDemo(page, { jour: 22 });
  await ouvrirCase(page, 22);
  await passerRegles(page);
  await expect(page.locator(".jeu-canvas canvas")).toBeVisible();
  await terminerEtVerifier(page, 22);
});
