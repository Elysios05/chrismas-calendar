// Audit d'accessibilité (axe-core, WCAG 2.1 A + AA) sur la vraie application en mode démo — ticket #34.
// Repris du script de l'équipe Interface (PR #33), mais sur l'appli réelle plutôt que sur maquettes.html.
// En plus d'axe : focus piégé dans la fenêtre d'une case, interrupteur des réglages au clavier.
import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
// @ts-expect-error module JS sans types
import * as C from "../qa/commun.mjs";

const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
type Violation = { id: string; impact: string | null; n: number; ex?: string };

test.beforeEach(async ({ context }, info) => {
  test.skip(info.project.name !== "mobile", "audit fait une fois, en téléphone 390×844");
  await C.preparerContexte(context, { heure: C.HEURES.jour });
});

/** Coupe les animations (réglage du site) puis lance axe sur la page ; le canvas Pixi est exclu. */
async function auditer(page: Page): Promise<Violation[]> {
  await page.evaluate(() => { document.documentElement.dataset.animations = "non"; });
  await page.waitForTimeout(800); // laisse finir les transitions (faux positif de contraste vu par l'Interface)
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    // @ts-expect-error axe injecté
    const res = await window.axe.run({ exclude: [["canvas"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    return res.violations.map((v: { id: string; impact: string | null; nodes: { html: string }[] }) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0]?.html?.slice(0, 120) }));
  });
}

const resume = (v: Violation[]) => v.map((x) => `[${x.impact}] ${x.id} ×${x.n}  ${x.ex}`).join("\n");

async function ouvrirCaseSouris(page: Page, jour: number) {
  await C.fermerPingou(page);
  await C.toucherCadeau(page, jour, false);
  await expect(page.locator(".sheet-panel")).toBeVisible({ timeout: 180_000 });
}

test("axe : écran de connexion", async ({ page }) => {
  await page.goto("./?jour=9&demo-reset");
  await page.getByRole("button", { name: "Alexandre" }).click();
  const v = await auditer(page);
  expect(v, resume(v)).toEqual([]);
});

test("axe : carte (en-tête, Pingou, rappel)", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 15 }); // ?jour=15 : le bandeau de rappel est affiché
  const v = await auditer(page);
  expect(v, resume(v)).toEqual([]);
});

test("axe : fenêtre d'une case + focus piégé", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await ouvrirCaseSouris(page, 9);
  const v = await auditer(page);
  expect.soft(v, resume(v)).toEqual([]);
  let dedans = true;
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    dedans = dedans && await page.evaluate(() => !!document.activeElement?.closest(".sheet-panel"));
  }
  expect(dedans, "le focus sort de la fenêtre modale").toBe(true);
});

test("axe : lettre d'une case préparée", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 8 });
  await ouvrirCaseSouris(page, 8);
  await page.getByRole("button", { name: "Ouvrir l'enveloppe" }).click();
  await page.locator(".prep-enveloppe").click();
  await expect(page.locator(".prep-lettre")).toBeVisible();
  await page.waitForTimeout(1500); // chute des polaroïds
  const v = await auditer(page);
  expect(v, resume(v)).toEqual([]);
});

test("axe : éditeur de case préparée", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await C.fermerPingou(page);
  await page.locator("button[title^='Préparer la case']").click();
  await expect(page.locator(".edit")).toBeVisible();
  await page.waitForTimeout(1200);
  const v = await auditer(page);
  expect(v, resume(v)).toEqual([]);
});

test("axe : réglages", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await C.fermerPingou(page);
  await page.getByRole("button", { name: "Réglages" }).click();
  await expect(page.locator("#reg-son")).toBeVisible();
  const v = await auditer(page);
  expect(v, resume(v)).toEqual([]);
});
