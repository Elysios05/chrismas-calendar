import { useEffect, useState } from "react";
import type { PreparedResult, Who } from "../core/contracts";
import { MascotDialog } from "./Mascot";
import { PINGOU_CASE, type PingouLine } from "./pingou/lines";
import { useDialog } from "./useDialog";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

/** Photo en grand : fenêtre modale à part entière (focus piégé, Échap, retour du focus). */
function Loupe({ src, onClose }: { src: string; onClose: () => void }) {
  const panneau = useDialog<HTMLDivElement>(onClose);
  return (
    <div
      ref={panneau}
      tabIndex={-1}
      className="prep-loupe"
      role="dialog"
      aria-modal="true"
      aria-label="Photo en grand"
      onClick={onClose}
    >
      <img src={src} alt="" />
      <button type="button" className="sheet-close" onClick={onClose} aria-label="Fermer la photo">✕</button>
    </div>
  );
}

type Etape = "enveloppe" | "lettre";

/**
 * Lecture d'une case préparée : une enveloppe qui s'ouvre, une lettre qui se déplie,
 * puis les polaroïds qui tombent un par un.
 * Ne décide jamais de ce qui est lisible : c'est le serveur qui renvoie `locked` / `empty` / `ready`.
 */
export function PreparedCase({
  resultat,
  de,
  onPingou,
}: {
  resultat: PreparedResult;
  /** Celui ou celle qui a préparé la case */
  de: Who;
  /** Pour que la fenêtre parente fasse parler Pingou (sinon la bulle est affichée ici) */
  onPingou?: (lines: PingouLine[]) => void;
}) {
  const [etape, setEtape] = useState<Etape>("enveloppe");
  const [agrandie, setAgrandie] = useState<string | null>(null);
  const [lines, setLines] = useState<PingouLine[]>([]);
  const prenom = PRENOM[de];

  const dire = (l: PingouLine[]) => (onPingou ? onPingou(l) : setLines(l));

  useEffect(() => {
    if (resultat.status === "empty") dire(PINGOU_CASE.prepareeVide(prenom));
    else if (resultat.status === "ready") dire(PINGOU_CASE.prepareeAvant(prenom));
  }, [resultat.status, prenom]); // eslint-disable-line react-hooks/exhaustive-deps

  if (resultat.status === "locked") {
    return (
      <p className="prep-message">
        <span className="prep-cadenas" aria-hidden="true">🔒</span>
        Cette case s'ouvrira le jour J, à 7 h du matin.
      </p>
    );
  }

  if (resultat.status === "empty") {
    return (
      <p className="prep-message">
        <span className="prep-cadenas" aria-hidden="true">📭</span>
        La boîte est vide pour l'instant — {prenom} n'a rien laissé ici.
      </p>
    );
  }

  const { message, photos } = resultat.content;

  const ouvrir = () => {
    setEtape("lettre");
    dire(PINGOU_CASE.prepareeApres());
  };

  return (
    <div className="prep">
      {etape === "enveloppe" ? (
        <button type="button" className="prep-enveloppe" onClick={ouvrir}>
          <span className="prep-env-corps">
            <span className="prep-env-rabat" />
            <span className="prep-env-sceau" aria-hidden="true">💝</span>
          </span>
          <span className="prep-env-texte">Une lettre de {prenom}. Touche pour l'ouvrir.</span>
        </button>
      ) : (
        <>
          <article className="prep-lettre">
            <p className="prep-de">De {prenom}, pour toi</p>
            {message.split("\n").filter(Boolean).map((paragraphe, i) => (
              <p key={i} className="prep-texte">{paragraphe}</p>
            ))}
          </article>

          {photos.length > 0 && (
            <div className="prep-photos">
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  className="prep-polaroid"
                  style={{ ["--i" as string]: i, ["--angle" as string]: `${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg` }}
                  onClick={() => setAgrandie(src)}
                  aria-label={`Agrandir la photo ${i + 1}`}
                >
                  <img src={src} alt="" />
                  <span className="prep-legende">souvenir</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {agrandie && <Loupe src={agrandie} onClose={() => setAgrandie(null)} />}

      {!onPingou && <MascotDialog key={JSON.stringify(lines)} lines={lines} variant="inline" onDone={() => setLines([])} />}
    </div>
  );
}
