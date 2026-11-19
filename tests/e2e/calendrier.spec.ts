// Parcours réel du calendrier en mode démo — npm run qa:e2e
// Connexion → monde → cases (quiz, luge, case préparée) → éditeur et rappel → deux onglets.
// Les cadeaux sont dessinés dans le canvas PixiJS : on les vise grâce au crochet des outils de dév PixiJS
// (__PIXI_APP_INIT__, voir tests/qa/commun.mjs), sans rien modifier dans le code de l'application.
// Mode démo : ?jour=N simule le jour, ?moi=… choisit le joueur de l'onglet, ?demo-reset repart des données d'exemple.
import { test, expect, type Page } from "@playwright/test";
// @ts-expect-error module JS sans types
import * as C from "../qa/commun.mjs";

type Msg = { type: string; texte: string };
let msgs: Msg[] = [];

test.beforeEach(async ({ context, page }) => {
  await C.preparerContexte(context, { heure: C.HEURES.jour }); // midi ; un test peut changer l'heure lui-même
  msgs = C.collecterConsole(page);
});

const erreurs = () => msgs.filter((m) => m.type !== "warning");
const fenetre = (page: Page) => page.locator(".sheet-panel");

/** Proportion de couleurs distinctes dans une zone (détecte un canvas vide / noir). */
async function diversite(page: Page, selecteur = "canvas") {
  const png = (await page.locator(selecteur).first().screenshot()).toString("base64");
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

/** Ouvre la fenêtre de la case `jour` en touchant son cadeau. */
// Clic souris même en profil téléphone : le toucher ouvre puis referme la fenêtre (ticket #28, testé à part).
async function ouvrirCase(page: Page, jour: number, _isMobile?: boolean) {
  await C.fermerPingou(page);
  await C.toucherCadeau(page, jour, false);
  await expect(fenetre(page)).toBeVisible();
  await expect(fenetre(page)).toContainText(`${jour} décembre`);
}

/** Ferme la bulle de Pingou dans la fenêtre si elle masque les boutons du jeu (ticket #31). */
async function fermerBulleInline(page: Page) {
  for (let i = 0; i < 10 && (await page.locator(".mascot--inline").count()); i++) {
    await page.locator(".mascot--inline").click({ force: true });
    await page.waitForTimeout(100);
  }
}

/** Passe l'intro (« C'est parti ») ou, si la case est déjà terminée, « Revoir la case ». */
async function lancerCase(page: Page) {
  const revoir = page.getByRole("button", { name: "Revoir la case" });
  const parti = page.getByRole("button", { name: /C'est parti|Ouvrir l'enveloppe/ });
  await expect(revoir.or(parti)).toBeVisible();
  if (await revoir.isVisible()) await revoir.click(); else await parti.click();
}

/* ------------------------------------------------------------------ */

test("connexion démo : choisir Alexandre, mot de passe quelconque", async ({ page }) => {
  await page.goto("./?jour=9&demo-reset");
  await expect(page.locator(".login-card")).toBeVisible();
  await page.getByRole("button", { name: "Alexandre" }).click();
  await page.locator("#mdp").fill("nimportequoi");
  await page.getByRole("button", { name: "Entrer" }).click();
  await C.attendreScene(page);
  await expect(page.locator(".who-badge")).toHaveText("Alexandre");
  await expect(page.locator(".brand-kicker")).toContainText("démo");
  expect(await diversite(page), "le canvas semble vide").toBeGreaterThan(20);
  expect(erreurs(), JSON.stringify(erreurs(), null, 1)).toEqual([]);
  // déconnexion (dans les réglages) → retour à l'écran de connexion
  await page.getByRole("button", { name: "Réglages" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.locator(".login-card")).toBeVisible();
});

test("« Voir la démo sans compte » entre directement", async ({ page }) => {
  await page.goto("./?jour=9&demo-reset");
  await page.getByRole("button", { name: "Voir la démo sans compte" }).click();
  await C.attendreScene(page);
  await expect(page.locator(".who-badge")).toBeVisible();
});

test("mode jour à midi, mode nuit à 21 h", async ({ page, context }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await expect(page.locator("button[title='Jour / nuit']")).toHaveText("☀️");
  await context.clock.setFixedTime(new Date(C.HEURES.nuit));
  await page.reload();
  await C.attendreScene(page);
  await expect(page.locator("button[title='Jour / nuit']")).toHaveText("🌙");
});

test("case du jour : la fenêtre s'ouvre, se ferme par ✕ et par Échap", async ({ page, isMobile }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await ouvrirCase(page, 9, isMobile);
  await page.getByRole("button", { name: "Fermer la case" }).click();
  await expect(fenetre(page)).toHaveCount(0);
  await ouvrirCase(page, 9, isMobile);
  await page.keyboard.press("Escape");
  await expect(fenetre(page)).toHaveCount(0);
  expect(erreurs()).toEqual([]);
});

test("téléphone : toucher le cadeau du jour ouvre la fenêtre", async ({ page, isMobile }) => {
  test.skip(!isMobile, "propre au tactile");
  test.fail(true, "#28 : clic fantôme, la fenêtre se referme aussitôt");
  await C.ouvrirDemo(page, { jour: 9 });
  await C.fermerPingou(page);
  await C.toucherCadeau(page, 9, true);
  await page.waitForTimeout(1500);
  await expect(fenetre(page)).toBeVisible({ timeout: 2000 });
});

test("case future verrouillée : Pingou parle, pas de fenêtre", async ({ page, isMobile }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await C.fermerPingou(page);
  const p = await C.toucherCadeau(page, 12, isMobile);
  expect(p.etat).toBe("locked");
  await expect(page.locator(".mascot--flottant")).toContainText("12");
  await expect(fenetre(page)).toHaveCount(0);
});

test("jour 1 : le quiz se joue jusqu'au bout", async ({ page, isMobile }) => {
  test.setTimeout(300_000);
  await C.ouvrirDemo(page, { jour: 1 });
  await ouvrirCase(page, 1, isMobile);
  await lancerCase(page);
  // écran de règles du quiz
  await fermerBulleInline(page);
  await page.locator(".jeu-btn").last().click();
  // répond toujours la première option, sur soi puis sur l'autre, jusqu'à l'écran de fin
  const fin = page.locator(".jeu-btn", { hasText: "Fermer" });
  for (let i = 0; i < 40 && !(await fin.isVisible()); i++) {
    const opt = page.locator(".quiz-options button:enabled").first();
    if (await opt.isVisible().catch(() => false)) await opt.click();
    await page.waitForTimeout(500);
  }
  await expect(fin).toBeVisible();
  await fermerBulleInline(page);
  await expect(fenetre(page)).toContainText(/Tu connais Flavie à \d+\/\d+|Réponses envoyées/);
  await fin.click();
  await expect(page.locator(".sheet-fini")).toBeVisible();
  await page.getByRole("button", { name: "Retour à la route" }).click();
  await expect(fenetre(page)).toHaveCount(0);
  const prog = await page.evaluate(() => JSON.stringify(localStorage));
  expect(prog).toContain("completed");
  expect(erreurs()).toEqual([]);
});

async function lancerLuge(page: Page) {
  await C.ouvrirDemo(page, { jour: 2 });
  await ouvrirCase(page, 2);
  await lancerCase(page);
  await fermerBulleInline(page);
  await page.locator(".jeu-btn").last().click(); // règles → partie
  const canvas = page.locator(".jeu-canvas canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(3000);
}

test("jour 2 : la luge se lance et dessine", async ({ page }) => {
  await lancerLuge(page);
  expect(await diversite(page, ".jeu-canvas canvas"), "le canvas de la luge semble vide").toBeGreaterThan(8);
});

test("jour 2 : aucune exception pendant la luge", async ({ page }) => {
  // #30 : exceptions Tone.js par intermittence (selon le rythme des images) ; ce test doit passer une fois corrigé.
  test.info().annotations.push({ type: "ticket", description: "#30" });
  await lancerLuge(page);
  expect(erreurs().length, erreurs()[0]?.texte).toBe(0);
});

test("jour 8 : lecture d'une case préparée (lettre de Flavie)", async ({ page, isMobile }) => {
  await C.ouvrirDemo(page, { jour: 8 });
  await ouvrirCase(page, 8, isMobile);
  await expect(fenetre(page)).toContainText("Une lettre de Flavie");
  await lancerCase(page);
  await page.locator(".prep-enveloppe").click();
  await expect(page.locator(".prep-lettre")).toBeVisible();
  await expect(page.locator(".prep-lettre")).toContainText("balade sous la neige");
  await expect(page.locator(".prep-polaroid").first()).toBeVisible();
  expect(erreurs()).toEqual([]);
});

test("éditeur de case préparée : bouton ✏️, écrire, envoyer", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await C.fermerPingou(page);
  const crayon = page.locator("button[title^='Préparer la case']");
  await expect(crayon).toBeVisible();
  const titre = await crayon.getAttribute("title");
  await crayon.click();
  await expect(page.locator(".edit")).toBeVisible();
  await expect(page.locator(".edit-kicker")).toContainText(titre!.replace("Préparer la case ", "Case "));
  await page.locator("#mot").fill("Message de test Qualité ❄️");
  await page.getByRole("button", { name: "Mettre sous enveloppe" }).click();
  await expect(page.locator(".edit")).toContainText("Rangé dans l'enveloppe");
  expect(erreurs()).toEqual([]);
});

test("rappel la veille (?jour=15) : bandeau, écriture de la case 16, bandeau qui disparaît", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 15 });
  const rappel = page.locator(".rappel");
  await expect(rappel).toBeVisible();
  await expect(rappel).toContainText("case 16");
  await rappel.getByRole("button", { name: "Écrire" }).click();
  await expect(page.locator(".edit-kicker")).toContainText("Case 16");
  await page.locator("#mot").fill("Pour demain 🎁");
  await page.getByRole("button", { name: "Mettre sous enveloppe" }).click();
  await expect(page.locator(".edit")).toContainText("Rangé dans l'enveloppe");
  await page.getByRole("button", { name: "Terminé" }).click();
  await expect(rappel).toHaveCount(0);
});

