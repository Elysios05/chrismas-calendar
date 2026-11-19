# Équipe Jeux

**Mission** : les activités des 24 cases, toutes conformes au contrat `GameModule` (`src/core/contracts.ts`).
**Dossiers** : `src/games/` (un sous-dossier par jeu), `src/data/` (contenu : questions, mots, souvenirs).

## Familles de jeux
- **Solo** : quiz (1), rébus emojis (7), pendu (15), mots croisés (17).
- **Score à battre** (PixiJS) : luge (2), attrape-flocons tempête (10), tri des cadeaux (22).
- **Différé** : défis photo croisés (3, 19), dessin à deviner (9).
- **En direct** (`backend.joinRoom`) : Pictionary (5), duel friandises (6), synchro quiz (11), bonhomme à deux (13),
  boules de neige (18), sapin à deux (21) — chacun avec **une version tour par tour** si l'autre n'est pas là.
- **Synchronisé** : biscuits + minuteur partagé (14), film lancé ensemble (23).

## À faire (par priorité)
1. **Cadre commun** : registre des jeux, chargement par jour, composants partagés (compte à rebours, score, écran de victoire).
2. Jeux solo → score à battre → différés → en direct (tester à deux onglets avec le mode démo).
3. Contenu d'exemple dans `src/data/` (facile à remplacer par Alexandre).

## Questions à poser à Alexandre
Règles et difficulté de chaque jeu, contenu à mettre (souvenirs, private jokes), durée des parties.

## Parler au chef de projet
**Par une issue GitHub, jamais autrement.** Tout ce qui sort de `src/games/` et `src/data/` passe par là :
contrat à changer, fichier d'une autre équipe à modifier, arbitrage, priorités. Le chef répond dans l'issue,
dit qui fait quoi et confie les fichiers par écrit ; la suite se discute en commentaires sous la même issue.
Avant de poser une question, relire les issues ouvertes (y compris celles des autres équipes : les réponses
du chef y annoncent souvent des changements de contrat qui nous concernent).

## Journal

### 📍 État au 19 novembre 2026 — à lire en premier (reprise de session)

**Rien en cours : tout est fusionné dans `main`, aucune PR ouverte, aucune branche de travail.**

**Jeux livrés et jouables depuis la carte** (registre : `src/games/registry.ts`) :
| Jour | Jeu | Dossier | Contenu à remplacer par Alexandre |
|---|---|---|---|
| 1 | Quiz « Est-ce que tu me connais ? » | `src/games/quiz/` | `src/data/games/quiz-jour1.ts` (10 questions) |
| 2 | Descente en luge (score à battre) | `src/games/luge/` | `src/data/games/luge-jour2.ts` (réglages de difficulté) |
| 7 | Rébus en emojis | `src/games/rebus/` | `src/data/games/rebus-jour7.ts` (4 énigmes « à vous deux ») |
| 11 | Quiz synchro (**en direct**) | `src/games/synchro/` | `src/data/games/synchro-jour11.ts` (12 questions) |
| 15 | Pendu du bonhomme qui fond | `src/games/pendu/` | `src/data/games/pendu-jour15.ts` (6 mots perso) |
| 17 | Mots croisés | `src/games/motscroises/` | `src/data/games/motscroises-jour17.ts` (7 mots perso) |

