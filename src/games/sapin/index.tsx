/**
 * Jour 21 — Décorer le sapin à deux (en direct, ou chacun son tour).
 *
 * Règles choisies par Alexandre (26 nov) : décoration libre, sans score. Chacun pioche dans un panier
 * (boules, guirlande tracée du doigt, sucres d'orge, cœurs, clochettes, nœuds, cadeaux au pied) et pose
 * où il veut. En direct, on voit la main de l'autre et ses décos arriver. Quand chacun a posé
 * `seuilEtoile` décos, l'étoile apparaît : il faut la tenir à deux en même temps pour la poser.
 * Si l'autre n'est pas là, on la « tient en veille » et elle monte quand l'autre la tient à son tour.
 * Le sapin reste jusqu'au 24, et sa miniature décore la carte (carte.ts).
 *
 * Tout passe par le journal de coups (`shared/partie.ts`, clé « sapin ») ; la main de l'autre et
 * « je tiens l'étoile » passent par le flux rapide de `joinLive`, sans être enregistrés.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule } from "../../core/contracts";
import { SAPIN_JOUR21, SAPIN_LIGNES, type SapinContent, type TypeDeco } from "../../data/games/sapin-jour21";
import { de, prenomsDe } from "../shared/contenu";
import { Cadre, PanneauRegles, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { ouvrirPartie, type Partie } from "../shared/partie";
import { demarrerSapin, type Main, type MoteurSapin } from "./moteur";
import { CLE_SAPIN, etatDuJournal, etoilePrete, type CoupSapin, type EtatSapin } from "./regles";
import "./sapin.css";

const TITRE = "Jour 21 · Le sapin";

/** Identifiant de coup unique : auteur + instant + un peu de hasard */
const nouvelId = (moi: string) => `${moi}:${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Petites icônes du panier (le moteur dessine les vraies) */
function Icone({ type, couleur }: { type: TypeDeco; couleur: string }) {
  const s = { width: 26, height: 26, viewBox: "-12 -12 24 24" };
  switch (type) {
    case "boule": return <svg {...s}><rect x="-2.5" y="-11" width="5" height="3" fill="#e0b84a" /><circle r="8" fill={couleur} stroke="#0003" /><circle cx="-3" cy="-3" r="2" fill="#fffb" /></svg>;
    case "guirlande": return <svg {...s}><path d="M-11 -4 Q0 10 11 -4" stroke={couleur} strokeWidth="2.5" fill="none" /><circle cx="-6" cy="1" r="2.2" fill="#ffd25e" /><circle cx="0" cy="3" r="2.2" fill="#ff6b6b" /><circle cx="6" cy="1" r="2.2" fill="#7cc4ff" /></svg>;
    case "sucre": return <svg {...s}><path d="M-2 10 V-4 A4.5 4.5 0 0 1 7 -4" stroke="#fffaf2" strokeWidth="4.5" fill="none" strokeLinecap="round" /><path d="M-2 10 V-4 A4.5 4.5 0 0 1 7 -4" stroke={couleur} strokeWidth="4.5" fill="none" strokeDasharray="2.5 2.5" /></svg>;
    case "coeur": return <svg {...s}><path d="M0 9 C-13 0 -8 -11 0 -4 C8 -11 13 0 0 9 Z" fill={couleur} stroke="#0003" /></svg>;
    case "cloche": return <svg {...s}><path d="M-9 6 C-6 4 -6 -9 0 -9 C6 -9 6 4 9 6 Z" fill={couleur} stroke="#0003" /><circle cy="8" r="2.4" fill="#0005" /></svg>;
    case "noeud": return <svg {...s}><path d="M0 0 L-10 -6 L-10 6 Z M0 0 L10 -6 L10 6 Z" fill={couleur} stroke="#0003" /><circle r="3" fill={couleur} stroke="#0004" /></svg>;
    case "cadeau": return <svg {...s}><rect x="-9" y="-6" width="18" height="15" rx="2" fill={couleur} stroke="#0003" /><rect x="-1.5" y="-6" width="3" height="15" fill="#f6e7b8" /><rect x="-9" y="-1" width="18" height="3" fill="#f6e7b8" /></svg>;
  }
}

type Etape = "chargement" | "regles" | "sapin";

function Sapin({ ctx }: { ctx: GameContext }) {
  // réglages de jeu : rien à personnaliser dans le salon
  const contenu: SapinContent = SAPIN_JOUR21;
  const prenoms = prenomsDe(ctx);
  const autre = prenoms[ctx.partner];
  // « que Alexandre » → « qu'Alexandre » : on élide devant une voyelle, comme `de()`
  const ligne = useCallback((l: string) => l
    .replaceAll("que {autre}", /^[AEIOUYÉÈÊH]/i.test(autre) ? `qu'${autre}` : `que ${autre}`)
    .replaceAll("{autre}", autre), [autre]);
  const nCouleurs = contenu.couleurs.length;

  const [etape, setEtape] = useState<Etape>("chargement");
  const [etat, setEtat] = useState<EtatSapin>(() => etatDuJournal([], nCouleurs));
  const [ensemble, setEnsemble] = useState(false);
  const [type, setType] = useState<TypeDeco>("boule");
  const [couleur, setCouleur] = useState(0);

  const partie = useRef<Partie<CoupSapin> | null>(null);
  const moteur = useRef<MoteurSapin | null>(null);
  const hote = useRef<HTMLDivElement>(null);
  // valeurs lues par le moteur pendant un geste : des références, pas d'état figé
  const etatRef = useRef(etat);
  const ensembleRef = useRef(false);
  const autreTient = useRef(false);
  const outil = useRef({ type: type as TypeDeco, couleur });
  useEffect(() => { outil.current = { type, couleur }; }, [type, couleur]);
  const dejaAllume = useRef(false);

  const prete = etoilePrete(etat, contenu.seuilEtoile);

  /* ---------- journal ---------- */
  const recalculer = useCallback(() => {
    const p = partie.current;
    if (!p) return;
    const e = etatDuJournal(p.coups, nCouleurs);
    etatRef.current = e;
    setEtat(e);
    moteur.current?.afficher(e, etoilePrete(e, contenu.seuilEtoile));
    if (e.etoile && !dejaAllume.current && moteur.current) {
      dejaAllume.current = true;
      moteur.current.allumer(false);
    }
  }, [contenu.seuilEtoile, nCouleurs]);

  useEffect(() => {
    let fini = false;
    const nettoyages: (() => void)[] = [];
    void ouvrirPartie<CoupSapin>(ctx, CLE_SAPIN).then((p) => {
      if (fini) { p.quitter(); return; }
      partie.current = p;
      ensembleRef.current = p.ensemble();
      setEnsemble(p.ensemble());
      recalculer();
      nettoyages.push(p.surCoup((coup, direct) => {
        const avant = etatRef.current;
        recalculer();
        const t = coup.t;
        if (!etoilePrete(avant, contenu.seuilEtoile) && etoilePrete(etatRef.current, contenu.seuilEtoile)) ctx.say([SAPIN_LIGNES.etoilePrete]);
        if (coup.de === ctx.partner && direct && (t.k === "deco" || t.k === "guirlande")) {
          moteur.current?.saluer(coup.id, autre);
        }
        if (t.k === "etoile" && !avant.etoile && moteur.current) {
          dejaAllume.current = true;
          moteur.current.allumer(true);
          ctx.sound.play("win");
          ctx.say([SAPIN_LIGNES.etoilePosee]);
          ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
        }
        if (t.k === "veille" && coup.de === ctx.partner && direct) ctx.say([ligne(SAPIN_LIGNES.etoileAutreVeille)]);
      }));
      nettoyages.push(p.surPresence((e) => {
        ensembleRef.current = e;
        setEnsemble(e);
        if (!e) { autreTient.current = false; moteur.current?.mainAutre(null, autre); }
        ctx.sound.play(e ? "partner-in" : "partner-out");
        ctx.say([ligne(e ? SAPIN_LIGNES.autreArrive : SAPIN_LIGNES.autrePart)]);
      }));
      if (p.live) {
        const off1 = p.live.on("main", (m) => moteur.current?.mainAutre((m as Main | null) ?? null, autre));
        const off2 = p.live.on("etoile", (v) => { autreTient.current = !!(v as { tient?: boolean })?.tient; });
        if (typeof off1 === "function") nettoyages.push(off1);
        if (typeof off2 === "function") nettoyages.push(off2);
      }
      setEtape("regles");
    });
    return () => {
      fini = true;
      nettoyages.forEach((n) => n());
      partie.current?.quitter();
      partie.current = null;
    };
  }, [ctx, autre, ligne, recalculer, contenu.seuilEtoile]);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);
  useEffect(() => () => { moteur.current?.detruire(); moteur.current = null; }, []);

  /* ---------- gestes ---------- */
  const jouer = useCallback((id: string, t: CoupSapin) => { void partie.current?.jouer(id, t); }, []);

  const entrer = useCallback(() => {
    setEtape("sapin");
    requestAnimationFrame(() => {
      void (async () => {
        if (!hote.current || moteur.current) return;
        const m = await demarrerSapin(hote.current, {
          contenu,
          sound: ctx.sound,
          outil: () => outil.current,
          peutPoser: (t) => {
            const e = etatRef.current;
            return e.nb[ctx.me] < contenu.maxDecos && (t !== "guirlande" || e.guirlandes[ctx.me] < contenu.maxGuirlandes);
          },
          surPose: (coup) => {
            const e = etatRef.current;
            const avant = e.nb[ctx.me];
            jouer(`${coup.k}:${nouvelId(ctx.me)}`, coup);
            if (avant + 1 === contenu.seuilEtoile && e.nb[ctx.partner] < contenu.seuilEtoile && !e.etoile) {
              const n = contenu.seuilEtoile - e.nb[ctx.partner];
              ctx.say([`Encore ${n} déco${n > 1 ? "s" : ""} ${de(autre)} et l'étoile arrivera ⭐`]);
            }
          },
          surRefus: (r) => ctx.say([r === "pied" ? SAPIN_LIGNES.cadeauPied : r === "plein" ? SAPIN_LIGNES.plein : SAPIN_LIGNES.horsSapin]),
          surMain: (mm) => { try { partie.current?.live?.emit("main", mm); } catch { /* le direct est facultatif */ } },
          surEtoileTenue: (tient) => {
            try { partie.current?.live?.emit("etoile", { tient }); } catch { /* idem */ }
            if (!tient) return;
            if (ensembleRef.current && !autreTient.current) ctx.say([ligne(SAPIN_LIGNES.etoileAttendre)]);
            else if (!ensembleRef.current && etatRef.current.veille.has(ctx.partner)) ctx.say([ligne(SAPIN_LIGNES.etoileAutreVeille)]);
          },
          etoileAvance: () => !ensembleRef.current || autreTient.current,
          surEtoileComplete: () => {
            const e = etatRef.current;
            if (e.etoile) return;
            if (ensembleRef.current || e.veille.has(ctx.partner)) jouer("etoile", { k: "etoile" });
            else if (!e.veille.has(ctx.me)) {
              jouer(`veille:${ctx.me}`, { k: "veille" });
              ctx.sound.play("good");
              ctx.say([ligne(SAPIN_LIGNES.etoileVeille)]);
            } else ctx.say([ligne(SAPIN_LIGNES.etoileVeille)]);
          },
        });
        if (!m) return;
        moteur.current = m;
        const e = etatRef.current;
        m.afficher(e, etoilePrete(e, contenu.seuilEtoile));
        if (e.etoile) { dejaAllume.current = true; m.allumer(false); }
        ctx.say([
          e.decos.length ? "Revoilà votre sapin 🎄" : SAPIN_LIGNES.arrivee,
          ligne(ensembleRef.current ? SAPIN_LIGNES.autreLa : SAPIN_LIGNES.seul),
        ]);
      })();
    });
  }, [autre, contenu, ctx, jouer, ligne]);

  const annuler = () => {
    const miennes = etatRef.current.decos.filter((d) => d.de === ctx.me);
    const derniere = miennes[miennes.length - 1];
    if (!derniere) return;
    ctx.sound.play("whoosh");
    jouer(`retire:${derniere.id}`, { k: "retire", cible: derniere.id });
  };

  const choix = useMemo(() => contenu.couleurs, [contenu]);

  /* ---------- rendu ---------- */
  if (etape === "chargement") {
    return <Cadre titre={TITRE}><div className="jeu-centre"><div className="jeu-panneau"><div className="emoji">🎄</div><p>Pingou sort les cartons de décos…</p></div></div></Cadre>;
  }

  if (etape === "regles") {
    const deja = etat.decos.length > 0;
    return (
      <Cadre titre={TITRE}>
        <PanneauRegles
          emoji="🎄"
          titre={etat.etoile ? "Votre sapin brille" : "Le sapin du pôle Nord"}
          regles={[
            "Choisis une déco et sa couleur en bas, puis pose-la du doigt sur les branches. Les cadeaux vont au pied.",
            "Pour la guirlande, trace-la du doigt sur le sapin.",
            ensemble ? `${autre} est là : tu verras sa main et ses décos en direct.` : `${autre} n'est pas là : ses décos arriveront quand ${autre} passera.`,
            `Quand vous aurez posé ${contenu.seuilEtoile} décos par personne, l'étoile arrivera. Tenez-la à deux pour la poser tout en haut.`,
            "Pas de score, pas de chrono : le sapin reste jusqu'au 24, et on le voit sur la carte.",
          ]}
          bouton={deja ? "Retour au sapin" : "Décorer !"}
          onJouer={entrer}
        />
      </Cadre>
    );
  }

  const moi = etat.nb[ctx.me], lui = etat.nb[ctx.partner];
  return (
    <Cadre
      titre={TITRE}
      barre={<>
        <Puce pale>{ensemble ? `🟢 ${autre}` : `⚪ ${autre}`}</Puce>
        {!etat.etoile && <Puce pale>⭐ {Math.min(moi, contenu.seuilEtoile)}/{contenu.seuilEtoile} · {Math.min(lui, contenu.seuilEtoile)}/{contenu.seuilEtoile}</Puce>}
      </>}
    >
      <div className="jeu-canvas sapin-canvas" ref={hote}>
        {prete && !etat.etoile && <div className="sapin-astuce">⭐ Tenez l'étoile à deux !</div>}
      </div>
      <div className="sapin-panier">
        <div className="sapin-ligne" role="radiogroup" aria-label="Déco">
          {contenu.decos.map((d) => (
            <button key={d.type} className={`sapin-deco${type === d.type ? " choisi" : ""}`} aria-pressed={type === d.type}
              title={d.nom} aria-label={d.nom} onClick={() => { setType(d.type); ctx.sound.play("tap"); }}>
              <Icone type={d.type} couleur={hex(choix[couleur].hex)} />
            </button>
          ))}
        </div>
        <div className="sapin-ligne">
          {choix.map((c, i) => (
            <button key={c.nom} className={`sapin-couleur${couleur === i ? " choisi" : ""}`} aria-pressed={couleur === i}
              title={c.nom} aria-label={c.nom} style={{ background: hex(c.hex) }} onClick={() => { setCouleur(i); ctx.sound.play("tap"); }} />
          ))}
          <button className="sapin-annuler" onClick={annuler} disabled={moi === 0} title="Enlever ma dernière déco">↶ Annuler</button>
        </div>
      </div>
    </Cadre>
  );
}

export const sapinJour21: GameModule = {
  id: "sapin-jour21",
  title: "Décorer le sapin à deux",
  mount: (el, ctx) => monterReact(el, <Sapin ctx={ctx} />),
};
