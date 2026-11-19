/**
 * Jour 11 — Quiz « Sommes-nous synchro ? » (premier jeu en direct).
 *
 * Les deux répondent à la même question sans voir l'autre ; même réponse = +1 synchro.
 * Tout passe par le journal de coups (`shared/partie.ts`) : en direct si l'autre est là,
 * chacun son tour sinon, sans deuxième version du jeu à écrire.
 *
 * Contenu : src/data/games/synchro-jour11.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { SYNCHRO_JOUR11, SYNCHRO_VERDICTS, type QuestionSynchro, type SynchroContent } from "../../data/games/synchro-jour11";
import { Cadre, PanneauFin, PanneauRegles, Points, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { ouvrirPartie, type Coup, type Partie } from "../shared/partie";

const PRENOMS: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const LETTRES = ["A", "B", "C", "D"];

type Reponse = { q: string; choix: number };
type Etape = "chargement" | "regles" | "attente" | "jeu" | "fin";

const idCoup = (q: string, qui: Who) => `rep:${q}:${qui}`;

function verdict(pourcent: number) {
  return (SYNCHRO_VERDICTS.find((v) => pourcent >= v.min) ?? SYNCHRO_VERDICTS[SYNCHRO_VERDICTS.length - 1]).ligne;
}

/** Les options d'une question « qui » sont les mêmes des deux côtés : des prénoms, jamais « toi » */
function optionsDe(q: QuestionSynchro): string[] {
  if (q.type === "qui") return [PRENOMS.alexandre, PRENOMS.flavie, "Les deux", "Ni l'un ni l'autre"];
  return q.options ?? [];
}

