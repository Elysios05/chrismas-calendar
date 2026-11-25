/**
 * Jour 6 — Duel de Saint-Nicolas : attrape les friandises.
 *
 * Règles décidées avec Alexandre (24 nov) : même écran, même pluie, les deux hottes côte à côte ;
 * on se dispute les friandises ; charbon = −1 et hotte ralentie ; les étoiles dorées ne comptent
 * que si vous les attrapez tous les deux ; 3 manches de 45 s.
 * Si l'autre n'est pas là : Pingou attend 20 s, puis on joue contre le FANTÔME de sa partie
 * (sa hotte rejouée) s'il a déjà joué la manche, sinon on pose un score qu'il devra affronter.
 *
 * Journal de coups (`shared/partie.ts`) : un coup `manche:<qui>:<m>` par manche jouée (prises
 * horodatées + trace de la hotte). Le décompte est le même en direct et contre un fantôme.
 * Contenu : src/data/games/friandises-jour6.ts
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { FRIANDISES_JOUR6, type FriandisesContent } from "../../data/games/friandises-jour6";
import { Cadre, Flash, PanneauRegles, Points, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { ouvrirPartie, type Partie } from "../shared/partie";
import { lancerManche, type Hud, type Manche } from "./moteur";
import { decompter, idManche, pluie, type CoupManche, type Prise } from "./pluie";
import "./friandises.css";

const PRENOMS: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };
const TITRE = "Jour 6 · Duel";
const de = (prenom: string) => (/^[AEIOUYÉ]/i.test(prenom) ? `d'${prenom}` : `de ${prenom}`);

type Mode = "chargement" | "regles" | "attente" | "salon" | "jeu" | "entre";
/** Une manche à jouer : heure locale de départ, et si c'est du direct */
type Plan = { m: number; debut: number; direct: boolean };

