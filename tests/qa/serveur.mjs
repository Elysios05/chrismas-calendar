// Petit serveur statique pour dist/ (port Qualité 4180). Remplace `vite preview`, qui a été arrêté deux fois
// en cours de série (probablement un `pkill -f "vite preview"` venu d'ailleurs sur la machine partagée).
// Usage : node tests/qa/serveur.mjs  (ou importé : demarrerServeur())
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".mp3": "audio/mpeg" };

export const DIST = RACINE;

/** port = 0 : le système choisit un port libre (lire `srv.address().port`). */
export function demarrerServeur(port = Number(process.env.QA_PORT ?? 4180)) {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let f = path.join(RACINE, p);
      if (!f.startsWith(RACINE)) { res.writeHead(403).end(); return; }
      const s = await stat(f).catch(() => null);
      if (!s) f = path.join(RACINE, "index.html"); else if (s.isDirectory()) f = path.join(f, "index.html");
      const buf = await readFile(f);
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream", "cache-control": "no-store", "x-cc-dist": RACINE }).end(buf);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok(srv)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await demarrerServeur();
  console.log(`dist/ servi sur http://localhost:${process.env.QA_PORT ?? 4180}/`);
}
