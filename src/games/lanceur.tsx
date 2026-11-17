/**
 * Lanceur de jeu : la seule chose dont `src/App.tsx` a besoin pour ouvrir un jeu.
 * Il s'occupe du chargement, du contexte, du montage, du nettoyage et de la fenêtre.
 *
 * Côté App.tsx, ça tient en une ligne :
 *
 *   {jeuOuvert && (
 *     <FenetreJeu
 *       jour={jeuOuvert} moi={who} backend={backend} sound={sound}
 *       say={setLines}
 *       onTermine={(r) => { ... marquer la case faite, afficher le score ... }}
 *       onFermer={() => setJeuOuvert(null)}
 *     />
 *   )}
 *
 * `onTermine` est appelé quand le joueur quitte le jeu depuis l'écran de fin
 * (le jeu a déjà appelé `backend.markCompleted` de son côté) ; `onFermer` suit
 * toujours, qu'on sorte par la fin du jeu ou par la croix.
 */

import { useEffect, useRef, useState } from "react";
import type { BackendApi, DayNumber, GameContext, GameResult, SoundApi, Who } from "../core/contracts";
import { chargerJeu, contenuDuJour } from "./registry";
import "./shared/games.css";

export type ProprietesFenetreJeu = {
  jour: DayNumber;
  moi: Who;
  backend: BackendApi;
  sound: SoundApi;
  /** Fait parler Pingou (la bulle appartient à l'interface) */
  say: (lignes: string[]) => void;
  /** Contenu du jeu ; par défaut celui de src/data via le registre */
  contenu?: unknown;
  onTermine?: (resultat: GameResult) => void;
  onFermer: () => void;
};

export function FenetreJeu(p: ProprietesFenetreJeu) {
  const hote = useRef<HTMLDivElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // les props changent pendant la partie (ex. nouvelle fonction `say`) sans devoir remonter le jeu
  const dernieres = useRef(p);
  dernieres.current = p;

  useEffect(() => {
    let annule = false;
    let nettoyer: (() => void) | null = null;
    (async () => {
      const module = await chargerJeu(p.jour);
      if (annule) return;
      if (!module) { setErreur(`Pas encore de jeu pour la case ${p.jour}.`); return; }
      if (!hote.current) return;
      const ctx: GameContext = {
        day: p.jour,
        me: p.moi,
        partner: p.moi === "alexandre" ? "flavie" : "alexandre",
        backend: p.backend,
        sound: p.sound,
        say: (lignes) => dernieres.current.say(lignes),
        content: p.contenu ?? contenuDuJour(p.jour),
        complete: (resultat) => {
          dernieres.current.onTermine?.(resultat);
          dernieres.current.onFermer();
        },
      };
      nettoyer = module.mount(hote.current, ctx);
    })();
    return () => { annule = true; nettoyer?.(); };
    // volontairement monté une seule fois par jour/joueur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.jour, p.moi, p.backend, p.sound]);

  return (
    <div className="jeu-fenetre" role="dialog" aria-label={`Case ${p.jour}`}>
      <button className="jeu-fermer jeu-fenetre-fermer" onClick={p.onFermer} title="Fermer le jeu" aria-label="Fermer le jeu">✕</button>
      <div className="jeu-hote" ref={hote} />
      {erreur && <div className="jeu-centre"><div className="jeu-panneau"><div className="emoji">🚧</div><h2>{erreur}</h2>
        <p>Il arrive bientôt, promis.</p>
        <div className="jeu-actions"><button className="jeu-btn" onClick={p.onFermer}>Fermer</button></div>
      </div></div>}
    </div>
  );
}
