// Texte des notifications de rappel (signé Pingou). Fichier sans dépendance : testable avec Node.

export type Who = "alexandre" | "flavie";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const AUTRE: Record<Who, string> = { alexandre: "Flavie", flavie: "Alexandre" };

export type Kind = "rappel" | "relance";

/** Prénoms du salon (reminder_targets) ; à défaut, ceux du premier salon. */
export type Noms = { prenom?: string | null; autre?: string | null; salonId?: string | null };

/**
 * Notification envoyée la veille au soir à l'auteur d'une case préparée encore vide :
 * « rappel » à 20 h (texte validé par Alexandre), « relance » à 22 h 30 si c'est toujours vide.
 */
export function reminderMessage(day: number, who: Who, kind: Kind = "rappel", noms: Noms = {}) {
  const final = day === 24;
  const autre = noms.autre?.trim() || AUTRE[who];
  const moi = noms.prenom?.trim() || PRENOM[who];
  // Le lien rouvre le bon salon (le site retient le dernier, mais un appareil peut en connaître plusieurs)
  const path = noms.salonId ? `./?salon=${encodeURIComponent(noms.salonId)}&case=${day}` : `./?case=${day}`;
  if (kind === "relance") {
    return {
      title: "🐧 Toc toc… Pingou insiste (gentiment)",
      body: final
        ? `La toute dernière case est toujours vide, et ${autre} l'ouvre demain à 7 h ! Il te reste ce soir pour lui préparer une dernière surprise 🎄💌`
        : `La case ${day} est toujours vide, et ${autre} l'ouvre demain à 7 h ! Il te reste ce soir : deux lignes et une photo, et je file me coucher 💤💌`,
      day,
      path,
      to: moi,
    };
  }
  return {
    title: final ? "🐧 Psst… c'est la dernière !" : "🐧 Psst… petit rappel de Pingou",
    body: final
      ? `Demain c'est la case 24, la toute dernière, et elle est encore vide ! ${autre} l'ouvrira à 7 h 🎄`
      : `Psst… demain c'est la case ${day}, et elle est encore vide ! ${autre} l'ouvrira à 7 h. Un mot doux et une photo, ça suffit 💌`,
    day,
    path,
    to: moi,
  };
}
