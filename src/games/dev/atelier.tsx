/**
 * Atelier des jeux (page de test de l'équipe Jeux) : http://localhost:5173/jeux.html
 * Permet de lancer un jeu sans attendre le monde, le backend ni l'interface.
 * Ne fait pas partie du site livré (seul index.html est construit).
 */

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { GameResult, Sfx, SoundApi, Who, ZoneId } from "../../core/contracts";
import { joursAvecJeu } from "../registry";
import { FenetreJeu } from "../lanceur";
import { creerBackendAtelier, viderAtelier } from "./backendDemo";
import "../../index.css";
import "./atelier.css";

const sonMuet: SoundApi = {
  setEnabled: () => { /* atelier silencieux */ },
  setZone: (_z: ZoneId, _n: boolean) => { /* rien */ },
  setGameMusic: () => { /* rien */ },
  play: (_s: Sfx) => { /* rien */ },
};

function Atelier() {
  const [jour, setJour] = useState(1);
  const [qui, setQui] = useState<Who>("alexandre");
  const [pingou, setPingou] = useState<string[]>([]);
  const [resultat, setResultat] = useState<GameResult | null>(null);
  const [cle, setCle] = useState(0);
  const [ouvert, setOuvert] = useState(true);
  const backend = useMemo(() => creerBackendAtelier(qui), [qui]);

  const relancer = (changer: () => void) => {
    setOuvert(false); setPingou([]); setResultat(null);
    changer();
    requestAnimationFrame(() => setOuvert(true));
  };

  return (
    <div className="atelier">
      <div className="atelier-outils">
        <strong>Atelier jeux</strong>
        <span>Jour</span>
        {joursAvecJeu().map((j) => (
          <button key={j} className={j === jour ? "on" : ""} onClick={() => relancer(() => setJour(j))}>{j}</button>
        ))}
        <span>Joueur</span>
        {(["alexandre", "flavie"] as Who[]).map((w) => (
          <button key={w} className={w === qui ? "on" : ""} onClick={() => relancer(() => setQui(w))}>{w === "alexandre" ? "Alexandre" : "Flavie"}</button>
        ))}
        <button onClick={() => relancer(() => setCle((c) => c + 1))}>Relancer</button>
        <button onClick={() => relancer(() => { viderAtelier(); setCle((c) => c + 1); })}>Effacer les scores</button>
        {resultat && <em>terminé · score {resultat.score ?? "—"}</em>}
      </div>
      <div className="atelier-ecran">
        <div className="atelier-jeu">
          {ouvert && (
            <FenetreJeu
              key={`${jour}-${qui}-${cle}`}
              jour={jour}
              moi={qui}
              backend={backend}
              sound={sonMuet}
              say={setPingou}
              onTermine={setResultat}
              onFermer={() => setOuvert(false)}
            />
          )}
        </div>
      </div>
      {pingou.length > 0 && (
        <div className="atelier-pingou" onClick={() => setPingou([])}>
          <b>Pingou</b>
          {pingou.map((l) => <p key={l}>{l}</p>)}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Atelier />);
