/**
 * Jour 9 — Dessin à deviner : vos souvenirs dessinés (en différé, chacun joue quand il veut).
 *
 * Règles décidées avec Alexandre (25 nov) :
 *  - chacun fait 3 dessins, sans chrono ; pour chacun il choisit un thème (« un voyage qu'on a fait »…),
 *    dessine SON souvenir, puis écrit la réponse à trouver et un petit mot révélé à la fin ;
 *  - l'autre découvre les dessins après avoir fait les siens : il les regarde se refaire trait par trait
 *    et tape sa réponse (correction tolérante, comme au rébus), avec le thème comme indice ;
 *  - la galerie des 6 dessins reste en souvenir.
 *
 * Décisions techniques prises seul : 3 essais par dessin (3, 2 puis 1 point) ; « Langue au chat » pour
 * voir la réponse ; si la réponse était juste mais pas dans les mots attendus, « C'était presque ça »
 * donne 1 point (sur l'honneur : c'est un souvenir, pas un examen). Le rejeu saute les longues pauses et
 * dure au plus 20 s. On peut annuler le dernier trait.
 *
 * Stockage (`setGameState`, par jour) :
 *  - `dessin:<qui>:<k>` → DessinPoste (k = 0, 1, 2)
 *  - `devine:<qui>:<k>` → Devinette de <qui> sur le dessin k de l'autre
 *
 * En mode démo, tant que l'autre n'a rien dessiné, trois dessins d'exemple tiennent lieu des siens ;
 * les devinettes faites contre eux ne sont pas enregistrées.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { DESSIN_JOUR9, SCHEMA_DESSIN_JOUR9, reparerDessin } from "../../data/games/dessin-jour9";
import { prenomsDe, lireContenu } from "../shared/contenu";
import { Cadre, PanneauRegles, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { bonneReponse, nue } from "../rebus/reponse";
import { EPAISSEURS, GOMME, NOMS_COULEURS, PALETTE, estEffacer, vignette, type Element } from "../pictionary/dessin";
import { Tableau, type Crayon } from "../pictionary/Tableau";
import { DESSINS_EXEMPLE } from "./exemple";
import "../pictionary/pictionary.css";
import "../photo/photo.css";
import "./dessin.css";

const REPONSE_MAX = 40;
const MOT_MAX = 90;
const ATTENTE_RELECTURE_MS = 15000;
/** Rejeu : une pause plus longue que ça est raccourcie à ça */
const PAUSE_MAX_MS = 400;
const REJEU_MAX_MS = 20000;

export type DessinPoste = {
  theme: string;
  elements: Element[];
  reponse: string;
  variantes: string[];
  mot: string;
  le: string;
};

export type Devinette = {
  essais: string[];
  trouve: boolean;
  /** « C'était presque ça » : réponse juste mais pas dans les mots attendus */
  presque?: boolean;
  points: number;
};

type Etape = "chargement" | "regles" | "theme" | "dessin" | "legende" | "tableau" | "devine";

const cleDessin = (qui: Who, k: number) => `dessin:${qui}:${k}`;
const cleDevine = (qui: Who, k: number) => `devine:${qui}:${k}`;

const pointsPour = (d: Devinette | null | undefined) => d?.points ?? 0;

/** Correction tolérante, plus large qu'au rébus : « une pizza margherita » trouve « la pizza » */
function reponseJuste(saisie: string, d: DessinPoste): boolean {
  if (bonneReponse(saisie, d.reponse, d.variantes)) return true;
  const mots = new Set(nue(saisie).split(" ").map((m) => m.replace(/s$/, "")));
  return [d.reponse, ...d.variantes].some((att) => {
    const attendus = nue(att).split(" ").filter((m) => m.length > 2).map((m) => m.replace(/s$/, ""));
    return attendus.length > 0 && attendus.every((m) => mots.has(m));
  });
}

