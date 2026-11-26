/**
 * Jour 14 — Biscuits de Noël, chacun chez soi (activité synchronisée).
 *
 * Règles décidées avec Alexandre (26 nov) :
 *  - chacun choisit SA recette (avec ou sans four : Alexandre n'a pas de four) ;
 *  - on cuisine en même temps, étape par étape, et on voit où en est l'autre (étape, minuteur en cours) ;
 *  - si les deux sont là, on peut démarrer pile au même moment (« prêt » des deux côtés, 3-2-1) ;
 *  - à la fin, photo de sa fournée ; on découvre celle de l'autre après avoir posté la sienne,
 *    et Pingou décerne un titre à chacun ;
 *  - l'autre n'est pas là : chacun son tour, rien ne change (c'est le même journal, lu plus tard).
 *
 * Journal de coups (shared/partie.ts), clé « journal » de la case :
 *  - `depart:<qui>`        → recette choisie, on commence
 *  - `etape:<qui>:<i>`     → étape i finie
 *  - `minuteur:<qui>:<i>`  → minuteur de l'étape i lancé (heure de fin, horloge de l'auteur)
 *  - `photo:<qui>`         → la photo de la fournée
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { BISCUITS_JOUR14, SCHEMA_BISCUITS_JOUR14, lireEtape, type Recette } from "../../data/games/biscuits-jour14";
import { de, prenomsDe, lireContenu } from "../shared/contenu";
import { ouvrirPartie, type Coup, type Partie } from "../shared/partie";
import { Cadre, PanneauRegles, Progres, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { Polaroid } from "../photo/index";
import "../photo/photo.css";
import "./biscuits.css";

type CoupBiscuits =
  | { k: "depart"; recette: string; nom: string; emoji: string; total: number }
  | { k: "etape"; i: number }
  | { k: "minuteur"; i: number; fin: number; minutes: number }
  | { k: "photo"; url: string; legende: string };

type Mode = "chargement" | "regles" | "recette" | "courses" | "ensemble" | "cuisine" | "photo" | "fin";

const LEGENDE_MAX = 90;

/** Ce qu'on sait de la cuisine de quelqu'un, d'après le journal */
type Cuisine = {
  depart: Extract<CoupBiscuits, { k: "depart" }> | null;
  faites: number;
  minuteurs: Map<number, Extract<CoupBiscuits, { k: "minuteur" }>>;
  photo: Extract<CoupBiscuits, { k: "photo" }> | null;
  /** horodatage de la photo (pour le tirage des titres) */
  photoLe: number;
};

function cuisineDe(coups: Coup<CoupBiscuits>[], qui: Who): Cuisine {
  const c: Cuisine = { depart: null, faites: 0, minuteurs: new Map(), photo: null, photoLe: 0 };
  const faites = new Set<number>();
  for (const coup of coups) {
    if (coup.de !== qui) continue;
    const t = coup.t;
    if (t.k === "depart") c.depart = t;
    else if (t.k === "etape") faites.add(t.i);
    else if (t.k === "minuteur") c.minuteurs.set(t.i, t);
    else if (t.k === "photo") { c.photo = t; c.photoLe = coup.le; }
  }
  while (faites.has(c.faites)) c.faites++;
  return c;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};
