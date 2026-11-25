/**
 * Accueil « Créer notre calendrier » + assistant de création + lien à envoyer (#84, docs/salons.md).
 * Piste B « Pingou » choisie par Alexandre le 25 nov : Pingou pose une question par écran.
 *
 * À afficher par App.tsx quand `backend.salons.getSalon()` renvoie null (première visite sur le site).
 * `onOuvrir` : le salon est créé et le créateur connecté → montrer le calendrier.
 * `onDemo` : « Voir la démo » (facultatif ; absent = bouton masqué).
 */
import { useRef, useState } from "react";
import type { BackendApi, CouleursJoueur, SalonConfig } from "../../core/contracts";
import { PLAYERS } from "../../world/actors";
import { PINGOU_SALON } from "../pingou/lines";
import { ChampMotDePasse, ChoixCouleurs, EcranPingou, codeErreur, messageErreur } from "./EcranPingou";

type Etape = "accueil" | "deja" | "monPrenom" | "monManteau" | "sonPrenom" | "sonManteau" | "contenu" | "motDePasse" | "lien";
/** Ordre de l'assistant (pour la barre et le bouton retour). */
const ASSISTANT: Etape[] = ["monPrenom", "monManteau", "sonPrenom", "sonManteau", "contenu", "motDePasse"];

const couleursDe = (p: (typeof PLAYERS)["alexandre"]): CouleursJoueur =>
  ({ coat: p.coat, hat: p.hat, pompom: p.pompom, hair: p.hair, longHair: p.longHair });

const PRENOM_MAX = 20;

