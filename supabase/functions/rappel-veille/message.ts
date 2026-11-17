// Texte des notifications de rappel (signé Pingou). Fichier sans dépendance : testable avec Node.

export type Who = "alexandre" | "flavie";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const AUTRE: Record<Who, string> = { alexandre: "Flavie", flavie: "Alexandre" };

/** Notification envoyée la veille au soir à l'auteur d'une case préparée encore vide. */
export function reminderMessage(day: number, who: Who) {
  const final = day === 24;
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
