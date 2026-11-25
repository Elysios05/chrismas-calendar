/**
 * Jour 17 — Mots croisés de votre histoire.
 *
 * Grille construite automatiquement à partir de `src/data/games/motscroises-jour17.ts`
 * (voir grille.ts) : Alexandre remplace les mots, la grille se refait toute seule.
 * Clavier AZERTY maison comme le pendu, « Vérifier » gratuit, « Une lettre » payée en points.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule } from "../../core/contracts";
import { MOTSCROISES_JOUR17, SCHEMA_MOTSCROISES_JOUR17, MOTSCROISES_VERDICTS } from "../../data/games/motscroises-jour17";
import { prenomsDe, lireContenu } from "../shared/contenu";
import { Cadre, PanneauFin, PanneauRegles, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { enregistrerMeilleur, lireMeilleur } from "../shared/scores";
import { construireGrille, type Entree, type Grille } from "./grille";

const CLAVIER = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
const base = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

type Etape = "regles" | "jeu" | "fin";
type Curseur = { ligne: number; col: number; dir: "h" | "v" };

function verdict(trouves: number) {
  return (MOTSCROISES_VERDICTS.find((v) => trouves >= v.min) ?? MOTSCROISES_VERDICTS[MOTSCROISES_VERDICTS.length - 1]).ligne;
}

/** Cases d'une entrée, dans l'ordre */
const casesDe = (e: Entree) =>
  [...e.mot].map((_, i) => ({ ligne: e.ligne + (e.dir === "v" ? i : 0), col: e.col + (e.dir === "h" ? i : 0) }));

