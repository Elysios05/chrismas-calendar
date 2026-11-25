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
