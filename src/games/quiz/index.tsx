/**
 * Jour 1 — Quiz « Est-ce que tu me connais ? »
 *
 * Deux temps :
 *  1. « Toi d'abord » : tu réponds pour toi (10 questions). Tes réponses deviennent la vérité.
 *  2. « À toi de deviner » : tu réponds à la place de l'autre.
 *     - si l'autre a déjà rempli ses réponses → correction immédiate ;
 *     - sinon → pas de correction, le score arrive quand l'autre a joué ;
 *     - en mode démo → les réponses d'exemple de src/data servent de réponses de l'autre.
 *
 * Contenu : src/data/games/quiz-jour1.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { QUIZ_JOUR1, SCHEMA_QUIZ_JOUR1, reparerQuiz, QUIZ_VERDICTS } from "../../data/games/quiz-jour1";
import { prenomsDe, lireContenu } from "../shared/contenu";
import { Cadre, PanneauFin, PanneauRegles, Points, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";

const LETTRES = ["A", "B", "C", "D", "E", "F"];

type Etape = "chargement" | "regles" | "moi" | "devine" | "fin";

const cleReponses = (qui: Who) => `reponses:${qui}`;
const cleDevinettes = (qui: Who) => `devinettes:${qui}`;

function verdict(score: number, total: number) {
  const sur10 = Math.round((score / Math.max(1, total)) * 10);
  return (QUIZ_VERDICTS.find((v) => sur10 >= v.min) ?? QUIZ_VERDICTS[QUIZ_VERDICTS.length - 1]).ligne;
}

function Quiz({ ctx }: { ctx: GameContext }) {
  const contenu = useMemo(() => lireContenu(ctx.content, QUIZ_JOUR1, SCHEMA_QUIZ_JOUR1, reparerQuiz), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const questions = useMemo(
    () => contenu.questions.slice(0, Math.max(1, contenu.nombre)),
    [contenu],
  );
  const total = questions.length;
  const prenomAutre = PRENOMS[ctx.partner];

  const [etape, setEtape] = useState<Etape>("chargement");
  const [index, setIndex] = useState(0);
  const [choix, setChoix] = useState<number | null>(null);
  /** mes réponses sur moi */
  const [mesReponses, setMesReponses] = useState<number[]>([]);
  /** mes paris sur l'autre */
  const [devinettes, setDevinettes] = useState<number[]>([]);
  /** les réponses de l'autre (null = pas encore joué) */
  const [sesReponses, setSesReponses] = useState<number[] | null>(null);
  /** vrai si `sesReponses` vient des exemples de src/data et pas de l'autre */
  const [exemples, setExemples] = useState(false);
  /** ses paris sur moi, pour afficher « Flavie te connaît : x/10 » */
  const [sesDevinettes, setSesDevinettes] = useState<number[] | null>(null);
  const [dejaRepondu, setDejaRepondu] = useState(false);

  const minuteur = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  /* ---------- chargement de l'état ---------- */
  useEffect(() => {
    let annule = false;
    (async () => {
      const lire = async (cle: string) => {
        try { return await ctx.backend.getGameState<number[]>(ctx.day, cle); } catch { return null; }
      };
      const [miennes, siennes, sesParis] = await Promise.all([
        lire(cleReponses(ctx.me)),
        lire(cleReponses(ctx.partner)),
        lire(cleDevinettes(ctx.partner)),
      ]);
      if (annule) return;
      if (miennes?.length) { setMesReponses(miennes); setDejaRepondu(true); }
      if (siennes?.length) setSesReponses(siennes);
      else if (ctx.backend.mode === "demo") {
        setSesReponses(questions.map((q) => q.exemple[ctx.partner]));
        setExemples(true);
      }
      if (sesParis?.length) setSesDevinettes(sesParis);
      setEtape("regles");
    })();
    return () => { annule = true; };
  }, [ctx, questions]);

  useEffect(() => { ctx.sound.setGameMusic("calm"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- scores ---------- */
  const monScore = useMemo(() => {
    if (!sesReponses) return null;
    return devinettes.reduce((n, d, i) => n + (d === sesReponses[i] ? 1 : 0), 0);
  }, [devinettes, sesReponses]);

  const sonScore = useMemo(() => {
    if (!sesDevinettes || !mesReponses.length) return null;
    return sesDevinettes.reduce((n, d, i) => n + (d === mesReponses[i] ? 1 : 0), 0);
  }, [sesDevinettes, mesReponses]);

  /* ---------- déroulé ---------- */
  const commencer = useCallback(() => {
    setIndex(0); setChoix(null);
    if (dejaRepondu) {
      setDevinettes([]);
      setEtape("devine");
      ctx.say([`Tes réponses sont déjà enregistrées. On passe directement à la partie amusante : devine ${prenomAutre} !`]);
    } else {
      setMesReponses([]);
      setEtape("moi");
      ctx.say(["D'abord, dis-moi la vérité sur toi. Pas de triche, je regarde 🐧"]);
    }
  }, [ctx, dejaRepondu, prenomAutre]);

  const terminer = useCallback(async (paris: number[], miennes: number[]) => {
    setEtape("fin");
    const connus = sesReponses;
    const score = connus ? paris.reduce((n, d, i) => n + (d === connus[i] ? 1 : 0), 0) : null;
    try {
      await ctx.backend.setGameState<number[]>(ctx.day, cleDevinettes(ctx.me), paris);
      if (!dejaRepondu) await ctx.backend.setGameState<number[]>(ctx.day, cleReponses(ctx.me), miennes);
    } catch { /* hors ligne : la partie reste jouée, on ne bloque pas */ }
    if (score !== null) {
      ctx.sound.play("win");
      ctx.say([`${score} sur ${total} !`, verdict(score, total)]);
    } else {
      ctx.say([
        `C'est envoyé ! ${prenomAutre} n'a pas encore répondu, donc je garde ton score au chaud.`,
        `Dès que ${prenomAutre} aura joué, je te dirai combien tu as eu sur ${total} 💌`,
      ]);
    }
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    // `ctx.complete` ferme le jeu : on attend que le joueur ait lu son résultat.
  }, [ctx, dejaRepondu, prenomAutre, sesReponses, total]);

  const repondre = (option: number) => {
    if (choix !== null) return;
    setChoix(option);
    const enDevinette = etape === "devine";
    const correction = enDevinette && sesReponses !== null;
    if (correction) ctx.sound.play(sesReponses[index] === option ? "good" : "bad");
    else ctx.sound.play("pop");

    const suite = () => {
      setChoix(null);
      if (enDevinette) {
        const paris = [...devinettes, option];
        setDevinettes(paris);
        if (index + 1 >= total) void terminer(paris, mesReponses);
        else setIndex(index + 1);
      } else {
        const miennes = [...mesReponses, option];
        setMesReponses(miennes);
        if (index + 1 >= total) {
          setIndex(0);
          setDevinettes([]);
          setEtape("devine");
          ctx.say([`Merci ! Maintenant, la vraie épreuve : qu'aurait répondu ${prenomAutre} ? 💞`]);
        } else setIndex(index + 1);
      }
    };
    minuteur.current = window.setTimeout(suite, correction ? 1150 : 420);
  };

  /* ---------- rendu ---------- */
  const q = questions[Math.min(index, total - 1)];
  const bonneReponse = etape === "devine" && sesReponses ? sesReponses[index] : null;
  const corrige = choix !== null && bonneReponse !== null;

  const etats = useMemo(() => {
    const faites = etape === "devine" ? devinettes : mesReponses;
    return questions.map((_, i): "vide" | "on" | "bon" | "rate" => {
      if (i === index && etape !== "fin") return "on";
      if (i >= faites.length) return "vide";
      if (etape === "devine" && sesReponses) return faites[i] === sesReponses[i] ? "bon" : "rate";
      return "bon";
    });
  }, [devinettes, etape, index, mesReponses, questions, sesReponses]);

  if (etape === "chargement") {
    return <Cadre titre="Jour 1 · Quiz"><div className="jeu-centre"><p className="quiz-attente">Un instant, je récupère vos réponses…</p></div></Cadre>;
  }

  if (etape === "regles") {
    return (
      <Cadre titre="Jour 1 · Quiz">
        <PanneauRegles
          emoji="❓"
          titre="Est-ce que tu me connais ?"
          regles={[
            dejaRepondu
              ? "Tes réponses sur toi sont déjà enregistrées."
              : `D'abord ${total} questions sur toi : tu réponds la vérité.`,
            `Ensuite les mêmes ${total} questions, mais sur ${prenomAutre} : à toi de deviner.`,
            sesReponses
              ? (exemples
                ? "Mode démo : les réponses sont des exemples, c'est pour voir le jeu."
                : `${prenomAutre} a déjà répondu : tu sauras tout de suite si tu as bon.`)
              : `${prenomAutre} n'a pas encore répondu : ton score arrivera dès que ${prenomAutre} aura joué.`,
            "Pas de chrono. On prend son temps.",
          ]}
          bouton={dejaRepondu ? `Deviner ${prenomAutre}` : "C'est parti !"}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (etape === "fin") {
    const actions = [{
      texte: "Fermer",
      onClic: () => ctx.complete({ success: true, score: monScore ?? undefined, data: { devinettes, reponses: mesReponses } }),
    }];
    return (
      <Cadre titre="Jour 1 · Quiz">
        <PanneauFin
          emoji={monScore !== null && monScore >= total * 0.8 ? "🏆" : "💞"}
          titre={monScore !== null ? `Tu connais ${prenomAutre} à ${monScore}/${total}` : "Réponses envoyées !"}
          comparaison={[
            { label: `Toi sur ${prenomAutre}`, valeur: monScore !== null ? `${monScore}/${total}` : "—" },
            { label: `${prenomAutre} sur toi`, valeur: sonScore !== null ? `${sonScore}/${total}` : "en attente" },
          ]}
          mots={
            monScore !== null
              ? verdict(monScore, total) + (exemples ? " (mode démo : réponses d'exemple)" : "")
              : `Dès que ${prenomAutre} aura rempli ses réponses, reviens ici : je te dirai ton score.`
          }
          actions={actions}
        />
      </Cadre>
    );
  }

  const enonce = etape === "moi" ? q.surMoi : q.surAutre.replace("{autre}", prenomAutre);

  return (
    <Cadre
      titre="Jour 1 · Quiz"
      barre={<>
        <Puce pale>{etape === "moi" ? "Sur toi" : `Sur ${prenomAutre}`}</Puce>
        <Puce>{index + 1} / {total}</Puce>
      </>}
    >
      <Points etats={etats} />
      <div className="jeu-centre">
        <div className="quiz-q">
          <div className="quiz-emoji">{q.emoji}</div>
          <div className="quiz-phase">{etape === "moi" ? "La vérité sur toi" : `Qu'a répondu ${prenomAutre} ?`}</div>
          <p className="quiz-texte">{enonce}</p>
          <div className="quiz-options">
            {q.options.map((opt, i) => {
              let classe = "quiz-option";
              if (choix === i) classe += corrige ? (i === bonneReponse ? " bon" : " mauvais") : " choisi";
              else if (corrige && i === bonneReponse) classe += " bon";
              return (
                <button key={opt} className={classe} disabled={choix !== null} onClick={() => repondre(i)}>
                  <span className="puce">{LETTRES[i]}</span>{opt}
                </button>
              );
            })}
          </div>
          <div className={"quiz-retour" + (corrige ? (choix === bonneReponse ? " bon" : " rate") : "")}>
            {corrige
              ? (choix === bonneReponse ? "Bien vu ! 🎉" : `Raté — ${prenomAutre} a répondu « ${q.options[bonneReponse!]} »`)
              : (etape === "devine" && !sesReponses && choix !== null ? "C'est noté 💌" : " ")}
          </div>
        </div>
      </div>
    </Cadre>
  );
}

export const quizJour1: GameModule = {
  id: "quiz-jour1",
  title: "Est-ce que tu me connais ?",
  mount: (el, ctx) => monterReact(el, <Quiz ctx={ctx} />),
};
