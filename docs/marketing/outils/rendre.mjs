// Équipe Marketing — rend toutes les vidéos TikTok du montage Remotion, en deux versions, + une planche-contact.
//
//   node docs/marketing/outils/rendre.mjs [--seulement=surprise,monde]   (depuis montage/ : `npm run rendre`)
//
// Pour chaque composition : docs/marketing/videos/<n>-<id>.mp4            (bruitages du site, SANS musique :
//                                                                           TikTok y pose le son tendance)
//                           docs/marketing/videos/<n>-<id>-musique.mp4    (+ fond musical Tone.js du site)
//                           docs/marketing/videos/planches/<n>-<id>.png    (une image par seconde, pour relire)
// H.264 CRF 23 « veryfast », ≤ 8 Mo. Les rushes et la musique doivent exister (npm run rushes, npm run musique).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MONTAGE = path.join(ICI, "../montage");
const VIDEOS = path.join(ICI, "../videos");
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));

/** composition → [numéro, fichier de musique (public/audio)] */
const VIDEOS_TIKTOK = {
  surprise: ["1", "musique-surprise"],
  monde: ["2", "musique-monde"],
  jeux: ["3", "musique-jeux"],
};
const choisies = opt.seulement ? String(opt.seulement).split(",") : Object.keys(VIDEOS_TIKTOK);
mkdirSync(path.join(VIDEOS, "planches"), { recursive: true });
mkdirSync(path.join(MONTAGE, "out"), { recursive: true });

const duree = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const lancer = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

for (const id of choisies) {
  const [n, musique] = VIDEOS_TIKTOK[id] ?? [];
  if (!n) { console.error(`Composition inconnue : ${id}`); process.exit(2); }
  const base = `${n}-${id}`;
  console.log(`\n● ${base}`);
  // 1. rendu Remotion (image + bruitages), directement aux réglages de livraison
  const brut = path.join(MONTAGE, "out", `${base}.mp4`), part = brut.replace(/\.mp4$/, ".part.mp4");
  lancer("npx", ["remotion", "render", id, part, "--codec=h264", "--crf=23", "--x264-preset=veryfast", "--audio-bitrate=160k", "--concurrency=2"], MONTAGE);
  renameSync(part, brut);
  copyFileSync(brut, path.join(VIDEOS, `${base}.mp4`));
  // 2. version avec musique : on ajoute le morceau sous les bruitages, sans réencoder l'image
  const d = duree(brut);
  const avec = path.join(VIDEOS, `${base}-musique.mp4`), avecPart = avec.replace(/\.mp4$/, ".part.mp4");
  lancer("ffmpeg", ["-loglevel", "error", "-y", "-i", brut, "-i", path.join(MONTAGE, "public/audio", `${musique}.wav`),
    "-filter_complex", `[1:a]atrim=0:${d},asetpts=PTS-STARTPTS,afade=t=in:d=0.2,afade=t=out:st=${Math.max(0, d - 1.8)}:d=1.8,volume=0.6[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", avecPart]);
  renameSync(avecPart, avec);
  // 3. planche-contact : une image par seconde, 6 par ligne
  const lignes = Math.ceil(Math.ceil(d) / 6);
  lancer("ffmpeg", ["-loglevel", "error", "-y", "-i", brut, "-vf", `fps=1,scale=270:-1,tile=6x${lignes}:padding=8:color=white`, "-frames:v", "1",
    path.join(VIDEOS, "planches", `${base}.png`)]);
  for (const f of [path.join(VIDEOS, `${base}.mp4`), avec]) {
    const mo = statSync(f).size / 1e6;
    console.log(`✓ ${path.basename(f)} : ${d.toFixed(1)} s, ${mo.toFixed(1)} Mo${mo > 8 ? "  ⚠ plus de 8 Mo" : ""}`);
  }
}
