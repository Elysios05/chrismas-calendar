/**
 * Jour 10 — Attrape-flocons dans la tempête (score à battre).
 * Ce fichier ne contient que l'habillage : règles, barre de score, écran de fin.
 * Le jeu lui-même est dans moteur.ts (PixiJS). Rien à personnaliser dans le salon (jeu d'adresse).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContext, GameModule } from "../../core/contracts";
import { FLOCONS_JOUR10, FLOCONS_LIGNES, type FloconsContent } from "../../data/games/flocons-jour10";
import { prenomsDe } from "../shared/contenu";
import { Cadre, Flash, PanneauFin, PanneauRegles, Progres, Puce, Vies } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { enregistrerMeilleur, lireMeilleur } from "../shared/scores";
import { demarrerFlocons, type EtatHud, type FinPartie } from "./moteur";

type Etape = "regles" | "partie" | "fin";

function Flocons({ ctx }: { ctx: GameContext }) {
  // jeu d'adresse : rien à personnaliser, on ignore ctx.content (un salon abîmé ne peut rien fausser)
  const contenu: FloconsContent = FLOCONS_JOUR10;
  const prenomAutre = prenomsDe(ctx)[ctx.partner];

  const [etape, setEtape] = useState<Etape>("regles");
  const [hud, setHud] = useState<EtatHud>({ score: 0, reste: contenu.duree, vies: contenu.vies, combo: 1 });
  const [flash, setFlash] = useState<{ texte: string; cle: number } | null>(null);
  const [fin, setFin] = useState<FinPartie | null>(null);
  const [monMeilleur, setMonMeilleur] = useState<number | null>(null);
  const [sonMeilleur, setSonMeilleur] = useState<number | null>(null);
  const [record, setRecord] = useState(false);

  const hote = useRef<HTMLDivElement>(null);
  const nettoyer = useRef<(() => void) | null>(null);
  const cleFlash = useRef(0);

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
    const neuf = await enregistrerMeilleur(ctx.backend, ctx.day, ctx.me, f.score, { flocons: f.flocons, dores: f.dores, serie: f.meilleureSerie });
    setRecord(neuf);
    setMonMeilleur((m) => (m === null || f.score > m ? f.score : m));
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const lignes = [f.tenu ? FLOCONS_LIGNES.tenu : FLOCONS_LIGNES.perdu, `Score : ${f.score} points.`];
    if (sonMeilleur !== null) {
      lignes.push(f.score > sonMeilleur
        ? `Tu passes devant ${prenomAutre} (${sonMeilleur}) 🏆`
        : `${prenomAutre} est à ${sonMeilleur}. Il te manque ${sonMeilleur - f.score} points…`);
    }
    ctx.say(lignes);
  }, [ctx, prenomAutre, sonMeilleur]);

  const jouer = useCallback(() => {
    setEtape("partie");
    setFin(null); setRecord(false);
    setHud({ score: 0, reste: contenu.duree, vies: contenu.vies, combo: 1 });
    requestAnimationFrame(() => {
      void (async () => {
        if (!hote.current) return;
        nettoyer.current?.();
        nettoyer.current = await demarrerFlocons(hote.current, {
          contenu,
          prenomAutre,
          scoreAutre: sonMeilleur,
          sound: ctx.sound,
          surHud: setHud,
          surFlash: (texte) => setFlash({ texte, cle: ++cleFlash.current }),
          surFin: (f) => { void terminerPartie(f); },
        });
      })();
    });
  }, [contenu, ctx.sound, prenomAutre, sonMeilleur, terminerPartie]);

  const titre = "Jour 10 · Flocons";

  if (etape === "regles") {
    return (
      <Cadre titre={titre}>
        <PanneauRegles
          emoji="❄️"
          titre="La tempête sur le lac"
          regles={[
            "Glisse ton doigt (ou les flèches ← →) pour déplacer Pingou et son panier.",
            `Attrape les flocons : +${contenu.pointsFlocon}, et plus si tu enchaînes. Les flocons dorés sont rares et valent ${contenu.pointsDore}.`,
            `Évite les glaçons : ${contenu.vies} dans le panier et c'est fini.`,
            "Quand Pingou crie « Rafale ! », le vent emporte tout sur le côté. Et la tempête forcit…",
            sonMeilleur !== null
              ? `Score à battre : ${sonMeilleur.toLocaleString("fr-FR")} points (${prenomAutre}).`
              : `${prenomAutre} n'a pas encore joué : à toi de donner le ton.`,
          ]}
          bouton={monMeilleur !== null ? "Nouvelle partie" : "C'est parti !"}
          onJouer={jouer}
        />
      </Cadre>
    );
  }

  if (etape === "fin" && fin) {
    return (
      <Cadre titre={titre}>
        <PanneauFin
          emoji={fin.tenu ? "🏆" : "🧊"}
          titre={fin.tenu ? "Tempête traversée !" : "Trop de glaçons…"}
          score={fin.score}
          uniteScore={record ? "Nouveau record personnel" : "points"}
          comparaison={[
            { label: "Flocons", valeur: `${fin.flocons}` },
            { label: "Meilleure série", valeur: `${fin.meilleureSerie}` },
            { label: prenomAutre, valeur: sonMeilleur !== null ? sonMeilleur.toLocaleString("fr-FR") : "—" },
          ]}
          mots={
            sonMeilleur === null
              ? `${prenomAutre} va devoir s'accrocher pour battre ça.`
              : fin.score > sonMeilleur
                ? `Tu es devant ${prenomAutre} de ${(fin.score - sonMeilleur).toLocaleString("fr-FR")} points 🏆`
                : `Il te manque ${(sonMeilleur - fin.score).toLocaleString("fr-FR")} points pour passer devant ${prenomAutre}.`
          }
          actions={[
            { texte: "Fermer", clair: true, onClic: () => ctx.complete({ success: fin.tenu, score: fin.score, data: fin }) },
            { texte: "Encore une partie", onClic: jouer },
          ]}
        />
      </Cadre>
    );
  }

  return (
    <Cadre
      titre={titre}
      barre={<>
        <Puce pale>{hud.reste} s</Puce>
        {hud.combo > 1.05 && <Puce pale>×{hud.combo.toFixed(1)}</Puce>}
        <Puce>{hud.score.toLocaleString("fr-FR")}</Puce>
        <Vies restantes={hud.vies} total={contenu.vies} />
      </>}
    >
      <Progres part={1 - hud.reste / contenu.duree} />
      <div className="jeu-canvas" ref={hote}>
        {flash && <Flash texte={flash.texte} cle={flash.cle} />}
      </div>
    </Cadre>
  );
}

export const floconsJour10: GameModule = {
  id: "flocons-jour10",
  title: "Attrape-flocons dans la tempête",
  mount: (el, ctx) => monterReact(el, <Flocons ctx={ctx} />),
};
