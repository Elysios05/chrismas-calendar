/**
 * Souvenirs après Noël (hors contrat) : rassemble les 12 cases préparées (6 de chacun) et leurs photos
 * dans UNE page HTML autonome (images intégrées), à télécharger et à garder. Disponible à partir du 24.
 * Fonctionne avec n'importe quel backend (démo ou Supabase) : on passe par getPrepared.
 */
import type { BackendApi, PreparedContent, Who } from "../core/contracts";
import { PREPARED_DAYS } from "./config";

/** Jour à partir duquel l'export est possible. */
export const SOUVENIRS_FROM_DAY = 24;

const NAME: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Transforme une photo (URL signée, data:…) en data URL, pour que le fichier se suffise à lui-même. */
async function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function paragraphs(message: string): string {
  const parts = message.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n");
}

async function letterHtml(c: PreparedContent): Promise<string> {
  const photos = (await Promise.all(c.photos.map(toDataUrl))).filter((x): x is string => !!x);
  const missing = c.photos.length - photos.length;
  return `<article class="lettre ${c.from}">
  <h3>De ${NAME[c.from]} pour ${NAME[c.to]}</h3>
  ${c.message.trim() ? paragraphs(c.message) : `<p class="vide">(pas de mot, seulement des photos)</p>`}
  ${photos.length ? `<div class="photos">${photos.map((src, i) => `<img src="${src}" alt="Photo ${i + 1} de ${NAME[c.from]}" loading="lazy">`).join("")}</div>` : ""}
  ${missing ? `<p class="vide">${missing} photo(s) n'ont pas pu être récupérées.</p>` : ""}
</article>`;
}

/** Construit la page de souvenirs. Erreur avant le 24 décembre ou si personne n'est connecté. */
export async function exportSouvenirs(backend: BackendApi): Promise<Blob> {
  const me = await backend.me();
  if (!me) throw new Error("Pas connecté.");
  const today = await backend.today();
  if (today < SOUVENIRS_FROM_DAY) throw new Error(`Les souvenirs seront disponibles le ${SOUVENIRS_FROM_DAY} décembre.`);

  const sections: string[] = [];
  let count = 0;
  for (const day of PREPARED_DAYS) {
    const letters: string[] = [];
    for (const to of ["flavie", "alexandre"] as Who[]) {
      const r = await backend.getPrepared(day, to);
      if (r.status === "ready" && (r.content.message.trim() || r.content.photos.length)) {
        letters.push(await letterHtml(r.content));
        count++;
      }
    }
    if (letters.length) {
      sections.push(`<section><h2><span class="case">${day}</span> ${day} décembre</h2>\n${letters.join("\n")}</section>`);
    }
  }
  if (!count) throw new Error("Aucune case préparée à garder pour l'instant.");

  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nos souvenirs de l'Avent 2026 — Alexandre & Flavie</title>
<style>
  :root { --nuit: #101a3a; --neige: #f6f8ff; --rouge: #c0392b; --or: #ffd54a; --texte: #1f2a44; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--nuit); color: var(--texte); font-family: Fredoka, "Trebuchet MS", system-ui, sans-serif; }
  header { color: var(--neige); text-align: center; padding: 48px 20px 24px; }
  header h1 { margin: 0 0 8px; font-size: clamp(26px, 6vw, 42px); }
  header p { margin: 0; opacity: .8; }
  main { max-width: 760px; margin: 0 auto; padding: 0 16px 48px; }
  section { background: var(--neige); border-radius: 20px; padding: 20px 22px; margin: 18px 0; box-shadow: 0 6px 24px #0004; }
  h2 { margin: 0 0 12px; color: var(--rouge); font-size: 22px; display: flex; align-items: center; gap: 12px; }
  .case { background: var(--rouge); color: #fff; border-radius: 12px; min-width: 40px; height: 40px; display: inline-grid; place-items: center; }
  .lettre { border-left: 4px solid var(--or); padding: 4px 0 4px 16px; margin: 16px 0; }
  .lettre.flavie { border-color: #e88aa8; } .lettre.alexandre { border-color: #6aa7e8; }
  .lettre h3 { margin: 0 0 6px; font-size: 16px; opacity: .75; }
  .lettre p { line-height: 1.55; margin: 8px 0; white-space: normal; }
  .vide { opacity: .6; font-style: italic; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
  .photos img { width: 100%; border-radius: 12px; display: block; }
  footer { color: var(--neige); text-align: center; opacity: .7; padding: 0 20px 40px; }
  @media print { body { background: #fff; } header, footer { color: var(--texte); } section { box-shadow: none; break-inside: avoid; } }
</style>
</head>
<body>
<header>
  <h1>🎄 Nos souvenirs de l'Avent 2026</h1>
  <p>Alexandre & Flavie : les ${count} cases préparées l'un pour l'autre</p>
</header>
<main>
${sections.join("\n")}
</main>
<footer>Gardé le ${esc(date)}, avec Pingou 🐧</footer>
</body>
</html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

/** Télécharge la page de souvenirs (à appeler dans un clic). */
export async function downloadSouvenirs(backend: BackendApi, filename = "souvenirs-avent-2026.html"): Promise<void> {
  const blob = await exportSouvenirs(backend);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
