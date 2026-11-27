/**
 * Atelier des jeux (page de test de l'équipe Jeux) : http://localhost:5173/jeux.html
 * Permet de lancer un jeu sans attendre le monde, le backend ni l'interface.
 * Ne fait pas partie du site livré (seul index.html est construit).
 */

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { silentSound } from "../../core/silent";
import { DemoBackend } from "../../backend";
import type { GameResult, SoundApi, Who } from "../../core/contracts";
import { joursAvecJeu } from "../registry";
import { FenetreJeu } from "../lanceur";
import { CONTENU_ABIME, CONTENU_PERSO, PRENOMS_TEST } from "./contenu-test";
import type { ContenuSalon } from "../../core/contracts";
import "../../index.css";
import "./atelier.css";

const sonMuet: SoundApi = silentSound;

/**
 * Contenu personnel d'Alexandre et Flavie : jamais dans le dépôt public (il est dans leur salon Supabase).
 * Si `prive/contenu-alexandre-flavie.json` existe sur ta machine (dossier ignoré par git), l'atelier le
 * propose sous « A & F » ; sinon le bouton n'apparaît pas.
 */
const PRIVES = import.meta.glob<ContenuSalon>("../../../prive/contenu-alexandre-flavie.json", { eager: true, import: "default" });
const CONTENU_PRIVE: ContenuSalon | undefined = Object.values(PRIVES)[0];

/** Efface ce que le mode démo a enregistré (scores, réponses, progression) */
function viderDemo() {
  try {
    for (const c of Object.keys(localStorage)) if (c.startsWith("cc-demo:")) localStorage.removeItem(c);
    for (const c of Object.keys(sessionStorage)) if (c.startsWith("cc-demo:")) sessionStorage.removeItem(c);
  } catch { /* stockage indisponible */ }
}

function Atelier() {
  const [jour, setJour] = useState(() => Number(new URLSearchParams(location.search).get("jour")) || 1);
  const [qui, setQui] = useState<Who>("alexandre");
  /** Salon simulé : contenu par défaut (générique), celui d'Alexandre et Flavie (fichier privé local), personnalisé (prénoms Camille et Sam) ou abîmé */
  const [salon, setSalon] = useState<"defaut" | "af" | "perso" | "abime">(() => {
    const s = new URLSearchParams(location.search).get("salon");
    return (s === "af" && CONTENU_PRIVE) || s === "perso" || s === "abime" ? s : "defaut";
  });
  const prenoms = salon === "perso" ? PRENOMS_TEST : { alexandre: "Alexandre", flavie: "Flavie" };
  const contenu = salon === "af" ? CONTENU_PRIVE?.[String(jour)] : salon === "perso" ? CONTENU_PERSO[jour] : salon === "abime" ? CONTENU_ABIME[jour] : undefined;
  const [pingou, setPingou] = useState<string[]>([]);
  const [resultat, setResultat] = useState<GameResult | null>(null);
  const [cle, setCle] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  // le vrai mode démo de l'équipe Backend, pas un faux backend à nous
  const backend = useMemo(() => new DemoBackend(), []);

  // les jeux ont besoin d'un joueur connecté (DemoBackend accepte n'importe quel mot de passe)
  useEffect(() => {
    let annule = false;
    setOuvert(false);
    void backend.signIn(qui, "atelier").then(() => { if (!annule) setOuvert(true); });
    return () => { annule = true; };
  }, [backend, qui, cle]);

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
          <button key={w} className={w === qui ? "on" : ""} onClick={() => relancer(() => setQui(w))}>{prenoms[w]}</button>
        ))}
        <span>Salon</span>
        {(["defaut", "af", "perso", "abime"] as const).filter((x) => x !== "af" || CONTENU_PRIVE).map((x) => (
          <button key={x} className={x === salon ? "on" : ""} onClick={() => relancer(() => setSalon(x))}>{x === "defaut" ? "défaut" : x === "af" ? "A & F" : x === "perso" ? "perso" : "abîmé"}</button>
        ))}
        <button onClick={() => relancer(() => setCle((c) => c + 1))}>Relancer</button>
        <button onClick={() => relancer(() => { viderDemo(); setCle((c) => c + 1); })}>Effacer les scores</button>
        {resultat && <em>terminé · score {resultat.score ?? "—"}</em>}
      </div>
      <div className="atelier-ecran">
        <div className="atelier-jeu">
          {ouvert && (
            <FenetreJeu
              key={`${jour}-${qui}-${cle}-${salon}`}
              jour={jour}
              moi={qui}
              backend={backend}
              sound={sonMuet}
              say={setPingou}
              contenu={contenu}
              prenoms={prenoms}
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