Pièces communes : `src/games/shared/` (cadre et panneaux `ui.tsx`, montage React `monter.tsx`, base PixiJS et
saisie `scene.ts`, tirage reproductible `alea.ts`, scores `scores.ts`, **journal de coups `partie.ts`**),
`src/games/lanceur.tsx` (gardé pour l'atelier ; l'application passe par `DayWindow` de l'Interface),
atelier de test `jeux.html` + `src/games/dev/`.

#### Prochaine tâche

**Les jeux en direct, dans l'ordre : 5 (Pictionary), 6 (duel friandises), 13, 18, 21.** Décidé avec
Alexandre : commencer par le plus risqué.

**⚠️ À faire AVANT de coder le jour 5 — [issue #56](https://github.com/Elysios05/chrismas-calendar/issues/56)** :
le Backend a livré `joinLive` / `LiveGame` (`src/backend/realtime.ts`, mode d'emploi dans
`src/backend/README.md`) : présence, « Prêt ? » des deux côtés puis **départ synchronisé** (< 60 ms),
état partagé (dernier écrit gagne), reprise après coupure. Mon socle `partie.ts` est antérieur et passe
encore par `backend.joinRoom`. Plan : poser `partie.ts` sur `joinLive`, garder le **journal de coups**
par-dessus (c'est lui qui apporte la mémoire et le tour par tour, que l'état « dernier écrit gagne » ne
remplace pas), migrer le jour 11, vérifier à deux onglets, puis bâtir le Pictionary dessus.
Sons disponibles : `partner-in`, `partner-out` ; musiques `duel` et `cosy`.

**Avant de coder le Pictionary, demander ses règles à Alexandre** (règle 2 de `CLAUDE.md`) : durée d'un
tour, qui dessine en premier, nombre de manches, liste de mots à deviner, palette et épaisseurs de trait.

#### Décisions prises avec Alexandre (toutes, par jeu)

- **Jour 1 — quiz** : 10 QCM, correction immédiate, pas de chrono. Les bonnes réponses ne sont pas écrites
  d'avance : **chacun répond pour soi, puis devine l'autre**. Si l'autre n'a pas encore joué, pas de
  correction immédiate et le score arrive plus tard ; en mode démo, les réponses d'exemple servent de
  réponses de l'autre.
- **Jour 2 — luge** : descente longue (~2 min, 1900 m), **pilotage au glissement du doigt** (flèches sur
  ordinateur). Ajouts décidés seul pour rendre la longueur supportable : 3 chocs permis, ligne d'arrivée
  avec bonus, piste tirée d'une graine (même piste pour les deux).
- **Jour 7 — rébus** : réponse **tapée** avec correction tolérante, **indices illimités** (une lettre
  = −20 points), contenu moitié Noël moitié « à vous deux », comparaison chiffrée avec l'autre.
- **Jour 11 — synchro** : 12 questions, **mélange** « qu'est-ce qu'on choisirait à deux ? » et « qui de
  nous deux ? », **pas de chrono** (on voit « Flavie a répondu »), et si l'autre est absent : **Pingou fait
  patienter 20 s puis propose « Jouer quand même »**.
- **Jour 15 — pendu** : **7 morceaux**, **3 mots** par partie, moitié Noël moitié « à vous deux »,
  **indice de Pingou après 3 erreurs** (j'ai ajouté une étiquette neutre « Mot de Noël » / « À vous deux »
  pour que les mots personnels restent jouables).
- **Jour 17 — mots croisés** : 8 mots, grille ~9×11, **clavier AZERTY maison**, « Vérifier » gratuit et
  « Une lettre » à −25 points, contenu moitié-moitié.
- **Transversal** : le branchement dans l'application est fait par le chef via `DayWindow` ; les jeux ne
  touchent ni `src/ui/` ni `src/App.tsx`.

#### Pièges techniques découverts (ne pas les refaire)

1. **`ctx.complete()` veut dire « le joueur quitte le jeu »**, pas « la partie est finie » : `DayWindow`
   ferme la case et affiche son écran. Ne l'appeler qu'au bouton « Fermer » de l'écran de résultat,
   sinon « Rejouer » devient impossible.
2. **Ne jamais monter un jeu directement dans l'élément prêté par l'hôte** : `monterReact` pose sa propre
   boîte `.jeu-boite`. Sinon un remontage (« Revoir la case ») crée une deuxième racine React sur le même
   nœud, et le jeu déborde de la fenêtre (`.sheet-game` fait 180 px en flux, pas plein écran).
3. **Journal de coups** : les coups déjà déposés sont lus **avant** que le jeu n'installe son écouteur.
   Il faut forcer un recalcul à l'ouverture, sinon le joueur qui revient repart du début.
4. **Questions « qui de nous deux »** : les options doivent être des **prénoms**, jamais « toi » / « moi »,
   sinon les deux joueurs ne désignent pas la même personne.
5. **Générateur de mots croisés** : refuser un mot entièrement recouvert par d'autres et un mot qui
   rallongerait un mot déjà posé (`TRAIN` sur `TRAINEAU`), sinon deux définitions pointent les mêmes cases.
6. **`justify-content: center` rogne le haut** d'un contenu plus grand que la fenêtre : le cadre commun
   utilise `safe center`.
7. **Accents** : dans le pendu et les mots croisés, taper E révèle É et È (comparaison sur la lettre nue).
8. **Scores à battre** : toujours tirer le terrain d'une **graine** commune, sinon comparer les scores
   n'a aucun sens.

#### Comment tester

```bash
npm run dev     # puis /jeux.html = atelier des jeux (hors site livré)
```
L'atelier choisit le jour et le joueur, et passe par le vrai `DemoBackend`.
**Pour le temps réel : deux onglets du MÊME navigateur** (BroadcastChannel ne traverse pas deux
navigateurs ni deux contextes Playwright), ou l'application avec `?moi=alexandre` et `?moi=flavie`.
Les scripts de test Playwright utilisés jusqu'ici sont jetables et vivent dans le dossier temporaire
de la session, pas dans le dépôt.


### 17 novembre 2026 — cadre commun + jours 1 et 2 (branche `jeux/cadre-et-jours-1-2`)

**Décisions prises avec Alexandre :**
- **Quiz (jour 1)** : 10 questions à choix multiples, correction immédiate, pas de chrono.
  Les « bonnes » réponses ne sont pas écrites à l'avance : **chacun répond d'abord pour soi, puis devine l'autre**.
  Conséquence signalée à Alexandre et retenue : si l'autre n'a pas encore rempli ses réponses, pas de correction
  immédiate — Pingou annonce que le score arrivera plus tard. En mode démo, les réponses d'exemple de
  `src/data/games/quiz-jour1.ts` tiennent lieu de réponses de l'autre.
- **Luge (jour 2)** : descente longue (~2 min, 1900 m), pilotage **au glissement du doigt** (flèches ← → sur ordinateur).
  Ajouts décidés seul pour rendre la longueur supportable : 3 chocs permis, ligne d'arrivée avec bonus
  (300 + 200 par choc épargné), piste **tirée au sort à partir d'une graine** pour que les deux descendent
  exactement la même piste.

**Fait :**
- `src/games/registry.ts` : jour → jeu, chargé à la demande ; `contenuDuJour()` pour `GameContext.content`.
- `src/games/shared/` : cadre, barre de score, vies, points de progression, barre de progression, écrans de
  règles et de fin (`ui.tsx`), pont React↔`GameModule` (`monter.tsx`), base PixiJS + saisie (`scene.ts`),
  tirage reproductible (`alea.ts`), scores à battre via `BackendApi` (`scores.ts`), styles (`games.css`).
- `src/games/quiz/` et `src/games/luge/` (+ moteur PixiJS), contenu dans `src/data/games/`.
- `jeux.html` + `src/games/dev/` : atelier de test des jeux (hors site livré), avec un faux backend
  en localStorage en attendant `src/backend/`.

**Branchement du lanceur** : d'abord mis en attente (le 17 novembre, `src/backend/` et `src/audio/` n'existaient
pas et les bouchons auraient été du provisoire à jeter). Ces deux dossiers sont maintenant livrés, donc la
question est posée au chef dans l'issue #7 : qui appelle `<FenetreJeu />` et où (plutôt `src/ui/DayWindow.tsx`
que `src/App.tsx`), et qui fournit `backend` et `sound` à cet endroit. Le terrain est prêt côté jeux : `src/games/lanceur.tsx`
(`<FenetreJeu … />`, une ligne à poser dans la carte d'une case, qui gère chargement, contexte, fenêtre et
nettoyage) et la marche à suivre dans `src/games/README.md`. L'atelier de test passe par ce même lanceur.
À noter : `ctx.complete()` signifie « le joueur quitte le jeu » (la fenêtre se ferme), pas « la partie est finie ».