/** Rejeu : renvoie une copie horodatée sans les longues pauses, et sa durée */
function compacter(elements: Element[]): { elements: Element[]; duree: number } {
  // tous les instants, dans l'ordre, pour recaler le temps
  const instants: number[] = [];
  for (const el of elements) {
    if (estEffacer(el)) instants.push(el.t);
    else for (let i = 2; i < el.p.length; i += 3) instants.push(el.p[i]);
  }
  const tries = [...new Set(instants)].sort((a, b) => a - b);
  const recale = new Map<number, number>();
  let t = 0, avant = tries[0] ?? 0;
  for (const x of tries) { t += Math.min(PAUSE_MAX_MS, x - avant); avant = x; recale.set(x, t); }
  const k = t > REJEU_MAX_MS ? REJEU_MAX_MS / t : 1;
  const r = (x: number) => Math.round((recale.get(x) ?? 0) * k);
  const copie = elements.map((el): Element => estEffacer(el)
    ? { x: 1, t: r(el.t) }
    : { c: el.c, e: el.e, p: el.p.map((v, i) => (i % 3 === 2 ? r(v) : v)) });
  return { elements: copie, duree: Math.round(t * k) };
}

/* ---------- petit tableau d'un dessin fini ---------- */

function Vignette({ elements, legende, sous, onClick }: {
  elements?: Element[]; legende: string; sous?: string; onClick?: () => void;
}) {
  const src = useMemo(() => (elements ? vignette(elements, 240) : ""), [elements]);
  const contenu = (
    <>
      <div className="des-vignette-image">{src ? <img src={src} alt={legende} /> : <span>⏳</span>}</div>
      <b>{legende}</b>
      {sous && <small>{sous}</small>}
    </>
  );
  return onClick
    ? <button className="des-vignette a-deviner" onClick={onClick}>{contenu}</button>
    : <div className="des-vignette">{contenu}</div>;
}

/* ---------- jeu ---------- */

