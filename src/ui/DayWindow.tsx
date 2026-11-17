import { silentSound } from "../core/silent";
import { useEffect, useRef, useState } from "react";
import type { BackendApi, GameModule, GameResult, PreparedResult, SoundApi, Who } from "../core/contracts";
import { PLANNING, KIND_LABEL } from "../data/planning";
import { MascotDialog } from "./Mascot";
import { PreparedCase } from "./PreparedCase";
import { PINGOU_CASE, type PingouLine } from "./pingou/lines";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

/** Son silencieux : utilisé tant que l'équipe Audio n'est pas branchée. */
const MUET: SoundApi = silentSound;

type Etape = "intro" | "jeu" | "fini";

/**
 * Fenêtre d'une case : en-tête du jour, zone où se monte le `GameModule`, état terminé.
 * La fenêtre ne connaît rien des jeux : elle leur prête un élément DOM et un `GameContext`.
 */
export function DayWindow({
  day,
  me,
  backend,
  sound = MUET,
  game,
  dejaTerminee = false,
  onClose,
}: {
  day: number;
  me: Who;
  backend: BackendApi;
  sound?: SoundApi;
  /** Fourni par l'équipe Jeux ; absent = case pas encore écrite */
  game?: GameModule;
  dejaTerminee?: boolean;
  onClose: () => void;
}) {
  const info = PLANNING[day - 1]!;
  const partner: Who = me === "alexandre" ? "flavie" : "alexandre";
  const estPreparee = info.kind === "prepare";
  const [etape, setEtape] = useState<Etape>(dejaTerminee ? "fini" : "intro");
  const [resultat, setResultat] = useState<GameResult | null>(null);
  const [prepared, setPrepared] = useState<PreparedResult | null>(null);
  const [lines, setLines] = useState<PingouLine[]>(
    dejaTerminee ? PINGOU_CASE.termine() : PINGOU_CASE.avantJeu(info.title),
  );
  const zone = useRef<HTMLDivElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);

  // Échap ferme la fenêtre ; le focus part sur la croix à l'ouverture.
  useEffect(() => {
    fermer.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  // Montage du jeu quand on passe à l'étape « jeu ». Une case préparée n'a pas de jeu.
  useEffect(() => {
    if (etape !== "jeu" || estPreparee || !game || !zone.current) return;
    const demonter = game.mount(zone.current, {
      day,
      me,
      partner,
      backend,
      sound,
      content: undefined,
      say: (l) => setLines(l),
      complete: (r) => {
        setResultat(r);
        setEtape("fini");
        setLines(r.success ? PINGOU_CASE.termine() : PINGOU_CASE.rate());
        void backend.markCompleted(day).catch(() => { /* réessayé au prochain chargement */ });
      },
    });
    return demonter;
  }, [etape, estPreparee, game, day, me, partner, backend, sound]);

  const commencer = async () => {
    setLines([]);
    await backend.markOpened(day).catch(() => { /* on continue même hors ligne */ });
    sound.play("open");
    if (estPreparee) {
      // le serveur décide de ce qui est lisible : on ne devine rien côté interface
      const r = await backend.getPrepared(day, me).catch((): PreparedResult => ({ status: "locked" }));
      setPrepared(r);
    }
    setEtape("jeu");
  };

  return (
    <div className="sheet" role="presentation" onClick={onClose}>
      <section
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-titre"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <span className="sheet-emoji" aria-hidden="true">{info.emoji}</span>
          <div>
            <p className="sheet-day">{day} décembre · {KIND_LABEL[info.kind]}</p>
            {/* pour une case préparée, le titre du planning est redondant avec l'étiquette */}
            <h2 className="sheet-title" id="case-titre">
              {estPreparee ? `Une lettre de ${PRENOM[partner]}` : info.title}
            </h2>
          </div>
          <button ref={fermer} className="sheet-close" type="button" onClick={onClose} aria-label="Fermer la case">✕</button>
        </header>

        <div className="sheet-body">
          {etape === "intro" && (
            <div className="sheet-intro">
              <p className="sheet-intro-text">
                {info.kind === "direct"
                  ? `À jouer avec ${PRENOM[partner]}. S'il n'est pas là, tu joues ton tour et il répondra plus tard.`
                  : info.kind === "prepare"
                    ? `${PRENOM[partner]} a préparé cette case pour toi.`
                    : "Prêt ? Tu pourras revoir cette case autant de fois que tu veux."}
              </p>
              <button className="btn sheet-cta" type="button" onClick={commencer}>
                {info.kind === "prepare" ? "Ouvrir l'enveloppe" : "C'est parti"}
              </button>
            </div>
          )}

          {etape === "jeu" && estPreparee && prepared && (
            <PreparedCase resultat={prepared} de={partner} onPingou={setLines} />
          )}

          {etape === "jeu" && !estPreparee && (
            <>
              <div className="sheet-game" ref={zone} />
              {!game && <p className="sheet-vide">Cette case n'est pas encore écrite. Reviens bientôt 🐧</p>}
            </>
          )}

          {etape === "fini" && (
            <div className="sheet-fini">
              <span className="sheet-sceau" aria-hidden="true">{resultat?.success === false ? "🫧" : "✅"}</span>
              <p className="sheet-fini-text">
                {resultat?.score !== undefined ? `Ton score : ${resultat.score}` : "Case terminée."}
              </p>
              <div className="sheet-actions">
                <button className="btn ghost" type="button" onClick={() => { setResultat(null); setEtape("jeu"); }}>
                  Revoir la case
                </button>
                <button className="btn" type="button" onClick={onClose}>Retour à la route</button>
              </div>
            </div>
          )}
        </div>

        <MascotDialog key={lines.length ? JSON.stringify(lines) : "vide"} lines={lines} variant="inline" onDone={() => setLines([])} />
      </section>
    </div>
  );
}
