/**
 * Salons (docs/salons.md, issue #84) : ce que chaque jeu lit dans le salon.
 *
 *  - `prenomsDe(ctx)` : les prénoms affichés des deux places. Jamais de prénom en dur dans un jeu.
 *  - `SchemaContenu`  : la description, pour l'éditeur générique de l'Interface, des champs qu'un couple
 *                       peut personnaliser dans un jeu (questions, mots, thèmes…). Objet JSON pur, sans
 *                       fonction : l'Interface le lit tel quel (`schemaDuJour(jour)` dans registry.ts).
 *  - `lireContenu()`  : fusionne le contenu du salon (`ctx.content`) avec le contenu par défaut, champ par
 *                       champ, en vérifiant chaque champ avec le schéma. Un champ absent ou abîmé garde sa
 *                       valeur par défaut : un salon mal rempli ne casse jamais un jeu.
 *
 * Règle de stockage (à respecter par l'éditeur) : `salon.config.contenu["<jour>"]` contient seulement les
 * champs du schéma que le couple a modifiés (les réglages techniques — graine, vitesses… — restent ceux du
 * jeu). Dans une liste d'objets, l'éditeur garde tels quels les champs d'un élément qu'il ne connaît pas
 * (`id`…) ; un élément ajouté reçoit `modele` puis ce que le couple a écrit.
 */

import type { GameContext, Who } from "../../core/contracts";

/* ------------------------------------------------------------------ */
/* Prénoms                                                             */
/* ------------------------------------------------------------------ */

/** Repli quand l'appelant ne passe pas les prénoms (atelier, ancien appelant) : jamais affiché en vrai. */
const REPLI: Record<Who, string> = { alexandre: "Joueur 1", flavie: "Joueur 2" };

export function prenomsDe(ctx: Pick<GameContext, "prenoms">): Record<Who, string> {
  const p = ctx.prenoms;
  const propre = (who: Who) => (typeof p?.[who] === "string" && p[who].trim() ? p[who].trim() : REPLI[who]);
  return { alexandre: propre("alexandre"), flavie: propre("flavie") };
}

/** « de Flavie », « d'Alexandre » */
export const de = (prenom: string) => (/^[AEIOUYÉÈÊH]/i.test(prenom) ? `d'${prenom}` : `de ${prenom}`);

/* ------------------------------------------------------------------ */
/* Schéma de contenu (lu par l'éditeur générique de l'Interface)       */
/* ------------------------------------------------------------------ */

type Base = {
  /** Clé dans l'objet de contenu */
  cle: string;
  /** Libellé court affiché au-dessus du champ */
  label: string;
  /** Une phrase d'aide sous le champ (facultatif) */
  aide?: string;
};

export type ChampContenu =
  /** Texte libre. `exemple` s'affiche en gris dans le champ vide. */
  | (Base & { type: "texte"; exemple?: string; long?: boolean; max: number; facultatif?: boolean; motif?: string; motifAide?: string })
  /** Nombre entier entre min et max */
  | (Base & { type: "nombre"; min: number; max: number })
  /** Case à cocher */
  | (Base & { type: "case" })
  /** Un choix parmi des valeurs fixes */
  | (Base & { type: "choix"; options: { valeur: string; label: string }[] })
  /** Liste de textes courts (options d'une question, variantes acceptées…) */
  | (Base & { type: "textes"; min: number; max: number; maxLongueur: number; exemple?: string })
  /** Liste d'objets : chaque élément a les `champs` ; un élément ajouté part de `modele` */
  | (Base & { type: "liste"; min: number; max: number; champs: ChampContenu[]; modele: Record<string, unknown>; libelleElement: string });

