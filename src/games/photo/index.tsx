/**
 * Défi photo croisé (jour 3, puis jour 19 avec un autre contenu).
 *
 * Règles décidées avec Alexandre (24 nov) :
 *  - chacun prend SA photo, avec une courte légende ;
 *  - il choisit une question de devinette et donne sa vraie réponse (qui ne se voit pas sur la photo) ;
 *  - on ne découvre la photo de l'autre qu'APRÈS avoir posté la sienne, puis on devine sa réponse ;
 *  - on peut reprendre sa photo tant que l'autre ne l'a pas découverte ; ensuite elle est figée.
 *
 * Stockage (`setGameState`, par jour) :
 *  - `photo:<qui>`  → PhotoPostee
 *  - `vu:<qui>`     → true quand <qui> a découvert la photo de l'autre (fige celle de l'autre)
 *  - `devine:<qui>` → indice de l'option choisie par <qui> pour deviner l'autre
 *
 * En mode démo, si l'autre n'a rien posté, une image dessinée par le jeu tient lieu de sa photo
 * (jour 3 : vue de fenêtre ; jour 19 : sapin décoré).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameContext, GameModule, Who } from "../../core/contracts";
import { PHOTO_JOUR3, SCHEMA_PHOTO_JOUR3, reparerPhoto, type PhotoContent } from "../../data/games/photo-jour3";
import { PHOTO_JOUR19, SCHEMA_PHOTO_JOUR19 } from "../../data/games/photo-jour19";
import type { SchemaContenu } from "../shared/contenu";
import { prenomsDe, lireContenu } from "../shared/contenu";
import { Cadre, PanneauRegles, Puce } from "../shared/ui";
import { monterReact } from "../shared/monter";
import { dessinerSapinExemple, dessinerVueExemple } from "./exemple";
import "./photo.css";

const LETTRES = ["A", "B", "C", "D"];
const LEGENDE_MAX = 90;
/** Toutes les combien de secondes on regarde si l'autre a posté, sur l'écran d'attente */
const ATTENTE_RELECTURE_MS = 15000;

export type PhotoPostee = { url: string; legende: string; question: string; reponse: number; le: string };

type Etape = "chargement" | "regles" | "prise" | "attente" | "devine" | "fin";

const clePhoto = (qui: Who) => `photo:${qui}`;
const cleVu = (qui: Who) => `vu:${qui}`;
const cleDevine = (qui: Who) => `devine:${qui}`;

/* ---------- polaroïd ---------- */

export function Polaroid({ url, legende, auteur, penche, vide }: {
  url?: string; legende?: string; auteur: string; penche: "g" | "d"; vide?: string;
}) {
  return (
    <figure className={`polaroid ${penche}`}>
      <div className="polaroid-image">
        {url ? <img src={url} alt={`Photo de ${auteur}`} /> : <div className="polaroid-vide">{vide}</div>}
      </div>
      <figcaption>
        {legende && <span className="polaroid-legende">{legende}</span>}
        <span className="polaroid-auteur">{auteur}</span>
      </figcaption>
    </figure>
  );
}

/* ---------- jeu ---------- */

/** Ce qui change d'un défi photo à l'autre (jour 3, jour 19) */
type ConfigDefiPhoto = {
  defaut: PhotoContent;
  schema: SchemaContenu;
  /** mode démo : la « photo » de l'autre, dessinée au canevas (data URL) */
  dessinerExemple: () => string;
  /** pastille de l'écran final */
  puceFin: string;
};

