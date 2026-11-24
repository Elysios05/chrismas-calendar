/**
 * Souvenirs après Noël (hors contrat) : rassemble les 12 cases préparées (6 de chacun) et leurs photos
 * dans UNE page HTML autonome (images intégrées), à télécharger et à garder. Disponible à partir du 24.
 * La page a un bouton « Enregistrer en PDF » (window.print) et une feuille d'impression A4 : une lettre par page.
 * Fonctionne avec n'importe quel backend (démo ou Supabase) : on passe par getPrepared.
 */
import type { BackendApi, PreparedContent, Who } from "../core/contracts";
import { PREPARED_DAYS } from "./config";

/** Jour à partir duquel l'export est possible. */
export const SOUVENIRS_FROM_DAY = 24;

/** Prénoms par défaut (si le backend ne fournit pas de salon) ; sinon ceux de la config du salon. */
const DEFAULT_NAMES: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

/** Options de l'export. */
export interface SouvenirsOptions {
  /**
   * Fournit (au moment de l'export, jamais figé dans le dépôt) une image du décor autour de la case `day`,
   * en data URL. Branchée plus tard sur `scene.snapshotAround`. Absente ou `null` : mise en page simple.
   */
  decor?: (day: number) => Promise<string | null>;
}

/** Appelle `decor` sans jamais casser l'export : une erreur ou un résultat vide donnent `null`. */
async function getDecor(opts: SouvenirsOptions, day: number): Promise<string | null> {
  if (!opts.decor) return null;
  try {
    const url = await opts.decor(day);
    return url && url.startsWith("data:image/") ? url : null;
  } catch {
    return null;
  }
}

/** Flocons en SVG (dans la page, donc imprimés). */
const FLAKES = (() => {
  const pts: Array<[number, number, number]> = [[8, 14, 3], [22, 62, 2], [38, 28, 2.5], [55, 80, 2], [70, 18, 3], [84, 52, 2], [93, 86, 2.5], [14, 90, 2], [62, 44, 1.6]];
  return `<svg class="flocons" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${pts
    .map(([x, y, r]) => `<g transform="translate(${x} ${y})" stroke="#fff" stroke-width=".5" stroke-linecap="round"><path d="M0 -${r}V${r}M-${r} 0H${r}M-${r * 0.7} -${r * 0.7}L${r * 0.7} ${r * 0.7}M-${r * 0.7} ${r * 0.7}L${r * 0.7} -${r * 0.7}"/></g>`)
    .join("")}</svg>`;
})();

/** Bordure isométrique : liseré à losanges, en SVG. */
const BORDER = `<svg class="bordure" viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="los" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 4L6 0L12 4L6 8Z" fill="#c0392b"/><path d="M6 4L9 2L12 4L9 6Z" fill="#ffd54a"/></pattern></defs><rect width="120" height="8" fill="url(#los)"/></svg>`;

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

