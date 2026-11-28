// Équipe Marketing — tourne TOUS les rushes des vidéos TikTok sur le site actuel, puis les prépare pour le montage.
//
//   node docs/marketing/outils/rushes.mjs [--seulement=zones,surprise] [--sans-film]
//   (depuis docs/marketing/montage/ : `npm run rushes`, ou `npm run videos` pour rushes + rendu)
//
// Pour chaque rush : filmer.mjs <plan> --propre (images JPEG dans /tmp/film/rushes/<nom>/, hors dépôt),
// puis encodage en MP4 quasi sans perte dans montage/public/rushes/<nom>.mp4 (ignoré par git) et copie des
// images clés (marques.json) dans montage/src/rushes/<nom>.json (versionné : le montage s'en sert pour couper).
// Le site est reconstruit (npm run build) si dist/ est plus vieux que src/.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as C from "../../../tests/qa/commun.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MONTAGE = path.join(ICI, "../montage");
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));

/** nom du rush → arguments de filmer.mjs */
export const RUSHES = {
  zones: ["zones", "--duree=2.2"],
  monde: ["monde", "--duree=12", "--fin=6"],
  surprise: ["surprise", "--duree=8"],
  luge: ["case", "--jour=2", "--duree=6"],
  flocons: ["case", "--jour=10", "--duree=6"],
  quiz: ["case", "--jour=1", "--duree=7"],
};

const choisis = opt.seulement ? String(opt.seulement).split(",") : Object.keys(RUSHES);
for (const n of choisis) if (!RUSHES[n]) { console.error(`Rush inconnu : ${n}. Rushes : ${Object.keys(RUSHES).join(", ")}`); process.exit(2); }

if (!opt["sans-film"] && !C.buildRecent()) C.construire();
mkdirSync(path.join(MONTAGE, "public/rushes"), { recursive: true });
mkdirSync(path.join(MONTAGE, "src/rushes"), { recursive: true });

for (const nom of choisis) {
  const dossier = `/tmp/film/rushes/${nom}`;
  if (!opt["sans-film"]) {
    console.log(`\n● rush « ${nom} »`);
    execFileSync("node", [path.join(ICI, "filmer.mjs"), ...RUSHES[nom], "--propre", `--sortie=${dossier}`],
      { stdio: "inherit", env: { ...process.env, QA_PORT: process.env.QA_PORT ?? "4199" } });
  }
  if (!existsSync(path.join(dossier, "marques.json"))) throw new Error(`rush ${nom} absent : ${dossier}`);
  // MP4 de travail : très peu compressé, une image clé toutes les 10 images (recherche rapide au montage)
  const mp4 = path.join(MONTAGE, "public/rushes", `${nom}.mp4`), tmp = mp4.replace(/\.mp4$/, ".part.mp4");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", "30", "-pattern_type", "glob", "-i", path.join(dossier, "*.jpg"),
    "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-g", "10", "-pix_fmt", "yuv420p", tmp], { stdio: "inherit" });
  renameSync(tmp, mp4);
  copyFileSync(path.join(dossier, "marques.json"), path.join(MONTAGE, "src/rushes", `${nom}.json`));
  console.log(`✓ ${nom} → ${path.relative(process.cwd(), mp4)}`);
}
