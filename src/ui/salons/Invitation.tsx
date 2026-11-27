/**
 * Page d'invitation (`?invitation=JETON`, #84) : la personne invitée choisit son mot de passe, et c'est tout.
 * À afficher par App.tsx quand l'adresse contient `invitation`.
 * `onEntree` : connecté·e (place "flavie"), le salon est ouvert → montrer le calendrier.
 * `onConnexion` : lien déjà utilisé → montrer l'écran de connexion habituel (le salon est déjà le salon courant).
 */
import { useEffect, useState } from "react";
import type { BackendApi, InvitationInfo } from "../../core/contracts";
import { PINGOU_SALON } from "../pingou/lines";
import { ChampMotDePasse, EcranPingou, Personnage, codeErreur, messageErreur } from "./EcranPingou";

export function Invitation({ backend, onEntree, onConnexion }: {
  backend: BackendApi; onEntree: () => void; onConnexion: () => void;
}) {
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [mdp, setMdp] = useState("");
  const [visible, setVisible] = useState(false);
  const [rester, setRester] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** La lecture du jeton a échoué (réseau, serveur) : ce n'est pas le lien qui est mauvais. */
  const [lectureRatee, setLectureRatee] = useState(false);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let vivant = true;
    if (!backend.salons) { setInfo({ statut: "invalide" }); return; }
    setLectureRatee(false);
    backend.salons.lireInvitation()
      .then((i) => { if (vivant) setInfo(i); })
      .catch(() => { if (vivant) setLectureRatee(true); });
    return () => { vivant = false; };
  }, [backend, essai]);

  /** Sortie de secours : la page sans `?invitation=`, rechargée (accueil, ou connexion si un salon est connu). */
  const allerALAccueil = () => {
    const url = new URL(location.href); url.searchParams.delete("invitation");
    location.replace(url);
  };

  if (lectureRatee) {
    return (
      <EcranPingou ligne={PINGOU_SALON.invitationIllisible()}>
        <button className="btn salon-btn" onClick={() => setEssai((n) => n + 1)}>Réessayer</button>
      </EcranPingou>
    );
  }

  if (!info) {
    return <EcranPingou ligne={{ text: "Une seconde, je cherche ton calendrier…", face: "neutre" }}>{null}</EcranPingou>;
  }

  if (info.statut === "invalide") {
    return (
      <EcranPingou ligne={PINGOU_SALON.invitationInvalide()}>
        <button className="btn ghost salon-btn" onClick={allerALAccueil}>Revenir à l'accueil</button>
      </EcranPingou>
    );
  }

  const { alexandre: createur, flavie: invite } = info.joueurs;

  if (info.statut === "utilisee") {
    return (
      <EcranPingou ligne={PINGOU_SALON.invitationUtilisee(invite.prenom)}>
        <button className="btn salon-btn" onClick={onConnexion}>Aller à la connexion</button>
      </EcranPingou>
    );
  }

  const jeton = info.jeton;
  const entrer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy || !backend.salons) return;
    setBusy(true);
    setErreur(null);
    try {
      await backend.salons.accepterInvitation(jeton, mdp, { rester });
      onEntree();
    } catch (e) {
      const code = codeErreur(e);
      if (code === "INVITATION_UTILISEE") setInfo({ statut: "utilisee", salonId: info.salonId, joueurs: info.joueurs });
      else if (code === "INVITATION_INVALIDE") setInfo({ statut: "invalide" });
      else setErreur(messageErreur(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EcranPingou ligne={erreur ? PINGOU_SALON.souci() : PINGOU_SALON.invitation(invite.prenom, createur.prenom)}>
      <div className="salon-duo" aria-hidden="true">
        <Personnage c={createur.couleurs} taille={70} /><span className="salon-coeur">♥</span><Personnage c={invite.couleurs} taille={70} />
      </div>
      <form className="salon-form" onSubmit={entrer}>
        <ChampMotDePasse id="invitation-mdp" label="Ton mot de passe" valeur={mdp} onChange={(v) => { setMdp(v); setErreur(null); }}
          visible={visible} onVisible={() => setVisible(!visible)} erreur={!!erreur} />
        {erreur && <p className="login-erreur salon-erreur" role="alert">{erreur}</p>}
        <label className="salon-rester">
          <input type="checkbox" checked={rester} onChange={(e) => setRester(e.target.checked)} />
          Se souvenir de moi sur cet appareil
        </label>
        <button className="btn salon-btn" type="submit" disabled={busy || mdp.length < 6}>
          {busy ? "Un instant…" : "Entrer dans le calendrier"}
        </button>
      </form>
    </EcranPingou>
  );
}
