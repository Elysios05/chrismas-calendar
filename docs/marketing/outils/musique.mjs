// Équipe Marketing — fond musical et bruitages des vidéos, rendus HORS LIGNE avec la vraie musique Tone.js du site
// (src/audio : morceaux composés pour l'appli, donc libres de droits pour nous). Aucune musique téléchargée.
//
//   node docs/marketing/outils/musique.mjs        (depuis docs/marketing/montage/ : `npm run musique`)
//
// Lance Vite sur la page audio-demo.html du site (port 4198), appelle window.__audio (renderPiece, renderSfx),
// et écrit les WAV dans montage/public/audio/ (ignoré par git).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as C from "../../../tests/qa/commun.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, "../montage/public/audio");
const PORT = Number(process.env.MUSIQUE_PORT ?? 4198);

/** fichier → [morceau, nuit, secondes] */
const MORCEAUX = {
  "musique-surprise": ["cosy", false, 34],
  "musique-monde": ["marche", false, 34],
  "musique-jeux": ["action", false, 34],
};
/** bruitages du site utilisés au montage (chacun commence 0,2 s après le début du fichier) */
const SFX = ["whoosh", "pop", "open", "tap", "notify", "win", "jingle", "unlock", "good"];

mkdirSync(SORTIE, { recursive: true });
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: C.RACINE, stdio: ["ignore", "pipe", "inherit"], detached: true });
await new Promise((ok, ko) => {
  vite.stdout.on("data", (d) => { if (String(d).includes(String(PORT))) ok(); });
  vite.on("exit", (c) => ko(new Error(`vite s'est arrêté (${c})`)));
});
const navigateur = await C.lancerChrome();
try {
  const page = await navigateur.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/audio-demo.html`);
  await page.waitForFunction(() => globalThis.__audio, null, { timeout: 120000 });
  for (const [nom, [id, nuit, s]] of Object.entries(MORCEAUX)) {
    const b64 = await page.evaluate(async ([id, nuit, s]) => __audio.wavBase64(await __audio.renderPiece(id, nuit, s, 2.5)), [id, nuit, s]);
    writeFileSync(path.join(SORTIE, `${nom}.wav`), Buffer.from(b64, "base64"));
    console.log(`✓ ${nom}.wav (${id})`);
  }
  for (const n of SFX) {
    const b64 = await page.evaluate(async (n) => __audio.wavBase64(await __audio.renderSfx([n], 1.6)), n);
    writeFileSync(path.join(SORTIE, `sfx-${n}.wav`), Buffer.from(b64, "base64"));
  }
  console.log(`✓ bruitages : ${SFX.join(", ")}`);
} finally {
  await navigateur.close();
  try { process.kill(-vite.pid); } catch { vite.kill(); } // npx lance vite dans un sous-processus : on arrête tout le groupe
}
process.exit(0);
