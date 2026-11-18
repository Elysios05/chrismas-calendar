/**
 * Correction tolérante des réponses tapées (rébus du jour 7, réutilisable ailleurs).
 * On compare des formes « nues » : sans accents, sans majuscules, sans article,
 * sans ponctuation ni espaces en trop. « Buche de noel » = « la bûche de Noël ».
 */

const ARTICLES = ["le", "la", "les", "l", "un", "une", "des", "du", "de la", "de l", "au", "aux", "mon", "ma", "mes", "notre", "nos"];

/** Minuscules, sans accents, ponctuation et apostrophes changées en espaces, espaces compactés */
export function nue(texte: string): string {
  return texte
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`\-–—_.,;:!?()«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Enlève un article en tête : « la buche de noel » → « buche de noel » */
function sansArticle(t: string): string {
  for (const a of ARTICLES) if (t === a || t.startsWith(a + " ")) return t.slice(a.length).trim();
  return t;
}

const formes = (t: string) => { const n = nue(t); return new Set([n, sansArticle(n)]); };

/** Vrai si la saisie correspond à la réponse ou à l'une de ses variantes */
export function bonneReponse(saisie: string, reponse: string, variantes: string[] = []): boolean {
  const dites = formes(saisie);
  if ([...dites].every((d) => d.length === 0)) return false;
  for (const attendue of [reponse, ...variantes]) {
    for (const f of formes(attendue)) if (dites.has(f)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Affichage « à trous » : on voit la forme de la réponse              */
/* ------------------------------------------------------------------ */

const EST_LETTRE = (c: string) => /\p{L}|\p{N}/u.test(c);

/** Positions des lettres dans la réponse (les espaces et apostrophes restent visibles) */
export function positionsLettres(reponse: string): number[] {
  const p: number[] = [];
  for (let i = 0; i < reponse.length; i++) if (EST_LETTRE(reponse[i])) p.push(i);
  return p;
}

/** La réponse avec des points à la place des lettres non révélées */
export function masquer(reponse: string, revelees: Set<number>): string {
  let out = "";
  for (let i = 0; i < reponse.length; i++) {
    const c = reponse[i];
    out += EST_LETTRE(c) ? (revelees.has(i) ? c : "•") : c;
  }
  return out;
}

/** Prochaine lettre à révéler (de gauche à droite), ou null s'il n'en reste pas */
export function prochaineLettre(reponse: string, revelees: Set<number>): number | null {
  for (const i of positionsLettres(reponse)) if (!revelees.has(i)) return i;
  return null;
}