test("deux onglets : Flavie écrit la case 16, Alexandre la lit le 16", async ({ context, isMobile }) => {
  // même contexte = même localStorage (comme deux onglets du même navigateur en démo)
  const flavie = await context.newPage();
  await C.ouvrirDemo(flavie, { jour: 15, moi: "flavie" });
  await expect(flavie.locator(".who-badge")).toHaveText("Flavie");
  await flavie.locator(".rappel").getByRole("button", { name: "Écrire" }).click();
  await flavie.locator("#mot").fill("Coucou depuis l'autre onglet 🐧");
  await flavie.getByRole("button", { name: "Mettre sous enveloppe" }).click();
  await expect(flavie.locator(".edit")).toContainText("Rangé dans l'enveloppe");

  const alex = await context.newPage();
  await C.ouvrirDemo(alex, { jour: 16, moi: "alexandre", reset: false });
  await expect(alex.locator(".who-badge")).toHaveText("Alexandre");
  await ouvrirCase(alex, 16, isMobile);
  await lancerCase(alex);
  await alex.locator(".prep-enveloppe").click();
  await expect(alex.locator(".prep-lettre")).toContainText("Coucou depuis l'autre onglet");
});

test.fixme("jeu en direct à deux onglets (?moi=alexandre / ?moi=flavie)", async () => {
  // À FAIRE : aucun jeu en direct n'est encore enregistré dans src/games/registry.ts (jours 5, 6, 11, 13, 18, 21).
  // Dès qu'un jeu « direct » existe : deux pages du même contexte, joinRoom, une action d'un côté visible de l'autre.
});

