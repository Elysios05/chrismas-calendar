// Adresse du site affichée sur la carte de fin de TOUTES les vidéos (une seule source).
//
// - Vide ("") : aucune adresse, la carte de fin dit seulement « Lien en bio 👆 » (défaut, en attendant le
//   choix d'un nom de domaine par Alexandre).
// - Sinon, ex. "notre-calendrier.fr" ou "elysios05.github.io/chrismas-calendar" : l'adresse est affichée
//   (coupée après le premier « / » si elle en a un), avec « (lien en bio) » dessous.
//
// Pour un seul rendu sans toucher à ce fichier : LIEN_SITE=notre-calendrier.fr npm run rendre
// (rendre.mjs passe alors l'adresse aux compositions par --props, qui l'emporte sur la valeur ci-dessous).
import { getInputProps } from "remotion";

export const LIEN_PAR_DEFAUT = "";

/** L'adresse à afficher ("" = aucune) : --props {"lien": …} de rendre.mjs, sinon LIEN_PAR_DEFAUT. */
export const lienSite = (): string => {
  const p = getInputProps() as { lien?: unknown };
  return typeof p.lien === "string" ? p.lien.trim() : LIEN_PAR_DEFAUT;
};
