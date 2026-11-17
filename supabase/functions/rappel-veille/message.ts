// Texte des notifications de rappel (signé Pingou). Fichier sans dépendance : testable avec Node.

export type Who = "alexandre" | "flavie";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const AUTRE: Record<Who, string> = { alexandre: "Flavie", flavie: "Alexandre" };

export type Kind = "rappel" | "relance";

/**
 * Notification envoyée la veille au soir à l'auteur d'une case préparée encore vide :
 * « rappel » à 20 h (texte validé par Alexandre), « relance » à 22 h 30 si c'est toujours vide.
 */
export function reminderMessage(day: number, who: Who, kind: Kind = "rappel") {
  const final = day === 24;
  if (kind === "relance") {
    return {
      title: "🐧 Toc toc… Pingou insiste (gentiment)",
      body: final
        ? `La toute dernière case est toujours vide, et ${AUTRE[who]} l'ouvre demain à 7 h ! Il te reste ce soir pour lui préparer une dernière surprise 🎄💌`
        : `La case ${day} est toujours vide, et ${AUTRE[who]} l'ouvre demain à 7 h ! Il te reste ce soir : deux lignes et une photo, et je file me coucher 💤💌`,
      day,
      path: `./?case=${day}`,
      to: PRENOM[who],
    };
  }
  return {
    title: final ? "🐧 Psst… c'est la dernière !" : "🐧 Psst… petit rappel de Pingou",
    body: final
      ? `Demain c'est la case 24, la toute dernière, et elle est encore vide ! ${AUTRE[who]} l'ouvrira à 7 h 🎄`
      : `Psst… demain c'est la case ${day}, et elle est encore vide ! ${AUTRE[who]} l'ouvrira à 7 h. Un mot doux et une photo, ça suffit 💌`,
    day,
    path: `./?case=${day}`,
    to: PRENOM[who],
  };
}
