import { useEffect, useRef, useState } from "react";
import type { Progress, Who } from "../core/contracts";
import { RaceIndicator, course } from "./RaceIndicator";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
/** Couleurs de texte de la course (assombries : le rouge vif ne tient pas le contraste en 14 px). */
const COULEUR_TEXTE: Record<Who, string> = { alexandre: "#2a5fb4", flavie: "#a3192f" };

export type HudProps = {
  me: Who;
  progress: Record<Who, Progress>;
  /** Nom du monde affiché sous le titre ; `zoneKey` change quand on passe d'un monde à l'autre. */
  zoneName: string;
  zoneKey?: string | number;
  /** Couleur du manteau du joueur, pour sa pastille (ex. "#2f6fd0"). */
  couleur: string;
  demo?: boolean;
  night: boolean;
  /** Case que je peux préparer pour l'autre ; absent = pas de bouton ✏️. */
  nextToWrite?: number | null;
  /** Le 24 et après : bouton 📜 « garder nos souvenirs ». */
  souvenirs?: boolean;
  onEdit: (day: number) => void;
  onToggleNight: () => void;
  onGoToday: () => void;
  onSouvenirs?: () => void;
  onSettings: () => void;
};

/**
 * En-tête de la carte (ticket #51, piste B choisie par Alexandre le 24 nov) :
 * deux îlots crème de même style — à gauche le titre et le nom du monde, à droite une capsule
 * ✏️ ☀️ (📜) ⚙️ et la pastille du joueur, avec la course réduite dessous —
 * et 📍 en bouton flottant en bas à droite.
 * Composant sans état métier : `App.tsx` lui passe les données et les actions.
 */
export function Hud(p: HudProps) {
  const autre: Who = p.me === "alexandre" ? "flavie" : "alexandre";
  const [courseOuverte, setCourseOuverte] = useState(false);
  const courseRef = useRef<HTMLDivElement>(null);

  // la course dépliée se replie au toucher ailleurs ou sur Échap
  useEffect(() => {
    if (!courseOuverte) return;
    const dehors = (e: PointerEvent) => { if (!courseRef.current?.contains(e.target as Node)) setCourseOuverte(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setCourseOuverte(false); };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("pointerdown", dehors); document.removeEventListener("keydown", echap); };
  }, [courseOuverte]);

  const duel = course(p.progress);
  const pastille = !duel ? "Égalité" : duel.tete === p.me ? `Toi +${duel.ecart}` : `${PRENOM[autre]} +${duel.ecart}`;
  const lecteur = !duel
    ? `Course : à égalité avec ${PRENOM[autre]}`
    : duel.tete === p.me
      ? `Course : tu as ${duel.ecart} case${duel.ecart > 1 ? "s" : ""} d'avance sur ${PRENOM[autre]}`
      : `Course : ${PRENOM[autre]} mène de ${duel.ecart}`;

  return (
    <>
      {/* quatre boutons + la pastille ne tiennent pas à côté du titre sur un téléphone :
          ce jour-là (le 24, ✏️ et 📜 ensemble), la pastille du joueur s'efface */}
      <header className={`entete${p.nextToWrite != null && p.souvenirs ? " entete--pleine" : ""}`}>
        <div className="entete-ilot entete-titre">
          <span className="entete-nom">
            Alexandre <span className="entete-et">&</span> Flavie
            {p.demo && <span className="entete-demo entete-demo--large">démo</span>}
          </span>
          <span className="entete-monde" key={p.zoneKey}>
            {p.demo && <span className="entete-demo entete-demo--etroit">démo</span>}
            {p.zoneName}
          </span>
        </div>

        <div className="entete-droite">
          <div className="entete-ilot entete-capsule">
            {p.nextToWrite != null && (
              <button type="button" onClick={() => p.onEdit(p.nextToWrite!)}
                title={`Préparer la case ${p.nextToWrite}`} aria-label={`Préparer la case ${p.nextToWrite} pour ${PRENOM[autre]}`}>✏️</button>
            )}
            <button type="button" onClick={p.onToggleNight}
              title={p.night ? "Passer en jour" : "Passer en nuit"} aria-label={p.night ? "Passer en jour" : "Passer en nuit"}>{p.night ? "🌙" : "☀️"}</button>
            {p.souvenirs && (
              <button type="button" onClick={p.onSouvenirs} title="Garder nos souvenirs" aria-label="Télécharger nos lettres et nos photos">📜</button>
            )}
            <button type="button" onClick={p.onSettings} title="Réglages" aria-label="Réglages">⚙️</button>
            <span className="entete-avatar" style={{ background: p.couleur }} title={PRENOM[p.me]}>
              <span aria-hidden="true">{PRENOM[p.me][0]}</span>
              <span className="pour-lecteurs">Connecté : {PRENOM[p.me]}</span>
            </span>
          </div>

          <div className="entete-course" ref={courseRef}>
            <button type="button" className="entete-ilot entete-pastille" aria-expanded={courseOuverte} aria-label={lecteur}
              style={{ color: duel ? COULEUR_TEXTE[duel.tete] : undefined }} onClick={() => setCourseOuverte(!courseOuverte)}>
              <span aria-hidden="true">🏁</span> {pastille} <span className="entete-chevron" aria-hidden="true">{courseOuverte ? "▴" : "▾"}</span>
            </button>
            {courseOuverte && <div className="entete-course-detail"><RaceIndicator me={p.me} progress={p.progress} /></div>}
          </div>
        </div>
      </header>

      <button type="button" className="entete-ilot entete-boussole" onClick={p.onGoToday}
        title="Aller à aujourd'hui" aria-label="Aller à la case du jour">📍</button>
    </>
  );
}