export function CreerSalon({ backend, onOuvrir, onDemo }: {
  backend: BackendApi; onOuvrir: () => void; onDemo?: () => void;
}) {
  const [etape, setEtape] = useState<Etape>("accueil");
  const [moi, setMoi] = useState("");
  const [toi, setToi] = useState("");
  const [mesCouleurs, setMesCouleurs] = useState(couleursDe(PLAYERS.alexandre));
  const [sesCouleurs, setSesCouleurs] = useState(couleursDe(PLAYERS.flavie));
  const [plus, setPlus] = useState(false);
  const [mdp, setMdp] = useState("");
  const [visible, setVisible] = useState(false);
  const [rester, setRester] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lien, setLien] = useState("");
  const [copie, setCopie] = useState(false);
  const champLien = useRef<HTMLInputElement>(null);

  const aller = (e: Etape) => { setEtape(e); setErreur(null); setPlus(false); };
  const i = ASSISTANT.indexOf(etape);
  const precedente = i > 0 ? ASSISTANT[i - 1] : "accueil";
  const progression = i >= 0 ? (i + 1) / (ASSISTANT.length + 1) : undefined;
  const nomMoi = moi.trim();
  const nomToi = toi.trim();

  const creer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    if (!backend.salons) { setErreur("La création de calendrier n'est pas disponible ici."); return; }
    setBusy(true);
    setErreur(null);
    const config: SalonConfig = {
      joueurs: {
        alexandre: { prenom: nomMoi, couleurs: mesCouleurs },
        flavie: { prenom: nomToi, couleurs: sesCouleurs },
      },
      contenu: {},
    };
    try {
      const cree = await backend.salons.creerSalon({ config, motDePasse: mdp, rester });
      setLien(cree.lienInvitation);
      aller("lien");
    } catch (e) {
      setErreur(messageErreur(e));
      if (codeErreur(e) === "CONFIG_INVALIDE") setEtape("monPrenom");
    } finally {
      setBusy(false);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
    } catch {
      // presse-papiers refusé (http, vieux navigateur) : on sélectionne le lien pour un copier à la main
      champLien.current?.select();
    }
  };
  const peutPartager = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const partager = () => {
    navigator.share?.({ title: "Notre calendrier de l'Avent", text: `${nomMoi} t'a préparé un calendrier de l'Avent 🎄`, url: lien })
      .catch(() => { /* partage annulé : rien à dire */ });
  };

  if (etape === "accueil") {
    return (
      <EcranPingou ligne={PINGOU_SALON.accueil()} grand>
        <button className="btn salon-btn" onClick={() => aller("monPrenom")}>Oui, créons notre calendrier</button>
        <button className="btn ghost salon-btn" onClick={() => aller("deja")}>J'ai déjà un calendrier</button>
        {onDemo && <button className="salon-lien" onClick={onDemo}>Voir la démo</button>}
      </EcranPingou>
    );
  }

  if (etape === "deja") {
    return (
      <EcranPingou ligne={PINGOU_SALON.dejaUnCalendrier()}>
        <button className="btn ghost salon-btn" onClick={() => aller("accueil")}>Retour</button>
      </EcranPingou>
    );
  }

  if (etape === "lien") {
    return (
      <EcranPingou ligne={copie ? PINGOU_SALON.copie() : PINGOU_SALON.lien(nomToi)}>
        <div className="salon-enveloppe">
          <span aria-hidden="true">✉</span>
          <input ref={champLien} className="salon-lien-texte" readOnly value={lien} aria-label={`Lien pour ${nomToi}`}
            onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="btn salon-btn" onClick={copier}>{copie ? "Lien copié ✓" : "Copier le lien"}</button>
        {peutPartager && <button className="btn ghost salon-btn" onClick={partager}>Partager…</button>}
        <p className="salon-note">Il ne sert qu'une fois : {nomToi} choisira son mot de passe en l'ouvrant.
          Ton lien de connexion à toi est dans les réglages.</p>
        <button className="salon-lien" onClick={onOuvrir}>Ouvrir notre calendrier</button>
      </EcranPingou>
    );
  }

  const retour = () => aller(precedente);

  if (etape === "monPrenom" || etape === "sonPrenom") {
    const pourMoi = etape === "monPrenom";
    const valeur = pourMoi ? moi : toi;
    const pret = valeur.trim().length > 0;
    return (
      <EcranPingou ligne={erreur ? PINGOU_SALON.souci() : pourMoi ? PINGOU_SALON.monPrenom() : PINGOU_SALON.sonPrenom()}
        progression={progression} onRetour={retour}>
        <form className="salon-form" onSubmit={(e) => { e.preventDefault(); if (pret) aller(pourMoi ? "monManteau" : "sonManteau"); }}>
          <label className="salon-etiq" htmlFor="salon-prenom">{pourMoi ? "Ton prénom" : "Son prénom"}</label>
          <input key={etape} id="salon-prenom" className="login-input salon-input" autoFocus autoComplete={pourMoi ? "given-name" : "off"}
            maxLength={PRENOM_MAX} value={valeur} onChange={(e) => (pourMoi ? setMoi : setToi)(e.target.value)}
            aria-describedby={erreur ? "salon-erreur" : undefined} />
          {erreur && <p className="login-erreur salon-erreur" id="salon-erreur" role="alert">{erreur}</p>}
          <button className="btn salon-btn" type="submit" disabled={!pret}>Suivant</button>
        </form>
      </EcranPingou>
    );
  }

  if (etape === "monManteau" || etape === "sonManteau") {
    const pourMoi = etape === "monManteau";
    return (
      <EcranPingou ligne={pourMoi ? PINGOU_SALON.monManteau(nomMoi) : PINGOU_SALON.sonManteau(nomToi)}
        progression={progression} onRetour={retour}>
        <ChoixCouleurs c={pourMoi ? mesCouleurs : sesCouleurs} onChange={pourMoi ? setMesCouleurs : setSesCouleurs}
          plus={plus} onPlus={() => setPlus(true)} />
        <button className="btn salon-btn" onClick={() => aller(pourMoi ? "sonPrenom" : "contenu")}>
          {pourMoi ? "C'est moi !" : `C'est ${nomToi} !`}
        </button>
      </EcranPingou>
    );
  }

  if (etape === "contenu") {
    return (
      <EcranPingou ligne={PINGOU_SALON.contenu(nomToi)} progression={progression} onRetour={retour}>
        <button className="btn salon-btn" onClick={() => aller("motDePasse")}>D'accord</button>
      </EcranPingou>
    );
  }

  // motDePasse
  return (
    <EcranPingou ligne={busy ? PINGOU_SALON.fabrication() : erreur ? PINGOU_SALON.souci() : PINGOU_SALON.motDePasse()}
      progression={progression} onRetour={busy ? undefined : retour}>
      <form className="salon-form" onSubmit={creer}>
        <ChampMotDePasse id="salon-mdp" label="Ton mot de passe" valeur={mdp} onChange={(v) => { setMdp(v); setErreur(null); }}
          visible={visible} onVisible={() => setVisible(!visible)} erreur={!!erreur} />
        {erreur && <p className="login-erreur salon-erreur" role="alert">{erreur}</p>}
        <label className="salon-rester">
          <input type="checkbox" checked={rester} onChange={(e) => setRester(e.target.checked)} />
          Se souvenir de moi sur cet appareil
        </label>
        <button className="btn salon-btn" type="submit" disabled={busy || mdp.length < 6}>
          {busy ? "Un instant…" : "Créer notre calendrier"}
        </button>
      </form>
    </EcranPingou>
  );
}
