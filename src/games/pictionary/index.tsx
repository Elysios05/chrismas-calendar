/**
 * Jour 5 — Pictionary de Noël, en direct (ou chacun son tour).
 *
 * Règles décidées avec Alexandre (24 nov) : 6 manches de 60 s, 3 dessins chacun en alternant ;
 * celui qui dessine choisit entre un mot de Noël et un mot « à vous deux » ; l'autre tape ses
 * propositions (correction tolérante) ; plus on trouve vite, plus les DEUX gagnent de points.
 * Outils : 8 couleurs, 3 épaisseurs, gomme, « Tout effacer ».
 * Si l'autre n'est pas là : Pingou attend 20 s, puis on joue en différé — les dessins sont
 * enregistrés trait par trait et rejoués devant l'autre, qui devine plus tard puis dessine à son tour.
 *
 * Tout passe par le journal de coups (`shared/partie.ts`) ; le direct utilise en plus la salle
 * `joinLive` (prêt, horloge commune, flux des traits). Contenu : src/data/games/pictionary-jour5.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { PICTIONARY_JOUR5, SCHEMA_PICTIONARY_JOUR5, type PictionaryContent } from "../../data/games/pictionary-jour5";
import { prenomsDe, lireContenu, de } from "../shared/contenu";
import { Cadre, PanneauRegles, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { ouvrirPartie, type Partie } from "../shared/partie";
import { bonneReponse, masquer } from "../rebus/reponse";
import { EPAISSEURS, GOMME, NOMS_COULEURS, PALETTE, estEffacer, vignette, type Element, type Trait } from "./dessin";
import { Tableau, type Crayon } from "./Tableau";
import {
  PREMIER, idDessin, idDevine, lireEtatLive, lireJournal, mancheDirecte, motsProposes, points, tacheSeul,
  type CoupPic, type EtatLive, type MotPropose, type Tache, type Theme,
} from "./regles";
import "./pictionary.css";

const THEMES: Record<Theme, string> = { noel: "Mot de Noël", nous: "À vous deux" };
const TITRE = "Jour 5 · Pictionary";

type Mode = "chargement" | "regles" | "attente" | "salon" | "direct" | "seul";

/** La manche que je vis en ce moment, en direct ou seul */
type EnCours = {
  /** dessine = je dessine ; devine = je devine ; regarde = l'autre devine mon dessin rejoué */
  role: "dessine" | "devine" | "regarde";
  k: number;
  mot: string;
  theme: Theme;
  variantes: string[];
  /** Heure locale (Date.now) du début */
  debut: number;
  /** Dessin déjà fini, rejoué à son rythme d'origine */
  rejeu: boolean;
  direct: boolean;
  r: number | null;
};

type Revele = { mot: string; trouve: boolean; secondes: number; dessinateur: Who; auto: boolean };

/** Message de flux d'un trait (non sauvegardé : le dessin complet est déposé à la fin) */
type MsgTrait = { r: number; i: number; c?: number; e?: number; p?: number[]; x?: 1; t?: number };

function variantesDe(c: PictionaryContent, mot: string): string[] {
  return [...c.noel, ...c.nous].find((m) => m.mot === mot)?.variantes ?? [];
}

/* ------------------------------------------------------------------ */
/* Choix du mot                                                        */
/* ------------------------------------------------------------------ */

