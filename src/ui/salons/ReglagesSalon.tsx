/**
 * Réglages du salon (#84) : changer prénoms et manteaux des deux personnages, retrouver son lien de connexion,
 * et, pour la personne qui a créé le calendrier, le lien d'invitation tant que l'autre n'est pas arrivé·e.
 *
 * Décidé avec Alexandre (25 nov) : on réutilise les écrans de l'assistant (piste B « Pingou »),
 * ouverts depuis la ligne « Notre calendrier › » de la feuille Réglages ; chacun peut modifier les deux personnages.
 */
import { useEffect, useRef, useState } from "react";
import type { BackendApi, CouleursJoueur, Who } from "../../core/contracts";
import { PINGOU_SALON, textOf, type PingouLine } from "../pingou/lines";
import { useDialog } from "../useDialog";
import { useSalon } from "../useSalon";
import { ChoixCouleurs, EcranPingou, Personnage, messageErreur } from "./EcranPingou";
import { EditeurCase, ListeCasesContenu } from "./EditeurContenu";

const PRENOM_MAX = 20;
const PLACES: Who[] = ["alexandre", "flavie"];

type Vue =
  | { etape: "accueil" }
  | { etape: "jeux" }
  | { etape: "case"; jour: number }
  | { etape: "supprimer" }
  | { etape: "prenom" | "manteau"; qui: Who; prenom: string; couleurs: CouleursJoueur };