function DefiPhoto({ ctx, titreJeu, config }: { ctx: GameContext; titreJeu: string; config: ConfigDefiPhoto }) {
  const contenu = useMemo(
    () => lireContenu(ctx.content, config.defaut, config.schema, reparerPhoto),
    [ctx.content, config],
  );
  const PRENOMS = prenomsDe(ctx);
  const autre = PRENOMS[ctx.partner];
  const titre = `Jour ${ctx.day} · ${titreJeu}`;
  const questionPar = useCallback(
    (id: string) => contenu.questions.find((q) => q.id === id) ?? contenu.questions[0],
    [contenu],
  );

  const [etape, setEtape] = useState<Etape>("chargement");
  const [ma, setMa] = useState<PhotoPostee | null>(null);
  const [sa, setSa] = useState<PhotoPostee | null>(null);
  /** sa photo vient de l'exemple du mode démo */
  const [exemple, setExemple] = useState(false);
  /** l'autre a découvert ma photo : elle est figée */
  const [ilAVu, setIlAVu] = useState(false);
  const [maDevinette, setMaDevinette] = useState<number | null>(null);
  const [saDevinette, setSaDevinette] = useState<number | null>(null);

  /* brouillon de la prise de vue */
  const [fichier, setFichier] = useState<Blob | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [legende, setLegende] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [reponse, setReponse] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /* découverte */
  const [revelee, setRevelee] = useState(false);
  const [choix, setChoix] = useState<number | null>(null);

  const entreeCamera = useRef<HTMLInputElement>(null);
  const entreeGalerie = useRef<HTMLInputElement>(null);
  const minuteur = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const idee = useMemo(() => contenu.idees[Math.floor(Math.random() * contenu.idees.length)] ?? "", [contenu]);

  useEffect(() => { ctx.sound.setGameMusic("cosy"); return () => ctx.sound.setGameMusic(null); }, [ctx.sound]);

  // l'aperçu local d'un fichier est une URL d'objet : on la libère quand elle change
  useEffect(() => () => { if (apercu?.startsWith("blob:")) URL.revokeObjectURL(apercu); }, [apercu]);

  /* ---------- lecture de l'état ---------- */
  const lire = useCallback(async <T,>(cle: string): Promise<T | null> => {
    try { return await ctx.backend.getGameState<T>(ctx.day, cle); } catch { return null; }
  }, [ctx]);

  const lireSa = useCallback(async (): Promise<{ photo: PhotoPostee | null; exemple: boolean }> => {
    const photo = await lire<PhotoPostee>(clePhoto(ctx.partner));
    if (photo?.url) return { photo, exemple: false };
    if (ctx.backend.mode === "demo") {
      return {
        photo: { ...contenu.exemple, url: config.dessinerExemple(), le: new Date().toISOString() },
        exemple: true,
      };
    }
    return { photo: null, exemple: false };
  }, [ctx, contenu, lire, config]);

  useEffect(() => {
    let annule = false;
    (async () => {
      const [mienne, sienne, vu, mienneDev, sienneDev] = await Promise.all([
        lire<PhotoPostee>(clePhoto(ctx.me)),
        lireSa(),
        lire<boolean>(cleVu(ctx.partner)),
        lire<number>(cleDevine(ctx.me)),
        lire<number>(cleDevine(ctx.partner)),
      ]);
      if (annule) return;
      setSa(sienne.photo); setExemple(sienne.exemple);
      setIlAVu(!!vu);
      setSaDevinette(typeof sienneDev === "number" ? sienneDev : null);
      if (mienne?.url) {
        setMa(mienne);
        if (typeof mienneDev === "number" && !sienne.exemple) { setMaDevinette(mienneDev); setRevelee(true); setEtape("fin"); }
        else setEtape(sienne.photo ? "devine" : "attente");
      } else setEtape("regles");
    })();
    return () => { annule = true; };
  }, [ctx, lire, lireSa]);

  /* ---------- attente : on guette la photo de l'autre ---------- */
  useEffect(() => {
    if (etape !== "attente") return;
    const id = window.setInterval(async () => {
      const [sienne, vu] = await Promise.all([lireSa(), lire<boolean>(cleVu(ctx.partner))]);
      setIlAVu(!!vu);
      if (sienne.photo) {
        setSa(sienne.photo); setExemple(sienne.exemple);
        ctx.sound.play("notify");
        ctx.say([`${autre} vient de poster sa photo ! Tu veux la découvrir ? 📸`]);
        setEtape("devine");
      }
    }, ATTENTE_RELECTURE_MS);
    return () => clearInterval(id);
  }, [autre, ctx, etape, lire, lireSa]);

  /* ---------- prise de vue ---------- */
  const ouvrirPrise = useCallback((reprise: boolean) => {
    setFichier(null);
    setApercu(reprise && ma ? ma.url : null);
    setLegende(reprise && ma ? ma.legende : "");
    setQuestion(reprise && ma ? ma.question : null);
    setReponse(reprise && ma ? ma.reponse : null);
    setErreur(null);
    setEtape("prise");
    ctx.say(reprise
      ? [`Pas de souci, ${autre} ne l'a pas encore vue. Reprends-la !`]
      : [contenu.consigne]);
  }, [autre, contenu.consigne, ctx, ma]);

  const choisirFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // pour pouvoir reprendre la même photo
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErreur("Ce fichier n'est pas une photo."); return; }
    setErreur(null);
    setFichier(f);
    setApercu(URL.createObjectURL(f));
    ctx.sound.play("photo");
  };

  const pret = !!apercu && question !== null && reponse !== null && !envoi;

  const envoyer = async () => {
    if (!pret || question === null || reponse === null) return;
    setEnvoi(true); setErreur(null);
    try {
      // l'autre a pu découvrir ma photo pendant que je la reprenais
      if (ma && await lire<boolean>(cleVu(ctx.partner))) {
        setIlAVu(true);
        throw new Error(`${autre} vient de découvrir ta photo : elle ne peut plus être changée.`);
      }
      const url = fichier ? await ctx.backend.uploadPhoto(fichier) : ma!.url;
      const postee: PhotoPostee = { url, legende: legende.trim().slice(0, LEGENDE_MAX), question, reponse, le: new Date().toISOString() };
      await ctx.backend.setGameState<PhotoPostee>(ctx.day, clePhoto(ctx.me), postee);
      setMa(postee);
      ctx.sound.play("send");
      ctx.backend.markCompleted(ctx.day).catch(() => { /* sans conséquence */ });
      if (maDevinette !== null) setEtape("fin");
      else if (sa) {
        setEtape("devine");
        ctx.say([exemple
          ? "Envoyée ! En mode démo, je t'ai préparé une photo d'exemple pour l'autre côté."
          : `Envoyée ! Et ${autre} a déjà posté la sienne… On regarde ? 👀`]);
      } else {
        setEtape("attente");
        ctx.say([`Envoyée ! ${autre} n'a pas encore pris la sienne.`, "Je te préviens dès qu'elle arrive 💌"]);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible. Réessaie dans un instant.");
      ctx.sound.play("bad");
    } finally {
      setEnvoi(false);
    }
  };

  /* ---------- découverte et devinette ---------- */
  const decouvrir = () => {
    setRevelee(true);
    ctx.sound.play("pop");
    if (!exemple) ctx.backend.setGameState<boolean>(ctx.day, cleVu(ctx.me), true).catch(() => { /* réessayé à la devinette */ });
    ctx.say([`Alors… qu'a répondu ${autre} ? 🤔`]);
  };

  const deviner = (option: number) => {
    if (choix !== null || !sa) return;
    setChoix(option);
    const juste = option === sa.reponse;
    ctx.sound.play(juste ? "good" : "bad");
    ctx.say([juste ? `Bien vu ! Tu connais ${autre} par cœur 💞` : `Raté ! ${autre} avait répondu « ${questionPar(sa.question).options[sa.reponse]} ».`]);
    // contre la photo d'exemple du mode démo, rien n'est enregistré : la vraie photo de l'autre,
    // si elle arrive, se devinera pour de bon
    if (!exemple) (async () => {
      try {
        await ctx.backend.setGameState<boolean>(ctx.day, cleVu(ctx.me), true);
        await ctx.backend.setGameState<number>(ctx.day, cleDevine(ctx.me), option);
      } catch { /* hors ligne : on ne bloque pas */ }
    })();
    minuteur.current = window.setTimeout(() => {
      setMaDevinette(option);
      setEtape("fin");
      if (juste) ctx.sound.play("win");
    }, 1500);
  };

  // en fin de partie, on va relire la devinette de l'autre si elle manque encore
  useEffect(() => {
    if (etape !== "fin" || saDevinette !== null) return;
    let annule = false;
    (async () => {
      const [d, vu] = await Promise.all([lire<number>(cleDevine(ctx.partner)), lire<boolean>(cleVu(ctx.partner))]);
      if (annule) return;
      if (typeof d === "number") setSaDevinette(d);
      setIlAVu(!!vu);
    })();
    return () => { annule = true; };
  }, [ctx, etape, lire, saDevinette]);

  /* ---------- rendu ---------- */
  const fermer = () => ctx.complete({
    success: true,
    score: sa && maDevinette !== null ? (maDevinette === sa.reponse ? 1 : 0) : undefined,
    data: { photo: ma?.url, devinette: maDevinette },
  });
  const boutonReprendre = ma && !ilAVu
    ? <button className="jeu-btn clair" onClick={() => ouvrirPrise(true)}>Reprendre ma photo</button>
    : null;

  if (etape === "chargement") {
    return <Cadre titre={titre}><div className="jeu-centre"><p className="quiz-attente">Un instant, je regarde vos photos…</p></div></Cadre>;
  }

  if (etape === "regles") {
    return (
      <Cadre titre={titre}>
        <PanneauRegles
          emoji={contenu.emoji}
          titre={contenu.titre}
          regles={[
            contenu.consigne,
            "Ajoute une petite légende, puis choisis une question et donne ta vraie réponse.",
            `Tu découvriras la photo de ${autre} seulement après avoir posté la tienne… et tu devras deviner sa réponse !`,
            `Tu peux reprendre ta photo tant que ${autre} ne l'a pas vue.`,
          ]}
          bouton="📸 Prendre ma photo"
          onJouer={() => ouvrirPrise(false)}
        />
      </Cadre>
    );
  }

  if (etape === "prise") {
    const q = question ? questionPar(question) : null;
    return (
      <Cadre titre={titre} barre={<Puce pale>Ta photo</Puce>}>
        <div className="jeu-centre">
          <div className="photo-prise">
            <input ref={entreeCamera} type="file" accept="image/*" capture="environment" hidden onChange={choisirFichier} />
            <input ref={entreeGalerie} type="file" accept="image/*" hidden onChange={choisirFichier} />

            {apercu
              ? <Polaroid url={apercu} legende={legende.trim() || undefined} auteur="Toi" penche="g" />
              : (
                <button className="photo-cadre-vide" onClick={() => entreeCamera.current?.click()}>
                  <span className="emoji">{contenu.emoji}</span>
                  <span>{contenu.consigne}</span>
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
                  <input
                    type="text" value={legende} maxLength={LEGENDE_MAX} placeholder={idee}
                    onChange={(e) => setLegende(e.target.value)}
                  />
                </label>

                <div className="photo-champ">
                  <span>Ta devinette pour {autre}</span>
                  <div className="photo-questions">
                    {contenu.questions.map((qq) => (
                      <button
                        key={qq.id}
                        className={"photo-question" + (question === qq.id ? " on" : "")}
                        onClick={() => { if (question !== qq.id) { setQuestion(qq.id); setReponse(null); } }}
                      >{qq.texte}</button>
                    ))}
                  </div>
                </div>

                {q && (
                  <div className="photo-champ">
                    <span>Ta vraie réponse</span>
                    <div className="quiz-options">
                      {q.options.map((opt, i) => (
                        <button key={opt} className={"quiz-option" + (reponse === i ? " choisi" : "")} onClick={() => setReponse(i)}>
                          <span className="puce">{LETTRES[i]}</span>{opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {erreur && <p className="photo-erreur">{erreur}</p>}
                <div className="jeu-actions">
                  {ma && <button className="jeu-btn clair" disabled={envoi} onClick={() => setEtape(maDevinette !== null ? "fin" : sa ? "devine" : "attente")}>Annuler</button>}
                  <button className="jeu-btn" disabled={!pret} onClick={envoyer}>
                    {envoi ? "J'envoie…" : `Envoyer à ${autre} 💌`}
                  </button>
                </div>
                {!pret && !envoi && <p className="photo-aide">{question === null ? "Choisis une question pour ta devinette." : reponse === null ? "Donne ta vraie réponse." : ""}</p>}
              </>
            )}
            {!apercu && erreur && <p className="photo-erreur">{erreur}</p>}
          </div>
        </div>
      </Cadre>
    );
  }

  if (etape === "attente" && ma) {
    return (
      <Cadre titre={titre} barre={<Puce pale>En attente</Puce>}>
        <div className="jeu-centre">
          <div className="photo-duo">
            <Polaroid url={ma.url} legende={ma.legende} auteur="Toi" penche="g" />
            <Polaroid auteur={autre} penche="d" vide={`${autre} n'a pas encore pris la sienne ⏳`} />
          </div>
          <p className="photo-texte">Ta photo est envoyée. Dès que {autre} poste la sienne, tu pourras la découvrir et deviner sa réponse.</p>
          <div className="jeu-actions">
            {boutonReprendre}
            <button className="jeu-btn" onClick={fermer}>Fermer</button>
          </div>
        </div>
      </Cadre>
    );
  }

  if (etape === "devine" && ma && sa) {
    const q = questionPar(sa.question);
    if (!revelee) {
      return (
        <Cadre titre={titre} barre={<Puce pale>Photo de {autre}</Puce>}>
          <div className="jeu-centre">
            <button className="photo-dos" onClick={decouvrir}>
              <span className="emoji">💌</span>
              <span>La photo de {autre} est arrivée</span>
              <b>Touche pour la découvrir</b>
            </button>
            {exemple && <p className="photo-aide">Mode démo : c'est une photo d'exemple.</p>}
            {boutonReprendre && <div className="jeu-actions">{boutonReprendre}</div>}
          </div>
        </Cadre>
      );
    }
    const bonne = sa.reponse;
    return (
      <Cadre titre={titre} barre={<Puce pale>Devine {autre}</Puce>}>
        <div className="jeu-centre">
          <Polaroid url={sa.url} legende={sa.legende} auteur={autre} penche="d" />
          <div className="quiz-q">
            <div className="quiz-phase">Qu'a répondu {autre} ?</div>
            <p className="quiz-texte">{q.texte}</p>
            <div className="quiz-options">
              {q.options.map((opt, i) => {
                let classe = "quiz-option";
                if (choix !== null) classe += i === bonne ? " bon" : i === choix ? " mauvais" : "";
                return (
                  <button key={opt} className={classe} disabled={choix !== null} onClick={() => deviner(i)}>
                    <span className="puce">{LETTRES[i]}</span>{opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Cadre>
    );
  }

  // fin : les deux polaroïds côte à côte et les deux devinettes
  if (!ma) return null;
  const maQ = questionPar(ma.question);
  const saQ = sa ? questionPar(sa.question) : null;
  const juste = sa && maDevinette !== null ? maDevinette === sa.reponse : null;
  const ilJuste = saDevinette !== null ? saDevinette === ma.reponse : null;
  return (
    <Cadre titre={titre} barre={<Puce pale>{config.puceFin}</Puce>}>
      <div className="jeu-centre">
        <div className="photo-duo">
          <Polaroid url={ma.url} legende={ma.legende} auteur="Toi" penche="g" />
          {sa
            ? <Polaroid url={sa.url} legende={sa.legende} auteur={autre} penche="d" />
            : <Polaroid auteur={autre} penche="d" vide="⏳" />}
        </div>
        <div className="photo-bilan">
          {saQ && sa && (
            <div className={juste ? "bon" : "rate"}>
              <span>Toi sur {autre} · {saQ.texte}</span>
              <b>{juste ? "✓" : "✗"} {saQ.options[sa.reponse]}</b>
            </div>
          )}
          <div className={ilJuste === null ? "" : ilJuste ? "bon" : "rate"}>
            <span>{autre} sur toi · {maQ.texte}</span>
            <b>{ilJuste === null ? `pas encore deviné (réponse : ${maQ.options[ma.reponse]})` : `${ilJuste ? "✓" : "✗"} ${maQ.options[saDevinette!]}`}</b>
          </div>
        </div>
        {exemple && <p className="photo-aide">Mode démo : la photo de {autre} est un exemple.</p>}
        <div className="jeu-actions">
          {boutonReprendre}
          <button className="jeu-btn" onClick={fermer}>Fermer</button>
        </div>
      </div>
    </Cadre>
  );
}

export function creerDefiPhoto(id: string, titre: string, config: ConfigDefiPhoto): GameModule {
  return { id, title: titre, mount: (el, ctx) => monterReact(el, <DefiPhoto ctx={ctx} titreJeu="Défi photo" config={config} />) };
}

export const defiPhotoJour3 = creerDefiPhoto("photo-jour3", "Défi photo croisé : la vue de ta fenêtre", {
  defaut: PHOTO_JOUR3, schema: SCHEMA_PHOTO_JOUR3, dessinerExemple: dessinerVueExemple, puceFin: "Vos deux vues",
});

export const defiPhotoJour19 = creerDefiPhoto("photo-jour19", "Défi photo croisé : ta déco de Noël", {
  defaut: PHOTO_JOUR19, schema: SCHEMA_PHOTO_JOUR19, dessinerExemple: dessinerSapinExemple, puceFin: "Vos deux décos",
});