export type SchemaContenu = {
  /** Jour de la case */
  jour: number;
  /** Titre de la page de l'éditeur (« Jour 1 — Est-ce que tu me connais ? ») */
  titre: string;
  /** Une à trois phrases : ce qu'on personnalise et comment ça sert dans le jeu */
  intro: string;
  champs: ChampContenu[];
  /**
   * Vrai si la case est déjà bien sans rien changer (jeu d'adresse, contenu générique).
   * L'assistant de création peut alors la proposer en « facultatif ».
   */
  facultatif?: boolean;
};

/* ------------------------------------------------------------------ */
/* Lecture du contenu                                                  */
/* ------------------------------------------------------------------ */

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Renvoie la valeur nettoyée si elle respecte le champ, sinon `undefined`. */
function verifier(champ: ChampContenu, v: unknown): unknown {
  switch (champ.type) {
    case "texte": {
      if (typeof v !== "string") return undefined;
      const t = v.trim().slice(0, champ.max);
      if (!t) return undefined;
      if (champ.motif && !new RegExp(champ.motif, "u").test(t)) return undefined;
      return t;
    }
    case "nombre":
      return typeof v === "number" && Number.isFinite(v) ? Math.min(champ.max, Math.max(champ.min, Math.round(v))) : undefined;
    case "case":
      return typeof v === "boolean" ? v : undefined;
    case "choix":
      return champ.options.some((o) => o.valeur === v) ? v : undefined;
    case "textes": {
      if (!Array.isArray(v)) return undefined;
      const l = v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, champ.maxLongueur)).filter(Boolean);
      return l.length >= champ.min ? l.slice(0, champ.max) : undefined;
    }
    case "liste": {
      if (!Array.isArray(v)) return undefined;
      const l: Record<string, unknown>[] = [];
      for (const brut of v) {
        if (!estObjet(brut)) continue;
        const el = lireObjet(champ.champs, brut, { ...champ.modele, ...brut });
        if (el) l.push(el);
      }
      return l.length >= champ.min ? l.slice(0, champ.max) : undefined;
    }
  }
}

/**
 * Un élément de liste : chaque champ obligatoire doit être valide, sinon l'élément est écarté
 * (un champ facultatif abîmé est simplement retiré).
 */
function lireObjet(champs: ChampContenu[], brut: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> | null {
  const el: Record<string, unknown> = { ...base };
  for (const c of champs) {
    const v = verifier(c, brut[c.cle]);
    if (v !== undefined) { el[c.cle] = v; continue; }
    const optionnel = (c.type === "texte" && c.facultatif) || c.type === "case" || (c.type === "textes" && c.min === 0);
    if (!optionnel) return null;
    delete el[c.cle];
  }
  return el;
}

/**
 * Contenu d'un jeu : `ctx.content` (salon) fusionné sur `defaut`, champ du schéma par champ du schéma.
 * `reparer` (facultatif) remet d'aplomb ce qui dépend de plusieurs champs (un nombre de questions plus
 * grand que la liste, un exemple qui pointe vers une question supprimée…).
 */
export function lireContenu<T extends object>(brut: unknown, defaut: T, schema: SchemaContenu, reparer?: (c: T) => T): T {
  if (!estObjet(brut)) return defaut;
  const c: Record<string, unknown> = { ...(defaut as Record<string, unknown>) };
  for (const champ of schema.champs) {
    const v = verifier(champ, brut[champ.cle]);
    if (v !== undefined) c[champ.cle] = v;
  }
  // identifiants manquants ou en double dans les listes : on en fabrique (stables pour un même contenu)
  for (const champ of schema.champs) {
    const l = c[champ.cle];
    if (champ.type !== "liste" || !Array.isArray(l) || !("id" in champ.modele)) continue;
    const vus = new Set<string>();
    c[champ.cle] = l.map((el: Record<string, unknown>, i: number) => {
      let id = typeof el.id === "string" && el.id ? el.id : `${champ.cle}-${i + 1}`;
      while (vus.has(id)) id = `${id}-${i + 1}`;
      vus.add(id);
      return { ...el, id };
    });
  }
  return reparer ? reparer(c as T) : (c as T);
}