async function letterHtml(day: number, c: PreparedContent, NAME: Record<Who, string>): Promise<string> {
  const photos = (await Promise.all(c.photos.map(toDataUrl))).filter((x): x is string => !!x);
  const missing = c.photos.length - photos.length;
  return `<article class="lettre ${c.from}">
  <h2><span class="case">${day}</span> ${day} décembre</h2>
  <h3>De ${esc(NAME[c.from])} pour ${esc(NAME[c.to])}</h3>
  ${c.message.trim() ? paragraphs(c.message) : `<p class="vide">(pas de mot, seulement des photos)</p>`}
  ${photos.length ? `<div class="photos">${photos.map((src, i) => `<img src="${src}" alt="Photo ${i + 1} de ${esc(NAME[c.from])}" loading="lazy">`).join("")}</div>` : ""}
  ${missing ? `<p class="vide">${missing} photo(s) n'ont pas pu être récupérées.</p>` : ""}
</article>`;
}

/** Construit la page de souvenirs. Erreur avant le 24 décembre ou si personne n'est connecté. */
export async function exportSouvenirs(backend: BackendApi, opts: SouvenirsOptions = {}): Promise<Blob> {
  const me = await backend.me();
  if (!me) throw new Error("Pas connecté.");
  const today = await backend.today();
  if (today < SOUVENIRS_FROM_DAY) throw new Error(`Les souvenirs seront disponibles le ${SOUVENIRS_FROM_DAY} décembre.`);
  const salon = await backend.salons?.getSalon().catch(() => null);
  const NAME: Record<Who, string> = salon
    ? { alexandre: salon.config.joueurs.alexandre.prenom, flavie: salon.config.joueurs.flavie.prenom }
    : DEFAULT_NAMES;
  const couple = `${esc(NAME.alexandre)} & ${esc(NAME.flavie)}`;

  const sections: string[] = [];
  let count = 0;
  for (const day of PREPARED_DAYS) {
    const img = await getDecor(opts, day);
    const bandeau = img
      ? `<div class="bandeau"><img src="${img}" alt="Le décor autour de la case ${day}"><div class="voile"></div>${FLAKES}</div>`
      : "";
    for (const to of ["flavie", "alexandre"] as Who[]) {
      const r = await backend.getPrepared(day, to);
      if (r.status === "ready" && (r.content.message.trim() || r.content.photos.length)) {
        const html = await letterHtml(day, r.content, NAME);
        // le bandeau de décor se place juste après l'ouverture de la lettre
        sections.push(bandeau ? html.replace(/(<article[^>]*>)/, `$1${bandeau}`).replace(/<\/article>\s*$/, `${BORDER}</article>`) : html);
        count++;
      }
    }
  }
  if (!count) throw new Error("Aucune case préparée à garder pour l'instant.");

  const cover = await getDecor(opts, 24);
  const couverture = cover
    ? `<div class="couverture"><img src="${cover}" alt="Le pôle Nord, case 24"><div class="voile"></div>${FLAKES}</div>`
    : "";
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nos souvenirs de l'Avent 2026 — ${couple}</title>
<style>
  :root { --nuit: #101a3a; --neige: #f6f8ff; --rouge: #c0392b; --or: #ffd54a; --texte: #1f2a44; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: var(--nuit); color: var(--texte); font-family: Fredoka, "Trebuchet MS", system-ui, sans-serif; }
  header { color: var(--neige); text-align: center; padding: 40px 20px 24px; }
  header h1 { margin: 0 0 8px; font-size: clamp(26px, 6vw, 42px); }
  header p { margin: 0; opacity: .8; }
  .imprimer { display: inline-flex; align-items: center; gap: 10px; margin-top: 22px; padding: 14px 26px; border: 0; border-radius: 999px;
    background: var(--rouge); color: #fff; font: inherit; font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: 0 6px 18px #0006; }
  .imprimer:hover { filter: brightness(1.1); } .imprimer:active { transform: translateY(1px); }
  .astuce { display: block; margin-top: 10px; font-size: 13px; opacity: .7; }
  main { max-width: 760px; margin: 0 auto; padding: 0 16px 48px; }
  .lettre { background: var(--neige); border-radius: 20px; border-top: 8px solid var(--or); padding: 20px 22px; margin: 18px 0; box-shadow: 0 6px 24px #0004; }
  .lettre.flavie { border-top-color: #e88aa8; } .lettre.alexandre { border-top-color: #6aa7e8; }
  h2 { margin: 0 0 6px; color: var(--rouge); font-size: 22px; display: flex; align-items: center; gap: 12px; }
  .case { background: var(--rouge); color: #fff; border-radius: 12px; min-width: 40px; height: 40px; display: inline-grid; place-items: center; }
  .lettre h3 { margin: 0 0 10px; font-size: 16px; opacity: .75; }
  .lettre p { line-height: 1.55; margin: 8px 0; }
  .vide { opacity: .6; font-style: italic; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 12px; }
  .photos img { width: 100%; border-radius: 12px; display: block; }
  .avec-decor { position: relative; }
  header.avec-decor { padding: 0; }
  header.avec-decor h1 { position: relative; margin-top: -90px; }
  header.avec-decor p { position: relative; padding-bottom: 24px; }
  .couverture, .bandeau { position: relative; overflow: hidden; }
  .couverture { height: 260px; }
  .bandeau { height: 130px; margin: -20px -22px 14px; border-radius: 20px 20px 0 0; }
  .couverture img, .bandeau img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .voile { position: absolute; inset: 0; background: linear-gradient(to bottom, #f6f8ff22, #f6f8ffee 92%); }
  .couverture .voile { background: linear-gradient(to bottom, #101a3a00, #101a3a); }
  .flocons { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .85; }
  .bordure { display: block; width: 100%; height: 8px; margin-top: 14px; border-radius: 4px; }
  footer { color: var(--neige); text-align: center; opacity: .7; padding: 0 20px 40px; }

  /* Impression / « Enregistrer en PDF » : A4, une page de garde, puis une lettre par page avec ses photos. */
  @page { size: A4; margin: 16mm 15mm; }
  @media print {
    body { background: #fff; font-size: 12pt; }
    .imprimer, .astuce { display: none !important; }
    header { color: var(--texte); min-height: 240mm; display: flex; flex-direction: column; justify-content: center; padding: 0; break-after: page; }
    header h1 { font-size: 34pt; color: var(--rouge); }
    header p { font-size: 14pt; }
    main { max-width: none; padding: 0; }
    .lettre { margin: 0; box-shadow: none; border: 1px solid #dde3f3; border-top-width: 8px; break-after: page; }
    .lettre:last-child { break-after: auto; }
    h2, h3 { break-after: avoid; }
    .lettre p { orphans: 3; widows: 3; }
    .photos { grid-template-columns: repeat(2, 1fr); gap: 4mm; }
    .photos img { max-height: 105mm; object-fit: cover; break-inside: avoid; page-break-inside: avoid; }
    .photos:has(img:only-child) { grid-template-columns: 1fr; }
    .photos img:only-child { max-height: 150mm; object-fit: contain; }
    footer { color: var(--texte); padding: 6mm 0 0; font-size: 10pt; break-before: avoid; }
  }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { background: #fff; } header, footer { color: var(--texte); } .couverture .voile { background: linear-gradient(to bottom, #f6f8ff00, #fff); } header.avec-decor h1, header.avec-decor p { color: var(--texte); } h2 { break-after: avoid; } section { box-shadow: none; break-inside: avoid; } }
</style>
</head>
<body>
<header class="${cover ? 'avec-decor' : ''}">
  ${couverture}
  <h1>🎄 Nos souvenirs de l'Avent 2026</h1>
  <p>${couple} : les ${count} cases préparées l'un pour l'autre</p>
  <div><button class="imprimer" type="button" onclick="window.print()">📄 Enregistrer en PDF</button>
  <span class="astuce">Dans la fenêtre qui s'ouvre, choisis « Enregistrer au format PDF » comme imprimante.</span></div>
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
export async function downloadSouvenirs(
  backend: BackendApi,
  filename = "souvenirs-avent-2026.html",
  opts: SouvenirsOptions = {},
): Promise<void> {
  const blob = await exportSouvenirs(backend, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