function Choix({ mots, secondes, pour, onChoisir }: {
  mots: [MotPropose, MotPropose]; secondes: number; pour: string; onChoisir: (m: MotPropose) => void;
}) {
  const [reste, setReste] = useState(secondes);
  const choisi = useRef(false);
  const choisir = useCallback((m: MotPropose) => { if (!choisi.current) { choisi.current = true; onChoisir(m); } }, [onChoisir]);
  useEffect(() => {
    const t = setInterval(() => setReste((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (reste <= 0) choisir(mots[0]); }, [reste, mots, choisir]);
  return (
    <div className="jeu-centre">
      <div className="jeu-panneau">
        <div className="emoji">🎨</div>
        <h2>Que vas-tu dessiner ?</h2>
        <p>Choisis ton mot : {pour} ne le verra pas. {reste > 0 ? `${reste} s` : ""}</p>
        <div className="pic-choix">
          {mots.map((m) => (
            <button key={m.mot} className="pic-mot" onClick={() => choisir(m)}>
              <span>{THEMES[m.theme]}</span>
              <b>{m.mot}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Le jeu                                                              */
/* ------------------------------------------------------------------ */

function Pictionary({ ctx }: { ctx: GameContext }) {
  const contenu = useMemo(() => lireContenu(ctx.content, PICTIONARY_JOUR5, SCHEMA_PICTIONARY_JOUR5), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const n = Math.max(1, contenu.dessinsParJoueur);
  const total = Math.max(10, contenu.secondes);
  const autre = PRENOMS[ctx.partner];

  const [mode, setMode] = useState<Mode>("chargement");
  const [ensemble, setEnsemble] = useState(false);
  const [version, setVersion] = useState(0);
  const [etatLive, setEtatLive] = useState<EtatLive | null>(null);
  const [pret, setPret] = useState({ me: false, partner: false });
  const [seulEnCours, setSeulEnCours] = useState<EnCours | null>(null);
  const [choixSeul, setChoixSeul] = useState<Tache | null>(null);
  const [revele, setRevele] = useState<Revele | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [attente, setAttente] = useState(0);
  const [essais, setEssais] = useState<string[]>([]);
  const [saisie, setSaisie] = useState("");
  const [rate, setRate] = useState(0);
  const [couleur, setCouleur] = useState(0);
  const [epaisseur, setEpaisseur] = useState(1);
  const [gomme, setGomme] = useState(false);

  const partie = useRef<Partie<CoupPic> | null>(null);
  /** Le dessin affiché : le mien, celui qui arrive en direct, ou celui qu'on rejoue */
  const elements = useRef<(Element | undefined)[]>([]);
  const sale = useRef(false);
  /** Manche (r) à laquelle appartiennent les traits reçus en direct */
  const flux = useRef(-1);
  const tampon = useRef(new Map<number, Trait>());
  const fini = useRef(false);
  const nbEssais = useRef(0);

  /* ---------- ouverture ---------- */
  useEffect(() => {
    let annule = false;
    void ouvrirPartie<CoupPic>(ctx).then((p) => {
      if (annule) { p.quitter(); return; }
      partie.current = p;
      setEnsemble(p.ensemble());
      setVersion((v) => v + 1); // les coups lus avant qu'on écoute
      p.surPresence((e) => setEnsemble(e));
      p.surCoup((coup, direct) => {
        setVersion((v) => v + 1);
        if (direct && coup.de === ctx.partner && coup.t.type === "devine" && coup.t.trouve) ctx.sound.play("good");
      });
      const L = p.live;
      if (L) {
        setEtatLive(lireEtatLive(L.state));
        L.onState((s) => setEtatLive(lireEtatLive(s)));
        L.onReady((r) => setPret(r));
        L.on("trait", (payload, de) => {
          if (de === ctx.me) return;
          const m = payload as MsgTrait;
          if (typeof m?.r !== "number" || typeof m.i !== "number") return;
          if (m.r !== flux.current) { flux.current = m.r; elements.current = []; }
          const els = elements.current;
          if (m.x) els[m.i] = { x: 1, t: m.t ?? 0 };
          else {
            const el = els[m.i];
            if (!el || estEffacer(el)) els[m.i] = { c: m.c ?? 0, e: m.e ?? 1, p: (m.p ?? []).slice() };
            else el.p.push(...(m.p ?? []));
          }
          sale.current = true;
        });
        L.on("essai", (payload, de) => {
          if (de === ctx.me) return;
          const texte = String((payload as { texte?: unknown })?.texte ?? "").slice(0, 40);
          if (texte) setEssais((l) => [...l.slice(-2), texte]);
        });
      }
      setMode("regles");
    });
    return () => { annule = true; partie.current?.quitter(); partie.current = null; };
  }, [ctx]);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- horloge d'affichage ---------- */
  useEffect(() => {
    if (mode !== "direct" && mode !== "seul") return;
    const t = setInterval(() => setMaintenant(Date.now()), 200);
    return () => clearInterval(t);
  }, [mode]);

  /* ---------- lecture du journal ---------- */
  const bilan = useMemo(() => {
    void version;
    return lireJournal(partie.current?.coups ?? [], n, total);
  }, [version, n, total]);

  const live = partie.current?.live ?? null;
  const manche = mode === "direct" ? mancheDirecte(bilan, n) : null;

  const enCoursDirect = useMemo<EnCours | null>(() => {
    if (mode !== "direct" || !manche || !etatLive || !live || etatLive.r !== manche.r) return null;
    const debut = live.toLocal(etatLive.debut);
    if (maintenant > debut + total * 1000 + 5000) return null; // état d'une ancienne séance
    const jeDessine = manche.dessinateur === ctx.me;
    return {
      role: jeDessine ? (etatLive.rejeu ? "regarde" : "dessine") : "devine",
      k: manche.k, r: manche.r, mot: etatLive.mot, theme: etatLive.theme,
      variantes: variantesDe(contenu, etatLive.mot), debut, rejeu: etatLive.rejeu, direct: true,
    };
  }, [mode, manche, etatLive, live, maintenant, total, ctx.me, contenu]);

  const enCours = mode === "direct" ? enCoursDirect : mode === "seul" ? seulEnCours : null;
  const cleEnCours = enCours ? `${enCours.role}:${enCours.k}:${Math.round(enCours.debut)}:${enCours.rejeu}` : "";

  /* ---------- début d'une manche : on prépare le tableau ---------- */
  useEffect(() => {
    if (!enCours) return;
    if (enCours.rejeu) {
      const dessinateur = enCours.role === "devine" ? ctx.partner : ctx.me;
      elements.current = (bilan.dessins[dessinateur][enCours.k]?.elements ?? []).slice();
    } else if (enCours.role === "devine" && flux.current !== enCours.r) {
      elements.current = [];
    }
    if (enCours.r !== null) flux.current = enCours.r;
    sale.current = true;
    fini.current = false;
    nbEssais.current = 0;
    tampon.current.clear();
    setEssais([]);
    setSaisie("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleEnCours]);

  /* ---------- fin d'une manche ---------- */
  const terminerDessin = useCallback(async (ec: EnCours) => {
    const p = partie.current;
    if (!p) return;
    const els = elements.current.filter((e): e is Element => !!e);
    await p.jouer(idDessin(ctx.me, ec.k), { type: "dessin", k: ec.k, mot: ec.mot, theme: ec.theme, elements: els, direct: ec.direct });
    if (!ec.direct) {
      setSeulEnCours(null);
      setRevele({ mot: ec.mot, trouve: false, secondes: 0, dessinateur: ctx.me, auto: false });
      ctx.sound.play("pop");
    }
  }, [ctx]);

  const deposerDevine = useCallback(async (ec: EnCours, trouve: boolean, secondes: number) => {
    const p = partie.current;
    if (!p) return;
    await p.jouer(idDevine(ctx.me, ec.k), { type: "devine", k: ec.k, trouve, secondes: Math.round(secondes * 10) / 10, essais: nbEssais.current });
    if (!ec.direct) {
      setSeulEnCours(null);
      setRevele({ mot: ec.mot, trouve, secondes, dessinateur: ctx.partner, auto: false });
    }
  }, [ctx]);

  useEffect(() => {
    if (!enCours || fini.current) return;
    const ecoule = maintenant - enCours.debut;
    if (enCours.role === "dessine") {
      const devinee = enCours.direct && !!bilan.devines[ctx.partner][enCours.k];
      if (ecoule >= total * 1000 || devinee) { fini.current = true; void terminerDessin(enCours); }
    } else if (enCours.role === "devine") {
      if (bilan.devines[ctx.me][enCours.k]) fini.current = true;
      else if (ecoule >= total * 1000) {
        fini.current = true;
        ctx.sound.play("bad");
        void deposerDevine(enCours, false, total);
      }
    }
  }, [maintenant, enCours, bilan, total, ctx, terminerDessin, deposerDevine]);

  /* ---------- direct : révélation entre deux manches ---------- */
  const derniereR = useRef<number | null>(null);
  const rCourante = mode === "direct" ? (manche?.r ?? 2 * n) : null;
  useEffect(() => {
    if (rCourante === null) { derniereR.current = null; return; }
    const avant = derniereR.current;
    derniereR.current = rCourante;
    if (avant === null || rCourante <= avant) return;
    const dessinateur: Who = avant % 2 === 0 ? PREMIER : (PREMIER === "flavie" ? "alexandre" : "flavie");
    const devineur: Who = dessinateur === "alexandre" ? "flavie" : "alexandre";
    const k = Math.floor(avant / 2);
    const d = bilan.dessins[dessinateur][k], g = bilan.devines[devineur][k];
    if (!d || !g) return;
    ctx.sound.play("pop");
    setRevele({ mot: d.mot, trouve: g.trouve, secondes: g.secondes, dessinateur, auto: true });
    const t = setTimeout(() => setRevele((r) => (r?.auto ? null : r)), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rCourante]);

  /* ---------- direct : je relance le rejeu d'un dessin fait en différé ---------- */
  const dessinARejouer = manche && manche.dessinateur === ctx.me ? bilan.dessins[ctx.me][manche.k] : undefined;
  const rARejouer = dessinARejouer ? manche?.r ?? null : null;
  const aRelancer = mode === "direct" && rARejouer !== null && !enCoursDirect && !revele && !!live;
  useEffect(() => {
    if (!aRelancer || !live || !dessinARejouer || rARejouer === null) return;
    const t = setTimeout(() => {
      live.setState({ r: rARejouer, debut: live.now(), mot: dessinARejouer.mot, theme: dessinARejouer.theme, rejeu: true } satisfies EtatLive);
    }, 1500);
    return () => clearTimeout(t);
  }, [aRelancer, rARejouer, dessinARejouer, live]);

  /* ---------- flux des traits en direct ---------- */
  const enDirectJeDessine = enCours?.direct && enCours.role === "dessine";
  useEffect(() => {
    if (!enDirectJeDessine || !live || enCours?.r == null) return;
    const r = enCours.r;
    const t = setInterval(() => {
      for (const [i, el] of tampon.current) live.emit("trait", { r, i, c: el.c, e: el.e, p: el.p } satisfies MsgTrait);
      tampon.current.clear();
    }, 80);
    return () => clearInterval(t);
  }, [enDirectJeDessine, live, enCours?.r]);

  const crayon: Crayon | null = enCours?.role === "dessine" ? {
    c: gomme ? GOMME : couleur,
    e: epaisseur,
    debut: enCours.debut,
    onPoints: (i, el, nouveaux) => {
      if (!enCours.direct) return;
      const t = tampon.current.get(i) ?? { c: el.c, e: el.e, p: [] };
      t.p.push(...nouveaux);
      tampon.current.set(i, t);
    },
  } : null;

  const toutEffacer = () => {
    if (!enCours || enCours.role !== "dessine") return;
    ctx.sound.play("whoosh");
    const t = Math.round(Date.now() - enCours.debut);
    const i = elements.current.length;
    elements.current.push({ x: 1, t });
    sale.current = true;
    if (enCours.direct && live && enCours.r !== null) live.emit("trait", { r: enCours.r, i, x: 1, t } satisfies MsgTrait);
  };

  /* ---------- présence : attente, salon, bascule ---------- */
  useEffect(() => {
    if (mode === "attente" && ensemble) {
      setMode("salon");
      ctx.sound.play("notify");
      ctx.say([`${autre} est là ! Cliquez sur « On y va ! » et on commence 🎨`]);
    } else if (mode === "salon" && !ensemble) {
      setMode("attente");
      setAttente(0);
    } else if (mode === "seul" && ensemble && !enCours) {
      ctx.sound.play("notify");
      ctx.say([`${autre} vient d'arriver ! Vous pouvez passer en direct.`]);
    } else if (mode === "direct" && !ensemble) {
      const ec = enCoursDirect;
      // mon dessin en cours ou un rejeu continuent sans l'autre ; un dessin en direct de l'autre s'arrête là
      if (ec && (ec.role === "dessine" || (ec.role === "devine" && ec.rejeu))) setSeulEnCours({ ...ec, direct: false, r: null });
      else setSeulEnCours(null);
      setMode("seul");
      setRevele(null);
      live?.setReady(false);
      ctx.say([`${autre} a quitté la partie… Je garde tout : continuez à tour de rôle 💌`]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensemble, mode]);

  useEffect(() => {
    if (mode !== "attente") return;
    const t = setInterval(() => setAttente((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (mode === "salon" && pret.me && pret.partner) {
      setMode("direct");
      setSeulEnCours(null);
      setChoixSeul(null);
      setRevele(null);
      ctx.sound.play("whoosh");
      ctx.say([`C'est parti ! ${PRENOMS[PREMIER]} ouvre le bal 🎨`]);
    }
  }, [mode, pret, ctx]);

  /* ---------- fin de ma partie ---------- */
  const maTache = tacheSeul(bilan, ctx.me, n);
  const moiFini = mode !== "chargement" && maTache === null;
  const annonceFin = useRef(false);
  useEffect(() => {
    if (!moiFini || annonceFin.current || (mode !== "seul" && mode !== "direct") || enCours || revele) return;
    annonceFin.current = true;
    ctx.sound.play("win");
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    ctx.say(bilan.complet
      ? [`${bilan.finies} dessins, ${bilan.scores[ctx.me] + bilan.scores[ctx.partner]} points à vous deux. Quels artistes ! 🖼️`]
      : [`Tes dessins sont au chaud. ${autre} les devinera dès son retour 💌`]);
  }, [moiFini, mode, enCours, revele, bilan, ctx, autre]);

  /* ---------- actions ---------- */
  const commencer = () => {
    ctx.sound.play("tap");
    if (ensemble) { setMode("salon"); return; }
    setAttente(0);
    setMode("attente");
    ctx.say([`Je préviens ${autre}… on attend un petit peu ?`]);
  };

  const choisirMotDirect = (m: MotPropose) => {
    if (!live || !manche) return;
    ctx.sound.play("tap");
    elements.current = [];
    flux.current = manche.r;
    live.setState({ r: manche.r, debut: live.now(), mot: m.mot, theme: m.theme, rejeu: false } satisfies EtatLive);
  };

  const choisirMotSeul = (m: MotPropose) => {
    if (!choixSeul) return;
    ctx.sound.play("tap");
    elements.current = [];
    setChoixSeul(null);
    setSeulEnCours({ role: "dessine", k: choixSeul.k, mot: m.mot, theme: m.theme, variantes: m.variantes ?? [], debut: Date.now(), rejeu: false, direct: false, r: null });
  };

  const regarderDessin = (k: number) => {
    const d = bilan.dessins[ctx.partner][k];
    if (!d) return;
    ctx.sound.play("tap");
    setSeulEnCours({ role: "devine", k, mot: d.mot, theme: d.theme, variantes: variantesDe(contenu, d.mot), debut: Date.now() + 600, rejeu: true, direct: false, r: null });
  };

  const proposer = (ev: FormEvent) => {
    ev.preventDefault();
    const texte = saisie.trim();
    if (!enCours || enCours.role !== "devine" || !texte || fini.current || maintenant < enCours.debut) return;
    setSaisie("");
    if (bonneReponse(texte, enCours.mot, enCours.variantes)) {
      fini.current = true;
      ctx.sound.play("good");
      void deposerDevine(enCours, true, (Date.now() - enCours.debut) / 1000);
    } else {
      nbEssais.current++;
      ctx.sound.play("bad");
      setRate((v) => v + 1);
      if (enCours.direct) live?.emit("essai", { texte });
    }
  };

  /* ---------- rendu ---------- */
  const scores = bilan.scores;
  const barre = (
    <>
      {(mode === "direct" || mode === "seul") && (
        <span className="pic-scores" aria-label={`Toi ${scores[ctx.me]} points, ${autre} ${scores[ctx.partner]} points`}>
          <Puce>⭐ {scores[ctx.me]} · {autre[0]}. {scores[ctx.partner]}</Puce>
        </span>
      )}
      <Puce pale>{ensemble ? `🟢 ${autre}` : `⚪️ ${autre}`}</Puce>
    </>
  );

  if (mode === "chargement") {
    return <Cadre titre={TITRE}><div className="jeu-centre"><p className="quiz-attente">Je prépare les crayons…</p></div></Cadre>;
  }

  if (mode === "regles") {
    return (
      <Cadre titre={TITRE} barre={barre}>
        <PanneauRegles
          emoji="🎨"
          titre="Pictionary de Noël"
          regles={[
            `${2 * n} manches de ${total} s : chaque personne dessine ${n} fois, à tour de rôle.`,
            "Quand c'est ton tour de dessiner, tu choisis entre un mot de Noël et un mot « à vous deux ».",
            "L'autre tape ses propositions. Accents et majuscules sont pardonnés.",
            "Plus le dessin est trouvé vite, plus vous gagnez de points, l'un comme l'autre.",
            ensemble
              ? `${autre} est là : vous jouez en direct.`
              : `${autre} n'est pas là : tes dessins seront rejoués devant ${autre}, qui devinera plus tard.`,
          ]}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (mode === "attente") {
    const reste = Math.max(0, contenu.attenteAvantSolo - attente);
    return (
      <Cadre titre={TITRE} barre={barre}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">🐧</div>
            <h2>J'appelle {autre}…</h2>
            <p>
              {reste > 0
                ? `Encore un instant, on ne sait jamais. ${reste} s`
                : `${autre} ne répond pas. Tu peux jouer ton tour : je rejouerai tes dessins devant ${autre} trait par trait.`}
            </p>
            <div className="attente-points"><i /><i /><i /></div>
            <div className="jeu-actions">
              {reste === 0 && <button className="jeu-btn" onClick={() => { setMode("seul"); ctx.say(["À tes crayons ! Je filme tout 🎥"]); }}>Jouer quand même</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "salon") {
    return (
      <Cadre titre={TITRE} barre={barre}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">🖍️</div>
            <h2>{autre} est là !</h2>
            <p>
              {pret.me
                ? (pret.partner ? "C'est parti…" : `C'est noté. On attend ${autre}…`)
                : (pret.partner ? `${autre} n'attend plus que toi !` : `Dès que vous aurez cliqué, toi et ${autre}, on commence.`)}
            </p>
            <div className="pic-pret">
              <span className={pret.me ? "ok" : ""}>{PRENOMS[ctx.me]} {pret.me ? "✅" : "…"}</span>
              <span className={pret.partner ? "ok" : ""}>{autre} {pret.partner ? "✅" : "…"}</span>
            </div>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => { setMode("seul"); live?.setReady(false); }}>Jouer à tour de rôle</button>
              {!pret.me && <button className="jeu-btn" onClick={() => { ctx.sound.play("tap"); live?.setReady(true); }}>On y va !</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  /* ----- révélation ----- */
  if (revele) {
    const p = points(revele.secondes, total);
    const jAiDessine = revele.dessinateur === ctx.me;
    const enAttente = !revele.auto && jAiDessine;
    return (
      <Cadre titre={TITRE} barre={barre}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">{enAttente ? "💌" : revele.trouve ? "🎉" : "🙈"}</div>
            <p>{enAttente ? "Ton dessin est envoyé. Le mot était :" : "C'était :"}</p>
            <h2>{revele.mot}</h2>
            {!enAttente && (
              <p>
                {revele.trouve
                  ? `Trouvé en ${Math.round(revele.secondes)} s ! +${p.devineur} pour ${jAiDessine ? autre : "toi"}, +${p.dessinateur} pour ${jAiDessine ? "toi" : autre}.`
                  : "Pas trouvé cette fois. Aucun point, mais quel chef-d'œuvre."}
              </p>
            )}
            {enAttente && <p>{autre} le découvrira trait par trait 🖍️</p>}
            {!revele.auto && (
              <div className="jeu-actions"><button className="jeu-btn" onClick={() => setRevele(null)}>Continuer</button></div>
            )}
          </div>
        </div>
      </Cadre>
    );
  }

  /* ----- une manche en cours ----- */
  if (enCours) {
    const reste = Math.max(0, Math.ceil((enCours.debut + total * 1000 - maintenant) / 1000));
    const rejeuJusqua = enCours.rejeu ? () => Date.now() - enCours.debut : undefined;
    return (
      <Cadre titre={TITRE} barre={barre}>
        <div className="pic-manche">
          <div className="pic-entete">
            <span className={reste <= 10 ? "pic-chrono vite" : "pic-chrono"}>⏱ {reste}</span>
            {enCours.role === "devine" ? (
              <span className="pic-indice"><small>{THEMES[enCours.theme]}</small>{masquer(enCours.mot, new Set())}</span>
            ) : (
              <span className="pic-indice"><small>{enCours.role === "regarde" ? `${autre} devine ton dessin` : "Fais deviner"}</small>{enCours.mot}</span>
            )}
          </div>
          <Tableau elements={elements} crayon={crayon} jusqua={rejeuJusqua} sale={sale} />
          {(enCours.role === "dessine" || enCours.role === "regarde") && enCours.direct && (
            <div className="pic-essais" aria-live="polite">
              {essais.length ? essais.map((e, i) => <span key={`${i}-${e}`}>{e} ?</span>) : <em>{autre} cherche…</em>}
            </div>
          )}
          {enCours.role === "dessine" && (
            <div className="pic-outils">
              <div className="pic-couleurs">
                {PALETTE.map((c, i) => (
                  <button key={c} aria-label={NOMS_COULEURS[i]} className={!gomme && couleur === i ? "on" : ""}
                    style={{ background: c }} onClick={() => { setCouleur(i); setGomme(false); }} />
                ))}
              </div>
              <div className="pic-traits">
                {EPAISSEURS.map((e, i) => (
                  <button key={e} aria-label={`Épaisseur ${i + 1}`} className={epaisseur === i ? "on" : ""} onClick={() => setEpaisseur(i)}>
                    <i style={{ width: 4 + i * 6, height: 4 + i * 6 }} />
                  </button>
                ))}
                <button className={gomme ? "on" : ""} aria-label="Gomme" onClick={() => setGomme((g) => !g)}>🧽</button>
                <button aria-label="Tout effacer" onClick={toutEffacer}>🗑️</button>
                {!enCours.direct && (
                  <button className="pic-fini" onClick={() => { if (!fini.current) { fini.current = true; void terminerDessin(enCours); } }}>J'ai fini</button>
                )}
              </div>
            </div>
          )}
          {enCours.role === "devine" && (
            <form className="pic-devine" onSubmit={proposer}>
              <input key={rate} className={rate ? "secoue" : ""} value={saisie} onChange={(e) => setSaisie(e.target.value)}
                placeholder="Ta proposition…" autoComplete="off" autoCapitalize="off" enterKeyHint="send" maxLength={40} />
              <button className="jeu-btn" type="submit">Proposer</button>
            </form>
          )}
        </div>
      </Cadre>
    );
  }

  /* ----- direct, entre deux manches ----- */
  if (mode === "direct" && manche) {
    if (manche.dessinateur === ctx.me && !dessinARejouer) {
      return (
        <Cadre titre={TITRE} barre={barre}>
          <Choix key={manche.r} mots={motsProposes(contenu, ctx.me, manche.k)} secondes={contenu.secondesChoix} pour={autre} onChoisir={choisirMotDirect} />
        </Cadre>
      );
    }
    return (
      <Cadre titre={TITRE} barre={barre}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">{manche.dessinateur === ctx.me ? "📼" : "✏️"}</div>
            <h2>Manche {manche.r + 1} / {2 * n}</h2>
            <p>{manche.dessinateur === ctx.me
              ? `Je rejoue ton dessin devant ${autre}…`
              : bilan.dessins[ctx.partner][manche.k] ? `Je ressors le dessin que ${autre} t'avait laissé…` : `${autre} choisit son mot…`}</p>
            <div className="attente-points"><i /><i /><i /></div>
          </div>
        </div>
      </Cadre>
    );
  }

  /* ----- seul : choix du mot ----- */
  if (mode === "seul" && choixSeul) {
    return (
      <Cadre titre={TITRE} barre={barre}>
        <Choix mots={motsProposes(contenu, ctx.me, choixSeul.k)} secondes={contenu.secondesChoix} pour={autre} onChoisir={choisirMotSeul} />
      </Cadre>
    );
  }

  /* ----- seul : prochaine tâche ----- */
  if (mode === "seul" && maTache) {
    const passerEnDirect = ensemble && (
      <button className="jeu-btn clair" onClick={() => { setMode("salon"); }}>Passer en direct</button>
    );
    return (
      <Cadre titre={TITRE} barre={barre}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">{maTache.role === "devine" ? "🖼️" : "🖍️"}</div>
            <h2>{maTache.role === "devine" ? `${autre} t'a laissé un dessin` : `À toi de dessiner pour ${autre}`}</h2>
            <p>
              {maTache.role === "devine"
                ? `Dessin ${maTache.k + 1} sur ${n}. Il se redessine sous tes yeux, au rythme ${de(autre)} : tape ta réponse dès que tu as une idée. ${total} s.`
                : `Dessin ${maTache.k + 1} sur ${n}. Tu as ${total} s, et « J'ai fini » si tu es plus rapide.`}
            </p>
            <div className="jeu-actions">
              {passerEnDirect}
              <button className="jeu-btn" onClick={() => (maTache.role === "devine" ? regarderDessin(maTache.k) : setChoixSeul(maTache))}>
                {maTache.role === "devine" ? "Je regarde !" : "Choisir mon mot"}
              </button>
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  /* ----- fin (complète ou en attente de l'autre) ----- */
  return (
    <Cadre titre={TITRE} barre={barre}>
      <Galerie ctx={ctx} contenuN={n} bilan={bilan} total={total} />
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Galerie de fin                                                      */
/* ------------------------------------------------------------------ */

function Galerie({ ctx, contenuN, bilan, total }: {
  ctx: GameContext; contenuN: number; bilan: ReturnType<typeof lireJournal>; total: number;
}) {
  const PRENOMS = prenomsDe(ctx);
  const autre = PRENOMS[ctx.partner];
  const cases = useMemo(() => {
    const l: { de: Who; k: number; mot?: string; image?: string; etat: string }[] = [];
    for (let r = 0; r < 2 * contenuN; r++) {
      const de: Who = r % 2 === 0 ? PREMIER : (PREMIER === "flavie" ? "alexandre" : "flavie");
      const devineur: Who = de === "alexandre" ? "flavie" : "alexandre";
      const k = Math.floor(r / 2);
      const d = bilan.dessins[de][k];
      const g = bilan.devines[devineur][k];
      l.push({
        de, k, mot: d?.mot,
        image: d ? vignette(d.elements) : undefined,
        etat: !d ? "pas encore dessiné" : !g ? "à deviner" : g.trouve ? `trouvé en ${Math.round(g.secondes)} s` : "pas trouvé",
      });
    }
    return l;
  }, [bilan, contenuN]);
  const s = bilan.scores;
  void total;
  return (
    <div className="jeu-centre">
      <div className="jeu-panneau pic-fin">
        <div className="emoji">{bilan.complet ? "🖼️" : "💌"}</div>
        <h2>{bilan.complet ? "Votre galerie de Noël" : `En attente ${de(autre)}`}</h2>
        <div className="jeu-compare">
          <div><span>Toi</span><b>{s[ctx.me]}</b></div>
          <div><span>{autre}</span><b>{s[ctx.partner]}</b></div>
          <div><span>À deux</span><b>{s[ctx.me] + s[ctx.partner]}</b></div>
        </div>
        {!bilan.complet && <p>Tu as joué tout ton tour. Les points arrivent quand {autre} aura joué le sien.</p>}
        <div className="pic-galerie">
          {cases.map((c) => (
            <figure key={`${c.de}-${c.k}`}>
              {c.image ? <img src={c.image} alt={c.mot ?? ""} /> : <div className="vide">?</div>}
              <figcaption><b>{c.mot && (c.de === ctx.me || c.etat !== "à deviner") ? c.mot : "…"}</b><span>{PRENOMS[c.de]} · {c.etat}</span></figcaption>
            </figure>
          ))}
        </div>
        <div className="jeu-actions">
          <button className="jeu-btn clair" onClick={() => ctx.complete({ success: bilan.finies > 0, score: s[ctx.me], data: { scores: s, finies: bilan.finies } })}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

export const pictionaryJour5: GameModule = {
  id: "pictionary-jour5",
  title: "Pictionary de Noël",
  mount: (el, ctx) => monterReact(el, <Pictionary ctx={ctx} />),
};