### 18 novembre 2026 — intégration dans la fenêtre de l'Interface (issue #7)

Le chef a branché les jeux lui-même dans `App.tsx` : toucher une case → `chargerJeu(jour)` →
`<DayWindow game={module} … />`. Il m'a confié le ménage et la vérification. Fait :
- **Les jeux débordaient de la fenêtre** : `.jeu` est en `position: absolute`, or `.sheet-game` est une
  simple div de 180 px — le jeu se calait sur l'écran entier et masquait l'en-tête et la croix de la case.
  `monterReact` pose maintenant sa propre boîte (`.jeu-boite`) dans l'élément prêté, qui se donne une
  hauteur jouable (`min(68vh, 560px)`) si l'hôte n'en impose pas. Mesuré : hôte 350×560 au lieu de 350×180.
- **Remontage** : cette boîte évite aussi qu'un « Revoir la case » crée une deuxième racine React sur le même
  nœud pendant que l'ancienne se démonte. Vérifié : « Revoir la case » relance bien le jeu à chaque fois.
- **Ménage** : `src/games/dev/backendDemo.ts` supprimé, l'atelier utilise le vrai `DemoBackend` de
  `src/backend/` (avec `signIn`, car les jeux ont besoin d'un joueur connecté) ; le son muet vient de
  `src/core/silent.ts` (le chef l'avait déjà fait).
- **Sémantique de `complete()`** : identique des deux côtés — « le joueur quitte le jeu ». `DayWindow` affiche
  alors son écran « Case terminée ». Les jeux ne l'appellent qu'au bouton « Fermer », donc « Encore une
  descente » reste interne au jeu.
- Vu dans le vrai site, téléphone et ordinateur : jours 1 et 2 jouables depuis la carte, aucune erreur console.

### 18 novembre 2026 — jour 7, rébus en emojis (branche `jeux/rebus-jour7`)

**Décisions prises avec Alexandre :**
- On **tape** la réponse (pas de QCM : le jour 1 utilise déjà ce mécanisme), avec correction tolérante —
  accents, majuscules, article, tirets et apostrophes pardonnés (`src/games/rebus/reponse.ts`).
- **Indices illimités** : Pingou révèle une lettre à la demande, chaque lettre coûte 20 points
  (minimum 20 points par rébus trouvé). La première lettre demandée déclenche aussi l'indice écrit.
- **Contenu moitié-moitié** : 4 énigmes de Noël, 4 « à vous deux » — ce sont celles qu'Alexandre remplacera
  par leurs vraies private jokes.
- **Comparaison chiffrée** avec l'autre à la fin (score et lettres demandées), comme les jours 1 et 2.

### 18 novembre 2026 — jour 15, le pendu du bonhomme qui fond (branche `jeux/pendu-jour15`)

**Décisions prises avec Alexandre :**
- **7 morceaux** (chapeau, écharpe, bras, carotte, boutons, tête, corps) : le bonhomme fond au lieu d'un pendu.
- **3 mots par partie**, le bonhomme se reconstruit entre chaque.
- **Moitié Noël, moitié « à vous deux »** ; le tirage alterne les deux et suit une graine, donc les deux
  joueurs ont exactement les mêmes mots.
- **Pas d'indice au départ** : Pingou le donne après 3 erreurs. Comme ça pénalise les mots personnels,
  j'affiche au-dessus du mot une étiquette neutre « Mot de Noël » / « À vous deux » — on sait dans quel
  monde chercher sans que la réponse soit vendue.

Décisions techniques prises seul : accents offerts (taper E révèle É et È), clavier AZERTY à l'écran **et**
clavier physique sur ordinateur, lettres groupées par mot pour qu'un mot ne se coupe jamais en fin de ligne.

### 19 novembre 2026 — socle des jeux à deux + jour 11 (branche `jeux/synchro-jour11`)

**Le morceau important, c'est le socle** : `src/games/shared/partie.ts`, un **journal de coups** partagé.
`backend.joinRoom` ne garantit rien (message perdu si l'écran est éteint, rien n'est mémorisé, un
rechargement repart de zéro). Chaque action est donc un coup identifié, diffusé en direct **et** déposé
via `setGameState`. Qui arrive, revient ou a raté un message rejoue le journal. Conséquence : le mode
« tour par tour » demandé au cahier des charges n'est pas un deuxième jeu à écrire, c'est le même
journal lu plus tard. Les cinq autres jeux en direct se poseront dessus.

**Décisions prises avec Alexandre (jour 11) :** 12 questions, mélange de « qu'est-ce qu'on choisirait
à deux ? » et de « qui de nous deux ? », pas de chrono (on voit « Flavie a répondu »), et quand l'autre
n'est pas là : Pingou fait patienter 20 secondes puis propose « Jouer quand même ».

**Attention pour les questions « qui » :** les options sont les prénoms, jamais « toi » / « moi » —
sinon les deux joueurs ne désignent pas la même personne et le score de synchro ne veut plus rien dire.

**Défaut trouvé en testant à deux onglets :** les coups déjà déposés sont lus avant que le jeu n'écoute,
donc le premier calcul des réponses restait vide — Flavie revenant dans la case repartait de la question 1
au lieu de la 3. Corrigé.

**Vérifié à deux onglets** (BroadcastChannel ne traverse pas deux navigateurs, il faut deux onglets du
même) : présence des deux côtés, révélation simultanée, désaccord, départ d'un joueur, réponse en solo,
retour de l'autre qui retrouve l'état. Aucune erreur console.

**Reste à faire :**
- Remplacer le faux backend d'atelier par le vrai mode démo quand `src/backend/` existe.
- Alexandre : remplacer les 10 questions d'exemple par les vraies.
- Suite : rébus (7), pendu (15), mots croisés (17), puis les scores à battre 10 et 22.

<!-- lignes du journal reprises de main lors de la fusion -->
### 18 novembre 2026 — jour 17, mots croisés (branche `jeux/motscroises-jour17`)
**Décisions prises avec Alexandre :** 8 mots sur une grille d'environ 9×9, clavier AZERTY maison
(comme le pendu), « Vérifier » gratuit et « Une lettre » payée 25 points, contenu moitié Noël
moitié « à vous deux ».
**Décision technique importante** : la grille n'est pas dessinée, elle est **construite par le code**
(`src/games/motscroises/grille.ts`) à partir de la liste de mots, en cherchant les croisements.
Alexandre peut donc remplacer les mots sans rien redessiner. Le générateur essaie une soixantaine
d'agencements et garde le plus compact et le plus carré (sinon la grille partait en 13×13).
**Deux défauts trouvés en regardant le résultat, puis corrigés :**
- `TRAIN` se posait **par-dessus** `TRAINEAU` (un mot préfixe d'un autre) : deux définitions pour les
  mêmes cases. Le générateur refuse maintenant un mot entièrement recouvert, et un mot qui rallongerait
  un mot déjà posé dans le même sens.
- Sur ordinateur, la première ligne de la grille était rognée : `.jeu-centre` centrait verticalement un
  contenu plus haut que la fenêtre. Passé en `justify-content: safe center` dans le cadre commun —
  ça profite à tous les jeux.
