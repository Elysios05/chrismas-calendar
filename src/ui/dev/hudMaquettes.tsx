/**
 * Maquettes de l'en-tête (ticket #51) — trois pistes à montrer à Alexandre avant de coder.
 * `maquettes.html?vue=hud-a` · `hud-b` · `hud-c` ; ajouter `&ouvert=1` pour montrer le menu
 * ou la course dépliée, `&nuit=1` pour la version de nuit.
 * Rien ici n'est branché : ce sont des images qui bougent un peu, pas l'en-tête livré.
 */
import { useState } from "react";
import type { Progress, Who } from "../../core/contracts";
import { RaceIndicator, course } from "../RaceIndicator";
import "./hud-maquettes.css";

const progress: Record<Who, Progress> = {
  alexandre: { opened: [1, 2, 3, 4, 5, 6], completed: [] },
  flavie: { opened: [1, 2, 3, 4, 5, 6, 7], completed: [] },
};
const me: Who = "alexandre";
const MONDE = "La Forêt et le Lac gelé";

/** La course réduite à une pastille, qui se déplie au toucher. */
function PastilleCourse({ ouverte, onToggle }: { ouverte: boolean; onToggle: () => void }) {
  const duel = course(progress);
  const texte = !duel ? "Égalité" : duel.tete === me ? `Toi +${duel.ecart}` : `Flavie +${duel.ecart}`;
  const couleur = !duel ? "var(--ink)" : duel.tete === "flavie" ? "#a3192f" : "#2a5fb4";
  return (
    <div className="hm-course">
      <button className="hm-pastille" style={{ color: couleur }} aria-expanded={ouverte} onClick={onToggle}>
        <span aria-hidden="true">🏁</span> {texte} <span className="hm-chevron" aria-hidden="true">{ouverte ? "▴" : "▾"}</span>
      </button>
      {ouverte && <div className="hm-course-detail"><RaceIndicator me={me} progress={progress} /></div>}
    </div>
  );
}

/** 📍 flottant en bas à droite (commun aux trois pistes, sauf C où il est dans la barre). */
const Boussole = () => <button className="hm-flottant" aria-label="Aller à la case du jour">📍</button>;

/** A — une seule barre crème : titre · monde · menu ☰ qui regroupe tout. */
function PisteA({ ouvert }: { ouvert: boolean }) {
  const [menu, setMenu] = useState(ouvert);
  const [detail, setDetail] = useState(false);
  return (
    <>
      <header className="hm-barre">
        <span className="hm-titre">Alexandre <span className="hm-et">&</span> Flavie</span>
        <span className="hm-monde">{MONDE}</span>
        <button className="hm-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <span className="hm-avatar" style={{ background: "#2f6fd0" }}>A</span>
          <span aria-hidden="true">☰</span>
        </button>
        {menu && (
          <div className="hm-deroulant" role="menu">
            <p className="hm-deroulant-qui">Connecté : <b>Alexandre</b></p>
            <button role="menuitem">✏️ Préparer la case 16</button>
            <button role="menuitem">🌙 Passer en nuit</button>
            <button role="menuitem">⚙️ Réglages</button>
          </div>
        )}
      </header>
      <div className="hm-sous-barre"><PastilleCourse ouverte={detail} onToggle={() => setDetail(!detail)} /></div>
      <Boussole />
    </>
  );
}

/** B — deux îlots : à gauche titre + monde, à droite une capsule de boutons + l'avatar. */
function PisteB({ ouvert }: { ouvert: boolean }) {
  const [detail, setDetail] = useState(ouvert);
  return (
    <>
      <header className="hm-ilots">
        <div className="hm-ilot hm-ilot-titre">
          <span className="hm-titre">Alexandre <span className="hm-et">&</span> Flavie</span>
          <span className="hm-monde-sous">{MONDE}</span>
        </div>
        <div className="hm-droite">
          <div className="hm-ilot hm-capsule">
            <button aria-label="Préparer la case 16">✏️</button>
            <button aria-label="Basculer jour / nuit">☀️</button>
            <button aria-label="Réglages">⚙️</button>
            <span className="hm-avatar hm-avatar-grand" style={{ background: "#2f6fd0" }} title="Alexandre">A</span>
          </div>
          <PastilleCourse ouverte={detail} onToggle={() => setDetail(!detail)} />
        </div>
      </header>
      <Boussole />
    </>
  );
}

/** C — façon jeu mobile : en haut seulement le monde et la course, les actions dans une barre en bas. */
function PisteC({ ouvert }: { ouvert: boolean }) {
  const [detail, setDetail] = useState(ouvert);
  return (
    <>
      <header className="hm-haut-c">
        <div className="hm-ilot hm-ilot-titre hm-centre">
          <span className="hm-titre">Alexandre <span className="hm-et">&</span> Flavie</span>
          <span className="hm-monde-sous">{MONDE}</span>
        </div>
        <PastilleCourse ouverte={detail} onToggle={() => setDetail(!detail)} />
      </header>
      <nav className="hm-dock">
        <button><span>✏️</span>Préparer</button>
        <button><span>☀️</span>Nuit</button>
        <button className="hm-dock-centre"><span>📍</span>Aujourd'hui</button>
        <button><span>⚙️</span>Réglages</button>
        <button><span className="hm-avatar" style={{ background: "#2f6fd0" }}>A</span>Moi</button>
      </nav>
    </>
  );
}

export function HudMaquette({ piste }: { piste: "a" | "b" | "c" }) {
  const q = new URLSearchParams(location.search);
  const ouvert = q.has("ouvert");
  if (q.has("nuit")) document.documentElement.dataset.nuit = "oui";
  return (
    <div className="hm-fond">
      {piste === "a" && <PisteA ouvert={ouvert} />}
      {piste === "b" && <PisteB ouvert={ouvert} />}
      {piste === "c" && <PisteC ouvert={ouvert} />}
    </div>
  );
}
