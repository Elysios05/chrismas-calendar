/**
 * Jour 2 — Descente en luge (score à battre).
 * Ce fichier ne contient que l'habillage : règles, barre de score, écran de fin.
 * Le jeu lui-même est dans moteur.ts (PixiJS).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { LUGE_JOUR2, LUGE_LIGNES, type LugeContent } from "../../data/games/luge-jour2";
import { Cadre, Flash, PanneauFin, PanneauRegles, Progres, Puce, Vies } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { enregistrerMeilleur, lireMeilleur } from "../shared/scores";
import { demarrerLuge, type EtatHud, type FinPartie } from "./moteur";

const PRENOMS: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

type Etape = "regles" | "partie" | "fin";

function Luge({ ctx }: { ctx: GameContext }) {
  const contenu = (ctx.content as LugeContent | null) ?? LUGE_JOUR2;
  const prenomAutre = PRENOMS[ctx.partner];

  const [etape, setEtape] = useState<Etape>("regles");
  const [hud, setHud] = useState<EtatHud>({ score: 0, distance: 0, vies: contenu.chocsPermis, combo: 1, turbo: false });
  const [flash, setFlash] = useState<{ texte: string; cle: number } | null>(null);
  const [fin, setFin] = useState<FinPartie | null>(null);
  const [monMeilleur, setMonMeilleur] = useState<number | null>(null);
  const [sonMeilleur, setSonMeilleur] = useState<number | null>(null);
  const [record, setRecord] = useState(false);

  const hote = useRef<HTMLDivElement>(null);
  const nettoyer = useRef<(() => void) | null>(null);
  const cleFlash = useRef(0);

  // meilleurs scores connus
  useEffect(() => {
    let annule = false;
    (async () => {
      const [mien, sien] = await Promise.all([
        lireMeilleur(ctx.backend, ctx.day, ctx.me),
        lireMeilleur(ctx.backend, ctx.day, ctx.partner),
      ]);
      if (annule) return;
      setMonMeilleur(mien?.score ?? null);
      setSonMeilleur(sien?.score ?? null);
    })();
    return () => { annule = true; };
  }, [ctx]);

  useEffect(() => () => { nettoyer.current?.(); ctx.sound.setGameMusic(null); }, [ctx.sound]);

  const terminerPartie = useCallback(async (f: FinPartie) => {
    setFin(f);
    setEtape("fin");
    nettoyer.current?.(); nettoyer.current = null;
    ctx.sound.setGameMusic("victory");
    const neuf = await enregistrerMeilleur(ctx.backend, ctx.day, ctx.me, f.score, { distance: f.distance, cadeaux: f.cadeaux });
    setRecord(neuf);
    setMonMeilleur((m) => (m === null || f.score > m ? f.score : m));
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const lignes = [f.arrivee ? LUGE_LIGNES.arrivee : LUGE_LIGNES.dernierChoc, `Score : ${f.score} points.`];
    if (sonMeilleur !== null) {
      lignes.push(f.score > sonMeilleur
        ? `Tu passes devant ${prenomAutre} (${sonMeilleur}) 🏆`
        : `${prenomAutre} est à ${sonMeilleur}. Il te manque ${sonMeilleur - f.score} points…`);
    }
    ctx.say(lignes);
    ctx.complete({ success: f.arrivee, score: f.score, data: f });
  }, [ctx, prenomAutre, sonMeilleur]);

  const jouer = useCallback(() => {
    setEtape("partie");
    setFin(null); setRecord(false);
    setHud({ score: 0, distance: 0, vies: contenu.chocsPermis, combo: 1, turbo: false });
    // le canvas n'existe qu'après le rendu de l'étape « partie »
    requestAnimationFrame(() => {
      void (async () => {
        if (!hote.current) return;
        nettoyer.current?.();
        nettoyer.current = await demarrerLuge(hote.current, {
          contenu,
          qui: ctx.me,
          prenomAutre,
          scoreAutre: sonMeilleur,
          sound: ctx.sound,
          surHud: setHud,
          surFlash: (texte) => setFlash({ texte, cle: ++cleFlash.current }),
          surFin: (f) => { void terminerPartie(f); },
        });
      })();
    });
  }, [contenu, ctx.me, ctx.sound, prenomAutre, sonMeilleur, terminerPartie]);

  if (etape === "regles") {
    return (
      <Cadre titre="Jour 2 · Luge">
        <PanneauRegles
          emoji="🛷"
          titre="La descente du col"
          regles={[
            "Glisse ton doigt (ou les flèches ← →) pour diriger la luge.",
            `Évite les sapins et les rochers : ${contenu.chocsPermis} chocs et c'est fini.`,
            `Ramasse les cadeaux (+${contenu.pointsCadeau} et plus si tu enchaînes) et les flocons bleus pour accélérer.`,
            `${Math.round(contenu.longueur / 100) * 100} m à descendre, environ deux minutes. Arriver en bas rapporte gros.`,
            sonMeilleur !== null
              ? `Score à battre : ${sonMeilleur.toLocaleString("fr-FR")} points (${prenomAutre}).`
              : `${prenomAutre} n'a pas encore descendu la piste : à toi de donner le ton.`,
          ]}
          bouton={monMeilleur !== null ? "Nouvelle descente" : "En luge !"}
          onJouer={jouer}
        />
      </Cadre>
    );
  }

  if (etape === "fin" && fin) {
    return (
      <Cadre titre="Jour 2 · Luge">
        <PanneauFin
          emoji={fin.arrivee ? "🏁" : "❄️"}
          titre={fin.arrivee ? "Arrivée en bas !" : "Dans la poudreuse…"}
          score={fin.score}
          uniteScore={record ? "Nouveau record personnel" : "points"}
          comparaison={[
            { label: "Distance", valeur: `${fin.distance} m` },
            { label: "Cadeaux", valeur: `${fin.cadeaux}` },
            { label: prenomAutre, valeur: sonMeilleur !== null ? sonMeilleur.toLocaleString("fr-FR") : "—" },
          ]}
          mots={
            sonMeilleur === null
              ? `${prenomAutre} va devoir se lever tôt pour battre ça.`
              : fin.score > sonMeilleur
                ? `Tu es devant ${prenomAutre} de ${(fin.score - sonMeilleur).toLocaleString("fr-FR")} points 🏆`
                : `Il te manque ${(sonMeilleur - fin.score).toLocaleString("fr-FR")} points pour passer devant ${prenomAutre}.`
          }
          actions={[
            { texte: "Fermer", clair: true, onClic: () => ctx.complete({ success: fin.arrivee, score: fin.score, data: fin }) },
            { texte: "Encore une descente", onClic: jouer },
          ]}
        />
      </Cadre>
    );
  }

  return (
    <Cadre
      titre="Jour 2 · Luge"
      barre={<>
        <Puce pale>{hud.distance} m</Puce>
        {hud.combo > 1.05 && <Puce pale>×{hud.combo.toFixed(1)}</Puce>}
        <Puce>{hud.score.toLocaleString("fr-FR")}</Puce>
        <Vies restantes={hud.vies} total={contenu.chocsPermis} />
      </>}
    >
      <Progres part={hud.distance / contenu.longueur} />
      <div className="jeu-canvas" ref={hote}>
        {flash && <Flash texte={flash.texte} cle={flash.cle} />}
      </div>
    </Cadre>
  );
}

export const lugeJour2: GameModule = {
  id: "luge-jour2",
  title: "Descente en luge",
  mount: (el, ctx) => monterReact(el, <Luge ctx={ctx} />),
};
