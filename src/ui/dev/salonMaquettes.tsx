/**
 * Maquettes des écrans des salons (#84) — trois pistes à montrer à Alexandre avant de coder.
 * `maquettes.html?vue=salon-a|salon-b|salon-c&ecran=accueil|assistant|lien|invitation`
 * Rien n'est branché : ce sont des images, pas les écrans livrés.
 *   A « Carte »   : la carte crème de la connexion, un assistant en 4 étapes à points.
 *   B « Pingou »  : Pingou pose une question par écran, comme une conversation.
 *   C « Atelier » : une seule page, les deux personnages en aperçu qui changent en direct.
 */
import { useState } from "react";
import { PenguinPortrait } from "../Mascot";
import "./salon-maquettes.css";

export type Ecran = "accueil" | "assistant" | "lien" | "invitation";

const NUANCIER = ["#2f6fb5", "#d9354b", "#2fa37a", "#f2a516", "#7b4fc4", "#1b2747", "#ffffff"];
const CHEVEUX = ["#2b1a10", "#4a2e1f", "#8a5a2b", "#d8b26a", "#b5502a"];

type Perso = { prenom: string; manteau: string; bonnet: string; pompon: string; cheveux: string; longs: boolean };
const MOI: Perso = { prenom: "Sam", manteau: "#2f6fb5", bonnet: "#1b2747", pompon: "#ffffff", cheveux: "#4a2e1f", longs: false };
const TOI: Perso = { prenom: "Camille", manteau: "#d9354b", bonnet: "#ffffff", pompon: "#d9354b", cheveux: "#8a5a2b", longs: true };
const LIEN = "calendrier.app/i/7KQ2-MX9P";

/** Petit personnage en SVG : juste assez pour voir les couleurs choisies. */
function Personnage({ p, taille = 84 }: { p: Perso; taille?: number }) {
  return (
    <svg width={taille} height={taille * 1.25} viewBox="0 0 80 100" aria-hidden="true">
      <ellipse cx="40" cy="96" rx="22" ry="4" fill="#1b2347" opacity=".15" />
      {p.longs && <path d="M22 40 Q20 66 30 68 L50 68 Q60 66 58 40 Z" fill={p.cheveux} />}
      <path d="M20 94 Q18 60 40 58 Q62 60 60 94 Z" fill={p.manteau} stroke="#1b2747" strokeOpacity=".15" strokeWidth="2" />
      <rect x="36" y="64" width="8" height="28" rx="3" fill="#fff" opacity=".25" />
      <circle cx="40" cy="40" r="17" fill="#f6d2b6" />
      <path d="M23 38 Q24 24 40 23 Q56 24 57 38 Q50 30 40 31 Q30 30 23 38 Z" fill={p.cheveux} />
      <path d="M22 34 Q24 12 40 11 Q56 12 58 34 Z" fill={p.bonnet} stroke="#1b2747" strokeOpacity=".2" strokeWidth="2" />
      <rect x="20" y="30" width="40" height="7" rx="3.5" fill={p.bonnet} stroke="#1b2747" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="40" cy="9" r="6" fill={p.pompon} stroke="#1b2747" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="34" cy="43" r="2" fill="#1b2747" />
      <circle cx="46" cy="43" r="2" fill="#1b2747" />
      <path d="M35 50 Q40 54 45 50" stroke="#1b2747" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="29" cy="48" r="3" fill="#ef8a8a" opacity=".5" />
      <circle cx="51" cy="48" r="3" fill="#ef8a8a" opacity=".5" />
    </svg>
  );
}

