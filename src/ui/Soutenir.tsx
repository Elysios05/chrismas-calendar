/**
 * Ouverture au public, gratuite avec dons (décision d'Alexandre, 27 nov).
 *
 * - `BoutonSoutenir` : « Soutenir le projet ☕ », vers la page de dons d'Alexandre.
 *   Le lien vient de `VITE_LIEN_DON` (.env.local en local, variable GitHub au déploiement) ;
 *   tant qu'il est vide, le bouton n'apparaît nulle part.
 * - `CONTACT` : adresse affichée sur la page Confidentialité (`VITE_CONTACT`), gardée hors du dépôt public.
 */
const lire = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const LIEN_DON = lire(import.meta.env.VITE_LIEN_DON);
export const CONTACT = lire(import.meta.env.VITE_CONTACT);

export function BoutonSoutenir({ className = "btn ghost" }: { className?: string }) {
  if (!LIEN_DON) return null;
  return (
    <a className={`${className} soutenir`} href={LIEN_DON} target="_blank" rel="noopener noreferrer">
      Soutenir le projet ☕
    </a>
  );
}
