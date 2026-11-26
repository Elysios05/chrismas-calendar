/**
 * Jour 13 — Bonhomme de neige à deux (en direct, ou chacun sa moitié).
 *
 * Règles décidées avec Alexandre (26 nov) :
 *  1. ROULER (30 s) : chacun roule sa boule au doigt — place 2 le corps, place 1 la tête.
 *     Pingou note l'empilement : taille, tailles assorties, boules bien rondes.
 *  2. DÉCORER à deux le même bonhomme, en voyant les objets de l'autre arriver.
 *  Fin : le bonhomme en souvenir (image à enregistrer) + un score commun.
 *  Absent : 20 s d'attente, puis chacun fait sa moitié ; l'autre trouvera le bonhomme commencé et le terminera.
 *
 * Journal de coups (`shared/partie.ts`) : `boule:<qui>` (rayon, rondeur) et `deco:<qui>` (objets posés).
 * En direct passent aussi la taille de la boule pendant qu'on roule (« taille ») et les objets pendant
 * qu'on décore (« deco »). Un brouillon des objets est gardé pour survivre à un rechargement.
 * Réglages : src/data/games/bonhomme-jour13.ts (rien à personnaliser dans le salon).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { BONHOMME_JOUR13, type BonhommeContent } from "../../data/games/bonhomme-jour13";
import { prenomsDe } from "../shared/contenu";
import { Cadre, Flash, PanneauRegles, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { ouvrirPartie, type Partie as PartieJeu } from "../shared/partie";
import { Decorer } from "./Decorer";
import { SceneBonhomme } from "./Scene";
import { lancerRoulage, type HudRoulage, type Roulage } from "./roulage";
import {
  bilan as calculerBilan, bouleValide, idBoule, idDeco, objetValide, roleDe,
  type Boule, type CoupBonhomme, type Objet,
} from "./modele";
import "./bonhomme.css";

const TITRE = "Jour 13 · Bonhomme";

type Mode = "chargement" | "regles" | "attente" | "salon" | "rouler" | "entre" | "decorer" | "fin";
type Plan = { debut: number; direct: boolean };

function Bonhomme({ ctx }: { ctx: GameContext }) {
  const contenu: BonhommeContent = BONHOMME_JOUR13; // jeu d'adresse : rien à personnaliser dans le salon
  const PRENOMS = prenomsDe(ctx);
  const autre = PRENOMS[ctx.partner];
  const monRole = roleDe(ctx.me);
  const types = useMemo(() => new Set<string>(contenu.decos.map((d) => d.type)), [contenu]);

  const [mode, setMode] = useState<Mode>("chargement");
  const [ensemble, setEnsemble] = useState(false);
  const [version, setVersion] = useState(0);
  const [pret, setPret] = useState({ me: false, partner: false });
  const [attente, setAttente] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [hud, setHud] = useState<HudRoulage | null>(null);
  const [autreCm, setAutreCm] = useState<number | null>(null);
  const [miens, setMiens] = useState<Objet[]>([]);
  const [siensDirect, setSiensDirect] = useState<Objet[] | null>(null);
  const [flash, setFlash] = useState<{ texte: string; cle: number } | null>(null);

  const partie = useRef<PartieJeu<CoupBonhomme> | null>(null);
  const roulage = useRef<Roulage | null>(null);
  const hote = useRef<HTMLDivElement>(null);
  const svgFin = useRef<SVGSVGElement>(null);
  const cleFlash = useRef(0);
  const departPerime = useRef(false);
  const lancerDirect = useRef<(startsAt: number) => void>(() => {});
  const cibleRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const miensRef = useRef(miens);
  miensRef.current = miens;

  const brouillon = `brouillon:${ctx.me}`;

  /* ---------- journal ---------- */
  const journal = useMemo(() => {
    void version;
    const boules: Record<Who, Boule | null> = { alexandre: null, flavie: null };
    const decos: Record<Who, Objet[] | null> = { alexandre: null, flavie: null };
    for (const c of partie.current?.coups ?? []) {
      if (c.t?.k === "boule" && c.id === idBoule(c.de) && bouleValide(c.t.boule)) boules[c.de] = c.t.boule;
      if (c.t?.k === "deco" && c.id === idDeco(c.de) && Array.isArray(c.t.objets)) {
        decos[c.de] = c.t.objets.filter((o) => objetValide(o, types));
      }
    }
    return { boules, decos };
  }, [version, types]);

  const maBoule = journal.boules[ctx.me];
  const saBoule = journal.boules[ctx.partner];
  const corps = journal.boules.flavie;
  const tete = journal.boules.alexandre;
  const mesDecos = journal.decos[ctx.me];
  const sesDecos = journal.decos[ctx.partner];
  const siens = sesDecos ?? siensDirect ?? [];

  /* ---------- ouverture ---------- */
  useEffect(() => {
    let annule = false;
    void ouvrirPartie<CoupBonhomme>(ctx, { compteARebours: 3000 }).then(async (p) => {
      if (annule) { p.quitter(); return; }
      partie.current = p;
      setEnsemble(p.ensemble());
      p.surPresence((e) => {
        setEnsemble(e);
        // l'autre arrive pendant qu'on décore : on lui montre où on en est
        if (e && modeRef.current === "decorer") p.live?.emit("deco", miensRef.current);
        if (!e) { setAutreCm(null); setSiensDirect(null); }
      });
      p.surCoup(() => setVersion((v) => v + 1));
      const L = p.live;
      if (L) {
        L.onReady((r) => setPret(r));
        L.onStart(({ startsAt, resumed }) => { if (resumed) departPerime.current = true; else lancerDirect.current(startsAt); });
        L.on("taille", (payload, qui) => {
          const cm = (payload as { cm?: number })?.cm;
          if (qui !== ctx.me && typeof cm === "number" && Number.isFinite(cm)) setAutreCm(cm);
        });
        L.on("deco", (payload, qui) => {
          if (qui === ctx.me || !Array.isArray(payload)) return;
          setSiensDirect(payload.filter((o) => objetValide(o, types)));
        });
      }
      // où en étais-je ?
      const moi = p.coups.filter((c) => c.de === ctx.me);
      const aBoule = moi.some((c) => c.id === idBoule(ctx.me));
      const deco = moi.find((c) => c.id === idDeco(ctx.me));
      if (deco?.t.k === "deco") setMiens(deco.t.objets.filter((o) => objetValide(o, types)));
      else if (aBoule) {
        try {
          const b = await ctx.backend.getGameState<Objet[]>(ctx.day, brouillon);
          if (!annule && Array.isArray(b)) setMiens(b.filter((o) => objetValide(o, types)));
        } catch { /* pas de brouillon */ }
      }
      if (annule) return;
      setVersion((v) => v + 1);
      setMode(deco ? "fin" : aBoule ? "decorer" : "regles");
    });
    return () => { annule = true; roulage.current?.arreter(); roulage.current = null; partie.current?.quitter(); partie.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- taille visée pendant qu'on roule ---------- */
  const rAutre = saBoule?.r ?? autreCm;
  cibleRef.current = monRole === "tete"
    ? (rAutre ? rAutre * contenu.rapportIdeal : contenu.teteConseillee)
    : (rAutre ? rAutre / contenu.rapportIdeal : null);

  /* ---------- départ en direct ---------- */
  lancerDirect.current = (startsAt: number) => {
    if (maBoule || startsAt + contenu.secondesRouler * 1000 < Date.now()) return;
    setPlan({ debut: startsAt, direct: true });
    setMode("rouler");
    ctx.say([`À vos boules ! ${PRENOMS.flavie} fait le corps, ${PRENOMS.alexandre} la tête ⛄`]);
  };

  /* ---------- phase 1 : rouler ---------- */
  useEffect(() => {
    if (mode !== "rouler" || !plan || !hote.current) return;
    setHud(null);
    let derniereTaille = 0;
    const r = lancerRoulage({
      hote: hote.current,
      contenu,
      debut: plan.debut,
      cible: () => cibleRef.current,
      surHud: (h) => {
        setHud(h);
        const t = Date.now();
        if (plan.direct && t - derniereTaille > 300) { derniereTaille = t; partie.current?.live?.emit("taille", { cm: h.cm }); }
      },
      surConseil: (texte) => setFlash({ texte, cle: ++cleFlash.current }),
      surFin: (boule) => {
        ctx.sound.play("whoosh");
        void partie.current?.jouer(idBoule(ctx.me), { k: "boule", boule });
        const p = partie.current;
        setMode(plan.direct && p?.ensemble() && !p.siens().some((c) => c.id === idBoule(ctx.partner)) ? "entre" : "decorer");
      },
    });
    roulage.current = r;
    return () => { r.arreter(); if (roulage.current === r) roulage.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, plan]);

  // on attend la boule de l'autre (direct) : elle arrive, ou l'autre part
  useEffect(() => {
    if (mode === "entre" && (saBoule || !ensemble)) setMode("decorer");
  }, [mode, saBoule, ensemble]);

  useEffect(() => {
    if (mode === "decorer" && maBoule) {
      ctx.say(saBoule
        ? [`Le bonhomme est monté ! Glisse les objets sur lui${ensemble ? ` : ${autre} décore en même temps que toi` : ""} 🥕🧣`]
        : [`${autre} n'a pas encore roulé sa boule : décore ta moitié, ${autre} terminera le bonhomme.`]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "decorer"]);

  /* ---------- phase 2 : décorer ---------- */
  const minuteurEnvoi = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteurBrouillon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changerObjets = (objets: Objet[]) => {
    if (objets.length > miensRef.current.length) ctx.sound.play("pop");
    setMiens(objets);
    if (minuteurEnvoi.current) clearTimeout(minuteurEnvoi.current);
    minuteurEnvoi.current = setTimeout(() => partie.current?.live?.emit("deco", objets), 120);
    if (minuteurBrouillon.current) clearTimeout(minuteurBrouillon.current);
    minuteurBrouillon.current = setTimeout(() => {
      ctx.backend.setGameState(ctx.day, brouillon, objets).catch(() => { /* hors ligne */ });
    }, 800);
  };
  useEffect(() => () => {
    if (minuteurEnvoi.current) clearTimeout(minuteurEnvoi.current);
    if (minuteurBrouillon.current) clearTimeout(minuteurBrouillon.current);
  }, []);

  const terminerDeco = () => {
    ctx.sound.play("tap");
    partie.current?.live?.emit("deco", miens);
    void partie.current?.jouer(idDeco(ctx.me), { k: "deco", objets: miens });
    setMode("fin");
  };

  /* ---------- présence (attente → salon) ---------- */
  useEffect(() => {
    if (mode === "attente" && ensemble) {
      setMode("salon");
      ctx.sound.play("notify");
      ctx.say([`${autre} est là ! Cliquez sur « On y va ! » et roulez vos boules ⛄`]);
    } else if (mode === "salon" && !ensemble) {
      setAttente(0);
      setMode("attente");
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

  /* ---------- bilan ---------- */
  const objetsTous: Record<Who, Objet[]> = ctx.me === "alexandre"
    ? { alexandre: miens, flavie: siens } : { alexandre: siens, flavie: miens };
  const b = calculerBilan(contenu, corps, tete, objetsTous);
  const toutFini = !!mesDecos && !!sesDecos;

  const annonce = useRef<"" | "moitie" | "tout">("");
  useEffect(() => {
    if (mode !== "fin" || !mesDecos) return;
    const etape = toutFini ? "tout" : "moitie";
    if (annonce.current === etape) return;
    const premiere = annonce.current === "";
    annonce.current = etape;
    if (premiere) ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    if (etape === "tout") {
      ctx.sound.play("win");
      const manque = b.elements.filter((e) => !e.ok);
      const nez = b.elements.find((e) => e.cle === "nez");
      ctx.say([
        `Votre bonhomme est terminé : ${b.total} points à deux ! ⛄`,
        manque.length === 0 ? "Il ne lui manque rien. Je crois qu'il vient de me faire un clin d'œil."
          : !nez?.ok ? "Il n'a pas de nez en carotte… c'est un choix artistique audacieux 🥕"
            : `Il lui manque : ${manque.map((e) => e.label.toLowerCase()).join(", ")}. Il est parfait quand même.`,
      ]);
    } else if (ensemble && !sesDecos) {
      ctx.say([`${autre} met la dernière touche… je regarde avec toi 👀`]);
    } else {
      ctx.say([`Ta moitié est faite ! ${autre} trouvera le bonhomme ici et le terminera.`]);
    }
  }, [mode, mesDecos, toutFini, b, ctx, autre, ensemble, sesDecos]);

  /* ---------- souvenir : image à enregistrer ---------- */
  const enregistrerImage = async () => {
    const s = svgFin.current;
    if (!s) return;
    ctx.sound.play("photo");
    const clone = s.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "900");
    clone.setAttribute("height", "1200");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("image")); img.src = url; });
      const cv = document.createElement("canvas");
      cv.width = 900; cv.height = 1200;
      cv.getContext("2d")!.drawImage(img, 0, 0, 900, 1200);
      const a = document.createElement("a");
      a.download = "notre-bonhomme-de-neige.png";
      a.href = cv.toDataURL("image/png");
      a.click();
    } catch {
      ctx.say(["Je n'arrive pas à faire la photo sur cet appareil… une capture d'écran fera l'affaire 📸"]);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  /* ---------- actions ---------- */
  const jouerSeul = () => {
    ctx.sound.play("tap");
    partie.current?.live?.setReady(false);
    setPlan({ debut: Date.now() + 3200, direct: false });
    setMode("rouler");
  };

  const commencer = () => {
    ctx.sound.play("tap");
    if (saBoule) { jouerSeul(); return; } // l'autre a déjà roulé : pas besoin de l'attendre
    if (ensemble) { setMode("salon"); return; }
    setAttente(0);
    setMode("attente");
    ctx.say([`Je préviens ${autre}… on attend un petit peu ?`]);
  };

  /* ---------- rendu ---------- */
  const presence = <Puce pale>{ensemble ? `🟢 ${autre}` : `⚪️ ${autre}`}</Puce>;
  const nomRole = (r: "tete" | "corps") => (r === "tete" ? "la tête" : "le corps");

  if (mode === "chargement") {
    return <Cadre titre={TITRE}><div className="jeu-centre"><p className="quiz-attente">Pingou tasse la neige…</p></div></Cadre>;
  }

  if (mode === "regles") {
    return (
      <Cadre titre={TITRE} barre={presence}>
        <PanneauRegles
          emoji="⛄"
          titre="Un bonhomme de neige à deux"
          regles={[
            `D'abord, ${contenu.secondesRouler} s pour rouler ta boule dans la neige : tu fais ${nomRole(monRole)}, ${autre} fait ${nomRole(monRole === "tete" ? "corps" : "tete")}.`,
            "Guide-la du doigt (ou avec les flèches). Tourne souvent : en ligne droite, elle devient un boudin !",
            monRole === "tete"
              ? "La tête doit aller avec le corps : environ deux tiers de sa taille. Le cercle pointillé te montre la bonne taille."
              : "Le corps porte tout : fais-le bien gros… mais rond !",
            "Ensuite, vous décorez le bonhomme ensemble : carotte, charbon, écharpe, bonnet…",
            saBoule
              ? `${autre} a déjà roulé sa boule (${Math.round(saBoule.r)} cm) : à toi !`
              : ensemble
                ? `${autre} est là : vous jouez en direct.`
                : `${autre} n'est pas là : tu feras ta moitié, et ${autre} terminera le bonhomme plus tard.`,
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
                : `${autre} ne répond pas. Fais ta moitié du bonhomme : ${autre} le terminera plus tard.`}
            </p>
            <div className="attente-points"><i /><i /><i /></div>
            <div className="jeu-actions">
              {reste === 0 && <button className="jeu-btn" onClick={jouerSeul}>Jouer quand même</button>}
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
            <div className="emoji">⛄</div>
            <h2>{autre} est là !</h2>
            <p>
              {pret.me
                ? (pret.partner ? "Attention… 3, 2, 1…" : `C'est noté. On attend ${autre}…`)
                : (pret.partner ? `${autre} n'attend plus que toi !` : "Dès que chacun a cliqué, on roule les boules.")}
            </p>
            <div className="duel-pret">
              <span className={pret.me ? "ok" : ""}>{PRENOMS[ctx.me]} {pret.me ? "✅" : "…"}</span>
              <span className={pret.partner ? "ok" : ""}>{autre} {pret.partner ? "✅" : "…"}</span>
            </div>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={jouerSeul}>Jouer en solo</button>
              {!pret.me && <button className="jeu-btn" onClick={() => { ctx.sound.play("tap"); partie.current?.live?.setReady(true); }}>On y va !</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "rouler") {
    const cible = cibleRef.current;
    return (
      <Cadre
        titre={monRole === "tete" ? "La tête" : "Le corps"}
        barre={(
          <>
            <Puce>⏱ {hud?.reste ?? contenu.secondesRouler}</Puce>
            <Puce>⚪️ {hud?.cm ?? contenu.rayonDepart} cm{cible ? ` / ${Math.round(cible)}` : ""}</Puce>
          </>
        )}
      >
        <div className="jeu-canvas bh-terrain" ref={hote}>
          {(!hud || hud.avant > 0) && <div className="duel-decompte" key={hud?.avant ?? 3}>{hud?.avant ?? 3}</div>}
          {plan?.direct && autreCm !== null && (
            <div className="bh-autre">{autre} · {nomRole(monRole === "tete" ? "corps" : "tete")} : {autreCm} cm</div>
          )}
          {hud && hud.avant === 0 && <div className="bh-rondeur">Rondeur {Math.round(hud.rondeur * 100)} %</div>}
          {hud && hud.avant === 0 && (
            <button className="jeu-btn bh-fini" onClick={() => roulage.current?.finir()}>C'est bon !</button>
          )}
          {flash && <Flash texte={flash.texte} cle={flash.cle} />}
        </div>
      </Cadre>
    );
  }

  if (mode === "entre") {
    return (
      <Cadre titre={TITRE} barre={presence}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">⛄</div>
            <h2>Ta boule est prête !</h2>
            <p>{autre} roule encore la sienne{autreCm ? ` (${autreCm} cm)` : ""}…</p>
            <div className="attente-points"><i /><i /><i /></div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "decorer") {
    return (
      <Cadre titre="On décore !" barre={<>{presence}<button className="jeu-btn bh-btn-barre" onClick={terminerDeco}>J'ai fini</button></>}>
        <Decorer contenu={contenu} corps={corps} tete={tete} miens={miens} siens={siens}
          surChange={changerObjets} max={contenu.objetsParPersonne} />
      </Cadre>
    );
  }

  /* ----- fin : le souvenir ----- */
  const c = b.construction;
  return (
    <Cadre titre={TITRE} barre={presence}>
      <div className="bh-fin">
        <div className="bh-fin-scene">
          <SceneBonhomme contenu={contenu} corps={corps} tete={tete} svgRef={svgFin}
            objets={[...siens.map((o) => ({ o, moi: false })), ...miens.map((o) => ({ o, moi: false }))]} />
        </div>
        <div className="jeu-panneau bh-fin-panneau">
          <h2>{toutFini ? "Votre bonhomme !" : "Ta moitié est faite !"}</h2>
          <div className="jeu-score">{b.total.toLocaleString("fr-FR")}</div>
          <div className="jeu-score-note">{toutFini ? "points, à vous deux" : "points pour l'instant"}</div>
          <div className="jeu-compare bh-detail">
            <div><span>Taille</span><b>{c.taille}</b></div>
            <div><span>Assortis</span><b>{c.complet ? c.assortiment : "…"}</b></div>
            <div><span>Rondeur</span><b>{c.rondeur}</b></div>
            <div><span>Déco</span><b>{b.deco}</b></div>
          </div>
          <ul className="bh-liste">
            {b.elements.map((e) => <li key={e.cle} className={e.ok ? "ok" : ""}>{e.ok ? "✅" : "▫️"} {e.label}</li>)}
            <li className={b.aDeux ? "ok" : ""}>{b.aDeux ? "✅" : "▫️"} Décoré à deux</li>
          </ul>
          {!toutFini && (
            <p>
              {ensemble && !sesDecos
                ? `${autre} décore encore… tu vois ses objets arriver.`
                : !saBoule ? `${autre} roulera ${nomRole(monRole === "tete" ? "corps" : "tete")} et terminera le bonhomme plus tard.`
                  : `${autre} n'a pas fini de le décorer : le score final arrive à ce moment-là.`}
            </p>
          )}
          <div className="jeu-actions">
            <button className="jeu-btn clair" onClick={() => void enregistrerImage()}>📸 Enregistrer l'image</button>
            <button className="jeu-btn" onClick={() => ctx.complete({ success: true, score: b.total, data: { construction: c, deco: b.deco, complet: toutFini } })}>Fermer</button>
          </div>
        </div>
      </div>
    </Cadre>
  );
}

export const bonhommeJour13: GameModule = {
  id: "bonhomme-jour13",
  title: "Bonhomme de neige à deux",
  mount: (el, ctx) => monterReact(el, <Bonhomme ctx={ctx} />),
};
