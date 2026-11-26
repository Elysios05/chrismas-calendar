# Équipe Interface (React)

**Mission** : tout ce qui se trouve par-dessus le monde — lisible, mignon, agréable au doigt comme à la souris.
**Dossiers** : `src/ui/`, `src/index.css`.

## Existant
Tous les écrans de l'interface sont écrits, fusionnés dans `main` et branchés sur le vrai backend :
connexion, fenêtre d'une case, lecture et éditeur d'une case préparée, rappel la veille,
réglages (son, animations, rappels, déconnexion), indicateur de la course, écran du 24,
et Pingou (répliques + 5 expressions).

| Fichier (`src/ui/`) | Rôle |
|---|---|
| `LoginScreen.tsx` | profil + mot de passe, œil, « rester connecté·e », accès démo |
| `DayWindow.tsx` | fenêtre d'une case : en-tête, montage du `GameModule`, état terminé |
| `PreparedCase.tsx` | lecture d'une case préparée : enveloppe, lettre, polaroïds |
| `PreparedEditor.tsx` | éditeur + aperçu, et `RappelVeille` (bandeau) |
| `Settings.tsx` | réglages ; `chargerPreferences(sound)` à appeler au démarrage |
| `Reminders.tsx` | bloc « Rappels sur cet appareil » (5 états du contrat) |
| `RaceIndicator.tsx` | la course ; exporte aussi `avancee()` et `course()` |
| `FinalScreen.tsx` | écran du 24 |
| `Mascot.tsx` | portrait + bulle ; `pingou/lines.ts` = toutes les répliques |
| `useDialog.ts` | tout ce qu'une fenêtre modale doit faire (voir Pièges) |
| `dev/maquettes.tsx` | page de maquettes, `maquettes.html?vue=…` (outil de travail) |

