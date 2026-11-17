import { useEffect, useRef, useState } from "react";
import type { BackendApi, Who } from "../core/contracts";
import { MascotDialog, PenguinPortrait } from "./Mascot";
import { PINGOU_LOGIN, type PingouLine } from "./pingou/lines";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const COULEUR: Record<Who, string> = { alexandre: "#2f6fd0", flavie: "#d9354b" };

/**
 * Écran de connexion : on choisit son profil, puis son mot de passe.
 * Ne connaît que `BackendApi` — en mode démo le backend accepte n'importe quel mot de passe.
 */
export function LoginScreen({ backend, onSignedIn }: { backend: BackendApi; onSignedIn?: (who: Who) => void }) {
  const [who, setWho] = useState<Who | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lines, setLines] = useState<PingouLine[]>(PINGOU_LOGIN.accueil());
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => { if (who) champ.current?.focus(); }, [who]);

  const choisir = (w: Who) => {
    setWho(w);
    setErreur(null);
    setPassword("");
    setLines(PINGOU_LOGIN.demandeMotDePasse(PRENOM[w]));
  };

  const entrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!who || busy) return;
    setBusy(true);
    setErreur(null);
    try {
      await backend.signIn(who, password);
      setLines(PINGOU_LOGIN.bienvenue(PRENOM[who]));
      onSignedIn?.(who);
    } catch {
      setErreur("Mot de passe incorrect.");
      setLines(PINGOU_LOGIN.mauvaisMotDePasse());
      setPassword("");
      champ.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-flakes" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => <span key={i}>❄</span>)}
      </div>

      <main className="login-card">
        <div className="login-portrait"><PenguinPortrait size={116} expression={erreur ? "surpris" : "content"} /></div>
        <p className="login-kicker">Calendrier de l'Avent</p>
        <h1 className="login-title">Alexandre &amp; Flavie</h1>

        <p className="login-question" id="qui">Qui es-tu ?</p>
        <div className="login-who" role="group" aria-labelledby="qui">
          {(["alexandre", "flavie"] as Who[]).map((w) => (
            <button
              key={w}
              type="button"
              className={`login-who-btn${who === w ? " on" : ""}`}
              style={{ ["--c" as string]: COULEUR[w] }}
              aria-pressed={who === w}
              onClick={() => choisir(w)}
            >
              <span className="login-who-dot" />
              {PRENOM[w]}
            </button>
          ))}
        </div>

        <form className="login-form" onSubmit={entrer} hidden={!who}>
          <label className="login-label" htmlFor="mdp">Mot de passe</label>
          <input
            id="mdp"
            ref={champ}
            className={`login-input${erreur ? " erreur" : ""}`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErreur(null); }}
            aria-invalid={!!erreur}
            aria-describedby={erreur ? "mdp-erreur" : undefined}
            placeholder="••••••••"
          />
          <p className="login-erreur" id="mdp-erreur" role="alert">{erreur ?? ""}</p>
          <button className="btn login-btn" type="submit" disabled={busy || !password}>
            {busy ? "Un instant…" : "Entrer"}
          </button>
        </form>

        {backend.mode === "demo" && (
          <p className="login-demo">Mode démo : le mot de passe n'a pas d'importance.</p>
        )}
      </main>

      <MascotDialog key={textKey(lines)} lines={lines} variant="inline" onDone={() => setLines([])} />
    </div>
  );
}

/** Force le remontage de la bulle quand Pingou change de réplique. */
const textKey = (lines: PingouLine[]) => JSON.stringify(lines);