function Synchro({ ctx }: { ctx: GameContext }) {
  const contenu = (ctx.content as SynchroContent | null) ?? SYNCHRO_JOUR11;
  const questions = useMemo(() => contenu.questions.slice(0, Math.max(1, contenu.nombre)), [contenu]);
  const total = questions.length;
  const prenomAutre = PRENOMS[ctx.partner];

  const [etape, setEtape] = useState<Etape>("chargement");
  const [index, setIndex] = useState(0);
  const [ensemble, setEnsemble] = useState(false);
  const [secondes, setSecondes] = useState(0);
  /** version : force le recalcul quand un coup arrive */
  const [version, setVersion] = useState(0);

  const partie = useRef<Partie<Reponse> | null>(null);
  const minuteur = useRef<number | undefined>(undefined);

  /* ---------- ouverture de la partie ---------- */
  useEffect(() => {
    let annule = false;
    void ouvrirPartie<Reponse>(ctx).then((p) => {
      if (annule) { p.quitter(); return; }
      partie.current = p;
      setEnsemble(p.ensemble());
      // les coups déjà déposés ont été lus avant qu'on écoute : il faut relire le journal
      setVersion((v) => v + 1);
      p.surPresence((e) => {
        setEnsemble(e);
        if (e) ctx.say([`${prenomAutre} vient d'arriver ! On joue à deux 💞`]);
      });
      p.surCoup((coup, direct) => {
        setVersion((v) => v + 1);
        if (direct && coup.de === ctx.partner) ctx.sound.play("notify");
      });
      setEtape("regles");
    });
    return () => { annule = true; partie.current?.quitter(); partie.current = null; };
  }, [ctx, prenomAutre]);

  useEffect(() => { ctx.sound.setGameMusic("calm"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  /* ---------- lecture du journal ---------- */
  const reponses = useMemo(() => {
    void version;
    const miennes = new Map<string, number>();
    const siennes = new Map<string, number>();
    for (const c of partie.current?.coups ?? ([] as Coup<Reponse>[])) {
      (c.de === ctx.me ? miennes : siennes).set(c.t.q, c.t.choix);
    }
    return { miennes, siennes };
  }, [ctx.me, version]);

  const accords = useMemo(() => questions.filter((q) => {
    const a = reponses.miennes.get(q.id); const b = reponses.siennes.get(q.id);
    return a !== undefined && b !== undefined && a === b;
  }).length, [questions, reponses]);

  const repondues = useMemo(
    () => questions.filter((q) => reponses.miennes.has(q.id) && reponses.siennes.has(q.id)).length,
    [questions, reponses],
  );
  const enAttente = useMemo(
    () => questions.filter((q) => reponses.miennes.has(q.id) && !reponses.siennes.has(q.id)).length,
    [questions, reponses],
  );

  /* ---------- attente de l'autre ---------- */
  useEffect(() => {
    if (etape !== "attente") return;
    if (ensemble) { setEtape("jeu"); return; }
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [ensemble, etape]);

  const commencer = () => {
    // on reprend là où on s'était arrêté si on revient dans la case
    const suivante = questions.findIndex((q) => !reponses.miennes.has(q.id));
    setIndex(suivante === -1 ? 0 : suivante);
    if (suivante === -1) { setEtape("fin"); return; }
    setSecondes(0);
    if (ensemble) { setEtape("jeu"); ctx.say([`${prenomAutre} est là. Répondez chacun de votre côté, sans tricher 👀`]); }
    else { setEtape("attente"); ctx.say([`Je préviens ${prenomAutre}… on attend un petit peu ?`]); }
  };

  const terminer = useCallback(() => {
    setEtape("fin");
    ctx.sound.play("win");
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const pourcent = repondues ? Math.round((accords / repondues) * 100) : 0;
    ctx.say(repondues
      ? [`${accords} réponses communes sur ${repondues}.`, verdict(pourcent)]
      : [`C'est envoyé ! Je garde tout au chaud jusqu'à ce que ${prenomAutre} réponde 💌`]);
    // `ctx.complete` ferme le jeu : seulement au bouton « Fermer ».
  }, [accords, ctx, prenomAutre, repondues]);

  const repondre = async (choix: number) => {
    const q = questions[index];
    if (!q || reponses.miennes.has(q.id)) return;
    ctx.sound.play("tap");
    await partie.current?.jouer(idCoup(q.id, ctx.me), { q: q.id, choix });
    setVersion((v) => v + 1);
  };

  const suivante = () => {
    if (index + 1 >= total) { terminer(); return; }
    setIndex(index + 1);
  };

  /* ---------- rendu ---------- */
  if (etape === "chargement") {
    return <Cadre titre="Jour 11 · Synchro"><div className="jeu-centre"><p className="quiz-attente">Je prépare la partie…</p></div></Cadre>;
  }

  const barrePresence = (
    <Puce pale>{ensemble ? `🟢 ${prenomAutre} est là` : `⚪️ ${prenomAutre} n'est pas connecté`}</Puce>
  );

  if (etape === "regles") {
    return (
      <Cadre titre="Jour 11 · Synchro" barre={barrePresence}>
        <PanneauRegles
          emoji="💞"
          titre="Sommes-nous synchro ?"
          regles={[
            `${total} questions, posées à vous deux en même temps.`,
            "Vous répondez chacun sans voir l'autre, puis les deux réponses se retournent ensemble.",
            "Même réponse = +1 point de synchro. Ce n'est pas un quiz, personne n'a « raison ».",
            "Pas de chrono : chacun son rythme.",
            ensemble
              ? `${prenomAutre} est connecté : vous jouez en direct.`
              : `${prenomAutre} n'est pas là : tu peux jouer ton tour, la réponse viendra plus tard.`,
          ]}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (etape === "attente") {
    const reste = Math.max(0, contenu.attenteAvantSolo - secondes);
    return (
      <Cadre titre="Jour 11 · Synchro" barre={barrePresence}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">🐧</div>
            <h2>J'appelle {prenomAutre}…</h2>
            <p>
              {reste > 0
                ? `Encore un instant, on ne sait jamais. ${reste} s`
                : `${prenomAutre} ne répond pas. Tu peux jouer ton tour : je garde tes réponses et je vous donne le score dès que ${prenomAutre} aura joué.`}
            </p>
            <div className="attente-points"><i /><i /><i /></div>
            <div className="jeu-actions">
              {reste === 0 && <button className="jeu-btn" onClick={() => { setEtape("jeu"); ctx.say(["C'est parti, je note tout 📝"]); }}>Jouer quand même</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (etape === "fin") {
    const pourcent = repondues ? Math.round((accords / repondues) * 100) : 0;
    return (
      <Cadre titre="Jour 11 · Synchro" barre={barrePresence}>
        <PanneauFin
          emoji={pourcent >= 70 ? "💞" : pourcent >= 40 ? "🙂" : "🤷"}
          titre={repondues ? `${accords} sur ${repondues} en commun` : "Réponses envoyées !"}
          score={repondues ? pourcent : undefined}
          uniteScore={repondues ? "% de synchro" : undefined}
          comparaison={[
            { label: "Questions jouées à deux", valeur: `${repondues}` },
            { label: `En attente de ${prenomAutre}`, valeur: `${enAttente}` },
          ]}
          mots={repondues
            ? verdict(pourcent)
            : `Dès que ${prenomAutre} aura répondu, reviens ici : le score s'affichera tout seul.`}
          actions={[{ texte: "Fermer", onClic: () => ctx.complete({ success: true, score: repondues ? accords : undefined, data: { accords, repondues } }) }]}
        />
      </Cadre>
    );
  }

  /* ---------- une question ---------- */
  const q = questions[index];
  const options = optionsDe(q);
  const mien = reponses.miennes.get(q.id);
  const sien = reponses.siennes.get(q.id);
  const revele = mien !== undefined && sien !== undefined;
  const dAccord = revele && mien === sien;

  const etats = questions.map((qq, i): "vide" | "on" | "bon" | "rate" => {
    const a = reponses.miennes.get(qq.id); const b = reponses.siennes.get(qq.id);
    if (a !== undefined && b !== undefined) return a === b ? "bon" : "rate";
    if (i === index) return "on";
    return "vide";
  });

  return (
    <Cadre
      titre="Jour 11 · Synchro"
      barre={<>{barrePresence}<Puce>{index + 1} / {total}</Puce></>}
    >
      <Points etats={etats} />
      <div className="jeu-centre">
        <div className="quiz-q">
          <div className="quiz-emoji">{q.emoji}</div>
          <div className="quiz-phase">{q.type === "qui" ? "Qui de vous deux ?" : "On choisit quoi ?"}</div>
          <p className="quiz-texte">{q.texte}</p>

          <div className="quiz-options">
            {options.map((opt, i) => {
              let classe = "quiz-option";
              if (mien === i) classe += revele ? (dAccord ? " bon" : " mauvais") : " choisi";
              if (revele && sien === i && mien !== i) classe += " sien";
              return (
                <button key={opt} className={classe} disabled={mien !== undefined} onClick={() => void repondre(i)}>
                  <span className="puce">{LETTRES[i]}</span>
                  <span className="texte">{opt}</span>
                  {revele && sien === i && <span className="sien-marque">{prenomAutre}</span>}
                </button>
              );
            })}
          </div>

          <div className={"quiz-retour" + (revele ? (dAccord ? " bon" : " rate") : "")}>
            {revele
              ? (dAccord ? "Synchro ! 💞" : (q.pingou ?? "Pas d'accord, cette fois."))
              : mien !== undefined
                ? (ensemble ? `En attente de ${prenomAutre}…` : `${prenomAutre} répondra plus tard 💌`)
                : " "}
          </div>

          {mien !== undefined && (
            <div className="jeu-actions">
              <button className="jeu-btn" onClick={suivante}>
                {index + 1 >= total ? "Voir le résultat" : "Question suivante"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Cadre>
  );
}

export const synchroJour11: GameModule = {
  id: "synchro-jour11",
  title: "Sommes-nous synchro ?",
  mount: (el, ctx) => monterReact(el, <Synchro ctx={ctx} />),
};
