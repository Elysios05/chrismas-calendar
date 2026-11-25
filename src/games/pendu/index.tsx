/**
 * Jour 15 — Le pendu du bonhomme qui fond.
 *
 * 3 mots d'affilée, 7 morceaux de bonhomme par mot. Les accents sont offerts (taper E
 * révèle les É et È), les espaces, tirets et apostrophes aussi. Pingou lâche l'indice
 * après 3 erreurs. Les mots sont tirés à partir d'une graine : les deux joueurs ont
 * exactement les mêmes, donc les scores se comparent.
 *
 * Contenu : src/data/games/pendu-jour15.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule } from "../../core/contracts";
import { PENDU_JOUR15, SCHEMA_PENDU_JOUR15, reparerPendu, PENDU_VERDICTS, type MotPendu, type PenduContent } from "../../data/games/pendu-jour15";
import { prenomsDe, lireContenu } from "../shared/contenu";
import { Cadre, PanneauFin, PanneauRegles, Points, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { creerAlea } from "../shared/alea";
import { enregistrerMeilleur, lireMeilleur } from "../shared/scores";
import { Bonhomme } from "./Bonhomme";

const CLAVIER = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];

/** Lettre « nue » : É → E, ç → C. C'est ce qu'on compare. */
const base = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const estLettre = (c: string) => /\p{L}/u.test(c);

type Etape = "regles" | "jeu" | "fin";
type Manche = { trouve: boolean; erreurs: number; points: number };

function verdict(trouves: number) {
  return (PENDU_VERDICTS.find((v) => trouves >= v.min) ?? PENDU_VERDICTS[PENDU_VERDICTS.length - 1]).ligne;
}

