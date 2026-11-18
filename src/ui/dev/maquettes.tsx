/**
 * Page de maquettes de l'équipe Interface (outil de travail, pas livrée au public).
 * `npm run dev` puis http://localhost:5173/maquettes.html?vue=connexion
 * Vues : connexion · connexion-erreur · case-intro · case-jeu · case-fini · lettre
 *         editeur · editeur-vide · rappel · course · reglages · final · pingou
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { GameModule } from "../../core/contracts";
import { LoginScreen } from "../LoginScreen";
import { DayWindow } from "../DayWindow";
import { PreparedEditor, RappelVeille } from "../PreparedEditor";
import { RaceIndicator } from "../RaceIndicator";
import { Settings } from "../Settings";
import { FinalScreen } from "../FinalScreen";
import { MascotDialog, PenguinPortrait } from "../Mascot";
import type { Expression } from "../pingou/lines";
import { DemoBackend } from "../../backend";
import "../../index.css";

// le vrai mode démo, celui qu'utilise l'application publique : plus de faux backend d'atelier.
// Les maquettes se règlent par l'URL, comme l'application : ?jour=N&moi=flavie&rappels=off…
const backend = new DemoBackend();

/** Faux jeu, juste pour montrer la zone de jeu dans la fenêtre d'une case. */
const fauxJeu: GameModule = {
  id: "faux",
  title: "Quiz de démonstration",
  mount(el, ctx) {
    el.innerHTML = `
      <p class="demo-q">Quel est mon plat préféré ?</p>
      <div class="demo-reponses">
        <button class="btn ghost">Les gnocchis</button>
        <button class="btn ghost">La raclette</button>
        <button class="btn ghost">Les sushis</button>
      </div>
      <p class="demo-pas">Question 2 sur 8</p>`;
    const boutons = [...el.querySelectorAll("button")];
    const onClick = () => ctx.complete({ success: true, score: 7 });
    boutons.forEach((b) => b.addEventListener("click", onClick));
    return () => boutons.forEach((b) => b.removeEventListener("click", onClick));
  },
};

const EXPRESSIONS: { face: Expression; nom: string }[] = [
  { face: "neutre", nom: "neutre" },
  { face: "content", nom: "content" },
  { face: "surpris", nom: "surpris" },
  { face: "triste", nom: "triste" },
  { face: "clin", nom: "clin d'œil" },
];

function Maquettes() {
  const vue = new URLSearchParams(location.search).get("vue") ?? "connexion";
  const [lines, setLines] = useState([
    { text: "Case 12 ouverte. Flavie a déjà fait 1 400 points, au cas où.", face: "clin" as Expression },
  ]);

  if (vue === "connexion" || vue === "connexion-erreur") {
    return <LoginScreen backend={backend} />;
  }

  if (vue === "editeur" || vue === "editeur-vide") {
    // ?vue=editeur-vide : on passe par ?vide=1, la démo part alors d'une case préparée vierge
    const b = backend;
    return (
      <div className="maq-monde maq-centre">
        <div className="maq-feuille">
          <PreparedEditor day={16} me="alexandre" backend={b} onClose={() => {}} />
        </div>
      </div>
    );
  }

  if (vue === "rappel") {
    return (
      <div className="maq-monde maq-centre">
        <div className="maq-rappel">
          <RappelVeille jour={16} partenaire="flavie" onOuvrir={() => {}} />
        </div>
      </div>
    );
  }

  if (vue === "final") {
    const tout = Array.from({ length: 24 }, (_, i) => i + 1);
    return (
      <FinalScreen
        me="alexandre"
        progress={{
          alexandre: { opened: tout, completed: tout },
          flavie: { opened: tout, completed: tout.filter((d) => d !== 15) },
        }}
        onRevoir={() => {}}
        onFermer={() => {}}
      />
    );
  }

  if (vue === "course") {
    const progress = {
      alexandre: { opened: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], completed: [] },
      flavie: { opened: [1, 2, 3, 4, 5, 6, 7, 8, 9], completed: [] },
    };
    return (
      <div className="maq-monde maq-centre">
        <div className="maq-course">
          <RaceIndicator me="alexandre" progress={progress} />
          <RaceIndicator me="flavie" progress={progress} compact />
        </div>
      </div>
    );
  }

  if (vue === "reglages") {
    return (
      <div className="maq-monde">
        <Settings me="alexandre" backend={backend} onClose={() => {}} />
      </div>
    );
  }

  if (vue === "pingou") {
    return (
      <div className="maq-pingou">
        <h1>Pingou — expressions</h1>
        <div className="maq-faces">
          {EXPRESSIONS.map((e) => (
            <figure key={e.face}>
              <PenguinPortrait size={110} expression={e.face} />
              <figcaption>{e.nom}</figcaption>
            </figure>
          ))}
        </div>
        <MascotDialog lines={lines} variant="inline" onDone={() => setLines(lines)} />
      </div>
    );
  }

  // la case préparée (12) pour l'intro et la lettre, une case de jeu (1) pour le jeu et la fin
  return (
    <div className="maq-monde">
      <DayWindow
        day={vue === "case-intro" || vue === "lettre" ? 12 : 1}
        me="alexandre"
        backend={backend}
        game={fauxJeu}
        dejaTerminee={vue === "case-fini"}
        onClose={() => {}}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Maquettes /></StrictMode>);