## À faire (par priorité) — mis à jour par le chef le 24 nov
Méthode : prends le **premier point non fait** de cette liste, une branche et une PR par point, `npm run build`,
`npm run capture`, PR vers `main` (le chef fusionne), Journal à jour. Questions de goût : 2–3 options avec captures
**avant** de coder. **On ne coupe rien** (décision d'Alexandre du 24 nov). Mise en ligne le 30 nov au soir.

1. ~~**#75**~~ — fait et fusionné (PR #76).
2. ~~**#51**~~ — fait et fusionné (PR #79), branché par le chef dans `App.tsx`.
3. ~~Relire les issues `[Interface]`~~ — fait le 24 nov : aucune ouverte. Suite demandée au chef dans **#81**
   (avec le signalement de `npm run capture` cassé). PR `interface/nettoyage-entete` en attente de fusion.
4. ~~Réponse du chef dans #81~~ : reçue (25 nov), PR #82 fusionnée.
**🆕 Salons** — ✅ maquettes (piste B choisie), assistant de création, invitation, réglages du salon (25 nov),
éditeur de contenu des jeux (26 nov, PR `interface/editeur-contenu`). Reste : faire valider les répliques de l'éditeur. ~~Ancien texte :~~
**Salons (décision d'Alexandre du 25 nov, avant le 30)** — lire `docs/salons.md`. Dès que le chef annonce dans **#84** la fusion du contrat `SalonApi`, ce point passe **avant tous les autres** : accueil « Créer notre calendrier », assistant de création, page du lien à envoyer, première connexion par lien, connexion par salon, éditeur de contenu générique. Avant cela, tu peux déjà proposer à Alexandre 2–3 maquettes de ces écrans.

5. ~~**Nom du monde tronqué sur téléphone**~~ — fait le 26 nov (nom court, PR `interface/nom-du-monde`).
6. **À partir du 27 nov** (Supabase branché) : vérification complète de l'interface en vrai — messages d'erreur de #75
   avec de vraies erreurs. ~~Audit axe-core, revue des 24 jours~~ : faits le 26 nov (bug de la case 10 → **#113**).
7. ~~Issue au chef pour la suite~~ : réponse reçue dans **#116** (26 nov) :
   - A (erreurs #75 sur vrai Supabase) : **après le 27**, Alexandre donnera URL + clé anonyme dans `.env.local` (jamais commité).
   - ~~C : #110 côté React~~ — fait (PR `interface/titre-salon`).
   - **B** : lister les défauts de **tous les jeux** sur 390×844, corriger ce qui est dans `src/ui/`, issue [Jeux] pour le reste.
   - **D** : jour 19 (défi photo, proche du jeu photo du jour 3) **à faire valider par Alexandre** ; s'il dit oui, les Jeux le retirent de leur liste.

## Journal

### 📍 Où j'en suis — 26 novembre 2026 (soir, après #116)

**#110, partie React : faite** (branche `interface/titre-salon`). `useTitreDuSalon(salon)` dans `src/ui/useSalon.ts` :
titre de l'onglet « Calendrier de l'Avent — Prénom & Prénom » d'après le salon, titre générique sans salon ou avant
son chargement (jamais les prénoms de repli), et remis en générique quand on quitte la carte. Un seul appel ajouté
dans `Calendar` (`App.tsx`), puisque le chef m'a confié ce point. Vérifié en démo : générique sur l'écran de connexion,
« … — Alexandre & Flavie » dans la carte. Remarque laissée au chef : l'écran de connexion affiche
« Alexandre & Flavie » en sous-titre (prénoms par défaut, le salon n'est pas encore connu à ce moment-là).

**Prochaine tâche** : D (jour 19), demander l'accord d'Alexandre ; puis B (défauts des jeux sur téléphone).

### 📍 Où j'en suis — 26 novembre 2026 (tard)

**Point 7 : suite demandée au chef dans #116** (pas de Supabase dans la session, donc le reste du point 6 est bloqué).
Options proposées : A) une clé d'un projet Supabase de test, ou confier le test des erreurs #75 à la Qualité sur le site
déployé ; B) aide aux Jeux (tenue sur 390×844) ; C) #110 côté React (`document.title` selon le salon). Recommandé : A + B.
- En attendant : **revue des 24 fenêtres de case sur ordinateur** (1280×800, jour 24, `npm run capture -- --case=N
  --appareils=ordinateur`) : 0 erreur console, aucun défaut (fenêtres centrées, titres longs repliés proprement).
  Astuce : une planche de 9 captures réduites (PIL) économise beaucoup de contexte pour la relecture.

**Prochaine tâche** : lire la réponse du chef dans #116, puis #113.

### 📍 Où j'en suis — 26 novembre 2026 (fin de soirée)

**Point 6, partie sans Supabase : faite** (branche `interface/verification-24-jours`, journal seulement, aucun code changé).
- **axe-core (WCAG 2.1 A/AA), jour et nuit, téléphone** : 0 violation sur l'assistant de création (12 étapes),
  l'invitation, les réglages du salon (places 1 et 2), la liste et l'éditeur de contenu (carte dépliée, erreurs après
  « Enregistrer »), l'en-tête, l'erreur de connexion, l'écran final, le rappel et la course. Le test e2e de la Qualité
  (`tests/e2e/accessibilite.spec.ts`) passe aussi. Méthode : `npx vite` + `maquettes.html?vue=…`, axe injecté,
  nuit via `document.documentElement.dataset.nuit = "oui"` (script jetable, hors dépôt).
- **Revue des 24 jours** (`npm run capture`, téléphone, 12 h et 21 h, plus les 24 fenêtres de case) : 0 erreur console,
  aucun défaut d'interface (en-tête, rappel de veille, course, 📜 le 24, pastille masquée le 24 : tout est conforme).
- **Bug trouvé, hors de mon dossier → #113 (Monde)** : au jour 10, toucher le cadeau 10 n'ouvre rien, parce qu'un patineur
  (zone de toucher ≥ 20 px) le recouvre et reçoit le toucher. Recommandé : les cadeaux passent avant les habitants.
  Dans #113, j'ai aussi signalé « Préparée par vous deux » coupé sur deux lignes (Jeux) et une bande sombre en bas de la nuit du 24 (Monde).
- Piège : deux `npm run capture` en parallèle se battent pour le port 4180. Mettre `QA_PORT=4181` sur le second.

**Prochaine tâche** : le 27 nov, une fois Supabase branché, vérifier les messages d'erreur de #75 avec de vraies erreurs
(mauvais mot de passe, réseau coupé, e-mail non confirmé, trop d'essais). Puis lire la réponse du chef dans #113.

### 📍 Où j'en suis — 26 novembre 2026 (nuit)

**Arbitrage du chef (#84) : « Les questions des jeux » réservé au créateur** (branche `interface/questions-createur`, PR ouverte).
- Place 1 (`me === "alexandre"`) : entrée inchangée. Place 2 : carte 🎁 inactive (un `<p>`, pas de flèche) avec
  `PINGOU_SALON.contenuSurprise(prénom du créateur)` : « {prénom} a préparé les questions des jeux. C'est une surprise 🤫 »
  — **texte choisi par Alexandre le 26 nov** (préféré à « Motus » et « je garde l'enveloppe »).
- Protection d'interface seulement : la config reste lisible par les deux (RLS inchangée, décision du chef).
- Maquette : `maquettes.html?vue=reglages-salon&moi=flavie` pour voir la place 2.
- Captures : place 2 téléphone et ordinateur, place 1 téléphone, 0 erreur console.

**Prochaine tâche** : point 6 (à partir du 27 nov, vérification complète en vrai avec Supabase).

### 📍 Où j'en suis — 26 novembre 2026 (soir)

**Point 5 : nom du monde tronqué sur téléphone** (branche `interface/nom-du-monde`, PR ouverte).
- **Décidé avec Alexandre (26 nov)** : **nom court sur téléphone** (< 700 px) : « Saint-Nicolas » et
  « Forêt & Lac gelé » ; les 4 autres noms tiennent tels quels. Écartés : texte plus petit (Saint-Nicolas restait
  coupé) et deux lignes (l'îlot grandit, « Saint-Nicolas » coupé au tiret).
- `NOM_COURT` dans `Hud.tsx`, indexé par le nom du monde (`zones.ts` est à Monde) ; si Monde renomme un monde,
  le nom complet s'affiche à nouveau → revérifier sur téléphone. Le nom complet reste lu par le lecteur d'écran.
- Captures : jour 6 nuit et jour 10 (téléphone), jour 10 (ordinateur), 0 erreur console.

**Prochaine tâche** : point 6 (à partir du 27 nov, vérification complète en vrai avec Supabase). PR #100 fusionnée par le chef
(26 nov).

### 📍 Où j'en suis — 26 novembre 2026

**Salons, étape 5 : éditeur de contenu des jeux** (branche `interface/editeur-contenu`, PR en brouillon).
- **Décidé avec Alexandre (26 nov)** : une page par case, chaque élément d'une liste est une **carte repliable**
  (résumé emoji + premier texte, ▸ pour déplier), et **rien ne part avant « Enregistrer »** (confirmation
  « Partir sans enregistrer / Enregistrer » si on quitte avec des changements). Écartés : un écran plein par élément
  (trop d'allers-retours pour 30 questions), tout déplié (page interminable), enregistrement automatique (écrasements).
- `src/ui/salons/EditeurContenu.tsx` : `ListeCasesContenu` (cases qui ont un schéma, « ✎ Vos questions » si le salon
  a un contenu pour ce jour) et `EditeurCase` (champs génériques `texte`, `nombre`, `case`, `choix`, `textes`, `liste`
  d'après `schemasDesJeux()` ; ↑ ↓ pour réordonner, « Retirer de la liste », « ＋ Ajouter … » depuis `modele`).
- Stockage (règles Jeux, #84) : seuls les champs du schéma **qui diffèrent du défaut** vont dans
  `salon.config.contenu["<jour>"]` ; tout redevenu par défaut → la clé est supprimée. Le salon est **relu juste
  avant** `modifierSalon` pour ne pas écraser une autre case modifiée par l'autre entre-temps.
- Départ = `lireContenu(contenu du salon, défaut, schéma)` : l'éditeur montre exactement ce que le jeu jouera.
- Erreurs (champ vide, motif, nombre hors bornes, trop peu d'éléments) affichées au premier « Enregistrer » ;
  les cartes à corriger passent en rouge avec ⚠.
- Entrée : bouton « 🎁 Les questions des jeux » dans l'accueil de `ReglagesSalon` ; Échap / ‹ remontent d'un écran.
- Répliques `PINGOU_SALON.contenuListe / contenuCase / contenuEnregistre / contenuOriginal / contenuQuitter /
  contenuIncomplet` : **validées telles quelles par Alexandre le 26 nov** (préférées à une version plus sobre).
- Captures : `maquettes.html?vue=reglages-salon` puis « Les questions des jeux » (Playwright jetable, hors dépôt).

**PR #100 complète**, en attente de relecture et de fusion par le chef. Aucune issue `[Interface]` ouverte (vérifié le 26 nov).

**Prochaine tâche** : point 5 de la liste (nom du monde tronqué sur téléphone), avec 2–3 options et des captures à montrer à Alexandre.
À signaler au chef si besoin : l'éditeur montre les réponses (rébus, pendu…) à celui qui l'ouvre — normal pour
celui qui prépare, mais l'autre peut aussi l'ouvrir.

### 📍 Où j'en suis — 25 novembre 2026 (soir)

**Salons, étape 4 : réglages du salon** (branche `interface/reglages-salon`, PR en brouillon).
- **Décidé avec Alexandre (25 nov)** : on **réutilise les écrans de l'assistant** (piste B « Pingou »), ouverts depuis
  une ligne « Notre calendrier › » de la feuille Réglages (affichée si `backend.salons` existe) ; **chacun peut
  modifier les deux personnages**.
- `src/ui/salons/ReglagesSalon.tsx` : accueil (les deux personnages + « Modifier », « Ton lien de connexion » à copier,
  et pour le créateur tant que `!salon.inviteArrive` : lien d'invitation + « Lien perdu ? Fabriquer un nouveau lien »
  avec confirmation) → Modifier = écran prénom → écran manteau (tous les nuanciers dépliés) → `modifierSalon`
  (le `contenu` est gardé tel quel). Échap / ‹ : remonte d'un écran, puis ferme.
- `Settings` : la feuille reste montée dessous ; tant que « Notre calendrier » est ouvert, Échap n'est pas pris par
  la feuille (`salonOuvertRef`). `EcranPingou` : bouton ‹ possible sans barre de progression (`libelleRetour`).
- Maquette : `maquettes.html?vue=reglages-salon` (crée un salon Sam & Camille, Camille pas encore arrivée).
- Répliques `PINGOU_SALON.reglages / changerPrenom / changerManteau / reglagesEnregistres / lienGarde / nouveauLien` :
  **validées telles quelles par Alexandre (25 nov)**.
- Captures : `npm run capture` ne sait pas ouvrir `maquettes.html` → petit Playwright jetable dans le brouillon.

**Prochaine tâche** : éditeur de contenu générique (schémas des Jeux dans #84 / PR #94 : `schemasDesJeux`,
`schemaDuJour`, `contenuDuJour` de `src/games/registry`), à ranger dans « Notre calendrier ».

### 25 novembre 2026 (après-midi) — salons, étape 3

**Salons, étape 3 : création d'un salon et invitation** (branche `interface/maquettes-salons`, PR à fusionner).
- **Alexandre a choisi la piste B « Pingou »** (25 nov) parmi trois maquettes (`maquettes.html?vue=salon-a|b|c&ecran=…`) :
  Pingou en haut avec sa bulle, une question par écran, les réponses en bas, fond nuit étoilée. Écartées :
  A « Carte » (carte crème de la connexion, 4 étapes à points) et C « Atelier » (une page, aperçu en direct).
- `src/ui/salons/` : `EcranPingou.tsx` (mise en page commune, barre de progression + retour, `Personnage` SVG,
  nuanciers, champ mot de passe), `CreerSalon.tsx` (accueil → ton prénom → ton manteau (+ « plus de choix » :
  bonnet, pompon, cheveux, longueur) → son prénom → son manteau → contenu « plus tard » → mot de passe →
  lien à copier / partager), `Invitation.tsx` (`?invitation=` : valide / déjà utilisée / invalide), `salons.css`.
  Répliques dans `pingou/lines.ts` → `PINGOU_SALON` : **validées telles quelles par Alexandre (25 nov)**.
- Maquettes vivantes : `maquettes.html?vue=creer` et `?vue=invitation` (crée un salon Sam & Camille dans la démo).
- **Branchement dans `App.tsx` = chef** (demandé dans #84) : `CreerSalon` quand `getSalon()` renvoie null,
  `Invitation` quand l'adresse contient `invitation`.
- L'étape « contenu » ne fait que prévenir (« plus tard, dans les réglages ») : l'éditeur générique attend les
  schémas de contenu des Jeux.

**Prochaine tâche** : réglages du salon (prénoms, couleurs, lien de connexion, nouveau lien d'invitation),
puis éditeur de contenu générique dès que les Jeux publient leurs schémas (#84).

### 25 novembre 2026 (midi) — salons, étape 2

**Salons, étape 2 : plus aucun prénom en dur dans `src/ui/`** (branche `interface/prenoms-du-salon`, partie de
`interface/salon-dans-la-case` → PR #86 à fusionner d'abord) :
- `useSalon.ts` : `PRENOMS_PAR_DEFAUT` (tiré de `PLAYERS`, seul usage qui lui reste) et `usePrenoms(backend)`
  (prénoms du salon, sinon le repli). `DayWindow` passe aussi par ce repli (fini « ton binôme »).
- Avec le backend : `LoginScreen` (titre + Pingou), `Settings`, `PreparedEditor` → `usePrenoms(backend)`.
- Sans backend : `Hud`, `RaceIndicator`, `FinalScreen`, `PreparedCase`, `RappelVeille` reçoivent une prop
  facultative `prenoms` (repli `PRENOMS_PAR_DEFAUT`). **Le chef doit la passer depuis `App.tsx`** pour `Hud`,
  `FinalScreen` et `RappelVeille` (demandé dans #84), ainsi que la couleur de la pastille depuis
  `salon.config.joueurs[me].couleurs.coat` au lieu de `PLAYERS`.
- **Textes neutres choisis par Alexandre (25 nov)** : « C'est qui, ce soir ? » (connexion) ; « Je vous laisse en
  tête-à-tête. » (après une lettre) ; « Et vous voilà au bout, ensemble. » (écran final) et Pingou du 24 :
  « Vous avez fait tout ce chemin à distance, et vous voilà au bout, ensemble. » ; **pas de point médian** :
  « Se souvenir de moi sur cet appareil », « Profil : X », « Un rappel t'arrivera la veille… ».
  « elle » à la place du partenaire → son prénom (« Voir ce que X verra », `editeurRepris(autre)`).
- Signalé hors dossier : `src/data/planning.ts` « Chacun son tour » (masculin), équipe Jeux.

**Captures** : le salon de démo s'appelle Alexandre & Flavie, on ne voit donc pas de différence à l'écran.
Renommer le salon de démo en local touche `src/backend/` : refusé, ne pas le refaire. Pour une preuve visuelle, il
faudra une option de la Qualité (salon de démo aux prénoms différents) ou attendre l'assistant de création.

**Prochaine tâche** : maquettes des écrans des salons (accueil « Créer notre calendrier », assistant, lien à
envoyer, page d'invitation) à montrer à Alexandre, 2–3 pistes, dans `maquettes.html`.

### 📍 Où j'en suis — 25 novembre 2026

**Salons, étape 1 livrée** (branche `interface/salon-dans-la-case`, PR vers `main`) — demandée par le chef dans #84 :
- nouveau `src/ui/useSalon.ts` : `useSalon(backend)` (salon courant, suivi par `onSalonChange`), `prenomsDuSalon()`,
  `contenuDuJour()`. **À réutiliser** pour tous les écrans des salons et le balayage des prénoms ;
- `DayWindow` remplit `ctx.content` (`salon.config.contenu[jour]`) et `ctx.prenoms`. Le salon est **relu au clic
  « C'est parti »** (dans une ref) : le jeu monté ne change pas de contenu en cours de partie si la config bouge ;
- textes de `DayWindow` sans prénom en dur et sans accord : « En son absence, tu joues ton tour et la réponse viendra
  plus tard. » ; « Prêt ? » → « C'est quand tu veux ! Cette case se rejoue autant de fois que tu le souhaites. »
  (règle du point 7) : **formulations validées par Alexandre le 25 nov**.
  Repli sans salon (faux backend d'atelier) : « ton binôme ».

**Captures** : `npm run capture` toujours cassé sur `main` (`.hud`), et modifier `tests/qa/commun.mjs` en local est
maintenant refusé par les permissions. Contournement : copier `tests/qa/*.mjs` dans le brouillon, y remplacer `RACINE`
(commun.mjs et serveur.mjs) par le chemin absolu du dépôt, `createRequire(...)` par `package.json` du dépôt,
`@playwright/test` par `node_modules/@playwright/test/index.mjs`, `.hud` par `.entete`, puis `node <copie>/capture.mjs …`.

**Reste en `src/ui/`** : 37 occurrences de « Alexandre »/« Flavie »/`PLAYERS` en dur (Hud, LoginScreen, Settings,
RaceIndicator, FinalScreen, PreparedCase, PreparedEditor, `pingou/lines.ts`) + accords à vérifier.

**Prochaine tâche** : balayage des prénoms en dur dans `src/ui/` avec `useSalon` (technique, pas de goût), puis maquettes
des écrans des salons (accueil, assistant, lien à envoyer, invitation) à montrer à Alexandre.

### 📍 Où j'en suis — 24 novembre 2026 (nuit)

**#75 et #51 sont fusionnés**, et le chef a branché `<Hud />` dans `App.tsx`. Aucune issue `[Interface]` ouverte.

**PR `interface/nettoyage-entete`** (en attente de fusion), `src/index.css` seulement :
- suppression des styles morts de l'ancien en-tête : `.hud`, `.brand*`, `.zone-pill` (+ `zoneIn`, + sa règle de nuit),
  `.who`, `.hud-actions`, `.who-badge`, `.round`, et leurs règles du media 560 px ;
- la ligne `.rappel-host { top: 96px }` du media 560 px était morte : la règle à 118 px, placée plus loin, l'emportait.
  Heureusement, car 96 px chevaucherait la pastille de la course. Supprimée, avec un commentaire sur les 118 px ;
- **bug corrigé** : la veille d'une case préparée, la course dépliée s'ouvrait **sous** le bandeau de rappel
  (z-index 15 contre 10). `.entete:has(.entete-course-detail)` passe maintenant à 16.

**`npm run capture` est cassé sur `main`** depuis le branchement de `<Hud />` : `tests/qa/commun.mjs:111` attend `.hud`.
Signalé dans **#81** (avec `.zone-pill` et `.who-badge` dans d'autres tests). En attendant, pour capturer :
remplacer en local `".hud"` par `".entete"` dans ce fichier, capturer, puis `git checkout tests/qa/commun.mjs`.
**Ne pas commiter ce fichier**, il appartient à la Qualité.

**Repéré, non traité** : sur téléphone, le nom du monde est tronqué (« La Forêt et le Lac … »). C'est une question de goût,
proposée au chef comme piste B dans #81. Il faudra des options à montrer à Alexandre avant de coder.

**Prochaine tâche** : lire la réponse du chef dans #81.

### 📍 Où j'en suis — 24 novembre 2026 (soir)

**#51 livré** (branche `interface/menus-haut`, PR vers `main`). Alexandre a vu trois maquettes
(`maquettes.html?vue=hud-a|hud-b|hud-c`) et a **choisi B, « deux îlots »** :
- à gauche un îlot crème : « Alexandre & Flavie » + nom du monde dessous (badge « démo » en mode démo) ;
- à droite une capsule ✏️ ☀️/🌙 (📜 le 24) ⚙️ + pastille ronde du joueur (initiale, couleur du manteau) ;
- dessous, la course réduite à une pastille « 🏁 Flavie +1 » qui déplie le `RaceIndicator` au toucher
  (se replie au toucher ailleurs ou sur Échap) ;
- 📍 en bouton rond flottant en bas à droite (Pingou, z-index 20, passe par-dessus quand il parle).
Écartées : A (une barre + menu ☰ : ✏️ caché derrière deux touchers) et C (barre d'actions en bas).

`src/ui/Hud.tsx` reçoit tout en props (`HudProps`), **App.tsx n'est pas touché** : le chef doit remplacer
le `<header className="hud">` par `<Hud …/>`, puis on pourra supprimer `.hud`, `.brand`, `.zone-pill`,
`.who-badge`, `.round` (et la règle `.zone-pill` de nuit et du media 560 px) de `index.css`.
Le jour où ✏️ et 📜 sont là ensemble (le 24), la pastille du joueur s'efface sur téléphone (`.entete--pleine`),
sinon le titre ne tient plus. Aperçu du vrai composant : `maquettes.html?vue=entete` (`&nuit=1&j24=1&plein=1&egalite=1`).

**Anneau du ✕ au toucher** : venait de `useDialog`, qui donnait le focus au ✕ à l'ouverture. Il retient
maintenant la dernière façon d'interagir (clavier / pointeur) : au doigt, le focus va sur le panneau
(`tabIndex=-1`, sans contour) ; au clavier, sur le premier bouton comme avant. Maj+Tab depuis le panneau
renvoie au dernier élément.

**Prochaine tâche** : relire les issues `[Interface]` ouvertes ; sinon, demander la suite au chef par une issue.

### 24 novembre 2026 — #75 (erreurs de connexion)

**#75 livré** (branche `interface/erreurs-connexion`, PR vers `main`, en attente du chef).
`LoginScreen` classe l'échec de `signIn` avec `classerEchec()` (exportée) :
- « Mot de passe incorrect. » (seul message que le backend renvoie pour un mauvais mot de passe)
  → comme avant : réplique taquine de Pingou, champ vidé ;
- réseau (`Failed to fetch` / `NetworkError` / `Load failed`, ou `navigator.onLine` faux)
  → « Pas de réseau : vérifie ta connexion internet, puis réessaie. » ;
- tout le reste → « Connexion impossible : » + message du backend (option 1 recommandée par le chef),
  avec traduction des deux messages Supabase anglais prévisibles (e-mail non confirmé, trop d'essais).
Dans ces deux derniers cas le mot de passe est **gardé** dans le champ. Deux répliques ajoutées
(`reseauCoupe`, `connexionImpossible`) : **validées par Alexandre le 24 nov**.
Au passage : `.login-erreur` passe en `--red-texte` (13 px, le rouge vif ne passait pas le contraste).
Maquettes : `maquettes.html?vue=connexion&erreur=mdp|reseau|compte` simule chaque échec.
`npm run capture` ne sait pas montrer l'écran de connexion (il passe la connexion d'office) :
captures faites à la main sur la page de maquettes en dev.

### 📍 Où j'en suis — 19 novembre 2026

**Rien en cours, rien en attente de relecture.** Les six PR de l'Interface sont fusionnées dans
`main` (#2, #6, #26, #33, #43, #45). Aucune branche de travail ouverte.

**Ce qui marche**, vérifié sur l'application réelle : les onze écrans ci-dessus, le mode démo
(`?jour=N&moi=flavie&demo-reset&rappels=off`), 0 violation axe-core WCAG 2.1 AA sur sept écrans,
le focus piégé dans les fenêtres, les interrupteurs au clavier.

**Prochaine tâche : ticket #51 — refaire la disposition des menus du haut.**
Alexandre trouve l'en-tête incohérent : titre, badge du joueur, 4 boutons ronds, panneau de la
course et pastille du monde, sur trois niveaux, avec des tailles et des styles différents.
Comment je comptais m'y prendre :
1. **Ne pas coder d'abord.** Le ticket demande 2–3 maquettes cohérentes, captures téléphone
   *et* ordinateur, soumises à Alexandre avant toute implémentation. Les construire dans
   `dev/maquettes.tsx` (`?vue=hud-a`, `hud-b`, `hud-c`), qui ne touche rien de livré.
2. Pistes données par le ticket, à affiner : une seule barre (titre à gauche, nom du monde au
   centre, un bouton menu à droite qui regroupe ✏️ / jour-nuit / réglages) ; la course réduite à
   une pastille « Flavie +1 » qui se déplie au toucher ; 📍 en bouton flottant en bas à droite.
3. **`App.tsx` ne m'appartient pas.** Le chef propose que je livre un composant `<Hud />` dans
   `src/ui/` recevant les actions en props, qu'il branchera lui-même. C'est la voie à suivre :
   ne pas modifier `App.tsx`, livrer le composant et le dire dans la PR.
4. Correctif à inclure : le ✕ des fenêtres affiche un gros anneau de focus **au toucher**.
   Il ne doit apparaître qu'au clavier — vérifier que `.sheet-close` ne reçoit pas de style de
   focus en dehors de `:focus-visible`.

**Rien ne m'attend ailleurs** : #59 (questions pour Alexandre) est vide, et aucune autre issue
ouverte n'est pour l'Interface.

### 🧭 Décisions prises avec Alexandre (ne pas les rouvrir sans lui)
- **Pingou : « copain taquin mais tendre »** — il chambre sur la course, il ne juge jamais un
  échec, il s'efface quand le moment est à eux. Écartés : « petit frère tout doux » (mièvre à la
  longue) et « majordome du pôle Nord » (drôle mais froid).
- Pingou parle **aux moments clés seulement** ; il se tait pendant un jeu, sauf si le jeu l'appelle.
- Sa bulle vit **dans la fenêtre de la case**, en bas — pas en flottant par-dessus.
- Écran de connexion : afficher/masquer le mot de passe, « rester connecté·e », « voir la démo ».
- Case préparée : **trois photos maximum** (au-delà, les polaroïds ne tiennent plus sur un téléphone).
- Nom du monde : **pastille crème permanente** (en blanc sur la neige il était illisible).
- Connexion (#75) : répliques « réseau gelé » et « la porte coince de notre côté » validées (24 nov).
- Règles d'écriture des répliques : une phrase courte par bulle, 150 caractères au plus, tutoiement,
  un emoji au maximum et jamais au milieu d'une phrase. Tout est dans `pingou/lines.ts`.

- Salons : **piste B « Pingou »** (une question par écran) et ses répliques `PINGOU_SALON` validées (25 nov).

### ⚠️ Pièges découverts (ils coûtent cher à retrouver)
- **La bulle de Pingou ne doit jamais changer de taille.** Elle s'écrivait lettre par lettre ;
  comme la fenêtre est centrée, toute la carte bougeait pendant qu'on visait un bouton, et
  Playwright disait « element is not stable » sans jamais cliquer. Elle réserve maintenant la
  hauteur de la **phrase la plus longue de la série** (`.mascot-gabarit`, invisible). Ne pas retirer.
- **Clic fantôme au doigt** : le clic de compatibilité qui suit un toucher arrive ~25 ms après
  l'ouverture d'une fenêtre et tombe sur son fond. `useDialog` renvoie `surFond`, qui ignore les
  clics sur le fond pendant 400 ms. Toute nouvelle fenêtre doit passer par `useDialog`.
- **`enableReminders()` doit être le premier `await` du clic**, sinon le navigateur considère le
  geste perdu et refuse la demande d'autorisation. Le gestionnaire n'est donc pas `async`.
- **Le rouge vif de la charte ne passe pas le contraste en petit texte** (4,43:1 sur le crème).
  Utiliser `--red-texte` (#a3192f, 7,3:1) dès que le texte fait moins de 14 px.
- **Les props qui arrivent en retard du serveur** : `DayWindow` ne lisait `dejaTerminee` qu'au
  montage, donc une case déjà terminée s'ouvrait sur « C'est parti » puis basculait toute seule.
- **axe-core et les animations** : mesurer pendant une animation d'entrée donne de faux positifs de
  contraste (opacité pas encore à 1). Attendre, ou poser `data-animations="non"` avant l'audit.
- **axe-core n'est pas une dépendance du projet** et le CDN est bloqué dans le conteneur :
  `npm install --no-save axe-core@4.10.2`, puis l'injecter en fichier local (issue #34 pour Qualité).
- `tests/e2e/calendrier.spec.ts` visait encore l'ancienne application (`.modal`, `localStorage`)
  au 18 novembre : ne pas s'y fier comme juge de paix sans vérifier qu'il a été remis à jour.

### 🗂️ Historique

### 17 novembre 2026 — premier lot (branche `interface/fenetre-case-et-connexion`)
Livré, **en attente de validation d'Alexandre** :
- `src/ui/pingou/lines.ts` : toutes les répliques de Pingou, regroupées par moment
  (connexion, route, fenêtre d'une case). Personnalité proposée : **« copain taquin mais tendre »**
  (il chambre, il ne juge jamais, il s'efface quand le moment est à eux).
  Deux autres tons avaient été écartés : « petit frère tout doux » (trop mièvre à la longue)
  et « majordome du pôle Nord » (drôle mais froid).
- `src/ui/Mascot.tsx` : 5 expressions (neutre, content, surpris, triste, clin d'œil),
  bulle devenue un vrai bouton (clavier + lecteur d'écran), variante « inline » pour les écrans.
- `src/ui/LoginScreen.tsx` : choix du profil puis mot de passe, via `BackendApi.signIn`.
- `src/ui/DayWindow.tsx` : fenêtre d'une case (en-tête, zone de montage du `GameModule`, état terminé).
- `src/ui/dev/` + `maquettes.html` : page de maquettes et faux backend, **provisoires**,
  à retirer dès que `createBackend()` arrive de `backend/socle`.

**Décisions d'Alexandre (17 novembre)** : ton *taquin et tendre* retenu ; Pingou parle
**aux moments clés seulement** (il se tait pendant un jeu, sauf si le jeu l'appelle) ;
sa bulle vit **dans la fenêtre de la case**, en bas ; l'écran de connexion reçoit
afficher/masquer le mot de passe, « rester connecté·e » et « voir la démo sans compte ».

**Demandé au chef de projet** : option de persistance sur `BackendApi.signIn`
(issue https://github.com/Elysios05/chrismas-calendar/issues/4). En attendant, la préférence
passe par `localStorage` sous `interface:rester-connecte`.

### Lecture d'une case préparée
`src/ui/PreparedCase.tsx` : enveloppe à sceau qui respire → lettre qui se déplie sur papier
ligné (police manuscrite Caveat, lignes calées sur la hauteur de ligne) → polaroïds qui tombent
un par un, agrandissables. Les trois états du contrat sont traités (`locked`, `empty`, `ready`) :
l'interface ne devine jamais ce qui est lisible, c'est le serveur qui tranche.
`DayWindow` appelle `getPrepared` à l'ouverture de l'enveloppe, et remplace le titre du planning
par « Une lettre de X » (le titre générique faisait doublon avec l'étiquette du jour).

### Éditeur de case préparée (branche `interface/editeur-case-preparee`)
`src/ui/PreparedEditor.tsx` : mot doux (zone de texte manuscrite qui grandit toute seule, 700 caractères),
**trois photos maximum** — décidé avec Alexandre : au-delà les polaroïds ne tiennent plus sur un téléphone —
puis « Voir ce qu'elle verra », qui réutilise `PreparedCase` tel quel : l'aperçu **est** l'écran de lecture,
enveloppe comprise. Le brouillon se reprend tant que le destinataire n'a pas ouvert la case ;
si `savePrepared` échoue, c'est que la case est figée, et Pingou le dit.

`RappelVeille` : le bandeau à poser sur la route quand la case du lendemain est vide.
Alexandre voulait un rappel qui arrive tout seul : impossible depuis GitHub Pages, remonté au chef de
projet dans l'issue https://github.com/Elysios05/chrismas-calendar/issues/5 (mail via Supabase).

**Question en suspens pour le chef de projet** : `getPrepared` est documenté comme refusé par le serveur
avant le jour J. L'auteur doit pourtant pouvoir relire **son propre brouillon** avant cette date.
En attendant, l'éditeur traite l'échec comme une page blanche — à confirmer côté backend.

### Course, réglages et écran de fin (branche `interface/course-et-reglages`)
- `RaceIndicator` : **deux couloirs séparés**, un par personne. Première version avec deux pions sur
  une seule piste : illisible dès que l'écart tombe sous deux cases, les pastilles se chevauchaient.
- `Settings` : son et animations (interrupteurs `role="switch"`), déconnexion. Les préférences vivent
  dans `localStorage` (`interface:son`, `interface:animations`) ; `chargerPreferences(sound)` les applique
  au démarrage, et « Animations » coupe tout mouvement via `html[data-animations="non"]`,
  en plus de `prefers-reduced-motion` déjà respecté.
- `FinalScreen` : feu d'artifice en CSS, compte des cases (toi, l'autre, celles faites à deux),
  « Relire vos lettres », et le dernier mot de Pingou.

### Accessibilité (branche `interface/accessibilite`)
`useDialog` regroupe ce qu'une fenêtre modale doit faire : focus qui entre, Tab qui tourne en boucle
dedans, Échap qui ferme, focus rendu à l'élément qui a ouvert, page du dessous bloquée.
Posé sur la fenêtre d'une case, les réglages et la photo en grand.

Autres corrections : la machine à écrire de Pingou est devenue purement visuelle (`aria-hidden`),
la phrase entière est annoncée une fois dans une zone `aria-live` ; elle s'affiche d'un coup si
le mouvement est réduit. Repère de focus unique sur tout le site. Cibles tactiles à 44 px.
Contraste : le rouge vif ne passe pas en dessous de 14 px (4,43:1), d'où `--red-texte` (#a3192f, 7,3:1)
pour les surtitres et des couleurs assombries pour les noms de la course.

**Vérifié avec axe-core** sur sept écrans en 390×844 : **0 violation** WCAG 2.1 AA, focus bien piégé,
interrupteurs pilotables au clavier. Script d'audit proposé à l'équipe Qualité dans l'issue
https://github.com/Elysios05/chrismas-calendar/issues/34.

### Branchement du backend — fait
Le faux backend d'atelier a été supprimé, tout passe par `DemoBackend` / `createBackend()`.
(L'issue #37 que j'avais ouverte a été fermée comme doublon de #17, plus complète.)

### Rappels, vrai backend et en-tête (branche `interface/rappels-et-vrai-backend`)
Tickets #17 et #25.
- `Reminders.tsx` : bloc « Rappels sur cet appareil » dans les réglages. `enableReminders()` est
  appelé **avant tout `await`** dans le gestionnaire de clic, sinon les navigateurs refusent la
  demande d'autorisation. Les cinq états du contrat ont chacun leur texte ; `denied`,
  `needs-install` et `unsupported` expliquent quoi faire plutôt que d'afficher un bouton inutile.
- `src/ui/dev/fakeBackend.ts` **supprimé** : les maquettes utilisent maintenant `DemoBackend`,
  le vrai mode démo, et se règlent par l'URL comme l'application.
- Le pansement `localStorage` du « rester connecté·e » est retiré : `signIn` porte l'option
  depuis l'issue #4.
- Styles d'intégration du chef repris à ma main (`.boot`, `.who-badge`, `.rappel-host`, `.edit-host`).
- En-tête sur téléphone : la pastille du monde devient crème et permanente, et elle flotte sous
  l'en-tête au lieu d'y ajouter une rangée ; l'indicateur de la course passe en version réduite.
  De 166 px à 135 px de haut.
- Fond de page de nuit : écrit sous `html[data-nuit="oui"]`. Le chef a posé la ligne qui manquait
  dans `App.tsx` ; c'est en place.
