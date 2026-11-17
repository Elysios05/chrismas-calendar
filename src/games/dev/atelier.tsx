/**
 * Atelier des jeux (page de test de l'équipe Jeux) : http://localhost:5173/jeux.html
 * Permet de lancer un jeu sans attendre le monde, le backend ni l'interface.
 * Ne fait pas partie du site livré (seul index.html est construit).
 */

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { GameContext, GameResult, Sfx, SoundApi, Who, ZoneId } from "../../core/contracts";
import { chargerJeu, contenuDuJour, joursAvecJeu } from "../registry";
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
  const hote = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let nettoyer: (() => void) | null = null;
    let annule = false;
    setPingou([]); setResultat(null);
    (async () => {
      const module = await chargerJeu(jour);
      if (annule || !module || !hote.current) return;
      const ctx: GameContext = {
        day: jour,
        me: qui,
        partner: qui === "alexandre" ? "flavie" : "alexandre",
        backend: creerBackendAtelier(qui),
        sound: sonMuet,
        say: (lignes) => setPingou(lignes),
        content: contenuDuJour(jour),
        complete: (r) => setResultat(r),
      };
      nettoyer = module.mount(hote.current, ctx);
    })();
    return () => { annule = true; nettoyer?.(); };
  }, [jour, qui, cle]);

  return (
    <div className="atelier">
      <div className="atelier-outils">
        <strong>Atelier jeux</strong>
        <span>Jour</span>
        {joursAvecJeu().map((j) => (
          <button key={j} className={j === jour ? "on" : ""} onClick={() => setJour(j)}>{j}</button>
        ))}
        <span>Joueur</span>
        {(["alexandre", "flavie"] as Who[]).map((w) => (
          <button key={w} className={w === qui ? "on" : ""} onClick={() => setQui(w)}>{w === "alexandre" ? "Alexandre" : "Flavie"}</button>
        ))}
        <button onClick={() => setCle((c) => c + 1)}>Relancer</button>
        <button onClick={() => { viderAtelier(); setCle((c) => c + 1); }}>Effacer les scores</button>
        {resultat && <em>terminé · score {resultat.score ?? "—"}</em>}
      </div>
      <div className="atelier-ecran">
        <div className="atelier-jeu" ref={hote} />
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
