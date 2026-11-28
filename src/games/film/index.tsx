/**
 * Jour 23 — Ciné de Noël à distance (activité synchronisée).
 *
 * Règles décidées avec Alexandre (28 nov) :
 *  - vote à deux : chaque personne coche les films qui lui plaisent (et peut en ajouter un) ; on découvre le
 *    résultat quand les deux ont voté. Un film coché des deux côtés gagne ; égalité → Pingou tire au sort
 *    (même tirage des deux côtés). Aucun film commun → on tire parmi tous les films cochés ;
 *  - la case ne lance pas Netflix : c'est une télécommande commune. 3-2-1 pour appuyer sur lecture ensemble,
 *    chrono commun, pause commune (la reprise refait un 3-2-1), réactions en emojis qui s'envolent chez l'autre ;
 *  - à la fin, chaque personne note le film (1 à 5 étoiles + une phrase) ; la note de l'autre se découvre
 *    après avoir donné la sienne ;
 *  - l'autre n'est pas là : « Choisir sans attendre », on regarde et on note ; l'autre verra tout plus tard.
 *
 * Journal de coups (shared/partie.ts), clé « journal » : `vote:<qui>`, `film` (le film retenu), `note:<qui>`.
 * Lecture : état partagé `joinLive` (position + heure de reprise sur l'HORLOGE COMMUNE), gardé par la salle.
 * Réactions : messages éphémères (`live.emit`), jamais sauvegardés.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { FILM_JOUR23, SCHEMA_FILM_JOUR23, type Film } from "../../data/games/film-jour23";
import { de, prenomsDe, lireContenu } from "../shared/contenu";
import { ouvrirPartie, type Coup, type Partie } from "../shared/partie";
import { Cadre, PanneauRegles, Progres, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import "./film.css";

type CoupFilm =
  | { k: "vote"; films: string[]; ajout: Film | null }
  | { k: "film"; film: Film; commun: boolean }
  | { k: "note"; etoiles: number; phrase: string };

/** Lecture partagée. `depart` est sur l'horloge commune ; null = en pause. */
type Lecture = { pos: number; depart: number | null; par: Who } | null;

type Mode = "chargement" | "regles" | "vote" | "attente" | "salle" | "note" | "fin";

const DECOMPTE_MS = 4000;
const PHRASE_MAX = 120;
const AJOUT_MAX = 60;
const REACTION_MS = 600;

type Envol = { id: number; emoji: string; x: number; moi: boolean };

/* ---------- lecture du journal ---------- */

function dernier<K extends CoupFilm["k"]>(coups: Coup<CoupFilm>[], k: K, qui?: Who): (Coup<CoupFilm> & { t: Extract<CoupFilm, { k: K }> }) | null {
  for (let i = coups.length - 1; i >= 0; i--) {
    const c = coups[i];
    if (c.t.k === k && (qui === undefined || c.de === qui)) return c as Coup<CoupFilm> & { t: Extract<CoupFilm, { k: K }> };
  }
  return null;
}

