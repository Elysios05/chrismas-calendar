/**
 * Jour 9 — Dessin à deviner : vos souvenirs dessinés (en différé).
 *
 * ALEXANDRE : tout se remplace ici.
 *  - `themes`    : les sujets proposés. Pour chaque dessin, on en choisit un (pas deux fois le même),
 *                  on dessine SON souvenir sur ce thème, puis on écrit la réponse à trouver.
 *                  Le thème s'affiche comme indice pour celui qui devine. Il en faut au moins `nbDessins`.
 *                  `idee` : exemple affiché en gris dans le champ « réponse ».
 *  - `nbDessins` : combien de dessins chacun fait (3 décidé le 25 nov).
 *  - `exemples`  : en mode démo seulement, ce que « l'autre » est censé avoir dessiné
 *                  (les dessins eux-mêmes sont tracés par le jeu, dans `src/games/dessin/exemple.ts`).
 */

import type { SchemaContenu } from "../../games/shared/contenu";
export type ThemeDessin = { id: string; texte: string; idee: string };

export type ExempleDessin = { theme: string; reponse: string; variantes: string[]; mot: string };

export type DessinContent = {
  emoji: string;
  titre: string;
  consigne: string;
  nbDessins: number;
  essais: number;
  themes: ThemeDessin[];
  exemples: ExempleDessin[];
};

export const DESSIN_JOUR9: DessinContent = {
  emoji: "✏️",
  titre: "Vos souvenirs dessinés",
  consigne: "Choisis un thème et dessine un souvenir à vous deux. Pas de chrono : prends ton temps !",
  nbDessins: 3,
  essais: 3,
  themes: [
    { id: "rdv", texte: "Notre premier rendez-vous", idee: "ex. le cinéma" },
    { id: "voyage", texte: "Un voyage qu'on a fait", idee: "ex. Venise" },
    { id: "plat", texte: "Un plat qu'on adore", idee: "ex. la raclette" },
    { id: "rire", texte: "Un moment où on a beaucoup ri", idee: "ex. la panne de voiture" },
    { id: "objet", texte: "Un objet qui me fait penser à toi", idee: "ex. ton écharpe" },
    { id: "bientot", texte: "Ce qu'on fera quand on se reverra", idee: "ex. un gros câlin" },
  ],
  exemples: [
    { theme: "plat", reponse: "la pizza", variantes: ["pizza", "pizzas"], mot: "Celle du petit resto, on n'a jamais retrouvé la même 🍕" },
    { theme: "voyage", reponse: "la plage", variantes: ["la mer", "bord de mer", "plage"], mot: "Le coucher de soleil le plus long du monde ☀️" },
    { theme: "bientot", reponse: "un câlin", variantes: ["calin", "se serrer dans les bras", "un bisou"], mot: "Le premier truc qu'on fera, promis 💞" },
  ],
};

/** Ce qu'un couple personnalise dans l'éditeur du salon (voir src/games/shared/contenu.ts). */
export const SCHEMA_DESSIN_JOUR9: SchemaContenu = {
  jour: 9,
  titre: "Jour 9 — Vos souvenirs dessinés",
  intro: "Pour chaque dessin, on choisit un thème, on dessine son souvenir et l'autre le devine. Il faut au moins autant de thèmes que de dessins.",
  champs: [
    { type: "nombre", cle: "nbDessins", label: "Dessins chacun", min: 1, max: 5 },
    {
      type: "liste", cle: "themes", label: "Thèmes proposés", libelleElement: "Thème", min: 3, max: 12, modele: { id: "" },
      champs: [
        { type: "texte", cle: "texte", label: "Thème", max: 60, exemple: "Un voyage qu'on a fait" },
        { type: "texte", cle: "idee", label: "Exemple de réponse (en gris)", max: 40, facultatif: true, exemple: "ex. Venise" },
      ],
    },
  ],
};

export function reparerDessin(c: DessinContent): DessinContent {
  const themes = c.themes.map((t) => ({ ...t, idee: t.idee ?? "" }));
  // les dessins d'exemple du mode démo gardent un thème qui existe
  const exemples = c.exemples.map((e, i) => (themes.some((t) => t.id === e.theme) ? e : { ...e, theme: themes[i % themes.length].id }));
  return { ...c, themes, exemples, nbDessins: Math.min(c.nbDessins, themes.length) };
}