/** Tire les mots de la partie : même graine = mêmes mots pour les deux joueurs, et au moins un mot perso */
function tirerMots(contenu: PenduContent): MotPendu[] {
  const alea = creerAlea(contenu.graine);
  const melange = <T,>(liste: T[]) => {
    const l = [...liste];
    for (let i = l.length - 1; i > 0; i--) { const j = alea.entier(0, i); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  };
  const perso = melange(contenu.mots.filter((m) => m.perso));
  const noel = melange(contenu.mots.filter((m) => !m.perso));
  const n = Math.max(1, contenu.motsParPartie);
  const choisis: MotPendu[] = [];
  // on alterne Noël / à vous deux, en complétant avec ce qui reste
  for (let i = 0; choisis.length < n && (noel.length || perso.length); i++) {
    const source = i % 2 === 0 ? (noel.length ? noel : perso) : (perso.length ? perso : noel);
    const m = source.shift();
    if (m) choisis.push(m);
  }
  return choisis;
}

function Pendu({ ctx }: { ctx: GameContext }) {
  const contenu = useMemo(() => lireContenu(ctx.content, PENDU_JOUR15, SCHEMA_PENDU_JOUR15, reparerPendu), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const prenomAutre = PRENOMS[ctx.partner];

  const [etape, setEtape] = useState<Etape>("regles");
  const [mots, setMots] = useState<MotPendu[]>([]);
  const [index, setIndex] = useState(0);
  const [jouees, setJouees] = useState<Set<string>>(new Set());
  const [manches, setManches] = useState<Manche[]>([]);
  const [fini, setFini] = useState<"gagne" | "perdu" | null>(null);
  const [indiceDonne, setIndiceDonne] = useState(false);
  const [sonMeilleur, setSonMeilleur] = useState<number | null>(null);
  const [record, setRecord] = useState(false);

  const minuteur = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const motCourant = mots[Math.min(index, Math.max(0, mots.length - 1))];
  const lettresDuMot = useMemo(
    () => (motCourant ? new Set([...motCourant.mot].filter(estLettre).map(base)) : new Set<string>()),
    [motCourant],
  );
  const erreurs = useMemo(() => [...jouees].filter((l) => !lettresDuMot.has(l)).length, [jouees, lettresDuMot]);
  const score = useMemo(() => manches.reduce((n, m) => n + m.points, 0), [manches]);
  const trouves = useMemo(() => manches.filter((m) => m.trouve).length, [manches]);

  useEffect(() => {
    let annule = false;
    void lireMeilleur(ctx.backend, ctx.day, ctx.partner).then((m) => { if (!annule) setSonMeilleur(m?.score ?? null); });
    return () => { annule = true; };
  }, [ctx]);

  useEffect(() => { ctx.sound.setGameMusic("calm"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- fin de partie ---------- */
  const terminer = useCallback(async (toutes: Manche[]) => {
    setEtape("fin");
    const pts = toutes.reduce((n, m) => n + m.points, 0);
    const nb = toutes.filter((m) => m.trouve).length;
    ctx.sound.play(nb > 0 ? "win" : "locked");
    const neuf = await enregistrerMeilleur(ctx.backend, ctx.day, ctx.me, pts, { trouves: nb });
    setRecord(neuf);
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const lignes = [`${nb} mot${nb > 1 ? "s" : ""} sur ${toutes.length}, ${pts} points.`, verdict(nb)];
    if (sonMeilleur !== null) {
      lignes.push(pts > sonMeilleur ? `Tu passes devant ${prenomAutre} (${sonMeilleur}) 🏆` : `${prenomAutre} est à ${sonMeilleur}…`);
    }
    ctx.say(lignes);
    // `ctx.complete` ferme le jeu : seulement au bouton « Fermer ».
  }, [ctx, prenomAutre, sonMeilleur]);

  const motSuivant = useCallback((manche: Manche) => {
    const toutes = [...manches, manche];
    setManches(toutes);
    setJouees(new Set()); setFini(null); setIndiceDonne(false);
    if (index + 1 >= mots.length) { void terminer(toutes); return; }
    setIndex(index + 1);
  }, [index, manches, mots.length, terminer]);

  /* ---------- jouer une lettre ---------- */
  const jouer = useCallback((lettre: string) => {
    if (etape !== "jeu" || fini || !motCourant || jouees.has(lettre)) return;
    const suite = new Set(jouees); suite.add(lettre);
    setJouees(suite);

    const bonne = lettresDuMot.has(lettre);
    const fautes = [...suite].filter((l) => !lettresDuMot.has(l)).length;
    ctx.sound.play(bonne ? "good" : "bad");

    if (bonne && [...lettresDuMot].every((l) => suite.has(l))) {
      setFini("gagne");
      const points = Math.max(0, contenu.pointsMot - contenu.coutErreur * fautes);
      ctx.sound.play("win");
      minuteur.current = window.setTimeout(() => motSuivant({ trouve: true, erreurs: fautes, points }), 1800);
      return;
    }
    if (!bonne && fautes >= contenu.morceaux) {
      setFini("perdu");
      minuteur.current = window.setTimeout(() => motSuivant({ trouve: false, erreurs: fautes, points: 0 }), 2200);
      return;
    }
    // l'indice arrive après quelques erreurs, une seule fois par mot
    if (!bonne && !indiceDonne && fautes >= contenu.erreursAvantIndice) {
      setIndiceDonne(true);
      ctx.say([motCourant.indice]);
    }
  }, [contenu, ctx, etape, fini, indiceDonne, jouees, lettresDuMot, motCourant, motSuivant]);

  // clavier physique sur ordinateur
  useEffect(() => {
    if (etape !== "jeu") return;
    const onKey = (e: KeyboardEvent) => {
      const l = base(e.key);
      if (l.length === 1 && /[A-Z]/.test(l)) jouer(l);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [etape, jouer]);

  const commencer = () => {
    setMots(tirerMots(contenu));
    setIndex(0); setManches([]); setJouees(new Set()); setFini(null); setIndiceDonne(false);
    setEtape("jeu");
    ctx.say(["Chaque lettre ratée fait fondre le bonhomme. Il compte sur toi ⛄"]);
  };

  /* ---------- rendu ---------- */
  if (etape === "regles") {
    return (
      <Cadre titre="Jour 15 · Pendu">
        <PanneauRegles
          emoji="⛄"
          titre="Le bonhomme qui fond"
          regles={[
            `${contenu.motsParPartie} mots à trouver, lettre par lettre.`,
            `Chaque lettre ratée fait fondre un morceau du bonhomme : ${contenu.morceaux} erreurs et il n'en reste qu'une flaque.`,
            "Les accents sont offerts : taper E révèle aussi les É et È.",
            `Si tu sèches, je te donne un indice après ${contenu.erreursAvantIndice} erreurs.`,
            sonMeilleur !== null
              ? `Score à battre : ${sonMeilleur.toLocaleString("fr-FR")} points (${prenomAutre}), sur les mêmes mots que toi.`
              : `${prenomAutre} aura exactement les mêmes mots : à toi de poser le score.`,
          ]}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (etape === "fin") {
    return (
      <Cadre titre="Jour 15 · Pendu">
        <PanneauFin
          emoji={trouves === manches.length ? "🏆" : trouves > 0 ? "⛄" : "🫠"}
          titre={`${trouves} mot${trouves > 1 ? "s" : ""} sur ${manches.length}`}
          score={score}
          uniteScore={record ? "Nouveau record personnel" : "points"}
          comparaison={[
            { label: "Erreurs", valeur: `${manches.reduce((n, m) => n + m.erreurs, 0)}` },
            { label: prenomAutre, valeur: sonMeilleur !== null ? sonMeilleur.toLocaleString("fr-FR") : "—" },
          ]}
          mots={verdict(trouves)}
          actions={[
            { texte: "Fermer", clair: true, onClic: () => ctx.complete({ success: trouves > 0, score, data: { trouves } }) },
            { texte: "Rejouer", onClic: commencer },
          ]}
        />
      </Cadre>
    );
  }

  const etats = mots.map((_, i): "vide" | "on" | "bon" | "rate" =>
    i === index ? "on" : i >= manches.length ? "vide" : manches[i].trouve ? "bon" : "rate");

  return (
    <Cadre
      titre="Jour 15 · Pendu"
      barre={<>
        <Puce pale>{index + 1} / {mots.length}</Puce>
        <Puce>{score.toLocaleString("fr-FR")}</Puce>
      </>}
    >
      <Points etats={etats} />
      <div className="jeu-centre pendu">
        <Bonhomme erreurs={erreurs} total={contenu.morceaux} />

        <div className="pendu-etiquette">{motCourant?.perso ? "À vous deux" : "Mot de Noël"}</div>

        {/* un groupe par mot : un mot ne se coupe jamais en fin de ligne */}
        <div className="pendu-mot" aria-label="mot à trouver">
          {(motCourant?.mot ?? "").split(" ").map((groupe, g) => (
            <span className="pendu-groupe" key={g}>
              {[...groupe].map((c, i) => {
                if (!estLettre(c)) return <span key={i} className="pendu-signe">{c}</span>;
                const vue = jouees.has(base(c)) || fini !== null;
                return <span key={i} className={"pendu-case" + (vue ? " vue" : "")}>{vue ? c : ""}</span>;
              })}
            </span>
          ))}
        </div>

        <div className={"pendu-retour" + (fini ? " " + fini : "")}>
          {fini === "gagne" ? "Trouvé ! ⛄" : fini === "perdu" ? `Raté — c'était « ${motCourant?.mot} »` : " "}
        </div>

        <div className="pendu-clavier">
          {CLAVIER.map((rangee) => (
            <div className="pendu-rangee" key={rangee}>
              {[...rangee].map((l) => {
                const jouee = jouees.has(l);
                const bonne = jouee && lettresDuMot.has(l);
                return (
                  <button
                    key={l}
                    type="button"
                    className={"pendu-touche" + (jouee ? (bonne ? " bonne" : " ratee") : "")}
                    disabled={jouee || fini !== null}
                    onClick={() => jouer(l)}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Cadre>
  );
}

export const penduJour15: GameModule = {
  id: "pendu-jour15",
  title: "Le bonhomme qui fond",
  mount: (el, ctx) => monterReact(el, <Pendu ctx={ctx} />),
};