function MotsCroises({ ctx }: { ctx: GameContext }) {
  const contenu = useMemo(() => lireContenu(ctx.content, MOTSCROISES_JOUR17, SCHEMA_MOTSCROISES_JOUR17), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const prenomAutre = PRENOMS[ctx.partner];

  const grille = useMemo<Grille>(
    () => construireGrille(contenu.mots, contenu.motsParGrille, contenu.graine),
    [contenu],
  );

  const vide = useCallback(
    () => grille.solution.map((rangee) => rangee.map((c) => (c === null ? null : ""))),
    [grille],
  );

  const [etape, setEtape] = useState<Etape>("regles");
  const [saisie, setSaisie] = useState<(string | null)[][]>(vide);
  const [revelees, setRevelees] = useState(0);
  const [fausses, setFausses] = useState<Set<string>>(new Set());
  const [curseur, setCurseur] = useState<Curseur>({ ligne: 0, col: 0, dir: "h" });
  const [sonMeilleur, setSonMeilleur] = useState<number | null>(null);
  const [record, setRecord] = useState(false);

  const minuteur = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  useEffect(() => {
    let annule = false;
    void lireMeilleur(ctx.backend, ctx.day, ctx.partner).then((m) => { if (!annule) setSonMeilleur(m?.score ?? null); });
    return () => { annule = true; };
  }, [ctx]);

  useEffect(() => { ctx.sound.setGameMusic("calm"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- état dérivé ---------- */
  const entreeCourante = useMemo(() => {
    const dansEntree = (e: Entree) =>
      e.dir === curseur.dir && casesDe(e).some((c) => c.ligne === curseur.ligne && c.col === curseur.col);
    return grille.entrees.find(dansEntree) ?? grille.entrees.find((e) =>
      casesDe(e).some((c) => c.ligne === curseur.ligne && c.col === curseur.col));
  }, [curseur, grille]);

  const entreeFinie = useCallback(
    (e: Entree) => casesDe(e).every(({ ligne, col }) => saisie[ligne][col] === grille.solution[ligne][col]),
    [grille, saisie],
  );
  const trouvees = useMemo(() => grille.entrees.filter(entreeFinie).length, [entreeFinie, grille]);
  const score = useMemo(
    () => Math.max(0, trouvees * contenu.pointsMot - revelees * contenu.coutLettre),
    [contenu, revelees, trouvees],
  );
  const toutRempli = useMemo(
    () => grille.solution.every((rangee, l) => rangee.every((c, col) => c === null || saisie[l][col] === c)),
    [grille, saisie],
  );

  /* ---------- fin ---------- */
  const terminer = useCallback(async (complet: boolean) => {
    setEtape("fin");
    ctx.sound.play(complet ? "win" : "locked");
    const neuf = await enregistrerMeilleur(ctx.backend, ctx.day, ctx.me, score, { trouves: trouvees, lettres: revelees });
    setRecord(neuf);
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const lignes = [`${trouvees} mot${trouvees > 1 ? "s" : ""} sur ${grille.entrees.length}, ${score} points.`, verdict(trouvees)];
    if (sonMeilleur !== null) {
      lignes.push(score > sonMeilleur ? `Tu passes devant ${prenomAutre} (${sonMeilleur}) 🏆` : `${prenomAutre} est à ${sonMeilleur}…`);
    }
    ctx.say(lignes);
    // `ctx.complete` ferme le jeu : seulement au bouton « Fermer ».
  }, [ctx, grille.entrees.length, prenomAutre, revelees, score, sonMeilleur, trouvees]);

  useEffect(() => {
    if (etape === "jeu" && toutRempli) {
      minuteur.current = window.setTimeout(() => void terminer(true), 700);
    }
  }, [etape, terminer, toutRempli]);

  /* ---------- écriture ---------- */
  const avancer = useCallback((pas: number) => {
    const e = entreeCourante;
    if (!e) return;
    const cases = casesDe(e);
    const i = cases.findIndex((c) => c.ligne === curseur.ligne && c.col === curseur.col);
    const suivant = cases[Math.min(cases.length - 1, Math.max(0, i + pas))];
    if (suivant) setCurseur({ ...suivant, dir: e.dir });
  }, [curseur, entreeCourante]);

  const ecrire = useCallback((lettre: string) => {
    if (etape !== "jeu") return;
    const { ligne, col } = curseur;
    if (grille.solution[ligne]?.[col] == null) return;
    setSaisie((s) => s.map((rangee, l) => rangee.map((c, cc) => (l === ligne && cc === col ? lettre : c))));
    setFausses((f) => { const n = new Set(f); n.delete(`${ligne},${col}`); return n; });
    ctx.sound.play("tap");
    avancer(1);
  }, [avancer, ctx.sound, curseur, etape, grille]);

  const effacer = useCallback(() => {
    const { ligne, col } = curseur;
    if (grille.solution[ligne]?.[col] == null) return;
    if (saisie[ligne][col]) {
      setSaisie((s) => s.map((rangee, l) => rangee.map((c, cc) => (l === ligne && cc === col ? "" : c))));
    } else avancer(-1);
  }, [avancer, curseur, grille, saisie]);

  // clavier physique sur ordinateur
  useEffect(() => {
    if (etape !== "jeu") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { e.preventDefault(); effacer(); return; }
      if (e.key === "ArrowRight") { setCurseur((c) => ({ ...c, dir: "h" })); return; }
      if (e.key === "ArrowDown") { setCurseur((c) => ({ ...c, dir: "v" })); return; }
      const l = base(e.key);
      if (l.length === 1 && /[A-Z]/.test(l)) { e.preventDefault(); ecrire(l); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [ecrire, effacer, etape]);

  /* ---------- aides ---------- */
  const verifier = () => {
    const mauvaises = new Set<string>();
    grille.solution.forEach((rangee, l) => rangee.forEach((bonne, c) => {
      const mise = saisie[l][c];
      if (bonne && mise && mise !== bonne) mauvaises.add(`${l},${c}`);
    }));
    setFausses(mauvaises);
    ctx.sound.play(mauvaises.size ? "bad" : "good");
    if (!mauvaises.size) ctx.say(["Tout ce que tu as écrit est juste 👌"]);
    minuteur.current = window.setTimeout(() => setFausses(new Set()), 2600);
  };

  const revelerLettre = () => {
    const { ligne, col } = curseur;
    const bonne = grille.solution[ligne]?.[col];
    if (!bonne || saisie[ligne][col] === bonne) return;
    setSaisie((s) => s.map((rangee, l) => rangee.map((c, cc) => (l === ligne && cc === col ? bonne : c))));
    setRevelees((n) => n + 1);
    ctx.sound.play("pop");
    avancer(1);
  };

  const choisirCase = (ligne: number, col: number) => {
    if (grille.solution[ligne][col] == null) return;
    setCurseur((c) => {
      const memeCase = c.ligne === ligne && c.col === col;
      const autre = c.dir === "h" ? "v" : "h";
      // retoucher la même case bascule horizontal / vertical si c'est possible
      const possible = grille.entrees.some((e) => e.dir === autre && casesDe(e).some((x) => x.ligne === ligne && x.col === col));
      return { ligne, col, dir: memeCase && possible ? autre : c.dir };
    });
  };

  const commencer = () => {
    setSaisie(vide()); setRevelees(0); setFausses(new Set()); setEtape("jeu");
    const premiere = grille.entrees[0];
    if (premiere) setCurseur({ ligne: premiere.ligne, col: premiere.col, dir: premiere.dir });
    ctx.say(["Touche une case, puis écris. Retoucher la même case passe de horizontal à vertical 🐧"]);
  };

  /* ---------- rendu ---------- */
  if (etape === "regles") {
    return (
      <Cadre titre="Jour 17 · Mots croisés">
        <PanneauRegles
          emoji="🔠"
          titre="Mots croisés de votre histoire"
          regles={[
            `${grille.entrees.length} mots à retrouver : la moitié sur Noël, la moitié sur vous deux.`,
            "Touche une case et écris. Retoucher la même case bascule entre horizontal et vertical.",
            "« Vérifier » marque en rouge les lettres fausses, et c'est gratuit.",
            `Une lettre révélée coûte ${contenu.coutLettre} points — autant que tu veux, mais le score s'en souvient.`,
            sonMeilleur !== null
              ? `Score à battre : ${sonMeilleur.toLocaleString("fr-FR")} points (${prenomAutre}), sur la même grille.`
              : `${prenomAutre} aura exactement la même grille : à toi de poser le score.`,
          ]}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (etape === "fin") {
    return (
      <Cadre titre="Jour 17 · Mots croisés">
        <PanneauFin
          emoji={trouvees === grille.entrees.length ? "🏆" : trouvees > 0 ? "🔠" : "🤔"}
          titre={`${trouvees} mot${trouvees > 1 ? "s" : ""} sur ${grille.entrees.length}`}
          score={score}
          uniteScore={record ? "Nouveau record personnel" : "points"}
          comparaison={[
            { label: "Lettres révélées", valeur: `${revelees}` },
            { label: prenomAutre, valeur: sonMeilleur !== null ? sonMeilleur.toLocaleString("fr-FR") : "—" },
          ]}
          mots={verdict(trouvees)}
          actions={[
            { texte: "Fermer", clair: true, onClic: () => ctx.complete({ success: trouvees > 0, score, data: { trouves: trouvees, lettres: revelees } }) },
            { texte: "Rejouer", onClic: commencer },
          ]}
        />
      </Cadre>
    );
  }

  const casesActives = new Set(entreeCourante ? casesDe(entreeCourante).map((c) => `${c.ligne},${c.col}`) : []);

  return (
    <Cadre
      titre="Jour 17 · Mots croisés"
      barre={<>
        <Puce pale>{trouvees} / {grille.entrees.length}</Puce>
        <Puce>{score.toLocaleString("fr-FR")}</Puce>
      </>}
    >
      <div className="jeu-centre mc">
        <div
          className="mc-grille"
          style={{ gridTemplateColumns: `repeat(${grille.colonnes}, 1fr)`, maxWidth: `${grille.colonnes * 40}px` }}
        >
          {grille.solution.map((rangee, l) => rangee.map((bonne, c) => {
            if (bonne === null) return <span className="mc-noire" key={`${l},${c}`} />;
            const k = `${l},${c}`;
            const choisie = curseur.ligne === l && curseur.col === c;
            const classes = ["mc-case"];
            if (casesActives.has(k)) classes.push("active");
            if (choisie) classes.push("choisie");
            if (fausses.has(k)) classes.push("fausse");
            return (
              <button type="button" key={k} className={classes.join(" ")} onClick={() => choisirCase(l, c)}>
                {grille.numeros[l][c] && <i>{grille.numeros[l][c]}</i>}
                {saisie[l][c]}
              </button>
            );
          }))}
        </div>

        <div className="mc-definition">
          {entreeCourante
            ? <><b>{entreeCourante.num} {entreeCourante.dir === "h" ? "horizontal" : "vertical"}</b> · {entreeCourante.definition}
              <span className="mc-tag">{entreeCourante.perso ? "à vous deux" : "Noël"}</span></>
            : "Touche une case pour commencer."}
        </div>

        <div className="pendu-clavier mc-clavier">
          {CLAVIER.map((rangee) => (
            <div className="pendu-rangee" key={rangee}>
              {[...rangee].map((l) => (
                <button key={l} type="button" className="pendu-touche" onClick={() => ecrire(l)}>{l}</button>
              ))}
              {rangee === "WXCVBN" && (
                <button type="button" className="pendu-touche large" onClick={effacer} aria-label="Effacer">⌫</button>
              )}
            </div>
          ))}
        </div>

        <div className="jeu-actions">
          <button className="jeu-btn clair" type="button" onClick={verifier}>Vérifier</button>
          <button className="jeu-btn clair" type="button" onClick={revelerLettre}>Une lettre (−{contenu.coutLettre})</button>
          <button className="jeu-btn clair" type="button" onClick={() => void terminer(false)}>J'arrête</button>
        </div>

        <details className="mc-liste">
          <summary>Toutes les définitions</summary>
          {(["h", "v"] as const).map((dir) => (
            <div key={dir}>
              <h3>{dir === "h" ? "Horizontalement" : "Verticalement"}</h3>
              <ul>
                {grille.entrees.filter((e) => e.dir === dir).map((e) => (
                  <li key={`${e.num}${e.dir}${e.mot}`}>
                    <button type="button" className={entreeFinie(e) ? "faite" : ""} onClick={() => setCurseur({ ligne: e.ligne, col: e.col, dir: e.dir })}>
                      <b>{e.num}.</b> {e.definition}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </div>
    </Cadre>
  );
}

export const motsCroisesJour17: GameModule = {
  id: "motscroises-jour17",
  title: "Mots croisés de votre histoire",
  mount: (el, ctx) => monterReact(el, <MotsCroises ctx={ctx} />),
};