function Duel({ ctx }: { ctx: GameContext }) {
  const contenu = (ctx.content as FriandisesContent | null) ?? FRIANDISES_JOUR6;
  const nb = Math.max(1, contenu.manches);
  const autre = PRENOMS[ctx.partner];

  const [mode, setMode] = useState<Mode>("chargement");
  const [ensemble, setEnsemble] = useState(false);
  const [version, setVersion] = useState(0);
  const [pret, setPret] = useState({ me: false, partner: false });
  const [attente, setAttente] = useState(0);
  /** Manches prévues (en direct : toute la série ; seul : une à la fois) */
  const [plan, setPlan] = useState<Plan[]>([]);
  const [iPlan, setIPlan] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [flash, setFlash] = useState<{ texte: string; cle: number } | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const partie = useRef<Partie<CoupManche> | null>(null);
  const manche = useRef<Manche | null>(null);
  const mancheM = useRef(-1);
  const hote = useRef<HTMLDivElement>(null);
  const cleFlash = useRef(0);
  const departPerime = useRef(false);
  const lancerDirect = useRef<(startsAt: number) => void>(() => {});

  /* ---------- ouverture ---------- */
  useEffect(() => {
    let annule = false;
    void ouvrirPartie<CoupManche>(ctx, { compteARebours: 3000 }).then((p) => {
      if (annule) { p.quitter(); return; }
      partie.current = p;
      setEnsemble(p.ensemble());
      setVersion((v) => v + 1);
      p.surPresence((e) => {
        setEnsemble(e);
        if (!e) manche.current?.sansAutre();
      });
      p.surCoup(() => setVersion((v) => v + 1));
      const L = p.live;
      if (L) {
        L.onReady((r) => setPret(r));
        // un départ « repris » est celui d'une ancienne séance : on l'efface au salon
        L.onStart(({ startsAt, resumed }) => { if (resumed) departPerime.current = true; else lancerDirect.current(startsAt); });
        L.on("prise", (payload, qui) => {
          const msg = payload as { m?: number; p?: Prise };
          if (qui === ctx.me || msg?.m !== mancheM.current || !msg.p) return;
          manche.current?.priseDistante(msg.p);
        });
        L.on("hotte", (payload, qui) => {
          const msg = payload as { m?: number; x?: number };
          if (qui === ctx.me || msg?.m !== mancheM.current || typeof msg.x !== "number") return;
          manche.current?.hotteDistante(msg.x);
        });
      }
      setMode("regles");
    });
    return () => { annule = true; manche.current?.arreter(); manche.current = null; partie.current?.quitter(); partie.current = null; };
  }, [ctx]);

  useEffect(() => { ctx.sound.setGameMusic("duel"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- journal ---------- */
  const joues = useMemo(() => {
    void version;
    const j: Record<Who, (CoupManche | undefined)[]> = { alexandre: Array(nb).fill(undefined), flavie: Array(nb).fill(undefined) };
    for (const c of partie.current?.coups ?? []) if (c.t && c.t.m >= 0 && c.t.m < nb) j[c.de][c.t.m] = c.t;
    return j;
  }, [version, nb]);

  const bilan = useMemo(() => {
    const parManche = Array.from({ length: nb }, (_, m) => {
      const a = joues.alexandre[m], f = joues.flavie[m];
      if (!a && !f) return null;
      return { m, deux: !!a && !!f, d: decompter(contenu, pluie(contenu, m), { alexandre: a?.prises ?? [], flavie: f?.prises ?? [] }) };
    });
    const total: Record<Who, number> = { alexandre: 0, flavie: 0 };
    let etoiles = 0;
    for (const b of parManche) {
      if (!b) continue;
      total.alexandre += b.d.points.alexandre; total.flavie += b.d.points.flavie; etoiles += b.d.etoiles;
    }
    const complet = parManche.every((b) => b?.deux);
    return { parManche, total, etoiles, complet };
  }, [joues, nb, contenu]);

  const prochaineSeul = joues[ctx.me].findIndex((c) => !c);
  const moiFini = prochaineSeul === -1;

  /* ---------- départ en direct ---------- */
  lancerDirect.current = (startsAt: number) => {
    // les manches que personne n'a encore jouées, enchaînées sur l'horloge commune
    const libres = Array.from({ length: nb }, (_, m) => m).filter((m) => !joues.alexandre[m] && !joues.flavie[m]);
    const pas = (contenu.secondes + contenu.pause) * 1000;
    const p = libres.map((m, i) => ({ m, debut: startsAt + i * pas, direct: true }))
      .filter((x) => x.debut + contenu.secondes * 1000 > Date.now());
    if (!p.length) return;
    setPlan(p);
    setIPlan(0);
    setMode("jeu");
    ctx.say(["Hottes prêtes… Que le plus gourmand gagne ! 🍬"]);
  };

  /* ---------- une manche ---------- */
  const enCours = mode === "jeu" ? plan[iPlan] : undefined;
  useEffect(() => {
    if (!enCours || !hote.current) return;
    let annule = false;
    mancheM.current = enCours.m;
    setHud(null);
    const p = partie.current;
    void lancerManche({
      hote: hote.current,
      contenu, m: enCours.m, moi: ctx.me, autre: ctx.partner, prenoms: PRENOMS,
      debut: enCours.debut,
      fantome: enCours.direct ? null : joues[ctx.partner][enCours.m] ?? null,
      direct: enCours.direct,
      sound: ctx.sound,
      surHud: setHud,
      surFlash: (texte) => setFlash({ texte, cle: ++cleFlash.current }),
      surPrise: (prise) => p?.live?.emit("prise", { m: enCours.m, p: prise }),
      surHotte: (x) => p?.live?.emit("hotte", { m: enCours.m, x }),
      surFin: (coup) => {
        void p?.jouer(idManche(ctx.me, coup.m), coup);
        ctx.sound.play("whoosh");
        setMode("entre");
      },
    }).then((mc) => {
      if (annule) { mc?.arreter(); return; }
      manche.current = mc;
      if (enCours.direct && !p?.ensemble()) mc?.sansAutre();
    });
    return () => { annule = true; manche.current?.arreter(); manche.current = null; mancheM.current = -1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCours?.m, enCours?.debut, mode]);

  /* ---------- entre deux manches (direct : on attend l'heure de la suivante) ---------- */
  const suivante = plan[iPlan + 1];
  useEffect(() => {
    if (mode !== "entre" || !suivante?.direct) return;
    const t = setTimeout(() => { setIPlan((i) => i + 1); setMode("jeu"); }, Math.max(0, suivante.debut - Date.now() - 50));
    return () => clearTimeout(t);
  }, [mode, suivante]);

  useEffect(() => {
    if (mode !== "entre") return;
    const t = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(t);
  }, [mode]);

  /* ---------- présence ---------- */
  useEffect(() => {
    if (mode === "attente" && ensemble) {
      setMode("salon");
      ctx.sound.play("notify");
      ctx.say([`${autre} est là ! Dites-vous « prêt » et les friandises tombent 🍭`]);
    } else if (mode === "salon" && !ensemble) {
      setAttente(0);
      setMode("attente");
    } else if (!ensemble && (mode === "jeu" || mode === "entre") && plan.some((x) => x.direct)) {
      // la manche en cours se termine seul ; les suivantes se jouent contre le fantôme, plus tard
      setPlan((l) => l.slice(0, iPlan + 1));
      partie.current?.live?.setReady(false);
      ctx.say([`${autre} est parti… Finis ta manche, la suite se jouera contre son fantôme 👻`]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensemble, mode]);

  useEffect(() => {
    if (mode !== "attente") return;
    const t = setInterval(() => setAttente((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (mode === "salon" && departPerime.current) { departPerime.current = false; partie.current?.live?.reset(); }
  }, [mode, pret]);

  /* ---------- fin ---------- */
  const annonce = useRef(false);
  // en direct, la dernière manche de l'autre arrive une fraction de seconde après la mienne : on l'attend un peu
  const [patience, setPatience] = useState(false);
  const finDirecte = moiFini && mode === "entre" && !suivante && plan.some((x) => x.direct) && !bilan.complet;
  useEffect(() => {
    if (!finDirecte) return;
    const t = setTimeout(() => setPatience(true), 4000);
    return () => clearTimeout(t);
  }, [finDirecte]);
  useEffect(() => {
    if (!moiFini || annonce.current || mode === "chargement" || mode === "regles" || mode === "jeu") return;
    if (mode === "entre" && suivante) return;
    if (finDirecte && !patience) return;
    annonce.current = true;
    ctx.sound.play("win");
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    const t = bilan.total;
    ctx.say(bilan.complet
      ? [t[ctx.me] === t[ctx.partner] ? "Égalité parfaite. Saint-Nicolas est ému 🥹"
        : `${t[ctx.me] > t[ctx.partner] ? "Tu gagnes" : `${autre} gagne`} ${Math.max(t.alexandre, t.flavie)} à ${Math.min(t.alexandre, t.flavie)} !`,
      bilan.etoiles ? `Et ${bilan.etoiles} étoile${bilan.etoiles > 1 ? "s" : ""} attrapée${bilan.etoiles > 1 ? "s" : ""} à deux ⭐` : "Pas une étoile à deux… la prochaine fois, rejoignez-vous dessous !"]
      : [`Ton score est posé. ${autre} jouera contre ton fantôme 👻`]);
  }, [moiFini, mode, suivante, bilan, ctx, autre, finDirecte, patience]);

  /* ---------- actions ---------- */
  const commencer = () => {
    ctx.sound.play("tap");
    if (moiFini) { setMode("entre"); return; }
    if (ensemble) { setMode("salon"); return; }
    setAttente(0);
    setMode("attente");
    ctx.say([`Je préviens ${autre}… on attend un petit peu ?`]);
  };

  const jouerSeul = () => {
    if (prochaineSeul < 0) return;
    ctx.sound.play("tap");
    partie.current?.live?.setReady(false);
    setPlan([{ m: prochaineSeul, debut: Date.now() + 3200, direct: false }]);
    setIPlan(0);
    setMode("jeu");
  };

  /* ---------- rendu ---------- */
  const presence = <Puce pale>{ensemble ? `🟢 ${autre}` : `⚪️ ${autre}`}</Puce>;

  if (mode === "chargement") {
    return <Cadre titre={TITRE}><div className="jeu-centre"><p className="quiz-attente">Saint-Nicolas remplit sa hotte…</p></div></Cadre>;
  }

  if (mode === "regles") {
    return (
      <Cadre titre={TITRE} barre={presence}>
        <PanneauRegles
          emoji="🍬"
          titre="Le duel des friandises"
          regles={[
            `${nb} manches de ${contenu.secondes} s, les deux hottes sous la même pluie.`,
            "Glisse le doigt (ou les flèches) : la première hotte qui touche une friandise la garde.",
            `🍭 🍬 +${contenu.points.sucre} · 🍪 +${contenu.points.pain} · charbon ${contenu.points.charbon} et ta hotte ralentit.`,
            `⭐ L'étoile dorée : +${contenu.points.etoile} chacun, seulement si vous l'attrapez TOUS LES DEUX.`,
            ensemble
              ? `${autre} est connecté : vous jouez en direct.`
              : `${autre} n'est pas là : tu joueras contre son fantôme, ou tu poseras un score à battre.`,
          ]}
          onJouer={commencer}
        />
      </Cadre>
    );
  }

  if (mode === "attente") {
    const reste = Math.max(0, contenu.attenteAvantSolo - attente);
    return (
      <Cadre titre={TITRE} barre={presence}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">🐧</div>
            <h2>J'appelle {autre}…</h2>
            <p>
              {reste > 0
                ? `Encore un instant, on ne sait jamais. ${reste} s`
                : `${autre} ne répond pas. Tu peux jouer quand même : je garde ta partie, et ${autre} jouera contre ton fantôme.`}
            </p>
            <div className="attente-points"><i /><i /><i /></div>
            <div className="jeu-actions">
              {reste === 0 && <button className="jeu-btn" onClick={() => setMode("entre")}>Jouer quand même</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "salon") {
    return (
      <Cadre titre={TITRE} barre={presence}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">🎅</div>
            <h2>{autre} est là !</h2>
            <p>
              {pret.me
                ? (pret.partner ? "Attention… 3, 2, 1…" : `Tu es prêt·e. On attend ${autre}…`)
                : (pret.partner ? `${autre} est prêt·e et t'attend !` : "Dès que vous êtes prêts tous les deux, la pluie commence.")}
            </p>
            <div className="duel-pret">
              <span className={pret.me ? "ok" : ""}>{PRENOMS[ctx.me]} {pret.me ? "✅" : "…"}</span>
              <span className={pret.partner ? "ok" : ""}>{autre} {pret.partner ? "✅" : "…"}</span>
            </div>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => { partie.current?.live?.setReady(false); setMode("entre"); }}>Jouer seul·e</button>
              {!pret.me && <button className="jeu-btn" onClick={() => { ctx.sound.play("tap"); partie.current?.live?.setReady(true); }}>Je suis prêt·e !</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "jeu" && enCours) {
    const pts = hud?.points ?? { alexandre: 0, flavie: 0 };
    const avecAutre = enCours.direct || !!joues[ctx.partner][enCours.m];
    return (
      <Cadre
        titre={`Manche ${enCours.m + 1}/${nb}`}
        barre={(
          <>
            <Puce>⏱ {hud?.reste ?? contenu.secondes}</Puce>
            <span className="duel-scores">
              <span className={`duel-score ${ctx.me}`}>{pts[ctx.me]}</span>
              {avecAutre && <span className={`duel-score ${ctx.partner}`}>{pts[ctx.partner]}</span>}
            </span>
          </>
        )}
      >
        <div className="jeu-canvas duel-terrain" ref={hote}>
          {hud && hud.avant > 0 && <div className="duel-decompte" key={hud.avant}>{hud.avant}</div>}
          {!hud && <div className="duel-decompte">3</div>}
          {hud?.ralenti && <div className="duel-ralenti">🐌 ralentie</div>}
          {!enCours.direct && avecAutre && <div className="duel-fantome">👻 fantôme {de(autre)}</div>}
          {flash && <Flash texte={flash.texte} cle={flash.cle} />}
        </div>
      </Cadre>
    );
  }

  /* ----- entre deux manches, ou fin ----- */
  const derniere = plan[iPlan];
  const b = derniere ? bilan.parManche[derniere.m] : null;
  const etats = Array.from({ length: nb }, (_, m) => (joues[ctx.me][m] ? (bilan.parManche[m]?.deux ? "bon" : "on") : "vide") as "vide" | "on" | "bon");
  const t = bilan.total;
  return (
    <Cadre titre={TITRE} barre={presence}>
      <div className="jeu-centre">
        <div className="jeu-panneau">
          <div className="emoji">{moiFini ? (bilan.complet ? (t[ctx.me] >= t[ctx.partner] ? "🏆" : "🍬") : "👻") : "🎅"}</div>
          <h2>{moiFini ? (bilan.complet ? "Les hottes sont pleines !" : "Score posé !") : derniere ? `Fin de la manche ${derniere.m + 1}` : "Prêt·e pour la pluie ?"}</h2>
          <Points etats={etats} />
          {b && !moiFini && (
            <div className="jeu-compare">
              <div><span>Toi</span><b>{b.d.points[ctx.me]}</b></div>
              <div><span>{autre}</span><b>{b.deux ? b.d.points[ctx.partner] : "…"}</b></div>
            </div>
          )}
          {moiFini && (
            <div className="jeu-compare">
              <div><span>Toi</span><b>{t[ctx.me]}</b></div>
              <div><span>{autre}</span><b>{bilan.complet ? t[ctx.partner] : "…"}</b></div>
              <div><span>⭐ à deux</span><b>{bilan.etoiles}</b></div>
            </div>
          )}
          <p>
            {moiFini
              ? (bilan.complet
                ? `${t[ctx.me] === t[ctx.partner] ? "Égalité !" : t[ctx.me] > t[ctx.partner] ? "Tu gagnes !" : `${autre} gagne !`} Les étoiles attrapées ensemble comptent pour vous deux.`
                : finDirecte && !patience ? `Je compte les friandises ${de(autre)}…` : `${autre} jouera contre ton fantôme : le score final arrive à ce moment-là.`)
              : suivante?.direct
                ? `Manche suivante dans ${Math.max(0, Math.ceil((suivante.debut - maintenant) / 1000))} s…`
                : joues[ctx.partner][prochaineSeul]
                  ? `Manche ${prochaineSeul + 1} : contre le fantôme ${de(autre)}, qui l'a déjà jouée.`
                  : `Manche ${prochaineSeul + 1} : ${autre} ne l'a pas encore jouée, tu poses le score à battre.`}
          </p>
          <div className="jeu-actions">
            {!moiFini && !suivante?.direct && ensemble && (
              <button className="jeu-btn clair" onClick={() => setMode("salon")}>Jouer en direct</button>
            )}
            {!moiFini && !suivante?.direct && <button className="jeu-btn" onClick={jouerSeul}>{derniere ? "Manche suivante" : "C'est parti !"}</button>}
            {moiFini && (
              <button className="jeu-btn clair" onClick={() => ctx.complete({ success: true, score: t[ctx.me], data: { total: t, etoiles: bilan.etoiles } })}>Fermer</button>
            )}
          </div>
        </div>
      </div>
    </Cadre>
  );
}

export const friandisesJour6: GameModule = {
  id: "friandises-jour6",
  title: "Duel de Saint-Nicolas",
  mount: (el, ctx) => monterReact(el, <Duel ctx={ctx} />),
};
