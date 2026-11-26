// Salons en mode démo (docs/salons.md) : créer un calendrier Sam & Camille → lien d'invitation → l'invité·e l'ouvre
// dans un autre onglet et choisit son mot de passe → les prénoms du salon partout, jamais « Alexandre » ni « Flavie ».
//
// L'assistant de création n'est pas atteignable dans l'application de démo (elle a toujours un salon par défaut) :
// on passe par la page de maquettes de l'Interface (vue=creer) sur le serveur de dév (port QA_PORT_DEV, 4181),
// puis par la vraie application (même origine, donc même stockage de démo) pour la suite du parcours.
import { test, expect, type Page } from "@playwright/test";
// @ts-expect-error module JS sans types
import * as C from "../qa/commun.mjs";

const DEV = `http://localhost:${process.env.QA_PORT_DEV ?? 4181}/`;
const INTERDITS = /Alexandre|Flavie/;
let msgs: { type: string; texte: string }[] = [];

test.use({ baseURL: DEV });
test.beforeEach(async ({ context, page }, info) => {
  test.skip(info.project.name !== "mobile", "parcours joué une fois, en téléphone 390×844");
  await C.preparerContexte(context, { heure: C.HEURES.jour });
  msgs = C.collecterConsole(page);
});

/** Tout le texte que voit (ou lit à voix haute) la personne : texte affiché, titres, libellés, valeurs de champs. */
async function texteVisible(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [document.body.innerText];
    document.querySelectorAll<HTMLElement>("[title],[aria-label],[alt],input,textarea").forEach((e) => {
      for (const a of ["title", "aria-label", "alt"]) { const v = e.getAttribute(a); if (v) out.push(v); }
      if ("value" in e && typeof (e as HTMLInputElement).value === "string" && (e as HTMLInputElement).type !== "password") out.push((e as HTMLInputElement).value);
    });
    return out.join("\n");
  });
}
const sansPrenomsEnDur = async (page: Page, ou: string) => {
  const t = await texteVisible(page);
  expect(t.match(INTERDITS)?.[0] ?? null, `« ${t.match(INTERDITS)?.[0]} » écrit en dur (${ou})`).toBeNull();
};
const ignorerBruitConnu = () => msgs.filter((m) => m.type !== "warning");

/** Crée le salon Sam & Camille par l'assistant ; renvoie le lien d'invitation affiché. */
async function creerSalon(page: Page) {
  await page.goto(`${DEV}maquettes.html?vue=creer&demo-reset`);
  await page.getByRole("button", { name: "Oui, créons notre calendrier" }).click();
  await page.getByLabel("Ton prénom").fill("Sam");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "C'est moi !" }).click();
  await page.getByLabel("Son prénom").fill("Camille");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "C'est Camille !" }).click();
  await page.getByRole("button", { name: "D'accord" }).click();
  await page.getByLabel("Ton mot de passe").fill("flocon-sam");
  await page.getByRole("button", { name: "Créer notre calendrier" }).click();
  const champ = page.getByLabel("Lien pour Camille");
  await expect(champ).toBeVisible();
  const lien = await champ.inputValue();
  expect(lien, "le lien d'invitation doit contenir ?invitation=").toMatch(/[?&]invitation=[\w-]{8,}/);
  await sansPrenomsEnDur(page, "page « lien à envoyer »");
  return lien;
}

/** Remplace le chemin du lien par la racine du serveur de dév (l'assistant tourne sous maquettes.html). */
const verslApp = (lien: string) => { const u = new URL(lien, DEV); return `${DEV}${u.search}`; };

async function entrerCarte(page: Page) {
  await C.attendreScene(page, 90_000);
  await page.waitForTimeout(800);
}

