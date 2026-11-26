// Configuration Playwright de l'équipe Qualité — npm run qa:e2e
// Utilise le Chrome du système (pas de téléchargement de navigateur) et WebGL logiciel (SwiftShader).
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.QA_PORT ?? 4180);
const PORT_DEV = Number(process.env.QA_PORT_DEV ?? 4181);
const CHROME = process.env.QA_CHROME ?? "/usr/bin/google-chrome";
const launchOptions = { executablePath: CHROME, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../docs/qa/e2e-resultats",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // SwiftShader occupe déjà tous les cœurs
  reporter: [["list"], ["html", { outputFolder: "../docs/qa/e2e-rapport", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    timezoneId: "Europe/Paris",
    locale: "fr-FR",
    screenshot: "only-on-failure",
    trace: process.env.QA_TRACE ? "retain-on-failure" : "off", // la trace capture chaque image : très lent sous SwiftShader
    launchOptions,
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 /* 2 dans qa:captures ; 1 ici pour la vitesse sous SwiftShader */, isMobile: true, hasTouch: true } },
    { name: "ordinateur", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: `npm run build && node tests/qa/serveur.mjs`,
      cwd: "..",
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      // serveur de dév : seul moyen propre d'atteindre l'assistant de création en démo (maquettes.html, voir salons.spec.ts)
      command: `npx vite --port ${PORT_DEV} --strictPort --host 127.0.0.1`,
      cwd: "..",
      url: `http://localhost:${PORT_DEV}/maquettes.html`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
