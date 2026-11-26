/**
 * Jour 18 — Bataille de boules de neige : le duel des forts, au pied de la cascade gelée.
 *
 * Règles décidées avec Alexandre (26 nov) : chacun derrière son fort, vu de côté ; on tire au lance-pierre
 * (glisser le doigt), on se baisse en restant appuyé ; une boule qui touche l'autre = 1 point ; le fort s'abîme
 * et se répare quand on reste baissé ; 3 manches de 45 s, avec de plus en plus de vent.
 * Si l'autre n'est pas là : Pingou attend 20 s, puis on joue contre le FANTÔME de sa partie (ses tirs et sa
 * posture rejoués) s'il a déjà joué la manche ; sinon un lutin d'entraînement nous bombarde, et le score reste
 * provisoire jusqu'à ce que l'autre joue contre notre fantôme.
 *
 * Journal de coups (`shared/partie.ts`) : un coup `manche:<qui>:<m>` par manche jouée (tirs + posture).
 * Le décompte (`regles.ts`) est le même en direct et contre un fantôme.
 * Contenu : src/data/games/boules-jour18.ts
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { BOULES_JOUR18, type BoulesContent } from "../../data/games/boules-jour18";
import { prenomsDe, de } from "../shared/contenu";
import { Cadre, Flash, PanneauRegles, Points, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { ouvrirPartie, type Partie } from "../shared/partie";
import { lancerManche, type Hud, type Manche } from "./moteur";
import { PERSONNE, decompter, idManche, type CoupManche, type Tir } from "./regles";
import "../friandises/friandises.css"; // classes duel-* partagées avec le jour 6
import "./boules.css";

const TITRE = "Jour 18 · Boules de neige";

type Mode = "chargement" | "regles" | "attente" | "salon" | "jeu" | "entre";
type Plan = { m: number; debut: number; direct: boolean };

function Bataille({ ctx }: { ctx: GameContext }) {
  const contenu = (ctx.content as BoulesContent | null) ?? BOULES_JOUR18; // jeu d'adresse : rien à personnaliser
  const PRENOMS = prenomsDe(ctx);
  const nb = Math.max(1, contenu.manches);
  const autre = PRENOMS[ctx.partner];

  const [mode, setMode] = useState<Mode>("chargement");
  const [ensemble, setEnsemble] = useState(false);
  const [version, setVersion] = useState(0);
  const [pret, setPret] = useState({ me: false, partner: false });
  const [attente, setAttente] = useState(0);
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
        L.onStart(({ startsAt, resumed }) => { if (resumed) departPerime.current = true; else lancerDirect.current(startsAt); });
        L.on("tir", (payload, qui) => {
          const msg = payload as { m?: number; tir?: Tir };
          if (qui === ctx.me || msg?.m !== mancheM.current || !msg.tir) return;
          manche.current?.tirDistant(msg.tir);
        });
        L.on("pose", (payload, qui) => {
          const msg = payload as { m?: number; b?: boolean };
          if (qui === ctx.me || msg?.m !== mancheM.current || typeof msg.b !== "boolean") return;
          manche.current?.poseDistante(msg.b);
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
      // une seule partie jouée : score provisoire contre quelqu'un qui ne se cache jamais
      return { m, deux: !!a && !!f, d: decompter(contenu, { alexandre: a ?? PERSONNE(m), flavie: f ?? PERSONNE(m) }) };
    });
    const total: Record<Who, number> = { alexandre: 0, flavie: 0 };
    for (const b of parManche) {
      if (!b) continue;
      total.alexandre += b.d.points.alexandre; total.flavie += b.d.points.flavie;
    }
    const complet = parManche.every((b) => b?.deux);
    return { parManche, total, complet };
  }, [joues, nb, contenu]);

  const prochaineSeul = joues[ctx.me].findIndex((c) => !c);
  const moiFini = prochaineSeul === -1;

  /* ---------- départ en direct ---------- */
  lancerDirect.current = (startsAt: number) => {
    const libres = Array.from({ length: nb }, (_, m) => m).filter((m) => !joues.alexandre[m] && !joues.flavie[m]);
    const pas = (contenu.secondes + contenu.pause + 2) * 1000; // + 2 s : les dernières boules retombent
    const p = libres.map((m, i) => ({ m, debut: startsAt + i * pas, direct: true }))
      .filter((x) => x.debut + contenu.secondes * 1000 > Date.now());
    if (!p.length) return;
    setPlan(p);
    setIPlan(0);
    setMode("jeu");
  };

  /* ---------- une manche ---------- */
  const enCours = mode === "jeu" ? plan[iPlan] : undefined;
  useEffect(() => {
    if (!enCours || !hote.current) return;
    let annule = false;
    mancheM.current = enCours.m;
    setHud(null);
    ctx.say([]); // Pingou se tait pendant la manche : sa bulle cacherait le bouton « Se baisser »
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
      surTir: (tir) => p?.live?.emit("tir", { m: enCours.m, tir }),
      surPose: (b) => p?.live?.emit("pose", { m: enCours.m, b }),
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

  /* ---------- entre deux manches ---------- */
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
      ctx.say([`${autre} est là ! Cliquez sur « On y va ! » et que volent les boules ☃️`]);
    } else if (mode === "salon" && !ensemble) {
      setAttente(0);
      setMode("attente");
    } else if (!ensemble && (mode === "jeu" || mode === "entre") && plan.some((x) => x.direct)) {
      setPlan((l) => l.slice(0, iPlan + 1));
      partie.current?.live?.setReady(false);
      ctx.say([`${autre} a quitté la bataille… Finis ta manche, la suite se jouera contre son fantôme 👻`]);
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
      ? [t[ctx.me] === t[ctx.partner] ? "Égalité parfaite. Tout le monde est trempé, personne n'a gagné 🥶"
        : `${t[ctx.me] > t[ctx.partner] ? "Tu gagnes" : `${autre} gagne`} ${Math.max(t.alexandre, t.flavie)} à ${Math.min(t.alexandre, t.flavie)} !`,
      "Allez vous réchauffer avec un chocolat chaud ☕"]
      : [`Ta bataille est enregistrée. ${autre} affrontera ton fantôme 👻`]);
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

  const baisser = (b: boolean) => manche.current?.baisser(b);

  /* ---------- rendu ---------- */
  const presence = <Puce pale>{ensemble ? `🟢 ${autre}` : `⚪️ ${autre}`}</Puce>;

  if (mode === "chargement") {
    return <Cadre titre={TITRE}><div className="jeu-centre"><p className="quiz-attente">On roule les premières boules…</p></div></Cadre>;
  }

  if (mode === "regles") {
    return (
      <Cadre titre={TITRE} barre={presence}>
        <PanneauRegles
          emoji="☃️"
          titre="Le duel des forts"
          regles={[
            `${nb} manches de ${contenu.secondes} s, chacun derrière son fort, au pied de la cascade gelée.`,
            "Glisse le doigt vers l'arrière comme un lance-pierre, puis lâche : plus tu tires loin, plus la boule va loin.",
            `Une boule sur ${autre} : +${contenu.points}. Une boule sur un fort lui enlève une rangée de neige.`,
            "Reste appuyé sur « Se baisser » (ou Espace) pour te cacher : ton fort se répare pendant ce temps.",
            "Attention au vent, de plus en plus fort à chaque manche 💨",
            ensemble
              ? `${autre} est là : vous jouez en direct.`
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
                : `${autre} ne répond pas. Tu peux jouer quand même : je garde ta bataille, et ${autre} affrontera ton fantôme.`}
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
            <div className="emoji">☃️</div>
            <h2>{autre} est là !</h2>
            <p>
              {pret.me
                ? (pret.partner ? "Attention… 3, 2, 1…" : `C'est noté. On attend ${autre}…`)
                : (pret.partner ? `${autre} n'attend plus que toi !` : "Dès que chacun a cliqué, la bataille commence.")}
            </p>
            <div className="duel-pret">
              <span className={pret.me ? "ok" : ""}>{PRENOMS[ctx.me]} {pret.me ? "✅" : "…"}</span>
              <span className={pret.partner ? "ok" : ""}>{autre} {pret.partner ? "✅" : "…"}</span>
            </div>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => { partie.current?.live?.setReady(false); setMode("entre"); }}>Jouer en solo</button>
              {!pret.me && <button className="jeu-btn" onClick={() => { ctx.sound.play("tap"); partie.current?.live?.setReady(true); }}>On y va !</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "jeu" && enCours) {
    const pts = hud?.points ?? { alexandre: 0, flavie: 0 };
    const avecAutre = enCours.direct || !!joues[ctx.partner][enCours.m];
    const vent = hud?.vent ?? 0;
    const force = Math.min(3, Math.ceil(Math.abs(vent) / 100));
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
        <div className="jeu-canvas duel-terrain boules-terrain" ref={hote}>
          {hud && hud.avant > 0 && <div className="duel-decompte" key={hud.avant}>{hud.avant}</div>}
          {!hud && <div className="duel-decompte">3</div>}
          <div className="boules-infos">
            <span className="boules-vent" title="Vent">
              💨 {force === 0 ? "calme" : (vent > 0 ? "→".repeat(force) : "←".repeat(force))}
            </span>
            <span className="boules-fort" title="Ton fort">
              🏰 {"■".repeat(hud?.fort ?? contenu.rangees)}<i>{"□".repeat(Math.max(0, contenu.rangees - (hud?.fort ?? contenu.rangees)))}</i>
            </span>
          </div>
          {!enCours.direct && <div className="duel-fantome">{avecAutre ? `👻 fantôme ${de(autre)}` : "🧝 lutin d'entraînement"}</div>}
          <button
            className={`boules-baisser ${hud?.baisse ? "on" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); baisser(true); }}
            onPointerUp={() => baisser(false)}
            onPointerCancel={() => baisser(false)}
            onPointerLeave={() => baisser(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            🛡️ Se baisser
          </button>
          <div className="boules-recharge" style={{ ["--r" as string]: hud?.recharge ?? 1 }} title="Boule prête" />
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
          <div className="emoji">{moiFini ? (bilan.complet ? (t[ctx.me] >= t[ctx.partner] ? "🏆" : "☃️") : "👻") : "❄️"}</div>
          <h2>{moiFini ? (bilan.complet ? "Fin de la bataille !" : "Bataille enregistrée !") : derniere ? `Fin de la manche ${derniere.m + 1}` : "La bataille commence !"}</h2>
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
            </div>
          )}
          <p>
            {moiFini
              ? (bilan.complet
                ? `${t[ctx.me] === t[ctx.partner] ? "Égalité !" : t[ctx.me] > t[ctx.partner] ? "Tu gagnes !" : `${autre} gagne !`} Chaque boule qui a touché compte un point.`
                : finDirecte && !patience ? `Je compte les boules ${de(autre)}…` : `${autre} affrontera ton fantôme : ton score sera recalculé à ce moment-là (s'il se cache bien…).`)
              : suivante?.direct
                ? `Manche suivante dans ${Math.max(0, Math.ceil((suivante.debut - maintenant) / 1000))} s…`
                : joues[ctx.partner][prochaineSeul]
                  ? `Manche ${prochaineSeul + 1} : contre le fantôme ${de(autre)}, qui l'a déjà jouée.`
                  : `Manche ${prochaineSeul + 1} : ${autre} ne l'a pas encore jouée. Un lutin te bombarde pour t'entraîner, et ${autre} affrontera ton fantôme.`}
          </p>
          <div className="jeu-actions">
            {!moiFini && !suivante?.direct && ensemble && (
              <button className="jeu-btn clair" onClick={() => setMode("salon")}>Jouer en direct</button>
            )}
            {!moiFini && !suivante?.direct && <button className="jeu-btn" onClick={jouerSeul}>{derniere ? "Manche suivante" : "C'est parti !"}</button>}
            {moiFini && (
              <button className="jeu-btn clair" onClick={() => ctx.complete({ success: true, score: t[ctx.me], data: { total: t } })}>Fermer</button>
            )}
          </div>
        </div>
      </div>
    </Cadre>
  );
}

export const boulesJour18: GameModule = {
  id: "boules-jour18",
  title: "Bataille de boules de neige",
  mount: (el, ctx) => monterReact(el, <Bataille ctx={ctx} />),
};
