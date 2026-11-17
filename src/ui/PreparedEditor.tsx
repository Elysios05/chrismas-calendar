import { useEffect, useRef, useState } from "react";
import type { BackendApi, PreparedResult, Who } from "../core/contracts";
import { MascotDialog } from "./Mascot";
import { PreparedCase } from "./PreparedCase";
import { PINGOU_CASE, type PingouLine } from "./pingou/lines";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

/** Décidé avec Alexandre : trois photos, pas plus — au-delà les polaroïds ne tiennent plus sur un téléphone. */
export const MAX_PHOTOS = 3;
const MAX_CARACTERES = 700;

type Etat = "chargement" | "edition" | "apercu" | "envoye" | "fige";

/**
 * Éditeur d'une case préparée : mot doux + photos, avec l'aperçu exact de ce que l'autre verra.
 * Tant que le destinataire n'a pas ouvert la case, on peut revenir la modifier.
 */
export function PreparedEditor({
  day,
  me,
  backend,
  onClose,
}: {
  day: number;
  me: Who;
  backend: BackendApi;
  onClose?: () => void;
}) {
  const partner: Who = me === "alexandre" ? "flavie" : "alexandre";
  const prenom = PRENOM[partner];
  const [etat, setEtat] = useState<Etat>("chargement");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lines, setLines] = useState<PingouLine[]>([]);
  const fichiers = useRef<HTMLInputElement>(null);
  const zoneTexte = useRef<HTMLTextAreaElement>(null);

  // la zone de texte grandit avec le mot : on ne coupe jamais une lettre au milieu
  useEffect(() => {
    const el = zoneTexte.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [message, etat]);

  // Reprise du brouillon, s'il y en a un.
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await backend.getPrepared(day, partner);
        if (!vivant) return;
        if (r.status === "ready") {
          setMessage(r.content.message);
          setPhotos(r.content.photos);
          setLines(PINGOU_CASE.editeurRepris());
        } else {
          setLines(PINGOU_CASE.editeurVide(day, prenom));
        }
      } catch {
        // le serveur peut refuser la lecture ; on repart d'une page blanche
        if (vivant) setLines(PINGOU_CASE.editeurVide(day, prenom));
      } finally {
        if (vivant) setEtat("edition");
      }
    })();
    return () => { vivant = false; };
  }, [backend, day, partner, prenom]);

  const ajouterPhotos = async (liste: FileList | null) => {
    if (!liste?.length) return;
    setErreur(null);
    const place = MAX_PHOTOS - photos.length;
    if (place <= 0) return;
    const choisies = [...liste].slice(0, place);
    try {
      const urls = await Promise.all(choisies.map((f) => backend.uploadPhoto(f)));
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      setErreur("Une photo n'est pas passée. Réessaie ?");
    }
    if (fichiers.current) fichiers.current.value = "";
  };

  const enlever = (src: string) => setPhotos((p) => p.filter((x) => x !== src));

  const envoyer = async () => {
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await backend.savePrepared(day, { message: message.trim(), photos });
      setLines(PINGOU_CASE.prepareeEnvoyee(prenom));
      setEtat("envoye");
    } catch {
      // le serveur fige la case dès que le destinataire l'a ouverte
      setLines(PINGOU_CASE.editeurFige(prenom));
      setEtat("fige");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const restant = MAX_CARACTERES - message.length;
  const vide = !message.trim() && photos.length === 0;

  if (etat === "chargement") {
    return <p className="edit-chargement">On ouvre ton papier à lettres…</p>;
  }

  return (
    <div className="edit">
      <header className="edit-head">
        <p className="edit-kicker">Case {day} · pour {prenom}</p>
        <h2 className="edit-titre">
          {etat === "envoye" ? "C'est envoyé" : etat === "fige" ? "Case déjà lue" : `Écris à ${prenom}`}
        </h2>
      </header>

      {etat === "fige" && (
        <p className="edit-info">
          {prenom} a déjà ouvert cette case : son contenu est figé, on n'y touche plus.
        </p>
      )}

      {etat === "envoye" && (
        <>
          <p className="edit-info">
            Rangé dans l'enveloppe. {prenom} l'ouvrira le {day} décembre à 7 h — tu peux encore la modifier d'ici là.
          </p>
          <div className="edit-actions">
            <button className="btn ghost" type="button" onClick={() => setEtat("edition")}>Modifier</button>
            {onClose && <button className="btn" type="button" onClick={onClose}>Terminé</button>}
          </div>
        </>
      )}

      {etat === "apercu" && (
        <>
          <p className="edit-info">Voilà exactement ce que {prenom} découvrira.</p>
          <div className="edit-apercu">
            <PreparedCase
              resultat={apercu(day, me, partner, message, photos)}
              de={me}
              onPingou={() => { /* Pingou ne commente pas un aperçu */ }}
            />
          </div>
          <div className="edit-actions">
            <button className="btn ghost" type="button" onClick={() => setEtat("edition")}>Continuer d'écrire</button>
            <button className="btn" type="button" onClick={envoyer} disabled={envoiEnCours}>
              {envoiEnCours ? "On envoie…" : "C'est bon, j'envoie"}
            </button>
          </div>
        </>
      )}

      {etat === "edition" && (
        <>
          <label className="edit-label" htmlFor="mot">Ton mot</label>
          <textarea
            id="mot"
            ref={zoneTexte}
            className="edit-zone"
            value={message}
            maxLength={MAX_CARACTERES}
            rows={4}
            placeholder={`Deux lignes suffisent. Un souvenir, une bêtise, ce que tu penses là maintenant…`}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className={`edit-compteur${restant < 60 ? " court" : ""}`}>{restant} caractères restants</p>

          <p className="edit-label">Photos <span className="edit-petit">({photos.length} sur {MAX_PHOTOS})</span></p>
          <div className="edit-photos">
            {photos.map((src) => (
              <div key={src} className="edit-vignette">
                <img src={src} alt="" />
                <button type="button" onClick={() => enlever(src)} aria-label="Enlever cette photo">✕</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" className="edit-ajout" onClick={() => fichiers.current?.click()}>
                <span aria-hidden="true">＋</span>
                Ajouter
              </button>
            )}
          </div>
          <input
            ref={fichiers}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void ajouterPhotos(e.target.files)}
          />

          {erreur && <p className="edit-erreur" role="alert">{erreur}</p>}

          <div className="edit-actions">
            <button className="btn ghost" type="button" disabled={vide} onClick={() => setEtat("apercu")}>
              Voir ce qu'elle verra
            </button>
            <button className="btn" type="button" disabled={vide || envoiEnCours} onClick={envoyer}>
              {envoiEnCours ? "On envoie…" : "Mettre sous enveloppe"}
            </button>
          </div>
        </>
      )}

      <MascotDialog key={JSON.stringify(lines)} lines={lines} variant="inline" onDone={() => setLines([])} />
    </div>
  );
}

/** Contenu factice, le temps de l'aperçu : rien n'est enregistré. */
function apercu(day: number, from: Who, to: Who, message: string, photos: string[]): PreparedResult {
  return {
    status: "ready",
    content: { day, from, to, message, photos, updatedAt: new Date().toISOString() },
  };
}

/**
 * Rappel la veille, à poser sur la route quand la case du lendemain est encore vide.
 * Un vrai rappel qui arrive tout seul (un mail) demande un envoi côté serveur : voir l'issue #5.
 */
export function RappelVeille({
  jour,
  partenaire,
  onOuvrir,
}: {
  jour: number;
  partenaire: Who;
  onOuvrir: () => void;
}) {
  return (
    <aside className="rappel" role="status">
      <span className="rappel-point" aria-hidden="true" />
      <p className="rappel-texte">
        Demain c'est la case {jour}, et elle est encore vide.
        <span> {PRENOM[partenaire]} l'ouvrira à 7 h.</span>
      </p>
      <button className="btn rappel-btn" type="button" onClick={onOuvrir}>Écrire</button>
    </aside>
  );
}
