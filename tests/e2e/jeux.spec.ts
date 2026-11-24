// Un parcours complet par jeu fini (jours 2, 7, 11, 15, 17 ; le quiz du jour 1 est dans calendrier.spec.ts) :
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

const erreurs = () => msgs.filter((m) => m.type !== "warning");
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
async function terminerEtVerifier(page: Page, jour: number, { score = true }: { score?: boolean } = {}) {
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
  expect(erreurs(), JSON.stringify(erreurs(), null, 1)).toEqual([]);
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
  for (let i = 0; i < 12 && !(await fin.isVisible()); i++) {
    const passer = page.getByRole("button", { name: "Passer" });
    if (await passer.isEnabled().catch(() => false)) await passer.click().catch(() => {});
    await page.waitForTimeout(700);
  }
  await expect(page.locator(".jeu-panneau h2")).toContainText(/\d+ rébus sur 8/);
  await terminerEtVerifier(page, 7);
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