function Nuancier({ valeur, couleurs, onChange, nom }: { valeur: string; couleurs: string[]; onChange: (c: string) => void; nom: string }) {
  return (
    <div className="sm-nuancier" role="radiogroup" aria-label={nom}>
      {couleurs.map((c) => (
        <button key={c} role="radio" aria-checked={c === valeur} className={c === valeur ? "on" : ""}
          style={{ background: c }} aria-label={c} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

const Flocons = () => (
  <div className="login-flakes" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <span key={i}>❄</span>)}</div>
);

/* ------------------------------------------------------------------ */
/* Écran d'invitation, commun aux trois pistes (la carte de connexion)  */
/* ------------------------------------------------------------------ */
function Invitation() {
  return (
    <div className="login">
      <Flocons />
      <main className="login-card">
        <div className="login-portrait"><PenguinPortrait size={116} expression="content" /></div>
        <p className="login-kicker">Calendrier de l'Avent</p>
        <h1 className="login-title">{MOI.prenom} t'a préparé un calendrier</h1>
        <div className="sm-duo"><Personnage p={MOI} taille={64} /><span className="sm-coeur">♥</span><Personnage p={TOI} taille={64} /></div>
        <p className="sm-texte">24 cases jusqu'à Noël, une par jour, à ouvrir chacun de votre côté. Il ne te reste qu'à choisir un mot de passe, {TOI.prenom}.</p>
        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <label className="login-label" htmlFor="sm-mdp">Ton mot de passe</label>
          <input id="sm-mdp" className="login-input" type="password" defaultValue="flocon" />
          <label className="login-rester"><input type="checkbox" defaultChecked /> Se souvenir de moi sur cet appareil</label>
          <button className="btn login-btn">Entrer dans le calendrier</button>
        </form>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A — « Carte »                                                        */
/* ------------------------------------------------------------------ */
const ETAPES_A = ["Vous deux", "Couleurs", "Contenu", "Mot de passe"];

function PisteA({ ecran }: { ecran: Ecran }) {
  const [moi, setMoi] = useState(MOI);
  if (ecran === "invitation") return <Invitation />;
  return (
    <div className="login">
      <Flocons />
      <main className="login-card">
        <div className="login-portrait"><PenguinPortrait size={116} expression={ecran === "lien" ? "clin" : "content"} /></div>
        {ecran === "accueil" && (
          <>
            <p className="login-kicker">Calendrier de l'Avent</p>
            <h1 className="login-title">Un calendrier pour deux</h1>
            <p className="sm-texte">24 cases, des jeux, des lettres et des photos, pour s'attendre jusqu'à Noël, même à distance. Tu le prépares, puis tu envoies un lien.</p>
            <button className="btn login-btn">Créer notre calendrier</button>
            <button className="login-lien">J'ai déjà un calendrier</button>
            <button className="login-lien">Voir la démo</button>
          </>
        )}
        {ecran === "assistant" && (
          <>
            <ol className="sm-points" aria-label="Étape 1 sur 4">
              {ETAPES_A.map((e, i) => <li key={e} className={i === 0 ? "on" : ""}><span />{e}</li>)}
            </ol>
            <h1 className="login-title sm-petit">Vous deux</h1>
            <div className="sm-duo"><Personnage p={moi} /><span className="sm-coeur">♥</span><Personnage p={TOI} /></div>
            <div className="login-form">
              <label className="login-label" htmlFor="a-moi">Ton prénom</label>
              <input id="a-moi" className="login-input sm-input" value={moi.prenom} onChange={(e) => setMoi({ ...moi, prenom: e.target.value })} />
              <label className="login-label sm-espace" htmlFor="a-toi">Le prénom de l'autre personne</label>
              <input id="a-toi" className="login-input sm-input" defaultValue={TOI.prenom} />
            </div>
            <div className="sm-boutons">
              <button className="btn ghost">Retour</button>
              <button className="btn">Suivant</button>
            </div>
          </>
        )}
        {ecran === "lien" && (
          <>
            <p className="login-kicker">C'est prêt !</p>
            <h1 className="login-title">Le lien pour {TOI.prenom}</h1>
            <p className="sm-texte">Envoie-le par message. Il ne sert qu'une fois : {TOI.prenom} choisira son mot de passe en l'ouvrant.</p>
            <div className="sm-lien"><code>{LIEN}</code><button className="btn sm-copier">Copier</button></div>
            <button className="btn ghost login-btn sm-espace">Partager…</button>
            <p className="sm-note">Ton lien à toi est dans les réglages, au cas où tu changes d'appareil.</p>
            <button className="btn login-btn sm-espace">Ouvrir notre calendrier</button>
          </>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* B — « Pingou » : une question par écran                              */
/* ------------------------------------------------------------------ */
function PisteB({ ecran }: { ecran: Ecran }) {
  const [couleur, setCouleur] = useState(MOI.manteau);
  if (ecran === "invitation") return <Invitation />;
  const bulle = {
    accueil: "Salut ! Je fabrique des calendriers de l'Avent pour deux. On fait le vôtre ?",
    assistant: `Enchanté, ${MOI.prenom} ! Tu veux quel manteau pour traverser la neige ?`,
    lien: `Voilà le lien pour ${TOI.prenom}. Je garde la porte entrouverte jusqu'à son arrivée 😉`,
  }[ecran];
  return (
    <div className="sm-b">
      <Flocons />
      <div className="sm-b-haut">
        {ecran === "assistant" && <div className="sm-b-barre"><span style={{ width: "40%" }} /></div>}
        <div className="sm-b-pingou"><PenguinPortrait size={ecran === "accueil" ? 150 : 110} expression={ecran === "lien" ? "clin" : "content"} /></div>
        <p className="sm-b-bulle">{bulle}</p>
      </div>
      <div className="sm-b-bas">
        {ecran === "accueil" && (
          <>
            <button className="btn login-btn">Oui, créons notre calendrier</button>
            <button className="btn ghost login-btn">J'ai déjà un calendrier</button>
            <button className="login-lien sm-clair">Voir la démo</button>
          </>
        )}
        {ecran === "assistant" && (
          <>
            <div className="sm-b-perso"><Personnage p={{ ...MOI, manteau: couleur }} taille={110} /></div>
            <Nuancier nom="Couleur du manteau" valeur={couleur} couleurs={NUANCIER} onChange={setCouleur} />
            <p className="sm-b-plus">Bonnet, pompon, cheveux : <button className="login-lien sm-clair">plus de choix</button></p>
            <button className="btn login-btn">C'est moi !</button>
          </>
        )}
        {ecran === "lien" && (
          <>
            <div className="sm-enveloppe"><span>✉</span><code>{LIEN}</code></div>
            <button className="btn login-btn">Copier le lien</button>
            <button className="btn ghost login-btn">Partager…</button>
            <button className="login-lien sm-clair">Ouvrir notre calendrier</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* C — « Atelier » : une page, aperçu en direct                         */
/* ------------------------------------------------------------------ */
function PisteC({ ecran }: { ecran: Ecran }) {
  const [moi, setMoi] = useState(MOI);
  const [toi, setToi] = useState(TOI);
  if (ecran === "invitation") return <Invitation />;
  const scene = (titre: string, sous?: string) => (
    <header className="sm-c-scene">
      <Flocons />
      <div className="sm-c-titre"><h1>{titre}</h1>{sous && <p>{sous}</p>}</div>
      <div className="sm-c-persos">
        <Personnage p={moi} taille={ecran === "accueil" ? 96 : 70} />
        <PenguinPortrait size={ecran === "accueil" ? 70 : 52} expression="content" />
        <Personnage p={toi} taille={ecran === "accueil" ? 96 : 70} />
      </div>
      <div className="sm-c-neige" />
    </header>
  );
  if (ecran === "accueil") {
    return (
      <div className="sm-c">
        {scene("Un calendrier de l'Avent pour deux", "24 cases, des jeux, des lettres, des photos. Tu le prépares, tu envoies un lien.")}
        <div className="sm-c-corps sm-c-centre">
          <ul className="sm-c-puces">
            <li><b>5 minutes</b> pour le préparer</li>
            <li><b>Rien à installer</b>, ni pour toi ni pour l'autre</li>
            <li><b>Vos prénoms, vos couleurs</b>, vos questions</li>
          </ul>
          <button className="btn login-btn">Créer notre calendrier</button>
          <button className="login-lien">J'ai déjà un calendrier · Voir la démo</button>
        </div>
      </div>
    );
  }
  if (ecran === "lien") {
    return (
      <div className="sm-c">
        {scene("C'est prêt !")}
        <div className="sm-c-corps">
          <div className="sm-billet">
            <p className="login-kicker">Billet pour</p>
            <p className="sm-billet-nom">{toi.prenom}</p>
            <code>{LIEN}</code>
            <div className="sm-boutons"><button className="btn">Copier</button><button className="btn ghost">Partager…</button></div>
          </div>
          <p className="sm-note">Le lien ne sert qu'une fois. Ton propre lien de connexion est dans les réglages.</p>
          <button className="btn login-btn">Ouvrir notre calendrier</button>
        </div>
      </div>
    );
  }
  const ligne = (p: Perso, set: (p: Perso) => void, titre: string) => (
    <fieldset className="sm-c-bloc">
      <legend>{titre}</legend>
      <input className="login-input sm-input" value={p.prenom} aria-label={`Prénom (${titre})`} onChange={(e) => set({ ...p, prenom: e.target.value })} />
      <p className="sm-c-etiq">Manteau</p>
      <Nuancier nom="Manteau" valeur={p.manteau} couleurs={NUANCIER} onChange={(c) => set({ ...p, manteau: c })} />
      <p className="sm-c-etiq">Cheveux</p>
      <Nuancier nom="Cheveux" valeur={p.cheveux} couleurs={CHEVEUX} onChange={(c) => set({ ...p, cheveux: c })} />
    </fieldset>
  );
  return (
    <div className="sm-c">
      {scene(`${moi.prenom || "…"} & ${toi.prenom || "…"}`)}
      <div className="sm-c-corps">
        <div className="sm-c-deux">{ligne(moi, setMoi, "Toi")}{ligne(toi, setToi, "L'autre personne")}</div>
        <details className="sm-c-bloc"><summary>Contenu des jeux <span>facultatif</span></summary></details>
        <details className="sm-c-bloc"><summary>Ton mot de passe</summary></details>
      </div>
      <div className="sm-c-pied"><button className="btn login-btn">Créer notre calendrier</button></div>
    </div>
  );
}

export function SalonMaquette({ piste, ecran }: { piste: string; ecran: Ecran }) {
  if (piste === "b") return <PisteB ecran={ecran} />;
  if (piste === "c") return <PisteC ecran={ecran} />;
  return <PisteA ecran={ecran} />;
}
