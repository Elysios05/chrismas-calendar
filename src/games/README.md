# Jeux — comment brancher une case sur son jeu

Pour le chef de projet (`src/App.tsx`). Tout ce qui suit est déjà prêt côté `src/games/` :
il n'y a **rien à écrire dans ce dossier**, et rien à savoir des jeux eux-mêmes.

## En une ligne

```tsx
import { FenetreJeu } from "./games/lanceur";
import { aUnJeu } from "./games/registry";

// …dans le rendu, quand une case est ouverte et qu'un jeu existe pour ce jour :
{jeuOuvert && (
  <FenetreJeu
    jour={jeuOuvert}
    moi={who}
    backend={backend}
    sound={sound}
    say={setLines}                         // la bulle de Pingou reste à l'interface
    onTermine={(r) => console.log(r.score)} // facultatif : score, réussite, données du jeu
    onFermer={() => setJeuOuvert(null)}
  />
)}
```

`FenetreJeu` s'occupe de tout : chargement à la demande du bon jeu, contexte (`GameContext`),
contenu de `src/data`, montage, nettoyage, fenêtre plein écran et croix de fermeture.
Si aucun jeu n'existe encore pour le jour demandé, elle affiche un panneau « bientôt » —
d'où `aUnJeu(jour)` pour décider du libellé du bouton dans la carte de la case.

## Ce que les jeux font déjà seuls

- `backend.markCompleted(jour)` quand la partie est terminée ;
- `backend.getGameState` / `setGameState` pour les réponses du quiz et les meilleurs scores ;
- `sound.setGameMusic(...)` pendant la partie, remis à `null` en sortant ;
- `say([...])` pour les répliques de Pingou.

## Ce que `App.tsx` doit fournir

- un `BackendApi` (le vrai mode démo de l'équipe Backend ; les jeux ne lisent que `mode`,
  `getGameState`, `setGameState`, `markCompleted`) ;
- un `SoundApi` (équipe Audio) ;
- `say`, qui pousse les lignes dans la bulle de Pingou.

Tant que `src/backend/` et `src/audio/` n'existent pas, un bouchon suffit :
voir `src/games/dev/backendDemo.ts` et `sonMuet` dans `src/games/dev/atelier.tsx`,
qui ne servent qu'à l'atelier de test (`npm run dev` puis `/jeux.html`).

## Détail d'usage

`ctx.complete(résultat)` veut dire **« le joueur quitte le jeu »** : la fenêtre appelle alors
`onTermine` puis `onFermer`. Les jeux ne l'appellent donc pas à la fin d'une partie, mais
seulement quand le joueur appuie sur « Fermer » depuis l'écran de résultat — il peut relancer
une descente sans que la fenêtre se referme.

## Salons : contenu personnalisé et prénoms (issue #84)
- Chaque jeu lit `ctx.prenoms` (via `prenomsDe(ctx)`, `shared/contenu.ts`) : plus aucun prénom en dur.
- Chaque jeu lit `ctx.content` via `lireContenu(ctx.content, DEFAUT, SCHEMA, reparer?)` : le contenu du salon
  est fusionné **champ par champ** sur le contenu par défaut de `src/data/games/`, et chaque champ est vérifié
  avec le schéma. Un champ absent ou abîmé garde sa valeur par défaut : un salon mal rempli ne casse rien.
- **Éditeur (Interface)** : `schemasDesJeux()` / `schemaDuJour(jour)` (registry.ts) décrivent les champs à
  proposer (type `SchemaContenu`, objet JSON pur) ; `contenuDuJour(jour)` donne le contenu par défaut pour
  pré-remplir. Enregistrer dans `salon.config.contenu["<jour>"]` seulement les champs du schéma.
  Jours 2 et 6 (adresse) : pas de schéma, rien à personnaliser.
- Atelier : `jeux.html?jour=11&salon=perso` (prénoms Camille et Sam, contenu de test) ou `salon=abime`.