test("1er décembre : connexion puis carte, rien n'est déjà ouvert ni joué", async ({ page }) => {
  await page.goto("./?jour=1&demo-reset");
  await page.getByRole("button", { name: "Alexandre" }).click();
  await page.locator("#mdp").fill("x");
  await page.getByRole("button", { name: "Entrer" }).click();
  await C.attendreScene(page);
  expect((await C.positionCadeau(page, 1)).etat).toBe("available");
  for (const d of [2, 6, 24]) expect((await C.positionCadeau(page, d)).etat).toBe("locked");
  await ouvrirCase(page, 1);
  await expect(page.getByRole("button", { name: "C'est parti" })).toBeVisible(); // pas « Revoir la case »
});

for (const jour of [7, 15]) {
  test(`jour ${jour} : le jeu se lance sans erreur`, async ({ page }) => {
    await C.ouvrirDemo(page, { jour });
    await ouvrirCase(page, jour);
    await lancerCase(page);
    await fermerBulleInline(page);
    const regles = page.locator(".jeu-btn").last();
    if (await regles.isVisible().catch(() => false)) await regles.click().catch(() => {});
    await expect(page.locator(".sheet-game .jeu-centre, .sheet-game canvas").first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(erreurs(), JSON.stringify(erreurs(), null, 1)).toEqual([]);
  });
}

test("réglages : l'interrupteur du son se pilote au clavier", async ({ page }) => {
  await C.ouvrirDemo(page, { jour: 9 });
  await C.fermerPingou(page);
  await page.getByRole("button", { name: "Réglages" }).click();
  const son = page.locator("#reg-son");
  const avant = await son.getAttribute("aria-checked");
  await son.focus();
  await page.keyboard.press("Space");
  await expect(son).not.toHaveAttribute("aria-checked", avant!);
});

test("24 décembre : ouvrir la dernière case mène à l'écran final", async ({ page }) => {
  test.setTimeout(400_000);
  await C.ouvrirDemo(page, { jour: 24 });
  // on avance Alexandre jusqu'à la case 23 dans les données de démo, pour que la marche finale soit courte
  await page.evaluate(() => {
    // stockage de la démo : seules les actions de l'utilisateur (src/backend/demo.ts, « cc-demo:data-v2 »)
    const k = "cc-demo:data-v2";
    const d = JSON.parse(localStorage.getItem(k) ?? "null") ?? { progress: { alexandre: { opened: [], completed: [] }, flavie: { opened: [], completed: [] } }, prepared: [], gameState: {} };
    d.progress.alexandre.opened = Array.from({ length: 23 }, (_, i) => i + 1);
    localStorage.setItem(k, JSON.stringify(d));
  });
  await C.ouvrirDemo(page, { jour: 24, reset: false });
  await ouvrirCase(page, 24);
  await lancerCase(page);
  await page.locator(".prep-enveloppe").click({ timeout: 5000 }).catch(() => { /* pas de lettre d’exemple le 24 */ });
  await page.getByRole("button", { name: "Fermer la case" }).click();
  await expect(page.locator(".final")).toBeVisible({ timeout: 300_000 });
  await expect(page.locator(".final-titre")).toHaveText("Vous y êtes");
});