function DessinADeviner({ ctx, titreJeu }: { ctx: GameContext; titreJeu: string }) {
  const contenu = useMemo(() => lireContenu(ctx.content, DESSIN_JOUR9, SCHEMA_DESSIN_JOUR9, reparerDessin), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const N = contenu.nbDessins;
  const autre = PRENOMS[ctx.partner];
  const titre = `Jour ${ctx.day} · ${titreJeu}`;
  const themePar = useCallback(
    (id: string) => contenu.themes.find((t) => t.id === id) ?? { id, texte: id, idee: "" },
    [contenu],
  );

  const [etape, setEtape] = useState<Etape>("chargement");
  const [mes, setMes] = useState<(DessinPoste | null)[]>([]);
  const [ses, setSes] = useState<(DessinPoste | null)[]>([]);
  const sesRef = useRef(ses);
  sesRef.current = ses;
  const [exemple, setExemple] = useState(false);
  const [mesDev, setMesDev] = useState<(Devinette | null)[]>([]);
  const [sesDev, setSesDev] = useState<(Devinette | null)[]>([]);

  /* dessin en cours */
  const elements = useRef<(Element | undefined)[]>([]);
  const debut = useRef(Date.now());
  const [nbTraits, setNbTraits] = useState(0);
  const [theme, setTheme] = useState<string | null>(null);
  const [couleur, setCouleur] = useState(0);
  const [epaisseur, setEpaisseur] = useState(1);
  const [gomme, setGomme] = useState(false);
  const [reponse, setReponse] = useState("");
  const [variantes, setVariantes] = useState("");
  const [mot, setMot] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /* devinette en cours */
  const [k, setK] = useState(0);
  const rejeu = useRef<(Element | undefined)[]>([]);
  const [rejeuDebut, setRejeuDebut] = useState(0);
  const [rejeuDuree, setRejeuDuree] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [essais, setEssais] = useState<string[]>([]);
  const [resultat, setResultat] = useState<Devinette | null>(null);
  const [rate, setRate] = useState(0);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  /* ---------- lecture de l'état ---------- */
  const lire = useCallback(async <T,>(cle: string): Promise<T | null> => {
    try { return await ctx.backend.getGameState<T>(ctx.day, cle); } catch { return null; }
  }, [ctx]);

  const lireTous = useCallback(<T,>(cle: (k: number) => string) =>
    Promise.all(Array.from({ length: N }, (_, i) => lire<T>(cle(i)))), [N, lire]);

  /** Les dessins de l'autre ; en démo, des exemples tant qu'il n'a rien dessiné */
  const lireSes = useCallback(async (): Promise<{ dessins: (DessinPoste | null)[]; exemple: boolean }> => {
    const dessins = await lireTous<DessinPoste>((i) => cleDessin(ctx.partner, i));
    if (dessins.some(Boolean) || ctx.backend.mode !== "demo") return { dessins, exemple: false };
    const le = new Date().toISOString();
    return {
      dessins: Array.from({ length: N }, (_, i) => {
        const ex = contenu.exemples[i % contenu.exemples.length];
        const els = DESSINS_EXEMPLE[i % DESSINS_EXEMPLE.length];
        return ex ? { ...ex, elements: els, le } : null;
      }),
      exemple: true,
    };
  }, [N, contenu, ctx, lireTous]);

  useEffect(() => {
    let annule = false;
    (async () => {
      const [mien, sien, mD, sD] = await Promise.all([
        lireTous<DessinPoste>((i) => cleDessin(ctx.me, i)),
        lireSes(),
        lireTous<Devinette>((i) => cleDevine(ctx.me, i)),
        lireTous<Devinette>((i) => cleDevine(ctx.partner, i)),
      ]);
      if (annule) return;
      setMes(mien); setSes(sien.dessins); setExemple(sien.exemple);
      setMesDev(sien.exemple ? [] : mD); setSesDev(sD);
      const faits = mien.filter(Boolean).length;
      setEtape(faits === 0 ? "regles" : faits < N ? "theme" : "tableau");
    })();
    return () => { annule = true; };
  }, [N, ctx, lireSes, lireTous]);

  const nbMes = mes.filter(Boolean).length;
  const tousMesFaits = nbMes >= N;

  /* ---------- tableau : on guette les dessins et devinettes de l'autre ---------- */
  useEffect(() => {
    if (etape !== "tableau") return;
    const id = window.setInterval(async () => {
      const [sien, sD] = await Promise.all([lireSes(), lireTous<Devinette>((i) => cleDevine(ctx.partner, i))]);
      setSesDev(sD);
      if (sien.exemple) return;
      const nouveaux = sien.dessins.filter((d, i) => d && !sesRef.current[i]).length;
      if (nouveaux > 0) {
        ctx.sound.play("notify");
        ctx.say([`${autre} vient de finir un dessin ! À toi de deviner ✏️`]);
      }
      setSes(sien.dessins);
      if (exemple) { setExemple(false); setMesDev([]); }
    }, ATTENTE_RELECTURE_MS);
    return () => clearInterval(id);
  }, [autre, ctx, etape, exemple, lireSes, lireTous]);

  /* ---------- dessiner ---------- */
  const themesPris = useMemo(() => new Set(mes.filter(Boolean).map((d) => d!.theme)), [mes]);

  const commencerDessin = (id: string) => {
    setTheme(id);
    elements.current = [];
    setNbTraits(0);
    setGomme(false);
    debut.current = Date.now();
    setEtape("dessin");
    ctx.sound.play("pop");
    ctx.say([`« ${themePar(id).texte} » : dessine ton souvenir, ${autre} devra le reconnaître 🎨`]);
  };

  const crayon: Crayon = {
    c: gomme ? GOMME : couleur,
    e: epaisseur,
    debut: debut.current,
    onPoints: (i) => { if (i >= nbTraits) setNbTraits(i + 1); },
  };

  const annulerTrait = () => {
    elements.current.pop();
    setNbTraits(elements.current.length);
  };
  const toutEffacer = () => {
    elements.current.push({ x: 1, t: Math.max(0, Date.now() - debut.current) });
    setNbTraits(elements.current.length);
  };
  const aDuDessin = elements.current.some((el) => el && !estEffacer(el))
    && !estEffacer(elements.current[elements.current.length - 1]);

  const finirDessin = () => {
    setReponse(""); setVariantes(""); setMot(""); setErreur(null);
    setEtape("legende");
    ctx.say(["Joli ! Maintenant, écris ce que " + autre + " doit trouver."]);
  };

  const envoyerDessin = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (!theme || !reponse.trim() || envoi) return;
    setEnvoi(true); setErreur(null);
    const k = mes.findIndex((d) => !d);
    const indice = k === -1 ? mes.length : k;
    const poste: DessinPoste = {
      theme,
      elements: elements.current.filter((e): e is Element => !!e),
      reponse: reponse.trim().slice(0, REPONSE_MAX),
      variantes: variantes.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 8),
      mot: mot.trim().slice(0, MOT_MAX),
      le: new Date().toISOString(),
    };
    try {
      await ctx.backend.setGameState<DessinPoste>(ctx.day, cleDessin(ctx.me, indice), poste);
      const suite = [...mes];
      suite[indice] = poste;
      setMes(suite);
      ctx.sound.play("send");
      const faits = suite.filter(Boolean).length;
      if (faits >= N) {
        ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
        setEtape("tableau");
        const dispo = ses.filter(Boolean).length;
        ctx.say(dispo
          ? [exemple ? "Tes 3 dessins sont envoyés ! En mode démo, j'ai préparé des dessins d'exemple pour l'autre côté." : `Tes ${N} dessins sont envoyés ! Et ${autre} a déjà dessiné… On devine ? 👀`]
          : [`Tes ${N} dessins sont envoyés !`, `Dès que ${autre} a dessiné, je te préviens 💌`]);
      } else {
        setEtape("theme");
        ctx.say([`Envoyé ! Plus que ${N - faits} dessin${N - faits > 1 ? "s" : ""}.`]);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible. Réessaie dans un instant.");
      ctx.sound.play("bad");
    } finally {
      setEnvoi(false);
    }
  };

  /* ---------- deviner ---------- */
  const relancerRejeu = useCallback((d: DessinPoste) => {
    const c = compacter(d.elements);
    rejeu.current = c.elements;
    setRejeuDuree(c.duree);
    setRejeuDebut(performance.now());
  }, []);

  const ouvrirDevinette = (i: number) => {
    const d = ses[i];
    if (!d) return;
    setK(i); setSaisie(""); setEssais([]); setResultat(null);
    relancerRejeu(d);
    setEtape("devine");
    ctx.sound.play("pop");
    ctx.say([`Thème : « ${themePar(d.theme).texte} ». Regarde bien… 👀`]);
  };

  const enregistrerDevinette = (dev: Devinette) => {
    setResultat(dev);
    setMesDev((avant) => { const s = [...avant]; s[k] = dev; return s; });
    if (!exemple) ctx.backend.setGameState<Devinette>(ctx.day, cleDevine(ctx.me, k), dev).catch(() => { /* hors ligne */ });
  };

  const proposer = (ev: FormEvent) => {
    ev.preventDefault();
    const d = ses[k];
    const s = saisie.trim();
    if (!d || !s || resultat) return;
    const tous = [...essais, s];
    setEssais(tous); setSaisie("");
    if (reponseJuste(s, d)) {
      const points = Math.max(1, contenu.essais + 1 - tous.length);
      enregistrerDevinette({ essais: tous, trouve: true, points });
      ctx.sound.play("win");
      ctx.say(["Bravo, tu as reconnu ce souvenir ! 💞"]);
    } else if (tous.length >= contenu.essais) {
      enregistrerDevinette({ essais: tous, trouve: false, points: 0 });
      ctx.sound.play("bad");
    } else {
      setRate((r) => r + 1);
      ctx.sound.play("bad");
    }
  };

  const langueAuChat = () => {
    if (resultat) return;
    enregistrerDevinette({ essais, trouve: false, points: 0 });
    ctx.sound.play("pop");
  };

  const presque = () => {
    if (!resultat || resultat.trouve) return;
    enregistrerDevinette({ ...resultat, presque: true, points: 1 });
    ctx.sound.play("good");
  };

  /* ---------- rendu ---------- */
  const mesPoints = mesDev.reduce((s, d) => s + pointsPour(d), 0);
  const sesPoints = sesDev.reduce((s, d) => s + pointsPour(d), 0);
  const fermer = () => ctx.complete({ success: true, score: mesPoints, data: { dessins: nbMes, devines: mesDev.filter(Boolean).length } });

  if (etape === "chargement") {
    return <Cadre titre={titre}><div className="jeu-centre"><p className="quiz-attente">Un instant, je sors vos crayons…</p></div></Cadre>;
  }

  if (etape === "regles") {
    return (
      <Cadre titre={titre}>
        <PanneauRegles
          emoji={contenu.emoji}
          titre={contenu.titre}
          regles={[
            `Tu fais ${N} dessins, sans chrono. Pour chacun, choisis un thème et dessine un souvenir à vous deux.`,
            `Écris ensuite ce que ${autre} doit trouver, et un petit mot qui sera révélé après.`,
            `Une fois tes dessins envoyés, tu regardes ceux de ${autre} se refaire trait par trait, et tu devines (${contenu.essais} essais).`,
            "À la fin, vos dessins restent dans une petite galerie souvenir.",
          ]}
          bouton="✏️ Prendre mes crayons"
          onJouer={() => setEtape("theme")}
        />
      </Cadre>
    );
  }

  if (etape === "theme") {
    return (
      <Cadre titre={titre} barre={<Puce pale>Dessin {nbMes + 1}/{N}</Puce>}>
        <div className="jeu-centre">
          <div className="des-themes">
            <p className="des-titre">Quel souvenir vas-tu dessiner ?</p>
            {contenu.themes.map((t) => (
              <button key={t.id} className="des-theme" disabled={themesPris.has(t.id)} onClick={() => commencerDessin(t.id)}>
                {t.texte}{themesPris.has(t.id) && <span> ✓</span>}
              </button>
            ))}
          </div>
        </div>
      </Cadre>
    );
  }

  if (etape === "dessin" && theme) {
    return (
      <Cadre titre={titre} barre={<Puce pale>Dessin {nbMes + 1}/{N}</Puce>}>
        <div className="pic-manche">
          <div className="pic-entete">
            <div className="pic-indice"><small>Ton thème</small>{themePar(theme).texte}</div>
          </div>
          <Tableau elements={elements} crayon={crayon} />
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
              <button aria-label="Annuler le dernier trait" disabled={nbTraits === 0} onClick={annulerTrait}>↩️</button>
              <button aria-label="Tout effacer" disabled={nbTraits === 0} onClick={toutEffacer}>🗑️</button>
              <button className="pic-fini" disabled={!aDuDessin} onClick={finirDessin}>J'ai fini</button>
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (etape === "legende" && theme) {
    const t = themePar(theme);
    return (
      <Cadre titre={titre} barre={<Puce pale>Dessin {nbMes + 1}/{N}</Puce>}>
        <div className="jeu-centre">
          <form className="des-legende" onSubmit={envoyerDessin}>
            <Vignette elements={elements.current.filter((e): e is Element => !!e)} legende={t.texte} />
            <label className="photo-champ">
              <span>Ce que {autre} doit trouver</span>
              <input type="text" value={reponse} maxLength={REPONSE_MAX} placeholder={t.idee} autoFocus
                onChange={(e) => setReponse(e.target.value)} />
            </label>
            <label className="photo-champ">
              <span>Autres réponses acceptées <em>(facultatif, séparées par des virgules)</em></span>
              <input type="text" value={variantes} maxLength={160} placeholder="ex. cinoche, le film"
                onChange={(e) => setVariantes(e.target.value)} />
            </label>
            <label className="photo-champ">
              <span>Un petit mot, révélé après <em>(facultatif)</em></span>
              <input type="text" value={mot} maxLength={MOT_MAX} placeholder="ex. Tu te souviens de ton fou rire ?"
                onChange={(e) => setMot(e.target.value)} />
            </label>
            {erreur && <p className="photo-erreur">{erreur}</p>}
            <div className="jeu-actions">
              <button type="button" className="jeu-btn clair" disabled={envoi} onClick={() => setEtape("dessin")}>Retoucher</button>
              <button type="submit" className="jeu-btn" disabled={!reponse.trim() || envoi}>
                {envoi ? "J'envoie…" : `Envoyer à ${autre} 💌`}
              </button>
            </div>
          </form>
        </div>
      </Cadre>
    );
  }

  if (etape === "devine" && ses[k]) {
    const d = ses[k]!;
    const fini = !!resultat;
    const jusqua = () => (fini ? Infinity : performance.now() - rejeuDebut);
    return (
      <Cadre titre={titre} barre={<Puce pale>Dessin {k + 1} de {autre}</Puce>}>
        <div className="pic-manche">
          <div className="pic-entete">
            <div className="pic-indice"><small>Thème</small>{themePar(d.theme).texte}</div>
            <button className="jeu-btn clair des-revoir" onClick={() => relancerRejeu(d)}>↻ Revoir</button>
          </div>
          <Tableau elements={rejeu} jusqua={jusqua} key={`${k}-${rejeuDebut}`} />
          <div className="pic-essais">
            {essais.map((e, i) => <span key={i}>{e}</span>)}
            {!fini && essais.length === 0 && <em>{contenu.essais} essais · {rejeuDuree > 0 ? "le dessin se refait…" : ""}</em>}
          </div>
          {!fini ? (
            <>
              <form className="pic-devine" onSubmit={proposer}>
                <input key={rate} className={rate ? "secoue" : ""} value={saisie} onChange={(e) => setSaisie(e.target.value)}
                  placeholder="Ta réponse…" autoComplete="off" autoCapitalize="off" enterKeyHint="send" maxLength={REPONSE_MAX} />
                <button className="jeu-btn" type="submit" disabled={!saisie.trim()}>Proposer</button>
              </form>
              <div className="jeu-actions des-chat">
                <button className="jeu-btn clair" onClick={langueAuChat}>🐱 Langue au chat</button>
              </div>
            </>
          ) : (
            <div className={"des-revele " + (resultat!.trouve || resultat!.presque ? "bon" : "rate")}>
              <p>{resultat!.trouve ? `Trouvé ! +${resultat!.points}` : resultat!.presque ? "Presque ça ! +1" : "C'était…"}</p>
              <b>{d.reponse}</b>
              {d.mot && <q>{d.mot}</q>}
              <div className="jeu-actions">
                {!resultat!.trouve && !resultat!.presque && essais.length > 0 && (
                  <button className="jeu-btn clair" onClick={presque}>✋ C'était presque ça</button>
                )}
                <button className="jeu-btn" onClick={() => setEtape("tableau")}>Continuer</button>
              </div>
            </div>
          )}
        </div>
      </Cadre>
    );
  }

  /* tableau : la galerie, les dessins à deviner, les scores */
  const sesDispo = ses.filter(Boolean).length;
  const aDeviner = ses.map((d, i) => (d && !mesDev[i] ? i : -1)).filter((i) => i >= 0);
  return (
    <Cadre titre={titre} barre={<Puce pale>Vos souvenirs</Puce>}>
      <div className="jeu-centre">
        <div className="des-galerie">
          <div className="des-rang">
            <h3>Les dessins de {autre} <span>· toi : {mesPoints} pt{mesPoints > 1 ? "s" : ""}</span></h3>
            <div className="des-ligne">
              {Array.from({ length: N }, (_, i) => {
                const d = ses[i];
                const dev = mesDev[i];
                if (!d) return <Vignette key={i} legende="Pas encore dessiné" />;
                if (!dev) return <Vignette key={i} legende={themePar(d.theme).texte} sous="Touche pour deviner" onClick={() => ouvrirDevinette(i)} />;
                return <Vignette key={i} elements={d.elements} legende={d.reponse}
                  sous={dev.trouve ? `✓ trouvé · +${dev.points}` : dev.presque ? "≈ presque · +1" : "✗ raté"} />;
              })}
            </div>
          </div>
          <div className="des-rang">
            <h3>Tes dessins <span>· {autre} : {sesPoints} pt{sesPoints > 1 ? "s" : ""}</span></h3>
            <div className="des-ligne">
              {Array.from({ length: N }, (_, i) => {
                const d = mes[i];
                const dev = sesDev[i];
                if (!d) return <Vignette key={i} legende="À dessiner" />;
                return <Vignette key={i} elements={d.elements} legende={d.reponse}
                  sous={!dev ? `${autre} n'a pas encore deviné` : dev.trouve ? `✓ ${autre} a trouvé` : dev.presque ? "≈ presque" : `✗ « ${dev.essais[dev.essais.length - 1] ?? "?"} »`} />;
              })}
            </div>
          </div>
        </div>
        {sesDispo < N && <p className="photo-aide">{autre} n'a pas fini de dessiner : je te préviens dès qu'un dessin arrive.</p>}
        {exemple && <p className="photo-aide">Mode démo : les dessins de {autre} sont des exemples.</p>}
        <div className="jeu-actions">
          {!tousMesFaits && <button className="jeu-btn clair" onClick={() => setEtape("theme")}>Continuer mes dessins</button>}
          {aDeviner.length > 0 && <button className="jeu-btn" onClick={() => ouvrirDevinette(aDeviner[0])}>Deviner ✏️</button>}
          <button className={aDeviner.length ? "jeu-btn clair" : "jeu-btn"} onClick={fermer}>Fermer</button>
        </div>
      </div>
    </Cadre>
  );
}

export function creerDessinADeviner(id: string, titre: string): GameModule {
  return { id, title: titre, mount: (el, ctx) => monterReact(el, <DessinADeviner ctx={ctx} titreJeu="Dessin à deviner" />) };
}

export const dessinJour9 = creerDessinADeviner("dessin-jour9", "Dessin à deviner : vos souvenirs");
