import { useEffect, useRef, useState } from "react";
import type { BackendApi, Who } from "../core/contracts";
import { usePrenoms } from "./useSalon";
import { MascotDialog, PenguinPortrait } from "./Mascot";
import { PINGOU_LOGIN, type PingouLine } from "./pingou/lines";

const COULEUR: Record<Who, string> = { alexandre: "#2f6fd0", flavie: "#d9354b" };

/** Ce qui a fait échouer la connexion : on ne dit « mot de passe » que si c'est vraiment lui (ticket #75). */
export type EchecConnexion = { cause: "mot-de-passe" | "reseau" | "autre"; message: string };

/** Messages bruts de Supabase (en anglais) qu'on sait dire en français. */
const TRADUCTIONS: [RegExp, string][] = [
  [/email not confirmed/i, "Adresse e-mail pas encore confirmée dans Supabase."],
  [/rate limit|too many requests/i, "Trop d'essais d'affilée : patiente une minute avant de réessayer."],
];

export function classerEchec(e: unknown, enLigne = typeof navigator === "undefined" || navigator.onLine): EchecConnexion {
  const brut = e instanceof Error ? e.message : String(e ?? "");
  if (brut === "Mot de passe incorrect.") return { cause: "mot-de-passe", message: brut };
  // fetch qui échoue : « Failed to fetch » (Chrome), « NetworkError… » (Firefox), « Load failed » (Safari)
  if (!enLigne || /failed to fetch|networkerror|load failed|network request failed/i.test(brut)) {
    return { cause: "reseau", message: "Pas de réseau : vérifie ta connexion internet, puis réessaie." };
  }
  const traduit = TRADUCTIONS.find(([motif]) => motif.test(brut))?.[1];
  return { cause: "autre", message: `Connexion impossible : ${traduit ?? (brut || "erreur inconnue.")}` };
}


/**
 * Écran de connexion : on choisit son profil, puis son mot de passe.
 * Ne connaît que `BackendApi` — en mode démo le backend accepte n'importe quel mot de passe.
 */
export function LoginScreen({ backend, onSignedIn }: { backend: BackendApi; onSignedIn?: (who: Who) => void }) {
  const PRENOM = usePrenoms(backend);
  const [who, setWho] = useState<Who | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [rester, setRester] = useState(true);
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
      // le contrat porte l'option depuis l'issue #4 : plus de pansement dans localStorage
      await backend.signIn(who, password, { rester });
      setLines(PINGOU_LOGIN.bienvenue(PRENOM[who]));
      onSignedIn?.(who);
    } catch (e) {
      const echec = classerEchec(e);
      setErreur(echec.message);
      if (echec.cause === "mot-de-passe") {
        setLines(PINGOU_LOGIN.mauvaisMotDePasse());
        setPassword("");
      } else {
        // le mot de passe n'y est pour rien : on le garde, il suffira de réessayer
        setLines(echec.cause === "reseau" ? PINGOU_LOGIN.reseauCoupe() : PINGOU_LOGIN.connexionImpossible());
      }
      champ.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  /** Version publique : on entre sans compte, avec du contenu fictif. */
  const voirLaDemo = async () => {
    setBusy(true);
    const profil: Who = who ?? "alexandre";
    try {
      await backend.signIn(profil, "");
      setLines(PINGOU_LOGIN.demo());
      onSignedIn?.(profil);
    } catch {
      setErreur("La démo n'a pas voulu démarrer. Réessaie ?");
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
        <h1 className="login-title">{PRENOM.alexandre} &amp; {PRENOM.flavie}</h1>

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
          <div className="login-champ">
            <input
              id="mdp"
              ref={champ}
              className={`login-input${erreur ? " erreur" : ""}`}
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErreur(null); }}
              aria-invalid={!!erreur}
              aria-describedby={erreur ? "mdp-erreur" : undefined}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="login-oeil"
              onClick={() => setVisible(!visible)}
              aria-pressed={visible}
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                <circle cx="12" cy="12" r="2.8" />
                {visible && <path d="M4 20 20 4" />}
              </svg>
            </button>
          </div>
          <p className="login-erreur" id="mdp-erreur" role="alert">{erreur ?? ""}</p>

          <label className="login-rester">
            <input type="checkbox" checked={rester} onChange={(e) => setRester(e.target.checked)} />
            Se souvenir de moi sur cet appareil
          </label>

          <button className="btn login-btn" type="submit" disabled={busy || !password}>
            {busy ? "Un instant…" : "Entrer"}
          </button>
        </form>

        {backend.mode === "demo" && (
          <button type="button" className="login-lien" onClick={voirLaDemo} disabled={busy}>
            Voir la démo sans compte
          </button>
        )}
      </main>

      <MascotDialog key={textKey(lines)} lines={lines} variant="inline" onDone={() => setLines([])} />
    </div>
  );
}

/** Force le remontage de la bulle quand Pingou change de réplique. */
const textKey = (lines: PingouLine[]) => JSON.stringify(lines);
