// Ticket #30 : rejouer un effet très vite ne doit jamais lever d'exception
// (« Start time must be strictly greater than previous start time » pendant la luge).
// Ce test lance son propre serveur Vite pour charger la page de démo audio (absente du build).
import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let base = "";

test.beforeAll(async () => {
  server = await createServer({ root: process.cwd().replace(/\/tests$/, ""), server: { port: 0, strictPort: false }, logLevel: "error" });
  await server.listen();
  const addr = server.httpServer!.address();
  base = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
});

test.afterAll(async () => {
  await server?.close();
});

const EFFETS = [
  "open", "good", "bad", "pop", "win", "locked", "step", "whoosh", "talk", "pingou", "jingle", "snow",
  "fox", "hare", "owl", "squirrel", "reindeer", "seal", "bear", "elf-laugh", "elf-hammer", "elf-hop",
  "snowball", "skate", "ski", "lift", "partner-in", "partner-out",
];

test("audio : un effet rejoué 50 fois en 100 ms ne lève aucune exception", async ({ page }, info) => {
  test.skip(info.project.name !== "ordinateur", "test audio pur : un seul projet suffit");
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.goto(`${base}/audio-demo.html`);
  await page.waitForFunction(() => "__audio" in window, null, { timeout: 60_000 });
  for (const nom of EFFETS) {
    const r = await page.evaluate(
      (n) => (window as unknown as { __audio: { stressSfx: (n: string, c: number, s: number) => Promise<Record<string, number>> } }).__audio.stressSfx(n, 50, 0.1),
      nom,
    );
    expect(r.thrown, `${nom} : exceptions levées`).toBe(0);
    expect(r.caught, `${nom} : exceptions rattrapées`).toBe(0);
    expect(r.played, `${nom} : au moins un effet joué`).toBeGreaterThan(0);
  }
  expect(erreurs).toEqual([]);
});
