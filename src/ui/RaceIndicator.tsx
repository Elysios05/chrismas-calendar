import type { Progress, Who } from "../core/contracts";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const COULEUR: Record<Who, string> = { alexandre: "#2f6fd0", flavie: "#d9354b" };
const TOTAL = 24;

/** Position sur la route = la case ouverte la plus loin. */
export const avancee = (p: Progress) => (p.opened.length ? Math.max(...p.opened) : 0);

/** Qui mène, et de combien. `ecart` est toujours positif ; `null` = égalité. */
export function course(progress: Record<Who, Progress>): { tete: Who; ecart: number } | null {
  const diff = avancee(progress.alexandre) - avancee(progress.flavie);
  if (diff === 0) return null;
  return { tete: diff > 0 ? "alexandre" : "flavie", ecart: Math.abs(diff) };
}

/**
 * Indicateur de la course : deux pastilles qui avancent sur la même route,
 * et une phrase qui dit où en est le duel. Amical, jamais humiliant.
 */
export function RaceIndicator({
  me,
  progress,
  compact = false,
}: {
  me: Who;
  progress: Record<Who, Progress>;
  /** Version réduite pour le bandeau du haut sur téléphone */
  compact?: boolean;
}) {
  const autre: Who = me === "alexandre" ? "flavie" : "alexandre";
  const duel = course(progress);

  const phrase = !duel
    ? `À égalité avec ${PRENOM[autre]}`
    : duel.tete === me
      ? `${duel.ecart} case${duel.ecart > 1 ? "s" : ""} d'avance`
      : `${PRENOM[autre]} mène de ${duel.ecart}`;

  // deux couloirs séparés : les pions ne se marchent jamais dessus, même à une case près
  return (
    <div className={`course${compact ? " course--compact" : ""}`}>
      <p className="course-phrase">{phrase}</p>
      <div className="course-couloirs">
        {[me, autre].map((w) => {
          const jour = avancee(progress[w]);
          return (
            <div key={w} className="course-couloir" style={{ ["--c" as string]: COULEUR[w] }}>
              <span className="course-nom">{w === me ? "Toi" : PRENOM[w]}</span>
              <span className="course-rail">
                <span className="course-avance" style={{ width: `${(jour / TOTAL) * 100}%` }} />
              </span>
              <span className="course-jour">{jour}</span>
              <span className="course-lecture">{PRENOM[w]} : case {jour} sur {TOTAL}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