const heure = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Deux titres différents, les mêmes des deux côtés (tirés d'après les heures des deux photos) */
function titresPour(titres: string[], a: number, b: number): Record<Who, string> {
  const n = titres.length;
  if (n === 0) return { alexandre: "", flavie: "" };
  const graine = Math.abs(Math.floor(a / 1000) * 31 + Math.floor(b / 1000) * 17);
  const i = graine % n;
  const j = n > 1 ? (i + 1 + (Math.floor(graine / n) % (n - 1))) % n : i;
  return { alexandre: titres[i], flavie: titres[j] };
}

/* ---------- jeu ---------- */

function Biscuits({ ctx }: { ctx: GameContext }) {
  const contenu = useMemo(() => lireContenu(ctx.content, BISCUITS_JOUR14, SCHEMA_BISCUITS_JOUR14), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const autre = PRENOMS[ctx.partner];
  const titre = `Jour ${ctx.day} · Biscuits`;

  const partie = useRef<Partie<CoupBiscuits> | null>(null);
  const [mode, setMode] = useState<Mode>("chargement");
  const [, setVersion] = useState(0);
  const [ensemble, setEnsemble] = useState(false);
  const [pret, setPret] = useState({ me: false, partner: false });
  const [compte, setCompte] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  /* brouillons locaux */
  const [choisie, setChoisie] = useState<Recette | null>(null);
  const [cochés, setCochés] = useState<Set<number>>(new Set());
  const [toutVoir, setToutVoir] = useState(false);
  const [fichier, setFichier] = useState<Blob | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [legende, setLegende] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const entreeCamera = useRef<HTMLInputElement>(null);
  const entreeGalerie = useRef<HTMLInputElement>(null);
  const ouverture = useRef(Date.now());
  const annonces = useRef(new Set<string>());
  const choisieRef = useRef<Recette | null>(null);
  choisieRef.current = choisie;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const idee = useMemo(() => contenu.idees[Math.floor(Math.random() * contenu.idees.length)] ?? "", [contenu]);
  const recettePar = useCallback((id: string | undefined) => contenu.recettes.find((r) => r.id === id) ?? null, [contenu]);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);
  useEffect(() => () => { if (apercu?.startsWith("blob:")) URL.revokeObjectURL(apercu); }, [apercu]);
  useEffect(() => { const id = window.setInterval(() => setMaintenant(Date.now()), 1000); return () => clearInterval(id); }, []);

  /* ---------- ouverture de la partie ---------- */
  const demarrer = useCallback(async (r: Recette) => {
    const p = partie.current;
    if (!p) return;
    const n = r.etapes.length;
    await p.jouer(`depart:${ctx.me}`, { k: "depart", recette: r.id, nom: r.nom, emoji: r.emoji, total: n });
    setMode("cuisine");
    const premiere = lireEtape(r.etapes[0] ?? "").texte;
    ctx.say([`C'est parti pour ${r.emoji} ${r.nom} !`, premiere]);
  }, [ctx]);
  const demarrerRef = useRef(demarrer);
  demarrerRef.current = demarrer;

  useEffect(() => {
    let annule = false;
    void ouvrirPartie<CoupBiscuits>(ctx, { compteARebours: 3000 }).then((p) => {
      if (annule) { p.quitter(); return; }
      partie.current = p;
      setEnsemble(p.ensemble());
      p.surPresence((e) => setEnsemble(e));
      p.surCoup((coup, direct) => {
        setVersion((v) => v + 1);
        if (!direct || coup.de === ctx.me) return;
        const t = coup.t;
        if (t.k === "depart") ctx.say([`${autre} se lance : ${t.emoji} ${t.nom} !`]);
        else if (t.k === "photo") { ctx.sound.play("notify"); ctx.say([`${autre} a fini sa fournée et l'a prise en photo 📸`]); }
      });
      const L = p.live;
      if (L) {
        L.onReady((r) => setPret(r));
        L.onStart(({ startsAt, resumed }) => {
          if (resumed || modeRef.current !== "ensemble") return;
          const r = choisieRef.current;
          if (!r) return;
          const tic = () => {
            const reste = startsAt - Date.now();
            if (reste <= 0) { setCompte(null); ctx.sound.play("jingle"); void demarrerRef.current(r); return; }
            setCompte(Math.ceil(reste / 1000));
            window.setTimeout(tic, Math.min(250, reste));
          };
          tic();
        });
      }
      // où en étais-je ?
      const moi = cuisineDe(p.coups, ctx.me);
      setVersion((v) => v + 1);
      if (moi.photo) setMode("fin");
      else if (moi.depart) {
        const r = recettePar(moi.depart.recette);
        setMode(r && moi.faites >= r.etapes.length ? "photo" : "cuisine");
      } else setMode("regles");
    });
    return () => { annule = true; partie.current?.quitter(); partie.current = null; };
  }, [ctx, autre, recettePar]);

  const coups = partie.current?.coups ?? [];
  const moi = cuisineDe(coups, ctx.me);
  const lui = cuisineDe(coups, ctx.partner);
  const maRecette = recettePar(moi.depart?.recette) ?? choisie;
  const saRecette = recettePar(lui.depart?.recette);

  /* ---------- minuteurs qui sonnent (le mien et celui de l'autre) ---------- */
  useEffect(() => {
    const sonner = (qui: Who, c: Cuisine) => {
      for (const [i, m] of c.minuteurs) {
        const id = `${qui}:${i}`;
        if (annonces.current.has(id) || m.fin > maintenant) continue;
        annonces.current.add(id);
        // un minuteur déjà fini avant l'ouverture ne sonne pas
        if (m.fin < ouverture.current) continue;
        ctx.sound.play("notify");
        ctx.say([qui === ctx.me ? "⏰ Ding ! Ton minuteur a sonné." : `⏰ Le minuteur ${de(autre)} vient de sonner !`]);
      }
    };
    sonner(ctx.me, moi);
    sonner(ctx.partner, lui);
  });

  /* ---------- actions ---------- */
  const choisir = (r: Recette) => {
    ctx.sound.play("select");
    setChoisie(r);
    setCochés(new Set());
    setMode("courses");
    ctx.say([`${r.emoji} ${r.nom}, excellent choix !`, "Rassemble les ingrédients et coche-les au fur et à mesure."]);
  };

  const pretACuisiner = () => {
    if (!choisie) return;
    ctx.sound.play("tap");
    // l'autre est là et n'a pas encore commencé : on propose de démarrer pile ensemble
    if (ensemble && partie.current?.live && !lui.depart) {
      setMode("ensemble");
      ctx.say([`${autre} est là ! On démarre au même moment ?`]);
    } else void demarrer(choisie);
  };

  const lancerMinuteur = (i: number, minutes: number) => {
    ctx.sound.play("tap");
    void partie.current?.jouer(`minuteur:${ctx.me}:${i}`, { k: "minuteur", i, minutes, fin: Date.now() + minutes * 60_000 });
    ctx.say([`Minuteur lancé : ${minutes} min. ${autre} le voit aussi ⏲️`]);
  };

  const etapeSuivante = () => {
    if (!maRecette) return;
    const i = moi.faites;
    ctx.sound.play("good");
    void partie.current?.jouer(`etape:${ctx.me}:${i}`, { k: "etape", i });
    setToutVoir(false);
    if (i + 1 >= maRecette.etapes.length) {
      setMode("photo");
      ctx.sound.play("win");
      ctx.say(["Bravo, c'est prêt ! 🎉", `Prends ta fournée en photo pour ${autre}.`]);
    }
  };

  const choisirFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErreur("Ce fichier n'est pas une photo."); return; }
    setErreur(null);
    setFichier(f);
    setApercu(URL.createObjectURL(f));
    ctx.sound.play("photo");
  };

  const envoyer = async () => {
    if (!fichier || envoi) return;
    setEnvoi(true); setErreur(null);
    try {
      const url = await ctx.backend.uploadPhoto(fichier);
      await partie.current?.jouer(`photo:${ctx.me}`, { k: "photo", url, legende: legende.trim().slice(0, LEGENDE_MAX) });
      ctx.sound.play("send");
      ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
      setMode("fin");
      ctx.say(lui.photo
        ? [`Envoyée ! Et voici la fournée ${de(autre)}… 😋`]
        : [`Envoyée ! ${autre} n'a pas encore fini.`, "Je te préviens dès que sa photo arrive 💌"]);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible. Réessaie dans un instant.");
      ctx.sound.play("bad");
    } finally {
      setEnvoi(false);
    }
  };

  const fermer = () => ctx.complete({ success: !!moi.photo, data: { recette: moi.depart?.recette, photo: moi.photo?.url } });

  /* ---------- l'encart « chez l'autre » ---------- */
  const chezLui = () => {
    const total = lui.depart?.total ?? saRecette?.etapes.length ?? 0;
    let etat: string;
    let minuteur: string | null = null;
    if (lui.photo) etat = "a fini sa fournée ! 📸";
    else if (!lui.depart) etat = "n'a pas encore commencé";
    else if (lui.faites >= total) etat = "prend sa fournée en photo…";
    else {
      etat = `étape ${lui.faites + 1}/${total}`;
      const m = lui.minuteurs.get(lui.faites);
      if (m) minuteur = m.fin > maintenant ? `⏲️ ${mmss(m.fin - maintenant)}` : "⏰ a sonné";
    }
    return (
      <div className="bis-lui">
        <span className={"bis-pastille" + (ensemble ? " on" : "")} title={ensemble ? "en ligne" : "pas en ligne"} />
        <span className="bis-lui-texte">
          <b>{autre}</b>
          {lui.depart && <> · {lui.depart.emoji} {lui.depart.nom}</>}
          {" · "}{etat}
        </span>
        {minuteur && <span className="bis-lui-minuteur">{minuteur}</span>}
      </div>
    );
  };

  /* ---------- rendu ---------- */
  if (mode === "chargement") {
    return <Cadre titre={titre}><div className="jeu-centre"><p className="quiz-attente">Un instant, je préchauffe la cuisine…</p></div></Cadre>;
  }

  if (mode === "regles") {
    return (
      <Cadre titre={titre}>
        <PanneauRegles
          emoji={contenu.emoji}
          titre={contenu.titre}
          regles={[
            contenu.intro,
            "Choisis ta recette : il y en a avec et sans four.",
            `Suis les étapes une à une : tu vois où en est ${autre}, et ses minuteurs aussi.`,
            `À la fin, prends ta fournée en photo… et découvre celle de ${autre} !`,
          ]}
          bouton="🧑‍🍳 Choisir ma recette"
          onJouer={() => { ctx.sound.play("tap"); setMode("recette"); }}
        />
      </Cadre>
    );
  }

  if (mode === "recette") {
    return (
      <Cadre titre={titre} barre={<Puce pale>Ta recette</Puce>}>
        <div className="jeu-centre">
          <div className="bis-colonne">
            {chezLui()}
            <h2 className="bis-h">Qu'est-ce que tu prépares ?</h2>
            <div className="bis-recettes">
              {contenu.recettes.map((r) => (
                <button key={r.id} className="bis-recette" onClick={() => choisir(r)}>
                  <span className="bis-recette-emoji">{r.emoji}</span>
                  <span className="bis-recette-corps">
                    <b>{r.nom}</b>
                    <span>{r.duree} · {r.portions}</span>
                  </span>
                  <span className={"bis-four" + (r.four ? "" : " sans")}>{r.four ? "🔥 four" : "❄️ sans four"}</span>
                </button>
              ))}
            </div>
            {lui.depart && <p className="photo-aide">{autre} a choisi {lui.depart.emoji} {lui.depart.nom}.</p>}
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "courses" && choisie) {
    const tout = cochés.size >= choisie.ingredients.length;
    return (
      <Cadre titre={titre} barre={<Puce pale>{choisie.emoji} Les courses</Puce>}>
        <div className="jeu-centre">
          <div className="bis-colonne">
            <h2 className="bis-h">{choisie.emoji} {choisie.nom}</h2>
            <p className="photo-aide">{choisie.duree} · {choisie.portions}</p>
            <ul className="bis-ingredients">
              {choisie.ingredients.map((ing, i) => (
                <li key={ing + i}>
                  <button
                    className={cochés.has(i) ? "on" : ""}
                    onClick={() => {
                      ctx.sound.play("tap");
                      setCochés((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
                    }}
                  ><span className="bis-case">{cochés.has(i) ? "✓" : ""}</span>{ing}</button>
                </li>
              ))}
            </ul>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => setMode("recette")}>← Autre recette</button>
              <button className="jeu-btn" onClick={pretACuisiner}>{tout ? "J'ai tout ! 🧑‍🍳" : "On commence 🧑‍🍳"}</button>
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "ensemble" && choisie) {
    return (
      <Cadre titre={titre} barre={<Puce pale>Top départ</Puce>}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">{compte ?? "🍪"}</div>
            <h2>{compte ? "Tabliers prêts…" : `${autre} est là !`}</h2>
            <p>
              {pret.me
                ? (pret.partner ? "Attention… 3, 2, 1…" : `C'est noté. On attend ${autre}…`)
                : (pret.partner ? `${autre} n'attend plus que toi !` : "Dès que chacun a cliqué, on lance la cuisine au même moment.")}
            </p>
            <div className="bis-pret">
              <span className={pret.me ? "ok" : ""}>{PRENOMS[ctx.me]} {pret.me ? "✅" : "…"}</span>
              <span className={pret.partner ? "ok" : ""}>{autre} {pret.partner ? "✅" : "…"}</span>
            </div>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => { partie.current?.live?.setReady(false); void demarrer(choisie); }}>Commencer sans attendre</button>
              {!pret.me && <button className="jeu-btn" onClick={() => { ctx.sound.play("tap"); partie.current?.live?.setReady(true); }}>Prêt·e !</button>}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "cuisine" && maRecette) {
    const n = maRecette.etapes.length;
    const i = Math.min(moi.faites, n - 1);
    const { texte, minutes } = lireEtape(maRecette.etapes[i]);
    const m = moi.minuteurs.get(i);
    const reste = m ? m.fin - maintenant : 0;
    return (
      <Cadre titre={titre} barre={<Puce pale>{maRecette.emoji} Étape {i + 1}/{n}</Puce>}>
        <Progres part={moi.faites / n} />
        <div className="jeu-centre">
          <div className="bis-colonne">
            {chezLui()}
            <div className="bis-etape" key={i}>
              <div className="quiz-phase">{maRecette.nom} · étape {i + 1} sur {n}</div>
              <p className="bis-etape-texte">{texte}</p>
              {minutes !== null && (
                <div className={"bis-minuteur" + (m ? (reste > 0 ? " tourne" : " fini") : "")}>
                  {!m && <button className="jeu-btn clair" onClick={() => lancerMinuteur(i, minutes)}>⏲️ Lancer le minuteur ({minutes} min)</button>}
                  {m && reste > 0 && <><b>{mmss(reste)}</b><span>sonne à {heure(m.fin)}</span></>}
                  {m && reste <= 0 && <><b>⏰ C'est l'heure !</b><span>{minutes} min écoulées</span></>}
                </div>
              )}
            </div>
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => setToutVoir((v) => !v)}>{toutVoir ? "Cacher la recette" : "📖 Toute la recette"}</button>
              <button className="jeu-btn" onClick={etapeSuivante}>{i + 1 >= n ? "C'est prêt ! 🎉" : "Étape finie ✓"}</button>
            </div>
            {toutVoir && (
              <div className="bis-tout">
                <h3>Ingrédients</h3>
                <ul>{maRecette.ingredients.map((x, k) => <li key={x + k}>{x}</li>)}</ul>
                <h3>Étapes</h3>
                <ol>{maRecette.etapes.map((x, k) => <li key={x + k} className={k < moi.faites ? "fait" : k === i ? "ici" : ""}>{lireEtape(x).texte}</li>)}</ol>
              </div>
            )}
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "photo") {
    return (
      <Cadre titre={titre} barre={<Puce pale>Ta fournée</Puce>}>
        <div className="jeu-centre">
          <div className="photo-prise">
            <input ref={entreeCamera} type="file" accept="image/*" capture="environment" hidden onChange={choisirFichier} />
            <input ref={entreeGalerie} type="file" accept="image/*" hidden onChange={choisirFichier} />
            {apercu
              ? <Polaroid url={apercu} legende={legende.trim() || undefined} auteur="Toi" penche="g" />
              : (
                <button className="photo-cadre-vide" onClick={() => entreeCamera.current?.click()}>
                  <span className="emoji">{maRecette?.emoji ?? "🍪"}</span>
                  <span>Prends ta fournée en photo pour {autre} !</span>
                </button>
              )}
            <div className="jeu-actions">
              <button className={apercu ? "jeu-btn clair" : "jeu-btn"} onClick={() => entreeCamera.current?.click()}>
                📸 {apercu ? "Reprendre" : "Prendre la photo"}
              </button>
              <button className="jeu-btn clair" onClick={() => entreeGalerie.current?.click()}>🖼️ Galerie</button>
            </div>
            {apercu && (
              <>
                <label className="photo-champ">
                  <span>Ta légende</span>
                  <input type="text" value={legende} maxLength={LEGENDE_MAX} placeholder={idee} onChange={(e) => setLegende(e.target.value)} />
                </label>
                <div className="jeu-actions">
                  <button className="jeu-btn" disabled={envoi} onClick={envoyer}>{envoi ? "J'envoie…" : `Envoyer à ${autre} 💌`}</button>
                </div>
              </>
            )}
            {erreur && <p className="photo-erreur">{erreur}</p>}
          </div>
        </div>
      </Cadre>
    );
  }

  // fin : les deux fournées côte à côte
  if (!moi.photo) return null;
  const deux = !!lui.photo;
  const titres = deux ? titresPour(contenu.titres, Math.min(moi.photoLe, lui.photoLe), Math.max(moi.photoLe, lui.photoLe)) : null;
  return (
    <Cadre titre={titre} barre={<Puce pale>Vos deux fournées</Puce>}>
      <div className="jeu-centre">
        <div className="photo-duo">
          <div className="bis-fournee">
            <Polaroid url={moi.photo.url} legende={moi.photo.legende || undefined} auteur="Toi" penche="g" />
            {titres && <span className="bis-titre">🏅 {titres[ctx.me]}</span>}
          </div>
          <div className="bis-fournee">
            {lui.photo
              ? <Polaroid url={lui.photo.url} legende={lui.photo.legende || undefined} auteur={autre} penche="d" />
              : <Polaroid auteur={autre} penche="d" vide={lui.depart ? `${autre} cuisine encore… ⏳` : `${autre} n'a pas encore commencé ⏳`} />}
            {titres && <span className="bis-titre">🏅 {titres[ctx.partner]}</span>}
          </div>
        </div>
        {deux
          ? <p className="photo-texte">Pingou a goûté (en pensée) et décerne ses titres. Bon appétit à vous deux ! 😋</p>
          : chezLui()}
        <div className="jeu-actions">
          <button className="jeu-btn" onClick={fermer}>Fermer</button>
        </div>
      </div>
    </Cadre>
  );
}

export const biscuitsJour14: GameModule = {
  id: "biscuits-jour14",
  title: "Biscuits de Noël, chacun chez soi",
  mount: (el, ctx) => monterReact(el, <Biscuits ctx={ctx} />),
};
