/**
 * Page de maquettes de l'équipe Interface (outil de travail, pas livrée au public).
 * `npm run dev` puis http://localhost:5173/maquettes.html?vue=connexion
 * Vues : connexion (+ &erreur=mdp|reseau|compte pour simuler un échec) · connexion-erreur · case-intro · case-jeu · case-fini · lettre
 *         editeur · editeur-vide · rappel · course · reglages · final · pingou
 *         hud-a · hud-b · hud-c (pistes de l'en-tête, #51 ; &ouvert=1, &nuit=1)
 *         entete (le vrai <Hud />, piste B ; &nuit=1, &egalite=1, &j24=1)
 *         salon-a · salon-b · salon-c (pistes des salons, #84 ; &ecran=accueil|assistant|lien|invitation)
 *         reglages-salon (réglages du salon Sam & Camille, Camille pas encore arrivée)
 *         creer (le vrai assistant des salons, piste B) · invitation (crée un salon fictif Sam & Camille puis ouvre son lien)
 */
import { StrictMode, useEffect, useState } from "react";
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
import { HudMaquette } from "./hudMaquettes";
import { Hud } from "../Hud";
import { SalonMaquette, type Ecran } from "./salonMaquettes";
import { CreerSalon } from "../salons/CreerSalon";
import { Invitation } from "../salons/Invitation";
import { ReglagesSalon } from "../salons/ReglagesSalon";
import { PLAYERS } from "../../world/actors";
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

/** Erreurs telles que `SupabaseBackend.signIn` les renvoie (ticket #75). */
const ECHECS: Record<string, string> = {
  mdp: "Mot de passe incorrect.",
  reseau: "Failed to fetch",
  compte: "Ce compte n'est pas relié à alexandre (table profiles).",
};

/** Crée un salon fictif Sam & Camille dans le DemoBackend (Sam connecté, Camille pas encore arrivée). */
async function creerSamEtCamille() {
  const c = (w: "alexandre" | "flavie") => {
    const { coat, hat, pompom, hair, longHair } = PLAYERS[w];
    return { coat, hat, pompom, hair, longHair };
  };
  const cree = await backend.salons!.creerSalon({
    motDePasse: "flocon",
    config: { joueurs: { alexandre: { prenom: "Sam", couleurs: c("alexandre") }, flavie: { prenom: "Camille", couleurs: c("flavie") } }, contenu: {} },
  });
  return cree;
}

/** Crée le salon fictif puis recharge la page avec son lien d'invitation. */
async function inviterSamEtCamille() {
  const cree = await creerSamEtCamille();
  const jeton = new URL(cree.lienInvitation, location.href).searchParams.get("invitation");
  location.replace(`${location.pathname}?vue=invitation&invitation=${jeton}`);
}

let samEtCamille: Promise<unknown> | undefined;
/** Réglages du salon sur un salon Sam & Camille tout neuf (`?vue=reglages-salon`). */
function MaquetteReglagesSalon() {
  const [pret, setPret] = useState(false);
  // une seule création, même si StrictMode lance l'effet deux fois
  useEffect(() => { void (samEtCamille ??= creerSamEtCamille()).then(() => setPret(true)); }, []);
  if (!pret) return null;
  return <div className="maq-monde"><ReglagesSalon backend={backend} me="alexandre" onFermer={() => alert("→ les réglages")} /></div>;
}

function Maquettes() {
  const vue = new URLSearchParams(location.search).get("vue") ?? "connexion";
  const [ouverte, setOuverte] = useState(true);
  const [lines, setLines] = useState([
    { text: "Case 12 ouverte. Flavie a déjà fait 1 400 points, au cas où.", face: "clin" as Expression },
  ]);

  if (vue === "hud-a" || vue === "hud-b" || vue === "hud-c") {
    return <HudMaquette piste={vue.slice(4) as "a" | "b" | "c"} />;
  }

  if (vue === "creer") {
    return <CreerSalon backend={backend} onOuvrir={() => alert("→ le calendrier")} onDemo={() => alert("→ la démo")} />;
  }
  if (vue === "invitation") {
    if (!new URLSearchParams(location.search).has("invitation")) void inviterSamEtCamille();
    else return <Invitation backend={backend} onEntree={() => alert("→ le calendrier")} onConnexion={() => alert("→ la connexion")} />;
    return null;
  }
  if (vue === "reglages-salon") {
    return <MaquetteReglagesSalon />;
  }
  if (vue.startsWith("salon-")) {
    const ecran = (new URLSearchParams(location.search).get("ecran") ?? "accueil") as Ecran;
    return <SalonMaquette piste={vue.slice(6)} ecran={ecran} />;
  }
  if (vue === "entete") {
    const q = new URLSearchParams(location.search);
    const nuit = q.has("nuit");
    if (nuit) document.documentElement.dataset.nuit = "oui";
    const six = [1, 2, 3, 4, 5, 6];
    return (
      <div className="hm-fond">
        <Hud
          me="alexandre"
          progress={{ alexandre: { opened: six, completed: [] }, flavie: { opened: q.has("egalite") ? six : [...six, 7], completed: [] } }}
          zoneName="La Forêt et le Lac gelé" zoneKey={2} couleur="#2f6fd0" demo night={nuit}
          nextToWrite={q.has("plein") ? 24 : 16} souvenirs={q.has("j24")}
          onEdit={() => {}} onToggleNight={() => {}} onGoToday={() => {}} onSouvenirs={() => {}} onSettings={() => {}}
        />
      </div>
    );
  }

  if (vue === "connexion" || vue === "connexion-erreur") {
    const echec = ECHECS[new URLSearchParams(location.search).get("erreur") ?? ""];
    if (!echec) return <LoginScreen backend={backend} />;
    // même backend démo, mais signIn échoue comme le ferait Supabase
    const enPanne = Object.assign(Object.create(backend), { signIn: async () => { throw new Error(echec); } });
    return <LoginScreen backend={enPanne} />;
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
  if (!ouverte) return <div className="maq-monde" />;
  return (
    <div className="maq-monde">
      <DayWindow
        day={vue === "case-intro" || vue === "lettre" ? 12 : 1}
        me="alexandre"
        backend={backend}
        game={fauxJeu}
        dejaTerminee={vue === "case-fini"}
        onClose={() => setOuverte(false)}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Maquettes /></StrictMode>);