test("salon Sam & Camille : création, invitation, prénoms partout, lien déjà utilisé, éditeur réservé au créateur", async ({ page, context }) => {
  test.setTimeout(900_000);
  test.info().annotations.push({ type: "ticket", description: "#84 salons" });

  // 1. création → le lien d'invitation s'affiche
  const lien = await creerSalon(page);
  const urlInvitation = verslApp(lien);

  // 2. le créateur (Sam) ouvre son calendrier dans cet onglet
  await page.goto(DEV);
  await entrerCarte(page);
  await expect(page.locator(".entete")).toContainText("Sam");
  await expect(page.locator(".entete")).toContainText("Camille");
  await sansPrenomsEnDur(page, "carte, côté créateur");
  await C.fermerPingou(page);

  // 3. l'invité·e ouvre le lien dans un autre onglet (même navigateur) : accueil par prénom, choix du mot de passe
  const invite = await context.newPage();
  const msgsInvite = C.collecterConsole(invite);
  await invite.goto(urlInvitation);
  await expect(invite.getByText(/Camille/).first()).toBeVisible();
  await sansPrenomsEnDur(invite, "page d'invitation");
  await invite.getByLabel("Ton mot de passe").fill("flocon-camille");
  await invite.getByRole("button", { name: "Entrer dans le calendrier" }).click();
  await entrerCarte(invite);

  // 4. côté invité·e : prénoms du salon dans l'en-tête et dans la bulle de Pingou, rien en dur
  await expect(invite.locator(".entete")).toContainText("Sam");
  await expect(invite.locator(".entete")).toContainText("Camille");
  expect(new URL(invite.url()).search, "?invitation= doit être retiré de l'adresse").not.toContain("invitation");
  const pingou = invite.locator(".mascot");
  if (await pingou.count()) await sansPrenomsEnDur(invite, "bulle de Pingou");
  await sansPrenomsEnDur(invite, "carte, côté invité·e");
  await C.fermerPingou(invite);
  await invite.getByRole("button", { name: "Réglages" }).click();
  await sansPrenomsEnDur(invite, "réglages");
  await invite.getByRole("button", { name: /Notre calendrier/ }).click();
  const dlg = invite.getByRole("dialog", { name: "Notre calendrier" });
  await expect(dlg).toContainText("Sam");
  await expect(dlg).toContainText("Camille");
  await sansPrenomsEnDur(invite, "réglages du salon, côté invité·e");
  // l'éditeur de contenu est réservé au créateur : l'invité·e voit la carte « surprise »
  await expect(dlg.getByRole("button", { name: /Les questions des jeux/ })).toHaveCount(0);
  await expect(dlg).toContainText("Sam a préparé les questions des jeux");
  await invite.close();

  // 5. un lien d'invitation déjà utilisé : « Ce lien ne marche plus » / « déjà rejoint », sans mot de passe à saisir
  const reuse = await context.newPage();
  await reuse.goto(urlInvitation);
  await expect(reuse.getByRole("button", { name: "Aller à la connexion" })).toBeVisible();
  await expect(reuse.getByLabel("Ton mot de passe")).toHaveCount(0);
  await sansPrenomsEnDur(reuse, "invitation déjà utilisée");
  await reuse.close();

  // 6. et un lien qui n'a jamais existé
  const faux = await context.newPage();
  await faux.goto(`${DEV}?invitation=nexistepas123456`);
  await expect(faux.getByText("Ce lien ne marche plus.", { exact: false })).toBeVisible();
  await faux.close();

  // 7. côté créateur : l'éditeur de contenu est là
  await page.getByRole("button", { name: "Réglages" }).click();
  await page.getByRole("button", { name: /Notre calendrier/ }).click();
  const dlgSam = page.getByRole("dialog", { name: "Notre calendrier" });
  await expect(dlgSam.getByRole("button", { name: /Les questions des jeux/ })).toBeVisible();
  await expect(dlgSam).not.toContainText("a préparé les questions des jeux");
  await sansPrenomsEnDur(page, "réglages du salon, côté créateur");

  expect(ignorerBruitConnu(), JSON.stringify(ignorerBruitConnu(), null, 1)).toEqual([]);
  expect(msgsInvite.filter((m: { type: string }) => m.type !== "warning")).toEqual([]);
});