/** Lien dans son enveloppe + bouton Copier (sélection du texte si le presse-papiers est refusé). */
function BlocLien({ id, titre, lien, note, onCopie }: {
  id: string; titre: string; lien: string | null; note: string; onCopie: () => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [copie, setCopie] = useState(false);
  useEffect(() => setCopie(false), [lien]);
  const copier = async () => {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      onCopie();
    } catch {
      champ.current?.select();
    }
  };
  return (
    <div className="salon-bloc">
      <p className="salon-etiq" id={`${id}-titre`}>{titre}</p>
      <div className="salon-enveloppe petite">
        <span aria-hidden="true">✉</span>
        <input ref={champ} className="salon-lien-texte" readOnly value={lien ?? "…"} aria-labelledby={`${id}-titre`}
          onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn salon-copier" onClick={copier} disabled={!lien}>
          {copie ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p className="salon-aide">{note}</p>
    </div>
  );
}

/**
 * `SalonApi.supprimerSalon` arrive avec la PR #146 du Backend : tant qu'elle n'est pas fusionnée, le bouton
 * reste caché. (Une fois fusionnée, ce test devient toujours vrai et peut être retiré.)
 */
type AvecSuppression = { supprimerSalon(): Promise<void> };
const saitSupprimer = (api: unknown): api is AvecSuppression =>
  typeof (api as Partial<AvecSuppression> | undefined)?.supprimerSalon === "function";

/**
 * `onSupprime` : le salon vient d'être effacé (le backend a déjà fermé la session) → retour à l'accueil.
 */
export function ReglagesSalon({ backend, me, onFermer, onSupprime }: {
  backend: BackendApi; me: Who; onFermer: () => void; onSupprime?: () => void;
}) {
  const salon = useSalon(backend);
  const [vue, setVue] = useState<Vue>({ etape: "accueil" });
  const [ligne, setLigne] = useState<PingouLine>(PINGOU_SALON.reglages());
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lienMoi, setLienMoi] = useState<string | null>(null);
  const [lienInvit, setLienInvit] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  // Échap et le retour : on revient d'abord à l'accueil des réglages, puis on ferme.
  const retour = useRef(() => {});
  const retourCase = useRef(() => {});
  const [ligneJeux, setLigneJeux] = useState<PingouLine | undefined>(undefined);
  retour.current = () => {
    if (busy) return;
    setErreur(null);
    if (vue.etape === "case") retourCase.current();
    else if (vue.etape === "jeux" || vue.etape === "supprimer") { setVue({ etape: "accueil" }); setLigne(PINGOU_SALON.reglages()); }
    else if (vue.etape === "manteau") setVue({ ...vue, etape: "prenom" });
    else if (vue.etape === "prenom") { setVue({ etape: "accueil" }); setLigne(PINGOU_SALON.reglages()); }
    else onFermer();
  };
  const [surEchap] = useState(() => () => retour.current());
  const { panneau } = useDialog<HTMLDivElement>(surEchap);

  const api = backend.salons;
  const inviter = me === "alexandre" && !!salon && !salon.inviteArrive && !salon.demo;
  // Seul le créateur (place 1) peut tout effacer (décision d'Alexandre, 27 nov).
  const peutSupprimer = me === "alexandre" && !!salon && !salon.demo && saitSupprimer(backend.salons);

  useEffect(() => {
    if (!api) return;
    let vivant = true;
    api.lienConnexion().then((l) => { if (vivant) setLienMoi(l); }).catch(() => { /* on laisse « … » */ });
    return () => { vivant = false; };
  }, [api, salon?.id]);

  useEffect(() => {
    if (!api || !inviter) { setLienInvit(null); return; }
    let vivant = true;
    api.lienInvitation().then((l) => { if (vivant) setLienInvit(l); }).catch(() => { if (vivant) setLienInvit(null); });
    return () => { vivant = false; };
  }, [api, inviter, salon?.id]);

  if (!api || !salon) {
    return (
      <div ref={panneau} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Notre calendrier">
        <EcranPingou ligne={PINGOU_SALON.reglages()} onRetour={onFermer}>
          <p className="salon-note">Un instant…</p>
        </EcranPingou>
      </div>
    );
  }

  const joueurs = salon.config.joueurs;
  const autre: Who = me === "alexandre" ? "flavie" : "alexandre";

  const enregistrer = async (qui: Who, prenom: string, couleurs: CouleursJoueur) => {
    if (busy) return;
    setBusy(true);
    setErreur(null);
    try {
      await api.modifierSalon({ ...salon.config, joueurs: { ...joueurs, [qui]: { prenom: prenom.trim(), couleurs } } });
      setVue({ etape: "accueil" });
      setLigne(PINGOU_SALON.reglagesEnregistres());
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setBusy(false);
    }
  };

  const nouveauLien = async () => {
    setBusy(true);
    setErreur(null);
    try {
      setLienInvit(await api.lienInvitation({ nouveau: true }));
      setLigne(PINGOU_SALON.nouveauLien(joueurs[autre].prenom));
      setConfirmer(false);
    } catch (e) {
      setErreur(messageErreur(e));
      setLigne(PINGOU_SALON.souci());
    } finally {
      setBusy(false);
    }
  };

  const supprimer = async () => {
    const api = backend.salons;
    if (busy || !saitSupprimer(api)) return;
    setBusy(true);
    setErreur(null);
    try {
      await api.supprimerSalon();
      onSupprime?.();
    } catch (e) {
      setErreur(messageErreur(e));
      setBusy(false);
    }
  };

  let ecran;
  if (vue.etape === "supprimer") {
    ecran = (
      <EcranPingou ligne={erreur ? PINGOU_SALON.supprimerSouci() : PINGOU_SALON.supprimer(joueurs[autre].prenom)}
        onRetour={busy ? undefined : () => retour.current()} libelleRetour="Revenir à notre calendrier">
        <div className="salon-danger" role="group" aria-labelledby="supp-titre">
          <p className="salon-etiq" id="supp-titre">Tout sera effacé, pour toujours :</p>
          <ul>
            <li>les 24 cases et votre avancée ;</li>
            <li>les lettres, les réponses et les questions des jeux ;</li>
            <li>toutes les photos ;</li>
            <li>vos deux comptes : ni toi ni {joueurs[autre].prenom} ne pourrez plus entrer.</li>
          </ul>
        </div>
        {erreur && <p className="login-erreur salon-erreur" role="alert">{erreur}</p>}
        <button className="btn salon-btn salon-btn-danger" disabled={busy} onClick={supprimer}>
          {busy ? "J'efface…" : "Oui, tout effacer pour toujours"}
        </button>
        <button className="btn ghost salon-btn" disabled={busy} onClick={() => retour.current()}>Non, on garde tout</button>
      </EcranPingou>
    );
  } else if (vue.etape === "jeux") {
    ecran = <ListeCasesContenu salon={salon} ligne={ligneJeux} onRetour={() => retour.current()}
      onChoisir={(jour) => setVue({ etape: "case", jour })} />;
  } else if (vue.etape === "case") {
    ecran = <EditeurCase key={vue.jour} backend={backend} salon={salon} jour={vue.jour} retourRef={retourCase}
      onFini={(enregistre) => { setLigneJeux(enregistre ? PINGOU_SALON.contenuEnregistre() : undefined); setVue({ etape: "jeux" }); }} />;
  } else if (vue.etape === "prenom") {
    const pret = vue.prenom.trim().length > 0;
    ecran = (
      <EcranPingou ligne={erreur ? PINGOU_SALON.souci() : PINGOU_SALON.changerPrenom(vue.qui === me, joueurs[vue.qui].prenom)}
        progression={1 / 3} onRetour={() => retour.current()}>
        <form className="salon-form" onSubmit={(e) => { e.preventDefault(); if (pret) setVue({ ...vue, etape: "manteau" }); }}>
          <label className="salon-etiq" htmlFor="reg-salon-prenom">{vue.qui === me ? "Ton prénom" : "Son prénom"}</label>
          <input id="reg-salon-prenom" className="login-input salon-input" autoFocus autoComplete="off"
            maxLength={PRENOM_MAX} value={vue.prenom} onChange={(e) => setVue({ ...vue, prenom: e.target.value })} />
          <button className="btn salon-btn" type="submit" disabled={!pret}>Suivant</button>
        </form>
      </EcranPingou>
    );
  } else if (vue.etape === "manteau") {
    ecran = (
      <EcranPingou ligne={busy ? PINGOU_SALON.fabrication() : erreur ? PINGOU_SALON.souci() : PINGOU_SALON.changerManteau(vue.prenom.trim())}
        progression={2 / 3} onRetour={busy ? undefined : () => retour.current()}>
        <ChoixCouleurs c={vue.couleurs} onChange={(couleurs) => setVue({ ...vue, couleurs })} plus onPlus={() => {}} />
        {erreur && <p className="login-erreur salon-erreur" role="alert">{erreur}</p>}
        <button className="btn salon-btn" disabled={busy} onClick={() => enregistrer(vue.qui, vue.prenom, vue.couleurs)}>
          {busy ? "Un instant…" : "Enregistrer"}
        </button>
      </EcranPingou>
    );
  } else {
    ecran = (
      <EcranPingou ligne={ligne} onRetour={() => retour.current()} libelleRetour="Revenir aux réglages">
        <ul className="salon-joueurs">
          {PLACES.map((qui) => (
            <li key={qui} className="salon-joueur">
              <Personnage c={joueurs[qui].couleurs} taille={44} />
              <span className="salon-joueur-nom">
                {joueurs[qui].prenom}
                {qui === me && <span className="salon-toi"> (toi)</span>}
              </span>
              <button type="button" className="btn ghost salon-modifier"
                aria-label={`Modifier ${joueurs[qui].prenom}`}
                onClick={() => { setErreur(null); setVue({ etape: "prenom", qui, prenom: joueurs[qui].prenom, couleurs: joueurs[qui].couleurs }); }}>
                Modifier
              </button>
            </li>
          ))}
        </ul>

        {/* Les questions des jeux sont réservées au créateur (place 1) : l'autre ne doit pas voir les réponses.
            Protection d'interface seulement, la config reste lisible par les deux (arbitrage du chef, #84). */}
        {me === "alexandre" ? (
          <button type="button" className="salon-joueur ed-entree" onClick={() => { setLigneJeux(undefined); setVue({ etape: "jeux" }); }}>
            <span className="ed-entree-icone" aria-hidden="true">🎁</span>
            <span className="salon-joueur-nom">Les questions des jeux
              <span className="ed-entree-note">Remplace celles de Pingou par les vôtres</span></span>
            <span aria-hidden="true" className="ed-entree-fleche">›</span>
          </button>
        ) : (
          <p className="salon-joueur ed-entree ed-surprise">
            <span className="ed-entree-icone" aria-hidden="true">🎁</span>
            <span className="salon-joueur-nom">Les questions des jeux
              <span className="ed-entree-note">{textOf(PINGOU_SALON.contenuSurprise(joueurs.alexandre.prenom))}</span></span>
          </p>
        )}

        <BlocLien id="reg-lien-moi" titre="Ton lien de connexion" lien={lienMoi}
          note="Garde-le : il ouvre votre calendrier sur n'importe quel appareil."
          onCopie={() => setLigne(PINGOU_SALON.lienGarde())} />

        {inviter && (
          <>
            <BlocLien id="reg-lien-invit" titre={`Lien d'invitation pour ${joueurs[autre].prenom}`} lien={lienInvit}
              note={`Il ne sert qu'une fois : ${joueurs[autre].prenom} choisira son mot de passe en l'ouvrant.`}
              onCopie={() => setLigne(PINGOU_SALON.copie())} />
            {confirmer ? (
              <div className="salon-confirmer" role="group" aria-label="Nouveau lien d'invitation">
                <p className="salon-note">L'ancien lien ne marchera plus. On en fabrique un autre ?</p>
                <button className="btn salon-btn" disabled={busy} onClick={nouveauLien}>
                  {busy ? "Un instant…" : "Oui, un nouveau lien"}
                </button>
                <button className="salon-lien" onClick={() => setConfirmer(false)}>Annuler</button>
              </div>
            ) : (
              <button className="salon-lien" onClick={() => setConfirmer(true)}>Lien perdu ? Fabriquer un nouveau lien</button>
            )}
          </>
        )}
        {erreur && <p className="login-erreur salon-erreur" role="alert">{erreur}</p>}
        <button className="btn ghost salon-btn" onClick={onFermer}>Fermer</button>
        {peutSupprimer && (
          <button className="salon-lien salon-lien-danger" onClick={() => { setErreur(null); setVue({ etape: "supprimer" }); }}>
            Supprimer notre calendrier
          </button>
        )}
      </EcranPingou>
    );
  }

  return (
    <div ref={panneau} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Notre calendrier" className="salon-dialogue">
      {ecran}
    </div>
  );
}
