/**
 * Éditeur de contenu des jeux (#84) : Réglages → Notre calendrier → « Les jeux ».
 *
 * Décidé avec Alexandre (26 nov) : une page par case, chaque élément d'une liste est une **carte repliable**
 * (une ligne de résumé, on la déplie pour la modifier), et rien ne part avant le bouton **Enregistrer**
 * (confirmation si on quitte avec des changements).
 *
 * L'éditeur ne connaît aucun jeu : il lit le schéma publié par l'équipe Jeux (`schemasDesJeux`,
 * src/games/shared/contenu.ts) et le contenu par défaut (`contenuDuJour`). Règles de stockage (Jeux, #84) :
 *  - on n'enregistre dans `salon.config.contenu["<jour>"]` que les champs du schéma, et seulement ceux qui
 *    diffèrent du défaut (jour vide → la clé est retirée, le jeu reprend son contenu par défaut) ;
 *  - dans une liste, les champs inconnus d'un élément (`id`, réponses d'exemple…) sont gardés tels quels ;
 *    un élément ajouté part de `modele`.
 */
import { useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { BackendApi, DayNumber, Salon } from "../../core/contracts";
import { contenuDuJour as contenuParDefaut, schemasDesJeux, type ChampContenu, type SchemaContenu } from "../../games/registry";
import { lireContenu } from "../../games/shared/contenu";
import { PINGOU_SALON, type PingouLine } from "../pingou/lines";
import { EcranPingou, messageErreur } from "./EcranPingou";

type Obj = Record<string, unknown>;
const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const pareil = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const estObjet = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/* ------------------------------------------------------------------ */
/* Valeurs : départ, nettoyage, erreurs                                 */
/* ------------------------------------------------------------------ */

/** Défaut du jeu, réduit aux champs du schéma. */
function defautDe(schema: SchemaContenu): Obj {
  const d = contenuParDefaut(schema.jour as DayNumber);
  const o: Obj = {};
  if (!estObjet(d)) return o;
  for (const c of schema.champs) o[c.cle] = copie(d[c.cle]);
  return o;
}

/** Ce que le jeu affichera aujourd'hui : contenu du salon fusionné sur le défaut (mêmes règles que le jeu). */
function departDe(schema: SchemaContenu, salon: Salon): Obj {
  const d = contenuParDefaut(schema.jour as DayNumber);
  const plein = estObjet(d) ? (lireContenu(salon.config.contenu[String(schema.jour)], d, schema) as Obj) : {};
  const o: Obj = {};
  for (const c of schema.champs) o[c.cle] = copie(plein[c.cle]);
  return o;
}

/** Valeur prête à enregistrer : textes coupés, entrées vides retirées. */
function nettoyer(champ: ChampContenu, v: unknown): unknown {
  switch (champ.type) {
    case "texte": {
      const t = typeof v === "string" ? v.trim() : "";
      return t || undefined;
    }
    case "nombre": return typeof v === "number" ? v : Number(v);
    case "case": return !!v;
    case "choix": return v;
    case "textes": return (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean);
    case "liste":
      return (Array.isArray(v) ? v : []).map((el: Obj) => {
        const o: Obj = { ...el };
        for (const c of champ.champs) {
          const n = nettoyer(c, el[c.cle]);
          if (n === undefined) delete o[c.cle]; else o[c.cle] = n;
        }
        return o;
      });
  }
}

/** Erreur à afficher sous un champ (sans regarder dans les éléments d'une liste), ou null. */
function erreurDe(champ: ChampContenu, v: unknown): string | null {
  switch (champ.type) {
    case "texte": {
      const t = typeof v === "string" ? v.trim() : "";
      if (!t) return champ.facultatif ? null : "À remplir.";
      if (champ.motif && !new RegExp(champ.motif, "u").test(t)) return champ.motifAide ?? "Ce n'est pas le bon format.";
      return null;
    }
    case "nombre": {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isInteger(n) && n >= champ.min && n <= champ.max ? null : `Un nombre entre ${champ.min} et ${champ.max}.`;
    }
    case "textes": {
      const n = (Array.isArray(v) ? v : []).filter((x) => String(x ?? "").trim()).length;
      return n < champ.min ? `Il en faut au moins ${champ.min}.` : null;
    }
    case "liste": {
      const n = Array.isArray(v) ? v.length : 0;
      return n < champ.min ? `Il en faut au moins ${champ.min}.` : null;
    }
    default: return null;
  }
}

/** Vrai si l'élément d'une liste a au moins une erreur. */
const elementAbime = (champs: ChampContenu[], el: Obj): boolean =>
  champs.some((c) => erreurDe(c, el[c.cle]) !== null || (c.type === "liste" && (el[c.cle] as Obj[] ?? []).some((s) => elementAbime(c.champs, s))));

const toutEstBon = (champs: ChampContenu[], o: Obj) => !elementAbime(champs, o);

/** Ce qu'on enregistre pour ce jour : les champs du schéma qui diffèrent du défaut (null = rien). */
function aEnregistrer(schema: SchemaContenu, valeurs: Obj, defaut: Obj): Obj | null {
  const o: Obj = {};
  for (const c of schema.champs) {
    const n = nettoyer(c, valeurs[c.cle]);
    if (n !== undefined && !pareil(n, defaut[c.cle])) o[c.cle] = n;
  }
  return Object.keys(o).length ? o : null;
}

/* ------------------------------------------------------------------ */
/* Champs                                                               */
/* ------------------------------------------------------------------ */

function Champ({ champ, valeur, onChange, voirErreurs }: {
  champ: ChampContenu; valeur: unknown; onChange: (v: unknown) => void; voirErreurs: boolean;
}) {
  const id = useId();
  const erreur = voirErreurs ? erreurDe(champ, valeur) : null;
  const aide = champ.aide ? <p className="ed-aide" id={`${id}-aide`}>{champ.aide}</p> : null;
  const decrit = [champ.aide && `${id}-aide`, erreur && `${id}-err`].filter(Boolean).join(" ") || undefined;
  const err = erreur ? <p className="ed-erreur" id={`${id}-err`}>{erreur}</p> : null;

  switch (champ.type) {
    case "texte": {
      const props = {
        id, className: "ed-input", value: typeof valeur === "string" ? valeur : "", maxLength: champ.max,
        placeholder: champ.exemple, "aria-describedby": decrit, "aria-invalid": !!erreur,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      };
      return (
        <div className="ed-champ">
          <label className="ed-label" htmlFor={id}>{champ.label}{champ.facultatif && <span className="ed-facultatif"> (facultatif)</span>}</label>
          {champ.long ? <textarea rows={3} {...props} /> : <input type="text" autoComplete="off" {...props} />}
          {aide}{err}
        </div>
      );
    }
    case "nombre":
      return (
        <div className="ed-champ">
          <label className="ed-label" htmlFor={id}>{champ.label}</label>
          <input id={id} className="ed-input ed-nombre" type="number" inputMode="numeric" min={champ.min} max={champ.max}
            value={typeof valeur === "number" && Number.isFinite(valeur) ? valeur : ""} aria-describedby={decrit} aria-invalid={!!erreur}
            onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
          {aide}{err}
        </div>
      );
    case "case":
      return (
        <div className="ed-champ">
          <label className="ed-case">
            <input type="checkbox" checked={!!valeur} aria-describedby={decrit} onChange={(e) => onChange(e.target.checked)} />
            {champ.label}
          </label>
          {aide}
        </div>
      );
    case "choix":
      return (
        <div className="ed-champ">
          <label className="ed-label" htmlFor={id}>{champ.label}</label>
          <select id={id} className="ed-input" value={String(valeur ?? "")} aria-describedby={decrit} onChange={(e) => onChange(e.target.value)}>
            {champ.options.map((o) => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
          </select>
          {aide}
        </div>
      );
    case "textes": {
      const l = Array.isArray(valeur) ? (valeur as string[]) : [];
      const maj = (i: number, t: string) => onChange(l.map((x, j) => (j === i ? t : x)));
      return (
        <fieldset className="ed-champ ed-textes" aria-describedby={decrit}>
          <legend className="ed-label">{champ.label}</legend>
          {l.map((t, i) => (
            <div key={i} className="ed-texte-ligne">
              <input className="ed-input" type="text" autoComplete="off" value={t} maxLength={champ.maxLongueur}
                placeholder={i === 0 ? champ.exemple : undefined} aria-label={`${champ.label} ${i + 1}`}
                onChange={(e) => maj(i, e.target.value)} />
              <button type="button" className="ed-mini" disabled={l.length <= champ.min}
                aria-label={`Retirer ${champ.label.toLowerCase()} ${i + 1}`} onClick={() => onChange(l.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {l.length < champ.max && (
            <button type="button" className="ed-ajouter" onClick={() => onChange([...l, ""])}>＋ Ajouter</button>
          )}
          {aide}{err}
        </fieldset>
      );
    }
    case "liste":
      return <Liste champ={champ} valeur={valeur} onChange={onChange} voirErreurs={voirErreurs} aide={aide} err={err} />;
  }
}

/** Résumé d'une carte : l'emoji et le premier texte rempli. */
function resume(champs: ChampContenu[], el: Obj, repli: string): string {
  const emoji = typeof el.emoji === "string" ? el.emoji : "";
  const texte = champs.find((c) => c.type === "texte" && c.cle !== "emoji" && typeof el[c.cle] === "string" && (el[c.cle] as string).trim());
  const t = texte ? (el[texte.cle] as string).trim() : repli;
  return emoji ? `${emoji} ${t}` : t;
}

function Liste({ champ, valeur, onChange, voirErreurs, aide, err }: {
  champ: Extract<ChampContenu, { type: "liste" }>; valeur: unknown; onChange: (v: unknown) => void;
  voirErreurs: boolean; aide: React.ReactNode; err: React.ReactNode;
}) {
  const l = Array.isArray(valeur) ? (valeur as Obj[]) : [];
  const [ouverte, setOuverte] = useState<number | null>(null);
  const aFocaliser = useRef<number | null>(null);
  const cartes = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (aFocaliser.current === null) return;
    cartes.current[aFocaliser.current]?.focus();
    cartes.current[aFocaliser.current]?.scrollIntoView({ block: "nearest" });
    aFocaliser.current = null;
  });

  const maj = (i: number, el: Obj) => onChange(l.map((x, j) => (j === i ? el : x)));
  const deplacer = (i: number, d: -1 | 1) => {
    const n = [...l];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
    setOuverte(i + d);
    aFocaliser.current = i + d;
  };
  const ajouter = () => {
    const el: Obj = copie(champ.modele);
    if ("id" in el) el.id = `perso-${Date.now().toString(36)}`;
    for (const c of champ.champs) {
      if (c.cle in el) continue;
      if (c.type === "textes") el[c.cle] = Array.from({ length: Math.max(c.min, 1) }, () => "");
      else if (c.type === "texte") el[c.cle] = "";
      else if (c.type === "nombre") el[c.cle] = c.min;
      else if (c.type === "choix") el[c.cle] = c.options[0]?.valeur;
      else if (c.type === "liste") el[c.cle] = [];
    }
    onChange([...l, el]);
    setOuverte(l.length);
    aFocaliser.current = l.length;
  };
  const retirer = (i: number) => {
    onChange(l.filter((_, j) => j !== i));
    setOuverte(null);
    aFocaliser.current = Math.min(i, l.length - 2);
  };

  return (
    <div className="ed-champ">
      <p className="ed-label">{champ.label} <span className="ed-compte">· {l.length}</span></p>
      {aide}
      <ul className="ed-cartes">
        {l.map((el, i) => {
          const ouvert = ouverte === i;
          const abime = voirErreurs && elementAbime(champ.champs, el);
          const titre = resume(champ.champs, el, `${champ.libelleElement} ${i + 1}`);
          return (
            <li key={typeof el.id === "string" && el.id ? el.id : i} className={`ed-carte${ouvert ? " ouverte" : ""}${abime ? " abimee" : ""}`}>
              <button type="button" className="ed-carte-titre" aria-expanded={ouvert}
                ref={(b) => { cartes.current[i] = b; }} onClick={() => setOuverte(ouvert ? null : i)}>
                <span className="ed-chevron" aria-hidden="true">{ouvert ? "▾" : "▸"}</span>
                <span className="ed-carte-texte">{titre}</span>
                {abime && <span className="ed-alerte" role="img" aria-label="à corriger">⚠</span>}
              </button>
              {ouvert && (
                <div className="ed-carte-corps">
                  {champ.champs.map((c) => (
                    <Champ key={c.cle} champ={c} valeur={el[c.cle]} voirErreurs={voirErreurs}
                      onChange={(v) => maj(i, { ...el, [c.cle]: v })} />
                  ))}
                  <div className="ed-carte-actions">
                    <button type="button" className="ed-mini" disabled={i === 0} aria-label="Monter" onClick={() => deplacer(i, -1)}>↑</button>
                    <button type="button" className="ed-mini" disabled={i === l.length - 1} aria-label="Descendre" onClick={() => deplacer(i, 1)}>↓</button>
                    <button type="button" className="ed-retirer" disabled={l.length <= champ.min} onClick={() => retirer(i)}>
                      Retirer de la liste
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {l.length < champ.max && (
        <button type="button" className="ed-ajouter" onClick={ajouter}>＋ Ajouter {champ.libelleElement.toLowerCase()}</button>
      )}
      {err}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Écrans                                                               */
/* ------------------------------------------------------------------ */

/** Liste des cases qui ont quelque chose à personnaliser. */
export function ListeCasesContenu({ salon, ligne, onChoisir, onRetour }: {
  salon: Salon; ligne?: PingouLine; onChoisir: (jour: number) => void; onRetour: () => void;
}) {
  const schemas = useMemo(() => schemasDesJeux(), []);
  return (
    <EcranPingou ligne={ligne ?? PINGOU_SALON.contenuListe()} onRetour={onRetour} libelleRetour="Revenir à Notre calendrier">
      <ul className="ed-jours">
        {schemas.map((s) => {
          const perso = salon.config.contenu[String(s.jour)] !== undefined;
          const titre = s.titre.replace(/^Jour \d+\s*[—–-]\s*/, "");
          return (
            <li key={s.jour}>
              <button type="button" className="ed-jour" onClick={() => onChoisir(s.jour)}>
                <span className="ed-jour-num" aria-hidden="true">{s.jour}</span>
                <span className="ed-jour-texte">
                  <span className="ed-jour-titre"><span className="ed-sr">Jour {s.jour} : </span>{titre}</span>
                  <span className={`ed-jour-etat${perso ? " perso" : ""}`}>{perso ? "✎ Vos questions" : "Les questions de Pingou"}</span>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </EcranPingou>
  );
}

/**
 * Page d'une case. `retourRef` reçoit la fonction « revenir » (Échap, ‹) : elle demande confirmation
 * s'il reste des changements non enregistrés.
 */
export function EditeurCase({ backend, salon, jour, onFini, retourRef }: {
  backend: BackendApi; salon: Salon; jour: number;
  /** `enregistre` : vrai si quelque chose vient d'être enregistré (pour la réplique de la liste). */
  onFini: (enregistre: boolean) => void;
  retourRef: MutableRefObject<() => void>;
}) {
  const schema = useMemo(() => schemasDesJeux().find((s) => s.jour === jour)!, [jour]);
  const defaut = useMemo(() => defautDe(schema), [schema]);
  const [initial, setInitial] = useState(() => departDe(schema, salon));
  const [valeurs, setValeurs] = useState<Obj>(() => copie(initial));
  const [voirErreurs, setVoirErreurs] = useState(false);
  const [quitter, setQuitter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ligne, setLigne] = useState<PingouLine>(PINGOU_SALON.contenuCase());
  const haut = useRef<HTMLDivElement>(null);

  const modifie = !pareil(valeurs, initial);
  const original = pareil(aEnregistrer(schema, valeurs, defaut), null);

  retourRef.current = () => {
    if (busy) return;
    if (quitter) { setQuitter(false); setLigne(PINGOU_SALON.contenuCase()); return; }
    if (modifie) { setQuitter(true); setLigne(PINGOU_SALON.contenuQuitter()); return; }
    onFini(false);
  };

  const enregistrer = async () => {
    const api = backend.salons;
    if (!api || busy) return;
    if (!toutEstBon(schema.champs, valeurs)) {
      setVoirErreurs(true);
      setLigne(PINGOU_SALON.contenuIncomplet());
      haut.current?.scrollIntoView({ block: "start" });
      return;
    }
    setBusy(true);
    setErreur(null);
    setLigne(PINGOU_SALON.fabrication());
    try {
      // On relit le salon juste avant : l'autre a peut-être modifié une autre case entre-temps.
      const frais = (await api.getSalon()) ?? salon;
      const contenu = { ...frais.config.contenu };
      const v = aEnregistrer(schema, valeurs, defaut);
      if (v) contenu[String(jour)] = v; else delete contenu[String(jour)];
      await api.modifierSalon({ ...frais.config, contenu });
      setInitial(copie(valeurs));
      onFini(true);
    } catch (e) {
      setErreur(messageErreur(e));
      setLigne(PINGOU_SALON.souci());
    } finally {
      setBusy(false);
    }
  };

  return (
    <EcranPingou ligne={ligne} onRetour={busy ? undefined : () => retourRef.current()} libelleRetour="Revenir à la liste des jeux">
      <div ref={haut} className="ed-page">
        <h2 className="ed-titre">{schema.titre}</h2>
        <p className="ed-intro">{schema.intro}</p>
        {schema.champs.map((c) => (
          <Champ key={c.cle} champ={c} valeur={valeurs[c.cle]} voirErreurs={voirErreurs}
            onChange={(v) => { setValeurs((o) => ({ ...o, [c.cle]: v })); setQuitter(false); }} />
        ))}
        {!original && (
          <button type="button" className="salon-lien ed-original" onClick={() => {
            setValeurs(copie(defaut)); setVoirErreurs(false); setLigne(PINGOU_SALON.contenuOriginal());
          }}>Remettre les questions de Pingou</button>
        )}
      </div>
      <div className="ed-pied">
        {erreur && <p className="login-erreur salon-erreur" role="alert">{erreur}</p>}
        {quitter ? (
          <>
          <p className="ed-pied-note" role="alert">Tes changements ne sont pas encore enregistrés.</p>
          <div className="ed-pied-boutons" role="group" aria-label="Changements non enregistrés">
            <button type="button" className="btn ghost" onClick={() => onFini(false)}>Partir sans enregistrer</button>
            <button type="button" className="btn" disabled={busy} onClick={enregistrer}>Enregistrer</button>
          </div>
          </>
        ) : (
          <button type="button" className="btn salon-btn" disabled={busy || !modifie} onClick={enregistrer}>
            {busy ? "Un instant…" : modifie ? "Enregistrer" : "Rien à enregistrer"}
          </button>
        )}
      </div>
    </EcranPingou>
  );
}
