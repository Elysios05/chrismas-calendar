// Parcours de base du calendrier — npm run qa:e2e
// Les cadeaux sont dessinés dans le canvas PixiJS : on les vise grâce au crochet des outils de dév PixiJS
// (__PIXI_APP_INIT__, voir tests/qa/commun.mjs), sans rien modifier dans le code de l'application.
import { test, expect, type Page } from "@playwright/test";
// @ts-expect-error module JS sans types
import * as C from "../qa/commun.mjs";

type Msg = { type: string; texte: string };
let msgs: Msg[] = [];

test.beforeEach(async ({ context, page }, info) => {
  const nuit = info.title.includes("nuit");
  await C.preparerContexte(context, { heure: nuit ? C.HEURES.nuit : C.HEURES.jour });
  msgs = C.collecterConsole(page);
});

const erreurs = () => msgs.filter((m) => m.type !== "warning");

async function ouvrir(page: Page, jour: number) {
  await page.goto(`./?jour=${jour}`);
  await C.attendreScene(page);
  await page.waitForTimeout(2000); // défilement automatique vers la case du jour
}

/** Clique (ou tape, sur mobile) au centre du paquet cadeau du jour donné. */
async function viserCadeau(page: Page, jour: number, isMobile: boolean) {
  await C.defilerVersCadeau(page, jour);
  await C.attendreCamera(page);
  const p = await C.positionCadeau(page, jour);
  expect(p, `cadeau ${jour} introuvable dans la scène`).not.toBeNull();
  if (isMobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  return p;
}

/** Proportion de pixels non uniformes dans la zone du canvas (détecte un canvas vide / noir). */
async function diversiteCanvas(page: Page) {
  const png = (await page.locator("canvas").screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    const couleurs = new Set<number>();
    for (let i = 0; i < d.length; i += 4) couleurs.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
    return couleurs.size;
  }, png);
}

test("chargement sans erreur et canvas dessiné", async ({ page }) => {
  await ouvrir(page, 9);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await diversiteCanvas(page), "le canvas semble vide (trop peu de couleurs)").toBeGreaterThan(20);
  await expect(page.locator(".zone-pill")).not.toBeEmpty();
  await expect(page.locator(".mascot")).toContainText("Pingou");
  expect(erreurs(), JSON.stringify(erreurs(), null, 1)).toEqual([]);
});

test("mode jour à midi", async ({ page }) => {
  await ouvrir(page, 9);
  await expect(page.locator("button[title='Jour / nuit']")).toHaveText("☀️");
});

test("mode nuit à 21 h", async ({ page }) => {
  await ouvrir(page, 9);
  await expect(page.locator("button[title='Jour / nuit']")).toHaveText("🌙");
});

test("case du jour : la fenêtre s'ouvre puis se ferme", async ({ page, isMobile }) => {
  await ouvrir(page, 9);
  await C.fermerPingou(page);
  const p = await viserCadeau(page, 9, isMobile);
  expect(p.etat).toBe("available");
  const modal = page.locator(".modal .card");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("9 décembre");
  await page.getByRole("button", { name: "Plus tard" }).click();
  await expect(page.locator(".modal")).toHaveCount(0);
  // fermeture en touchant le fond
  await viserCadeau(page, 9, isMobile);
  await expect(modal).toBeVisible();
  await page.locator(".modal").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".modal")).toHaveCount(0);
  expect(erreurs()).toEqual([]);
});

test("ouvrir la case du jour : le personnage avance et Pingou félicite", async ({ page, isMobile }) => {
  await ouvrir(page, 9);
  await C.fermerPingou(page);
  await viserCadeau(page, 9, isMobile);
  await page.getByRole("button", { name: "Ouvrir la case" }).click();
  await expect(page.locator(".mascot")).toContainText("Case 9 ouverte", { timeout: 180_000 });
  const ouverts = await page.evaluate(() => JSON.parse(localStorage.getItem("opened") ?? "{}"));
  expect(ouverts.alexandre).toContain(9);
  await expect.poll(async () => (await C.positionCadeau(page, 9)).etat).toBe("opened");
});

test("case future verrouillée : Pingou parle, pas de fenêtre", async ({ page, isMobile }) => {
  await ouvrir(page, 9);
  await C.fermerPingou(page);
  const p = await viserCadeau(page, 12, isMobile);
  expect(p.etat).toBe("locked");
  await expect(page.locator(".mascot")).toContainText("case 12");
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("le bouton 📍 ramène à la case du jour", async ({ page }) => {
  await ouvrir(page, 9);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
  await page.locator("button[title=\"Aller à aujourd'hui\"]").click();
  await page.waitForTimeout(2000);
  await C.attendreImages(page, 3);
  const p = await C.positionCadeau(page, 9);
  const h = await page.evaluate(() => innerHeight);
  expect(p.y).toBeGreaterThan(h * 0.2);
  expect(p.y).toBeLessThan(h * 0.85);
});

// BUG CONNU (rapport QA 2026-11-17, B1) : l'état initial « opened » d'App.tsx contient déjà les cases 1 à 6
// (Alexandre) et 1 à 7 (Flavie). Sur un appareil neuf le 1er décembre, la case 1 apparaît déjà ouverte et les
// personnages sont placés aux cases 6/7, devant des cases verrouillées. test.fail : passera au rouge
// (« unexpectedly passed ») le jour où c'est corrigé, il suffira alors d'enlever test.fail.
test.describe("1er décembre, appareil neuf", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("aucune case n'est déjà ouverte", async ({ page, context }) => {
    test.fail(true, "B1 : état de démo codé en dur dans App.tsx");
    await context.clock.setFixedTime(new Date("2026-12-01T10:00:00"));
    await page.goto("./");
    await C.attendreScene(page);
    expect((await C.positionCadeau(page, 1)).etat).toBe("available");
  });
});
