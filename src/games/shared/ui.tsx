/**
 * Composants partagés par les jeux : cadre, barre de score, écran de règles, écran de fin.
 * Ces composants n'appartiennent qu'à l'équipe Jeux ; l'interface générale est dans src/ui/.
 */

import type { ReactNode } from "react";
import "./games.css";

/* ---------- cadre ---------- */

export function Cadre({ titre, barre, children }: { titre: string; barre?: ReactNode; children: ReactNode }) {
  return (
    <div className="jeu">
      <div className="jeu-barre">
        <span className="jeu-titre">{titre}</span>
        <span className="jeu-spacer" />
        {barre}
      </div>
      <div className="jeu-corps">{children}</div>
    </div>
  );
}

/* ---------- panneaux ---------- */

export function PanneauRegles({
  emoji, titre, regles, bouton = "C'est parti !", onJouer, secondaire,
}: {
  emoji: string; titre: string; regles: string[]; bouton?: string;
  onJouer: () => void; secondaire?: { texte: string; onClic: () => void };
}) {
  return (
    <div className="jeu-centre">
      <div className="jeu-panneau">
        <div className="emoji">{emoji}</div>
        <h2>{titre}</h2>
        <ul>{regles.map((r) => <li key={r}>{r}</li>)}</ul>
        <div className="jeu-actions">
          {secondaire && <button className="jeu-btn clair" onClick={secondaire.onClic}>{secondaire.texte}</button>}
          <button className="jeu-btn" onClick={onJouer}>{bouton}</button>
        </div>
      </div>
    </div>
  );
}

export function PanneauFin({
  emoji, titre, score, uniteScore, mots, comparaison, actions,
}: {
  emoji: string; titre: string;
  score?: number; uniteScore?: string;
  mots?: string;
  /** « Toi 1 240 / Flavie 980 » */
  comparaison?: { label: string; valeur: string }[];
  actions: { texte: string; onClic: () => void; clair?: boolean }[];
}) {
  return (
    <div className="jeu-centre">
      <div className="jeu-panneau">
        <div className="emoji">{emoji}</div>
        <h2>{titre}</h2>
        {score !== undefined && (
          <>
            <div className="jeu-score">{score.toLocaleString("fr-FR")}</div>
            {uniteScore && <div className="jeu-score-note">{uniteScore}</div>}
          </>
        )}
        {comparaison && (
          <div className="jeu-compare">
            {comparaison.map((c) => <div key={c.label}><span>{c.label}</span><b>{c.valeur}</b></div>)}
          </div>
        )}
        {mots && <p>{mots}</p>}
        <div className="jeu-actions">
          {actions.map((a) => (
            <button key={a.texte} className={a.clair ? "jeu-btn clair" : "jeu-btn"} onClick={a.onClic}>{a.texte}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- petits éléments de barre ---------- */

export function Puce({ children, pale }: { children: ReactNode; pale?: boolean }) {
  return <span className={pale ? "jeu-chip pale" : "jeu-chip"}>{children}</span>;
}

export function Vies({ restantes, total }: { restantes: number; total: number }) {
  return (
    <span className="jeu-chip jeu-vies" aria-label={`${restantes} chocs restants sur ${total}`}>
      {"❤️".repeat(Math.max(0, restantes))}{"🤍".repeat(Math.max(0, total - restantes))}
    </span>
  );
}

/** Points de progression : « on » = question courante, « bon »/« rate » = déjà répondue */
export function Points({ etats }: { etats: ("vide" | "on" | "bon" | "rate")[] }) {
  return (
    <div className="jeu-points">
      {etats.map((e, i) => <i key={i} className={e === "vide" ? "" : e} />)}
    </div>
  );
}

/** Barre de progression (0 → 1), par exemple la descente */
export function Progres({ part }: { part: number }) {
  return <div className="jeu-progres"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%` }} /></div>;
}

export function Flash({ texte, cle }: { texte: string; cle: number }) {
  return <div className="jeu-flash" key={cle}>{texte}</div>;
}