/** Petit hachage stable : les deux côtés tirent le même film */
function hacher(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Le film retenu d'après les deux votes (ou un seul) : mêmes entrées → même film, des deux côtés */
function departager(films: Film[], votes: { t: Extract<CoupFilm, { k: "vote" }>; le: number }[]): { film: Film; commun: boolean } | null {
  const catalogue = new Map<string, Film>();
  for (const f of films) catalogue.set(f.titre, f);
  for (const v of votes) if (v.t.ajout) catalogue.set(v.t.ajout.titre, v.t.ajout);
  const ensembles = votes.map((v) => new Set(v.t.films.filter((t) => catalogue.has(t))));
  let candidats = [...catalogue.keys()].filter((t) => ensembles.every((e) => e.has(t)));
  const commun = votes.length > 1 && candidats.length > 0;
  if (!candidats.length) candidats = [...catalogue.keys()].filter((t) => ensembles.some((e) => e.has(t)));
  if (!candidats.length) candidats = [...catalogue.keys()];
  if (!candidats.length) return null;
  candidats.sort();
  const graine = hacher(candidats.join("|") + votes.map((v) => v.le).sort().join("|"));
  return { film: catalogue.get(candidats[graine % candidats.length])!, commun };
}

const chrono = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}:${String(s % 60).padStart(2, "0")}`;
};
const heure = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const etoiles = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

/* ---------- jeu ---------- */

function Cine({ ctx }: { ctx: GameContext }) {
  const contenu = useMemo(() => lireContenu(ctx.content, FILM_JOUR23, SCHEMA_FILM_JOUR23), [ctx.content]);
  const PRENOMS = prenomsDe(ctx);
  const autre = PRENOMS[ctx.partner];
  const titre = `Jour ${ctx.day} · Ciné`;

  const partie = useRef<Partie<CoupFilm> | null>(null);
  const [mode, setMode] = useState<Mode>("chargement");
  const [, setVersion] = useState(0);
  const [ensemble, setEnsemble] = useState(false);
  const [lecture, setLecture] = useState<Lecture>(null);
  const [, setTic] = useState(0);

  /* brouillons locaux */
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [ajout, setAjout] = useState("");
  const [note, setNote] = useState(0);
  const [phrase, setPhrase] = useState("");
  const [envols, setEnvols] = useState<Envol[]>([]);

  const derniereReaction = useRef(0);
  const prochainEnvol = useRef(0);
  const decompteAnnonce = useRef<number | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /** Heure sur l'horloge commune (celle de la salle), sinon l'horloge locale */
  const maintenant = useCallback(() => partie.current?.live?.now() ?? Date.now(), []);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);
  useEffect(() => { const id = window.setInterval(() => setTic((n) => n + 1), 250); return () => clearInterval(id); }, []);

  const envoler = useCallback((emoji: string, moi: boolean) => {
    const id = ++prochainEnvol.current;
    setEnvols((l) => [...l.slice(-14), { id, emoji, x: 10 + Math.random() * 80, moi }]);
    window.setTimeout(() => setEnvols((l) => l.filter((e) => e.id !== id)), 2600);
  }, []);

  /* ---------- ouverture ---------- */
  useEffect(() => {
    let annule = false;
    void ouvrirPartie<CoupFilm>(ctx).then((p) => {
      if (annule) { p.quitter(); return; }
      partie.current = p;
      setEnsemble(p.ensemble());
      p.surPresence((e) => {
        setEnsemble(e);
        if (e && modeRef.current !== "fin") ctx.say([`${autre} vient d'arriver dans la salle 🍿`]);
      });
      p.surCoup((coup, direct) => {
        setVersion((v) => v + 1);
        if (!direct || coup.de === ctx.me) return;
        if (coup.t.k === "vote") { ctx.sound.play("notify"); ctx.say([`${autre} a voté 🗳️`]); }
        else if (coup.t.k === "note") { ctx.sound.play("notify"); ctx.say([`${autre} a noté le film ⭐`]); }
      });
      const L = p.live;
      if (L) {
        setLecture(L.state as Lecture);
        L.onState((s, par) => {
          const l = s as Lecture;
          setLecture(l);
          if (par === ctx.me || !l) return;
          if (l.depart == null) { ctx.sound.play("pop"); ctx.say([`⏸️ ${autre} a mis pause.`]); }
          else ctx.say([`▶️ ${autre} relance : 3, 2, 1…`]);
        });
        L.on("reaction", (e, de) => { if (de !== ctx.me && typeof e === "string") envoler(e, false); });
      }
      // où en étais-je ?
      setVersion((v) => v + 1);
      if (dernier(p.coups, "note", ctx.me)) setMode("fin");
      else if (dernier(p.coups, "film")) setMode("salle");
      else if (dernier(p.coups, "vote", ctx.me)) setMode("attente");
      else setMode("regles");
    });
    return () => { annule = true; partie.current?.quitter(); partie.current = null; };
  }, [ctx, autre, envoler]);

  const coups = partie.current?.coups ?? [];
  const monVote = dernier(coups, "vote", ctx.me);
  const sonVote = dernier(coups, "vote", ctx.partner);
  const leFilm = dernier(coups, "film");
  const maNote = dernier(coups, "note", ctx.me);
  const saNote = dernier(coups, "note", ctx.partner);
  const film = leFilm?.t.film ?? null;

  /* ---------- les deux ont voté : le film est tiré (même résultat des deux côtés) ---------- */
  useEffect(() => {
    if (!monVote || !sonVote || leFilm) return;
    const r = departager(contenu.films, [monVote, sonVote]);
    if (r) void partie.current?.jouer("film", { k: "film", ...r });
  }, [monVote, sonVote, leFilm, contenu.films]);

  /* ---------- le film vient d'être choisi ---------- */
  const filmAnnonce = useRef(false);
  useEffect(() => {
    if (!leFilm || filmAnnonce.current) return;
    filmAnnonce.current = true;
    if (mode !== "attente" && mode !== "vote") return;
    ctx.sound.play("jingle");
    setMode("salle");
    const f = leFilm.t.film;
    const ligne = leFilm.t.commun ? "Vous l'aviez choisi à deux."
      : sonVote ? "Pas de film en commun : c'est moi qui ai tiré au sort."
        : `${autre} le découvrira en ouvrant la case.`;
    ctx.say([`Roulement de tambour… 🥁`, `Ce soir : ${f.emoji} ${f.titre} ! ${ligne}`]);
  }, [leFilm, mode, ctx, sonVote, autre]);

  /* ---------- lecture ---------- */
  const now = maintenant();
  const enDecompte = !!lecture && lecture.depart != null && now < lecture.depart;
  const enLecture = !!lecture && lecture.depart != null && now >= lecture.depart;
  const position = !lecture ? 0 : lecture.depart == null ? lecture.pos : lecture.pos + Math.max(0, now - lecture.depart);
  const decompte = enDecompte && lecture?.depart != null ? Math.ceil((lecture.depart - now) / 1000) : null;
  const duree = (film?.minutes ?? 100) * 60_000;

  // bip à chaque seconde du 3-2-1, jingle au top
  useEffect(() => {
    if (decompte == null) {
      if (decompteAnnonce.current != null && enLecture) ctx.sound.play("jingle");
      decompteAnnonce.current = null;
      return;
    }
    if (decompteAnnonce.current !== decompte) { decompteAnnonce.current = decompte; ctx.sound.play("tap"); }
  }, [decompte, enLecture, ctx.sound]);

  const ecrireLecture = (l: Lecture) => {
    const L = partie.current?.live;
    if (L) L.setState(l); else setLecture(l);
  };
  const lancer = (depuis: number) => {
    ctx.sound.play("select");
    ecrireLecture({ pos: Math.max(0, depuis), depart: maintenant() + DECOMPTE_MS, par: ctx.me });
  };
  const pause = () => {
    ctx.sound.play("pop");
    ecrireLecture({ pos: position, depart: null, par: ctx.me });
  };
  const decaler = (ms: number) => {
    ctx.sound.play("tap");
    ecrireLecture({ pos: Math.max(0, Math.min(duree, position + ms)), depart: null, par: ctx.me });
  };
  const reagir = (emoji: string) => {
    const t = Date.now();
    if (t - derniereReaction.current < REACTION_MS) return;
    derniereReaction.current = t;
    envoler(emoji, true);
    try { partie.current?.live?.emit("reaction", emoji); } catch { /* sans conséquence */ }
  };

  /* ---------- actions ---------- */
  const basculer = (t: string) => {
    ctx.sound.play("tap");
    setCoches((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  };

  const voter = async () => {
    const titreAjout = ajout.trim().slice(0, AJOUT_MAX);
    const filmAjoute: Film | null = titreAjout && !contenu.films.some((f) => f.titre.toLowerCase() === titreAjout.toLowerCase())
      ? { emoji: "🎞️", titre: titreAjout, minutes: 100, pitch: `Proposé par ${PRENOMS[ctx.me]}.` }
      : null;
    const films = [...coches];
    if (filmAjoute) films.push(filmAjoute.titre);
    else if (titreAjout) {
      const existant = contenu.films.find((f) => f.titre.toLowerCase() === titreAjout.toLowerCase());
      if (existant && !films.includes(existant.titre)) films.push(existant.titre);
    }
    if (!films.length) return;
    ctx.sound.play("send");
    setMode("attente");
    await partie.current?.jouer(`vote:${ctx.me}`, { k: "vote", films, ajout: filmAjoute });
    if (!sonVote) ctx.say([`C'est noté ! ${autre} n'a pas encore voté.`, "Je dévoile le film dès que les deux votes sont là 🤫"]);
  };

  const sansAttendre = () => {
    if (!monVote) return;
    const r = departager(contenu.films, [monVote]);
    if (!r) return;
    void partie.current?.jouer("film", { k: "film", ...r });
  };

  const noter = async () => {
    if (!note) return;
    ctx.sound.play("send");
    await partie.current?.jouer(`note:${ctx.me}`, { k: "note", etoiles: note, phrase: phrase.trim().slice(0, PHRASE_MAX) });
    ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
    setMode("fin");
    if (saNote) {
      const ecart = Math.abs(saNote.t.etoiles - note);
      ctx.say(ecart === 0 ? ["Même note des deux côtés ! Vous êtes synchro 💞"] : ecart >= 3 ? ["Oh là, vous n'avez pas vu le même film 😄"] : [`Et voici la note ${de(autre)}…`]);
    } else ctx.say([`Merci ! ${autre} n'a pas encore noté.`, "Sa note t'attendra ici 💌"]);
  };

  const fermer = () => ctx.complete({ success: !!maNote, data: { film: film?.titre, etoiles: maNote?.t.etoiles } });

  /* ---------- petits morceaux ---------- */
  const presence = (
    <span className="film-presence">
      <span className={"film-pastille" + (ensemble ? " on" : "")} />
      {autre} {ensemble ? "est dans la salle" : "n'est pas là"}
    </span>
  );

  /* ---------- rendu ---------- */
  if (mode === "chargement") {
    return <Cadre titre={titre}><div className="jeu-centre"><p className="quiz-attente">J'allume le projecteur…</p></div></Cadre>;
  }

  if (mode === "regles") {
    return (
      <Cadre titre={titre}>
        <PanneauRegles
          emoji={contenu.emoji}
          titre={contenu.titre}
          regles={[
            contenu.intro,
            `Coche les films qui te tentent. Un film choisi par toi et ${autre} gagne, sinon je tire au sort.`,
            "Ouvrez le film sur vos deux écrans : 3, 2, 1… et lecture au même moment !",
            "Pause commune, et des emojis à envoyer pendant le film. À la fin, on le note.",
          ]}
          bouton="🗳️ Voter"
          onJouer={() => { ctx.sound.play("tap"); setMode("vote"); }}
        />
      </Cadre>
    );
  }

  if (mode === "vote") {
    const nb = coches.size + (ajout.trim() ? 1 : 0);
    return (
      <Cadre titre={titre} barre={<Puce pale>Le vote</Puce>}>
        <div className="jeu-centre">
          <div className="film-colonne">
            {presence}
            <h2 className="film-h">Qu'est-ce qui te tente ce soir ?</h2>
            <p className="film-aide">Coche autant de films que tu veux. {sonVote ? `${autre} a déjà voté !` : `${autre} ne verra pas tes choix.`}</p>
            <div className="film-liste">
              {contenu.films.map((f) => (
                <button key={f.titre} className={"film-carte" + (coches.has(f.titre) ? " on" : "")} onClick={() => basculer(f.titre)}>
                  <span className="film-emoji">{f.emoji}</span>
                  <span className="film-corps">
                    <b>{f.titre}</b>
                    <span>{f.pitch}</span>
                  </span>
                  <span className="film-duree">{Math.floor(f.minutes / 60)} h {String(f.minutes % 60).padStart(2, "0")}</span>
                  <span className="film-case">{coches.has(f.titre) ? "✓" : ""}</span>
                </button>
              ))}
            </div>
            <label className="film-ajout">
              <span>➕ Un autre film en tête ?</span>
              <input value={ajout} maxLength={AJOUT_MAX} placeholder="Son titre" onChange={(e) => setAjout(e.target.value)} />
            </label>
            <div className="jeu-actions">
              <button className="jeu-btn" disabled={!nb} onClick={() => void voter()}>
                {nb ? `Voter (${nb} film${nb > 1 ? "s" : ""})` : "Coche au moins un film"}
              </button>
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "attente") {
    return (
      <Cadre titre={titre} barre={<Puce pale>Le vote</Puce>}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">🗳️</div>
            <h2>Vote enregistré</h2>
            <p>{sonVote ? "Les deux votes sont là, je dépouille…" : `On attend le vote ${de(autre)}. Je dévoile le film dès qu'il arrive.`}</p>
            {presence}
            {!sonVote && (
              <div className="jeu-actions">
                <button className="jeu-btn clair" onClick={sansAttendre}>Choisir sans attendre</button>
              </div>
            )}
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "salle" && film) {
    const fini = position >= duree;
    const finVers = lecture?.depart != null ? heure(Date.now() + Math.max(0, duree - position)) : null;
    return (
      <Cadre titre={titre} barre={<Puce pale>{film.emoji} {film.titre}</Puce>}>
        <div className="jeu-centre">
          <div className="film-salle">
            <div className="film-ecran">
              <div className="film-affiche">{decompte ?? film.emoji}</div>
              <h2>{decompte ? "Doigt sur « lecture »…" : film.titre}</h2>
              {!lecture && <p className="film-aide">Ouvrez le film sur vos deux écrans et mettez-le sur pause au tout début. Ensuite, un 3, 2, 1 commun et… lecture !</p>}
              {lecture && (
                <>
                  <div className="film-chrono">{chrono(position)} <small>/ {chrono(duree)}</small></div>
                  <Progres part={Math.min(1, position / duree)} />
                  <p className="film-aide">
                    {enDecompte ? "Appuyez sur lecture au top !"
                      : enLecture ? (fini ? "Le film devrait être fini 🎬" : `En cours · fini vers ${finVers}`)
                        : "⏸️ En pause. Calez votre film sur ce chrono, puis reprenez ensemble."}
                  </p>
                </>
              )}
              {envols.map((e) => <span key={e.id} className={"film-envol" + (e.moi ? " moi" : "")} style={{ left: `${e.x}%` }}>{e.emoji}</span>)}
            </div>
            {presence}
            {enLecture && (
              <div className="film-reactions">
                {contenu.reactions.map((r) => <button key={r} onClick={() => reagir(r)} aria-label={`Envoyer ${r}`}>{r}</button>)}
              </div>
            )}
            <div className="jeu-actions">
              {!lecture && <button className="jeu-btn" onClick={() => lancer(0)}>▶️ Lancer le film (3, 2, 1)</button>}
              {enLecture && <button className="jeu-btn clair" onClick={pause}>⏸️ Pause pour nous deux</button>}
              {lecture && lecture.depart == null && (
                <>
                  {position > 0 && <button className="jeu-btn clair film-petit" onClick={() => decaler(-duree)}>⏮ Début</button>}
                  <button className="jeu-btn clair film-petit" onClick={() => decaler(-10_000)}>−10 s</button>
                  <button className="jeu-btn clair film-petit" onClick={() => decaler(10_000)}>+10 s</button>
                  <button className="jeu-btn" onClick={() => lancer(position)}>▶️ Reprendre (3, 2, 1)</button>
                </>
              )}
            </div>
            {lecture && !enDecompte && (
              <button className="film-lien" onClick={() => { ctx.sound.play("tap"); setMode("note"); }}>
                {fini ? "🎬 Le film est fini : on le note !" : "🎬 Film terminé ? Le noter"}
              </button>
            )}
          </div>
        </div>
      </Cadre>
    );
  }

  if (mode === "note" && film) {
    return (
      <Cadre titre={titre} barre={<Puce pale>La critique</Puce>}>
        <div className="jeu-centre">
          <div className="jeu-panneau">
            <div className="emoji">{film.emoji}</div>
            <h2>Alors, ce {film.titre} ?</h2>
            <div className="film-etoiles" role="radiogroup" aria-label="Note sur 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= note ? "on" : ""} aria-label={`${n} sur 5`} onClick={() => { ctx.sound.play("tap"); setNote(n); }}>★</button>
              ))}
            </div>
            <textarea className="film-phrase" value={phrase} maxLength={PHRASE_MAX} rows={2}
              placeholder="Ta critique en une phrase (facultatif)" onChange={(e) => setPhrase(e.target.value)} />
            <div className="jeu-actions">
              <button className="jeu-btn clair" onClick={() => setMode("salle")}>← Retour au film</button>
              <button className="jeu-btn" disabled={!note} onClick={() => void noter()}>{note ? "Donner ma note" : "Choisis des étoiles"}</button>
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  // fin : les deux critiques
  if (!maNote) return null;
  const critique = (qui: string, n: { etoiles: number; phrase: string } | null, attente: string) => (
    <div className={"film-critique" + (n ? "" : " vide")}>
      <b>{qui}</b>
      {n ? <><span className="film-note">{etoiles(n.etoiles)}</span>{n.phrase && <q>{n.phrase}</q>}</> : <span>{attente}</span>}
    </div>
  );
  return (
    <Cadre titre={titre} barre={<Puce pale>Les critiques</Puce>}>
      <div className="jeu-centre">
        <div className="jeu-panneau">
          <div className="emoji">{film?.emoji ?? "🎬"}</div>
          <h2>{film?.titre ?? "Le film"}</h2>
          <div className="film-critiques">
            {critique("Toi", maNote.t, "")}
            {critique(autre, saNote?.t ?? null, film && !dernier(coups, "vote", ctx.partner) ? `${autre} n'a pas encore vu la case ⏳` : `${autre} n'a pas encore noté ⏳`)}
          </div>
          {saNote && <p className="film-aide">Moyenne du soir : {((maNote.t.etoiles + saNote.t.etoiles) / 2).toLocaleString("fr-FR")} / 5. Joyeux Noël en avance 🎄</p>}
          <div className="jeu-actions">
            <button className="jeu-btn clair" onClick={() => setMode("salle")}>Revoir la salle</button>
            <button className="jeu-btn" onClick={fermer}>Fermer</button>
          </div>
        </div>
      </div>
    </Cadre>
  );
}

export const filmJour23: GameModule = {
  id: "film-jour23",
  title: "Ciné de Noël à distance",
  mount: (el, ctx) => monterReact(el, <Cine ctx={ctx} />),
};
