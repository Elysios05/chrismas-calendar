import { useState } from "react";
import type { BackendApi, SoundApi, Who } from "../core/contracts";
import { PenguinPortrait } from "./Mascot";
import { useDialog } from "./useDialog";
import { RemindersRow } from "./Reminders";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

export const CLE_SON = "interface:son";
export const CLE_ANIMATIONS = "interface:animations";

const lire = (cle: string, defaut: boolean) => {
  try { const v = localStorage.getItem(cle); return v === null ? defaut : v === "oui"; } catch { return defaut; }
};
const ecrire = (cle: string, on: boolean) => {
  try { localStorage.setItem(cle, on ? "oui" : "non"); } catch { /* stockage indisponible */ }
};

/** Coupe les animations pour toute la page (préférence explicite, en plus de celle du système). */
export const appliquerAnimations = (on: boolean) => {
  document.documentElement.dataset.animations = on ? "oui" : "non";
};

/** À appeler au démarrage pour que les préférences enregistrées s'appliquent. */
export function chargerPreferences(sound?: SoundApi) {
  const son = lire(CLE_SON, true);
  const animations = lire(CLE_ANIMATIONS, true);
  sound?.setEnabled(son);
  appliquerAnimations(animations);
  return { son, animations };
}

function Interrupteur({
  id, label, aide, on, onChange,
}: { id: string; label: string; aide?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="reg-ligne">
      <label className="reg-texte" htmlFor={id}>
        {label}
        {aide && <span className="reg-aide">{aide}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        className={`reg-switch${on ? " on" : ""}`}
        onClick={() => onChange(!on)}
      >
        <span className="reg-bouton" />
      </button>
    </div>
  );
}

/** Panneau des réglages : son, animations, et la porte de sortie. */
export function Settings({
  me,
  backend,
  sound,
  onClose,
  onSignedOut,
}: {
  me: Who;
  backend: BackendApi;
  sound?: SoundApi;
  onClose: () => void;
  onSignedOut?: () => void;
}) {
  const [son, setSon] = useState(() => lire(CLE_SON, true));
  const [animations, setAnimations] = useState(() => lire(CLE_ANIMATIONS, true));

  const panneau = useDialog<HTMLElement>(onClose);

  const changerSon = (v: boolean) => {
    setSon(v); ecrire(CLE_SON, v); sound?.setEnabled(v);
    if (v) sound?.play("pop");
  };
  const changerAnimations = (v: boolean) => {
    setAnimations(v); ecrire(CLE_ANIMATIONS, v); appliquerAnimations(v);
  };

  return (
    <div className="sheet" role="presentation" onClick={onClose}>
      <section
        ref={panneau}
        tabIndex={-1}
        className="sheet-panel reg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-titre"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <span className="reg-portrait" aria-hidden="true"><PenguinPortrait size={46} expression="content" /></span>
          <div>
            <p className="sheet-day">Connecté·e en tant que {PRENOM[me]}</p>
            <h2 className="sheet-title" id="reg-titre">Réglages</h2>
          </div>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="Fermer les réglages">✕</button>
        </header>

        <div className="reg-liste">
          <Interrupteur
            id="reg-son" label="Musique et sons"
            aide="L'ambiance change selon le monde traversé."
            on={son} onChange={changerSon}
          />
          <Interrupteur
            id="reg-anim" label="Animations"
            aide="À couper si le mouvement te gêne."
            on={animations} onChange={changerAnimations}
          />
          <RemindersRow backend={backend} />
        </div>

        <div className="reg-pied">
          {backend.mode === "demo" && <p className="reg-demo">Version de démonstration : rien n'est enregistré.</p>}
          <button
            className="btn ghost reg-sortie"
            type="button"
            onClick={async () => { await backend.signOut().catch(() => { /* déjà déconnecté */ }); onSignedOut?.(); }}
          >
            Se déconnecter
          </button>
        </div>
      </section>
    </div>
  );
}
