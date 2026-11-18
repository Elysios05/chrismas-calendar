/**
 * Jour 7 — Rébus en emojis.
 *
 * 8 énigmes, pas de chrono. On tape sa réponse (correction tolérante : accents, majuscules,
 * article, tirets). Si on sèche, Pingou révèle une lettre, autant de fois qu'on veut, mais
 * chaque lettre coûte des points. À la fin, comparaison chiffrée avec l'autre.
 *
 * Contenu : src/data/games/rebus-jour7.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { REBUS_JOUR7, REBUS_VERDICTS, type RebusContent } from "../../data/games/rebus-jour7";
import { Cadre, PanneauFin, PanneauRegles, Points, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { enregistrerMeilleur, lireMeilleur } from "../shared/scores";
import { bonneReponse, masquer, positionsLettres, prochaineLettre } from "./reponse";

const PRENOMS: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

type Etape = "regles" | "jeu" | "fin";
type Retour = { ton: "bon" | "rate" | "passe"; texte: string } | null;

function verdict(trouves: number) {
  return (REBUS_VERDICTS.find((v) => trouves >= v.min) ?? REBUS_VERDICTS[REBUS_VERDICTS.length - 1]).ligne;
}

function Rebus({ ctx }: { ctx: GameContext }) {
  const contenu = (ctx.content as RebusContent | null) ?? REBUS_JOUR7;
  const enigmes = contenu.enigmes;
  const total = enigmes.length;
  const prenomAutre = PRENOMS[ctx.partner];

  const [etape, setEtape] = useState<Etape>("regles");
  const [index, setIndex] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [revelees, setRevelees] = useState<Set<number>>(new Set());
  const [retour, setRetour] = useState<Retour>(null);
  const [resultats, setResultats] = useState<{ trouve: boolean; lettres: number; points: number }[]>([]);
  const [indiceLu, setIndiceLu] = useState(false);
  const [sonMeilleur, setSonMeilleur] = useState<number | null>(null);
  const [record, setRecord] = useState(false);

  const champ = useRef<HTMLInputElement>(null);
  const minuteur = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const enigme = enigmes[Math.min(index, total - 1)];
  const score = useMemo(() => resultats.reduce((n, r) => n + r.points, 0), [resultats]);
  const trouves = useMemo(() => resultats.filter((r) => r.trouve).length, [resultats]);
  const lettresUtilisees = useMemo(() => resultats.reduce((n, r) => n + r.lettres, 0), [resultats]);

  useEffect(() => {
    let annule = false;
    void lireMeilleur(ctx.backend, ctx.day, ctx.partner).then((m) => { if (!annule) setSonMeilleur(m?.score ?? null); });
    return () => { annule = true; };
  }, [ctx]);

  useEffect(() => { ctx.sound.setGameMusic("calm"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- fin de partie ---------- */
  const terminer = useCallback(async (tous: { trouve: boolean; lettres: number; points: number }[]) => {
    setEtape("fin");
    const pts = tous.reduce((n, r) => n + r.points, 0);
    const nb = tous.filter((r) => r.trouve).length;
    const lettres = tous.reduce((n, r) => n + r.lettres, 0);
    ctx.sound.play("win");
    const neuf = await enregistrerMeilleur(ctx.backend, ctx.day, ctx.me, pts, { trouves: nb, lettres });
    setRecord(neuf);
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const lignes = [`${nb} rébus sur ${total}, ${pts} points.`, verdict(nb)];
    if (sonMeilleur !== null) {
      lignes.push(pts > sonMeilleur
        ? `Et tu passes devant ${prenomAutre} (${sonMeilleur}) 🏆`
        : pts === sonMeilleur ? `Pile le même score que ${prenomAutre} 😮` : `${prenomAutre} est à ${sonMeilleur}…`);
    }
    ctx.say(lignes);
    // `ctx.complete` ferme le jeu : seulement au bouton « Fermer ».
  }, [ctx, prenomAutre, sonMeilleur, total]);

  const suivant = useCallback((resultat: { trouve: boolean; lettres: number; points: number }) => {
    const tous = [...resultats, resultat];
    setResultats(tous);
    setSaisie(""); setRevelees(new Set()); setIndiceLu(false);
    if (index + 1 >= total) { setRetour(null); void terminer(tous); return; }
    setIndex(index + 1);
    minuteur.current = window.setTimeout(() => { setRetour(null); champ.current?.focus(); }, 1400);
  }, [index, resultats, terminer, total]);

  /* ---------- actions ---------- */
  const valider = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (etape !== "jeu" || retour?.ton === "bon") return;
    if (!saisie.trim()) return;
    if (bonneReponse(saisie, enigme.reponse, enigme.variantes)) {
      const points = Math.max(contenu.pointsMini, contenu.pointsTrouve - contenu.coutLettre * revelees.size);
      ctx.sound.play("good");
      setRetour({ ton: "bon", texte: `Oui ! « ${enigme.reponse} » · +${points}` });
      setRevelees(new Set(positionsLettres(enigme.reponse)));
      minuteur.current = window.setTimeout(() => suivant({ trouve: true, lettres: revelees.size, points }), 1400);
    } else {
      ctx.sound.play("bad");
      setRetour({ ton: "rate", texte: "Pas tout à fait… essaie encore, ou demande une lettre." });
      setSaisie("");
      champ.current?.focus();
    }
  };

  const revelerLettre = () => {
    const i = prochaineLettre(enigme.reponse, revelees);
    if (i === null) return;
    ctx.sound.play("pop");
    const suite = new Set(revelees); suite.add(i);
    setRevelees(suite);
    setRetour(null);
    champ.current?.focus();
    // la première lettre demandée s'accompagne de l'indice écrit, s'il y en a un
    if (!indiceLu && enigme.indice) { setIndiceLu(true); ctx.say([enigme.indice]); }
  };

  const passer = () => {
    ctx.sound.play("locked");
    setRetour({ ton: "passe", texte: `C'était « ${enigme.reponse} »` });
    setRevelees(new Set(positionsLettres(enigme.reponse)));
    minuteur.current = window.setTimeout(() => suivant({ trouve: false, lettres: revelees.size, points: 0 }), 1600);
  };

  const commencer = () => {
    setEtape("jeu"); setIndex(0); setResultats([]); setSaisie(""); setRevelees(new Set()); setRetour(null);
    ctx.say(["Je te montre des emojis, tu me dis ce que ça veut dire. Si tu sèches, je te donne des lettres 🐧"]);
    setTimeout(() => champ.current?.focus(), 50);
  };

  /* ---------- rendu ---------- */
  if (etape === "regles") {
    return (
      <Cadre titre="Jour 7 · Rébus">
        <PanneauRegles
          emoji="🧩"
          titre="Rébus en emojis"
          regles={[
            `${total} suites d'emojis, à toi de trouver ce qu'elles veulent dire.`,
            "Tu tapes ta réponse : accents, majuscules et articles n'ont aucune importance.",
            `Bloqué ? Je te révèle une lettre, autant de fois que tu veux — chaque lettre coûte ${contenu.coutLettre} points.`,
            sonMeilleur !== null
              ? `Score à battre : ${sonMeilleur.toLocaleString("fr-FR")} points (${prenomAutre}).`
              : `${prenomAutre} n'a pas encore joué : tu poses le score à battre.`,
            "Pas de chrono.",
          ]}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (etape === "fin") {
    return (
      <Cadre titre="Jour 7 · Rébus">
        <PanneauFin
          emoji={trouves === total ? "🏆" : trouves >= total / 2 ? "🧩" : "🤔"}
          titre={`${trouves} rébus sur ${total}`}
          score={score}
          uniteScore={record ? "Nouveau record personnel" : "points"}
          comparaison={[
            { label: "Lettres demandées", valeur: `${lettresUtilisees}` },
            { label: prenomAutre, valeur: sonMeilleur !== null ? sonMeilleur.toLocaleString("fr-FR") : "—" },
          ]}
          mots={verdict(trouves)}
          actions={[
            { texte: "Fermer", clair: true, onClic: () => ctx.complete({ success: trouves > 0, score, data: { trouves, lettres: lettresUtilisees } }) },
            { texte: "Rejouer", onClic: commencer },
          ]}
        />
      </Cadre>
    );
  }

  const etats = enigmes.map((_, i): "vide" | "on" | "bon" | "rate" =>
    i === index ? "on" : i >= resultats.length ? "vide" : resultats[i].trouve ? "bon" : "rate");
  const restantes = positionsLettres(enigme.reponse).length - revelees.size;

  return (
    <Cadre
      titre="Jour 7 · Rébus"
      barre={<>
        <Puce pale>{index + 1} / {total}</Puce>
        <Puce>{score.toLocaleString("fr-FR")}</Puce>
      </>}
    >
      <Points etats={etats} />
      <div className="jeu-centre">
        <div className="rebus">
          <div className="rebus-emojis" aria-label="rébus en emojis">{enigme.emojis}</div>
          <div className="rebus-masque" aria-hidden="true">{masquer(enigme.reponse, revelees)}</div>

          <form className="rebus-form" onSubmit={valider}>
            <input
              ref={champ}
              className="rebus-champ"
              type="text"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Ta réponse…"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-label="Ta réponse"
              disabled={retour?.ton === "bon" || retour?.ton === "passe"}
            />
            <button className="jeu-btn" type="submit" disabled={!saisie.trim() || retour?.ton === "bon" || retour?.ton === "passe"}>
              Valider
            </button>
          </form>

          <div className={"rebus-retour" + (retour ? " " + retour.ton : "")}>{retour?.texte ?? " "}</div>

          <div className="jeu-actions">
            <button className="jeu-btn clair" type="button" onClick={revelerLettre} disabled={restantes === 0 || retour?.ton === "bon" || retour?.ton === "passe"}>
              Une lettre (−{contenu.coutLettre})
            </button>
            <button className="jeu-btn clair" type="button" onClick={passer} disabled={retour?.ton === "bon" || retour?.ton === "passe"}>
              Passer
            </button>
          </div>
        </div>
      </div>
    </Cadre>
  );
}

export const rebusJour7: GameModule = {
  id: "rebus-jour7",
  title: "Rébus en emojis",
  mount: (el, ctx) => monterReact(el, <Rebus ctx={ctx} />),
};
