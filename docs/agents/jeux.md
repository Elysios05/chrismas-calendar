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

## À faire (par priorité) — mis à jour par le chef le 24 nov
**🎯 Plan final (chef, 27 nov — validé par Alexandre)** : à finir **samedi 28 au soir**.
1. **PRIORITÉ ABSOLUE : contenu d'Alexandre & Flavie — ⚠️ CHANGEMENT (27 nov, décision d'Alexandre) : le dépôt est
   PUBLIC, leur contenu ne doit JAMAIS y être commité.**
   - Écris leur contenu dans **`prive/contenu-alexandre-flavie.json`** (dossier ignoré par git, vérifie avec `git status`) :
     un objet indexé par jour (`{ "1": …, "7": … }`) au format exact de `salon.config.contenu` (valide pour chaque `SCHEMA_…`).
     **Rien ne doit être perdu** : tout ce qui est perso dans `src/data/games/` aujourd'hui (questions, LJUBLJANA, souvenirs…).
   - Puis rends le contenu par défaut de chaque jeu **générique** dans `src/data/games/` (PR normale).
   - **Ne crée pas** `src/data/salons/alexandre-flavie.ts`. Dis à Alexandre d'envoyer le fichier JSON au chef (pièce jointe
     dans sa conversation) : le chef le charge directement dans leur salon Supabase.
2. ~~#129 cibles tactiles~~ (PR #131, fusionnée).
3. Le **jour 19 est confié à l'Interface**, le **jour 23 au Monde** : ne les fais pas.
4. Ensuite : corrections remontées par la Qualité ; fermer #56 et #109 quand la Qualité confirme.

**🆕 Contenu d'Alexandre & Flavie séparé du contenu générique (décision d'Alexandre, 25 nov — PRIORITÉ 1)** :
- Copier **tout** le contenu actuel de `src/data/games/` (questions, mots, rébus, LJUBLJANA, « à vous deux »…) dans
  `src/data/salons/alexandre-flavie.ts` : un objet `CONTENU_ALEXANDRE_FLAVIE` indexé par jour (`{ "1": …, "7": … }`),
  au format exact de `salon.config.contenu` (chaque entrée valide pour le `SCHEMA_…` du jour). **Rien ne doit être perdu.**
- Puis rendre le contenu par défaut de chaque jeu **générique** (n'importe quel couple, aucun nom de lieu ou souvenir à eux).
- Le chef s'occupe de mettre `CONTENU_ALEXANDRE_FLAVIE` dans leur vrai salon (Supabase) et dans le salon de démo.
- Chaque nouveau jeu : contenu générique par défaut + leur contenu perso dans ce même fichier.

Méthode : prends le **premier point non fait** de cette liste, une branche et une PR par point, `npm run build`,
`npm run capture`, PR vers `main` (le chef fusionne), Journal à jour. Questions de goût : 2–3 options avec captures
**avant** de coder. **On ne coupe rien** (décision d'Alexandre du 24 nov). Mise en ligne le 30 nov au soir.

**🆕 Salons (décision d'Alexandre du 25 nov, avant le 30)** — lire `docs/salons.md`. ✅ Fait pour les 10 jeux livrés
le 25 nov (branche `jeux/salons-contenu`) ; **chaque nouveau jeu** doit faire pareil (voir `src/games/README.md`). Dès que le chef annonce dans **#84** la fusion du contrat `SalonApi`, ce point passe **avant les nouveaux jeux** : chaque jeu (déjà livré, puis chaque nouveau) lit son contenu depuis le salon (sinon le défaut de `src/data/games/`) et exporte un schéma de contenu pour l'éditeur ; plus aucun prénom en dur. En attendant, continue la liste ci-dessous en écrivant déjà le contenu de chaque nouveau jeu comme un objet séparé et remplaçable.

Faits : 1, 2, 3, **5, 6** (PR #83 en attente de fusion), 7, 11, 15, 17. Restent 10, **dans l'ordre d'ouverture des cases** :
1. ~~Jour **3** (défi photo croisé)~~ — fait le 24 nov (PR #77, fusionnée)
2. ~~Jours **5** et **6** (en direct)~~ — faits le 24 nov, branche `jeux/direct-jours-5-6` (PR #83)
3. ~~Jour **9** (dessin à deviner)~~ — fait le 25 nov, branche `jeux/dessin-jour9`
4. ~~Jour **10** (score à battre)~~ — fait le 26 nov (PR #102, fusionnée)
5. ~~Jour **13** (en direct)~~ — fait le 26 nov (PR #107, fusionnée)
6. ~~Jour **14** (activité synchronisée)~~ — fait le 26 nov, branche `jeux/biscuits-jour14`
7. ~~Jour **18** (en direct)~~ — fait le 26 nov, branche `jeux/boules-neige-jour18`
8. Jour **19** (défi photo)
9. ~~Jour 21~~ → **confié à l'équipe Monde** (26 nov, #29)
10. ~~Jour 22~~ → **confié à l'équipe Monde** (26 nov, #29)
11. Jour **23** (activité synchronisée)
Les règles de chaque jeu sont dans `src/data/planning.ts` et `docs/cahier-des-charges.md`.

## Questions à poser à Alexandre
Règles et difficulté de chaque jeu, contenu à mettre (souvenirs, private jokes), durée des parties.

## Parler au chef de projet
**Par une issue GitHub, jamais autrement.** Tout ce qui sort de `src/games/` et `src/data/` passe par là :
contrat à changer, fichier d'une autre équipe à modifier, arbitrage, priorités. Le chef répond dans l'issue,
dit qui fait quoi et confie les fichiers par écrit ; la suite se discute en commentaires sous la même issue.
Avant de poser une question, relire les issues ouvertes (y compris celles des autres équipes : les réponses
du chef y annoncent souvent des changements de contrat qui nous concernent).

## Journal

### 26 novembre 2026 — issue #129, petites cibles tactiles sur téléphone (branche `jeux/cibles-tactiles-129`)

**Décision technique prise seul :** on ne change **pas le dessin** (pas de goût en jeu), on élargit seulement ce
que le doigt peut toucher.
- **Pendu (15) et clavier des mots croisés (17)** : `.pendu-touche::after` déborde jusqu'au milieu des écarts →
  plus de toucher « dans le vide » entre deux touches (zone ≈ 34×48 px au lieu de 29×42). Mesuré : 99 % des points
  du clavier tombent sur une touche.
- **Mots croisés (17)** : `.mc-case::after` couvre la moitié de l'écart, et `toucherGrille()` (clic sur la grille
  hors d'une case) choisit la **case blanche la plus proche** à moins d'un pas de grille. Mesuré : 175 touchers sur
  192, faits à 0,7 case du centre, choisissent la bonne case voisine (avant : quasi aucun).
- **Sapin (21)** : pastille toujours dessinée à 30 px, zone tactile ≈ 35×44 px (déborde sur les écarts et la marge
  du bas ; pas vers le haut pour ne pas voler la rangée des décos).
- Rien touché à `.jeu-boite` (demande de l'Interface dans #129).

**Vérifié :** `npm run build` OK ; touchers simulés Playwright en 390×844 (atelier, 0 erreur) ;
`npm run capture -- --jour=17 --case=17` et `--jour=21 --case=21` (mobile) : 0 erreur console.

**Prochaine étape :** jour 19 (défi photo croisé « ta déco de Noël ») : reprendre le jour 3. Demander d'abord ses
règles à Alexandre.

### 26 novembre 2026 — jour 18, bataille de boules de neige : le duel des forts (branche `jeux/boules-neige-jour18`)

**Décidé avec Alexandre :** « duel des forts » (parmi 3 options : duel des forts / coop contre les lutins / duel aux
cibles). Vu de côté, chacun derrière son fort au pied de la cascade gelée ; **lance-pierre** (glisser le doigt vers
l'arrière, lâcher ; début de trajectoire en pointillés dorés) ; **« Se baisser »** maintenu (ou Espace / ↓) ;
boule sur l'autre = +1 ; boule sur un fort = une rangée de neige en moins (3 rangées) ; baissé, le fort se refait
(1 rangée / 2 s) ; 3 manches de 45 s, vent 0 → moyen → fort. Absent : 20 s puis **fantôme** (ses tirs et sa posture
rejoués) s'il a joué la manche ; sinon un **lutin d'entraînement** te bombarde (ses boules ne comptent pas) et ton
score reste **provisoire** : il est recalculé quand l'autre joue contre ton fantôme.

**Décisions techniques prises seul :**
- `boules/regles.ts` = la bataille sans affichage, en pas fixes de 10 ms (que des + et ×) ; le vent de chaque boule
  est **enregistré avec le tir** (pas de `Math.sin` recalculé chez l'autre) → même résultat sur les deux appareils.
- Coup `manche:<qui>:<m>` = `{ tirs: {t,v,a,w}[], trace }` (posture tous les 100 ms, 1 = baissé). Score d'une manche
  = `decompter()` des deux coups ; une seule partie jouée → contre `PERSONNE(m)` (debout, sans tirer).
- **Baissé, on se plaque contre son fort** (`X_BAISSE`) : sinon les cloches retombaient sur un joueur caché
  (balayage : 45 touches sur 918 tirs → 11 sur 837). Lutin : vitesse calculée puis ±14 % (≈ 1 tir sur 2 touche).
- Terrain 640 unités (Alexandre 70, Flavie 570), **vue en miroir pour Flavie** : chacun se voit à gauche.
- En direct : `emit("tir")` et `emit("pose")` ; l'aperçu à l'écran peut différer d'un poil, le score qui compte
  vient des coups déposés.
- `ctx.say([])` au début de chaque manche : la bulle de Pingou cachait le bouton « Se baisser ».
- Classes `duel-*` du jour 6 : `friandises.css` est **importé** par le jour 18 (piège du jour 13).
- Pas de schéma de salon (jeu d'adresse). Réglages : `src/data/games/boules-jour18.ts`.

**Vérifié :** `npm run build` OK ; `npm run capture -- --jour=18 --case=18` (la case s'ouvre, 0 erreur) ; atelier
`jeux.html?jour=18` joué par Playwright en 390×844 et 1280×800 (visée, vol, baissé, fin de manche, 0 erreur) ;
**à deux onglets en direct** : Flavie se voit à gauche, même score des deux côtés (4–0), 0 erreur.

**Prochaine étape :** jour 19 (défi photo croisé « ta déco de Noël ») : reprendre le jour 3. Demander d'abord ses
règles à Alexandre.

### 26 novembre 2026 — issue #109 (suite), la vraie cause de `reading 'clear'` (branche `jeux/clear-jour10-109`)

**Cause trouvée :** `app.destroy(true, …)` passe `true` au moteur de rendu, et PixiJS 8 comprend « libère aussi les
ressources **globales** » (`GlobalResourceRegistry.release()`). La réserve globale des lots de dessin (`Batcher`) garde
des références vers des lots **encore utilisés par la carte** : ils sont détruits (`textures = null`), et la carte
plante à l'image suivante (`DefaultBatcher.break` → `textures.clear()`). Le report de la destruction (#112) ne pouvait
donc rien y changer. Visible surtout en rendu Canvas.

**Correctif :** `detruireApplication(app)` dans `src/games/shared/scene.ts` = `app.destroy({ removeView: true }, { children: true })`.
Tous les jeux d'adresse (luge, friandises, flocons, tri-cadeaux, sapin) en profitent. **Règle : ne jamais écrire
`app.destroy(true…)` pour une application PixiJS tant qu'une autre vit dans la page.**

**Vérifié :** reproduction Playwright du jour 10 jouée jusqu'à la fin, WebGL coupé (`--disable-3d-apis`, rendu Canvas,
~1 min) : `main` → 1 erreur (la pile de la Qualité), branche → 0 erreur, 3 passages. `npm run build` OK,
`npm run capture -- --jour=10 --case=10` : 0 erreur.

**Signalé au chef (#109) :** `src/App.tsx` l. 148 et 158 fait aussi `app.destroy(true…)` pour la carte (même piège).

### 26 novembre 2026 — jour 14, biscuits chacun chez soi (branche `jeux/biscuits-jour14`)

**Décisions prises avec Alexandre :** « cuisine à deux + photo ». Chacun choisit **sa** recette : Alexandre n'a
pas de four, donc une recette **avec four pour Flavie** (sablés de Noël) et **sans four pour lui** (truffes au
chocolat ; recettes choisies par moi, remplaçables dans le salon). On cuisine étape par étape en voyant où en est
l'autre et ses minuteurs ; photo de la fournée à la fin, celle de l'autre se découvre après avoir posté la sienne,
Pingou décerne un titre à chacun. **Absent :** chacun son tour (même journal, lu plus tard).

**Décisions techniques prises seul :**
- Journal de coups (`shared/partie.ts`) : `depart:<qui>`, `etape:<qui>:<i>`, `minuteur:<qui>:<i>` (heure de fin),
  `photo:<qui>`. Un rechargement reprend à la bonne étape avec le minuteur en cours.
- Si l'autre est en ligne et n'a pas commencé : écran « Top départ » (`live.setReady`, 3-2-1), ou « Commencer sans attendre ».
- Minuteur = étape finissant par « [30 min] » (pas de liste imbriquée pour l'éditeur). Il sonne chez les deux
  (son + Pingou), sauf s'il avait fini avant l'ouverture.
- Titres : deux différents, tirés d'après les heures des deux photos → identiques des deux côtés.
- `Polaroid` est maintenant exporté de `photo/index.tsx` (réutilisé).
- Schéma `SCHEMA_BISCUITS_JOUR14` (intro, recettes, titres, idées de légende), `facultatif: true`.
  Salon A & F : seulement la phrase d'accueil (« Flavie au four, Alexandre au frigo… »).

**Vérifié :** à deux onglets (choix, top départ, minuteurs vus des deux côtés, photos, titres), seul, rechargement
en pleine cuisine, 390×844 et 1280×800, `npm run capture -- --jour=14 --case=14` (case ouverte, 0 erreur).

**Reste / à signaler :** le titre de la case dans `planning.ts` dit encore « Même recette de biscuits » alors que
les recettes diffèrent (fichier du chef : signalé dans la PR).

**Prochaine étape :** jour 18 (bataille de boules de neige, en direct). Demander d'abord ses règles à Alexandre.

### 26 novembre 2026 — issue #109, fin de partie du jour 10 (branche `jeux/flocons-fin-109`)

**Ce qui change :** `src/games/shared/scene.ts` (socle des jeux d'adresse : luge 2, friandises 6, flocons 10).
Si `detruire()` est appelé **pendant une image** (fin de partie déclenchée depuis `surImage`), on arrête le
ticker et on détruit l'application juste après (`setTimeout 0`) au lieu de la détruire au milieu de l'image.
Les rappels sont parcourus sur une copie et s'arrêtent dès que la scène est détruite ; `detruire()` est idempotent.

**Non reproduit ici :** ni dans l'atelier (WebGL, Canvas forcé, ticker avancé à la main façon `avancerCamera`),
ni avant ni après la correction → la correction est **défensive**. Piste signalée dans #109 : le crochet
`__PIXI_APP_INIT__` des tests garde la **dernière** application créée dans `__qaApp`, donc celle du jeu une fois
la partie lancée ; tout appel de rendu sur `__qaApp` après la fin de partie vise une application détruite.
Demandé à la Qualité de relancer son parcours du jour 10 sans la tolérance.

**Prochaine étape :** jour 14 (biscuits + minuteur partagé, synchronisé). Demander d'abord ses règles à Alexandre.

### 26 novembre 2026 — jour 13, bonhomme de neige à deux (branche `jeux/bonhomme-jour13`)

**Décisions prises avec Alexandre :** deux phases. 1) **Rouler** (adresse, 30 s) : chacun roule sa boule
au doigt — place 2 le corps, place 1 la tête ; Pingou note l'empilement (taille, tailles assorties, boules rondes).
2) **Décorer à deux** le même bonhomme, en direct (on voit les objets de l'autre arriver). Fin : le bonhomme en
souvenir (image PNG à enregistrer) + un **score commun** sur 1 000.
**Absent :** 20 s d'attente puis **chacun sa moitié** : on roule sa boule et on décore ; l'autre trouve le
bonhomme commencé (sa boule en pointillés « ? ») et le termine.

**Décisions techniques prises seul :**
- Rouler = vue de dessus de la place du marché en **Canvas 2D** (une texture de neige qu'on gomme, les pavés
  réapparaissent) : Pixi n'apportait rien ici. Neige comptée en part du champ → mêmes tailles sur téléphone et
  ordinateur (vérifié : balayage parfait ≈ 60 cm des deux côtés, plafond 62).
- **Rondeur** = neige ramassée par direction (4 axes) : en ligne droite la boule devient un boudin (dessinée
  aplatie, Pingou prévient), en tournant elle reste ronde.
- La tête voit un **cercle pointillé** = 2/3 du corps (en direct, la taille du corps arrive en continu) ; le corps
  ne vise une taille que si la tête est déjà finie (différé).
- Objets posés **relatifs à leur boule** (`sur`, `u`, `v` en rayons) : en différé, la déco faite sur la boule
  « ? » suit la vraie boule quand elle arrive. 14 objets par personne, on reprend les siens pour les déplacer,
  lâchés hors de la scène = enlevés. Brouillon gardé dans `brouillon:<qui>` (survit à un rechargement).
- Points : taille 150 (corps, plein à 48 cm) + assortiment 200 (tête/corps ≈ 0,66) + rondeur 150 + 7 éléments
  vérifiés **à leur place** × 60 (yeux, nez, sourire, couvre-chef, écharpe, boutons, bras) + 80 si décoré à deux.
- Coups `boule:<qui>` et `deco:<qui>` ; en direct, `taille` et `deco` passent par `live.emit`.
- Pas de schéma de salon (jeu d'adresse). Réglages et objets : `src/data/games/bonhomme-jour13.ts`.

**Vérifié :** à deux onglets en direct (salon, départ commun, tailles en direct, déco vue des deux côtés, score
commun identique), en différé (Alexandre seul → rechargement en pleine déco → Flavie termine plus tard), 390×844 et
1280×800, `npm run capture -- --jour=14 --case=13` (la case s'ouvre), aucune erreur console.
Défauts vus et corrigés : neige en damier, boule trop petite sur téléphone, « C'est bon ! » caché par la bulle de
Pingou (monté dans la barre), décompte blanc sur neige blanche, classes CSS empruntées au jour 6 (non chargées).

**Prochaine étape :** jour 14 (biscuits + minuteur partagé, synchronisé). Demander d'abord ses règles à Alexandre.

### 26 novembre 2026 — jour 10, attrape-flocons dans la tempête (branche `jeux/flocons-jour10`)

**Décisions prises avec Alexandre :** Pingou glisse sur le lac gelé avec un **panier** au-dessus de la tête
(doigt ou flèches) ; **les quatre difficultés** : glaçons à éviter (une vie chacun), rafales annoncées par
Pingou (« Rafale ! → »), flocons dorés rares (80 points, ils tombent plus vite), tempête qui monte (cadence,
vitesse, part de glaçons, neige et brume) ; fin à **90 s ou 3 vies**, au premier des deux.

**Décisions techniques prises seul :** tout ce qui tombe est tiré d'avance depuis la graine, donc les deux joueurs
ont la même tempête. Le terrain fait au plus 0,8 × la hauteur de large, et les vitesses sont exprimées en hauteurs
ou en largeurs d'écran : ordinateur et téléphone ont la même difficulté. Série : ×0,1 par flocon d'affilée (plafond
×3). Un flocon perdu casse la série, mais pas un doré. Bonus de 150 par vie restante si on tient les 90 s.
Pas de schéma de salon (jeu d'adresse, comme 2 et 6) : `ctx.content` est ignoré. Réglages dans
`src/data/games/flocons-jour10.ts`.

**Vérifié :** build, capture `--jour=12 --case=10` sur ordinateur (la fenêtre de la case s'ouvre bien ; sur téléphone et au jour 10, la capture ne touche pas le cadeau : issue #101 pour la Qualité), partie en cours dans l'atelier (390×844 et 1280×800), aucune
erreur console. Défauts vus et corrigés : barre du haut qui débordait sur téléphone (titre raccourci en
« Jour 10 · Flocons »), terrain trop étroit sur ordinateur, bandes visibles dans le ciel.

**Prochaine étape :** jour 13 (bonhomme à deux, en direct sur `joinLive`, #56). Demander d'abord ses règles à Alexandre.

### 25 novembre 2026 — salons : contenu et prénoms du salon (branche `jeux/salons-contenu`, #84)

**Fait :** `src/games/shared/contenu.ts` = `prenomsDe(ctx)` (repli neutre « Joueur 1/2 », jamais vu en vrai),
`de(prenom)`, type `SchemaContenu`/`ChampContenu` (JSON pur : texte, nombre, case, choix, textes, liste d'objets avec
`modele`) et `lireContenu()` (fusion champ par champ + vérification, ids fabriqués si absents, `reparer` par jeu).
Les 10 jeux livrés lisent le salon ; schémas exportés depuis chaque fichier `src/data/games/*.ts` (`SCHEMA_…`),
registre : `schemaDuJour`, `schemasDesJeux` (jours 2 et 6 : pas de schéma). `FenetreJeu` accepte `prenoms`.
Textes neutres (#84 point 7) : « a quitté la partie », « On y va ! », « Jouer en solo », « Aucun des deux »,
« Sam n'est pas là », « ouvre le bal »… Atelier : boutons Salon défaut / perso (Camille et Sam) / abîmé,
`?jour=` et `?salon=` dans l'URL. Vérifié : 10 jeux × 3 salons sans erreur, synchro « Qui ? » propose les prénoms.
⚠️ `npm run capture` toujours cassé (#87).

**Décidé avec Alexandre (25 nov) : option A.** Leur contenu personnel (Ljubljana, train de nuit, décalage…) est
copié tel quel dans `src/data/salons/alexandre-flavie.ts` (`CONTENU_ALEXANDRE_FLAVIE`, une entrée par jour, champs
du schéma seulement, vérifié : rien n'est écarté par `lireContenu`). Le **défaut** de `src/data/games/` est devenu
générique (mots « à deux » valables pour tout couple, plus d'allusions à la distance). Atelier : salon « A & F ».
Reste à brancher ce contenu dans leur vrai salon et dans le salon démo : demandé au chef dans #84 (Backend/Interface).
Forme du schéma annoncée dans #84 (PR #94).

**Prochaine étape :** jour 10 (attrape-flocons, score à battre, PixiJS) — demander ses règles à Alexandre, et le
faire directement « salon » (schéma si quelque chose se personnalise).

### 25 novembre 2026 — jour 9, dessin à deviner (branche `jeux/dessin-jour9`)

**Décidé avec Alexandre :** « souvenirs dessinés » (pas un 2e Pictionary) : **3 dessins chacun, sans chrono**.
Pour chacun : un thème au choix (pas deux fois le même), on dessine SON souvenir, puis on écrit la réponse,
des variantes acceptées et un petit mot révélé après. On devine ceux de l'autre **après avoir fini les siens** :
le dessin se refait trait par trait, le thème sert d'indice, réponse tapée (correction tolérante).
Galerie des 6 dessins à la fin. Contenu : `src/data/games/dessin-jour9.ts` (6 thèmes d'exemple).

**Décisions techniques prises seul :** 3 essais (3/2/1 point), « Langue au chat », « C'était presque ça » = 1 point
sur l'honneur (un souvenir n'a pas de réponse unique) ; correction plus large qu'au rébus (« une pizza margherita »
trouve « la pizza ») ; rejeu sans les pauses > 0,4 s et au plus 20 s ; bouton « annuler le dernier trait ».
Réutilise `pictionary/dessin.ts`, `Tableau.tsx` et les styles du Pictionary et du défi photo.
Coups : `dessin:<qui>:<k>`, `devine:<qui>:<k>`. Démo : 3 dessins d'exemple tracés par le code
(`dessin/exemple.ts`) tant que l'autre n'a rien dessiné ; les devinettes contre eux ne sont pas enregistrées.

**Vérifié dans l'atelier** (390×844 et 1280×800) : Alexandre dessine 3 fois et devine les exemples, puis Flavie
dessine, devine pour de vrai, et Alexandre retrouve « Flavie a trouvé » et les 3 vrais dessins à deviner. 0 erreur console.
⚠️ `npm run capture` est cassé sur `main` (« Carte non atteinte », même sans mes changements) → issue #87 pour la Qualité.

**Prochaine étape :** jour 10 (attrape-flocons dans la tempête, score à battre, PixiJS). Demander d'abord ses
règles à Alexandre. Surveiller #84 (contrat `SalonApi`, PR #85) : quand il est fusionné, ce point passe avant.

### 24 novembre 2026 — jours 5 et 6, jeux en direct (branche `jeux/direct-jours-5-6`)

**Socle (#56) :** `shared/partie.ts` passe maintenant par `joinLive` (présence par « hello », prêt,
départ synchronisé, horloge commune) au lieu de `joinRoom`. Le journal de coups reste par-dessus,
et la salle est exposée en `partie.live` (`setReady`, `onReady`, `onStart`, `now`/`toLocal`,
`emit`/`on`, `setState`). `ouvrirPartie(ctx, { cle, compteARebours })` (une chaîne seule = la clé,
comme avant). Le jour 11 n'a pas changé d'une ligne.
⚠️ `LiveGame` garde `startAt` en mémoire : un départ « repris » (`resumed: true`) vient d'une
ancienne séance et bloque tout nouveau départ → le jour 6 appelle `live.reset()` en arrivant au salon.

**Jour 5 — Pictionary (décidé avec Alexandre) :** 6 manches de 60 s (3 dessins chacun, Flavie
commence) ; celui qui dessine choisit entre un mot de Noël et un mot « à vous deux » (15 s, sinon
le mot de Noël) ; l'autre tape (correction tolérante du rébus) ; trouvé en t s → devineur
100 + 2×(60−t), dessinateur 50 + (60−t). 8 couleurs, 3 épaisseurs, gomme, « Tout effacer ».
Absent : 20 s d'attente puis différé — le dessin est enregistré **horodaté** (`dessin.ts`) et
rejoué au même rythme chez l'autre, qui devine plus tard puis dessine à son tour. Fin : galerie
des 6 dessins (un vrai souvenir). Contenu : `src/data/games/pictionary-jour5.ts`.
Technique : coups `dessin:<qui>:<k>` et `devine:<qui>:<k>` ; en direct, le dessinateur fixe la
manche dans l'état `live` (`{r, debut, mot, rejeu}`), les traits passent par `emit("trait")`
toutes les 80 ms et le dessin complet est déposé à la fin. Si l'autre part, mon dessin ou un rejeu
continuent seuls ; un dessin en direct de l'autre s'arrête (il sera rejoué plus tard).

**Jour 6 — duel des friandises (décidé avec Alexandre) :** même écran, même pluie (graine),
on se dispute les friandises ; charbon −1 et hotte ralentie 1,5 s ; **étoile dorée +5 chacun
seulement si les deux hottes la touchent** ; 3 manches de 45 s. Absent : 20 s puis on joue contre
le **fantôme** de l'autre (sa hotte rejouée) s'il a joué la manche, sinon on pose un score.
Décompte unique (`pluie.ts`) : la première hotte qui touche garde la friandise ; l'instant de
prise est l'heure exacte du passage de la ligne + écart au centre (départage équitable).
Coups `manche:<qui>:<m>` (prises + trace de la hotte à 10 Hz). En direct, les manches que
personne n'a jouées s'enchaînent sur l'horloge commune (45 s + 6 s de pause).
Contenu : `src/data/games/friandises-jour6.ts`.

**Vérifié :** à deux onglets (direct, 3 manches du duel avec le même score des deux côtés) et en différé (rejeu, fantôme), jour 11 non cassé, aucune erreur console. PR #83 (brouillon).
Défaut trouvé puis corrigé : en fin de direct, Pingou annonçait « score posé » avant que la dernière manche de l'autre arrive → on l'attend 4 s.

**Prochaine étape :** jour 9 (dessin à deviner, différé) — il pourra reprendre `pictionary/dessin.ts`
et `Tableau.tsx` tels quels. Demander d'abord ses règles à Alexandre.
### 24 novembre 2026 — jour 3, défi photo croisé (branche `jeux/defi-photo-jour3`)

**Décisions prises avec Alexandre :**
- On ne voit la photo de l'autre **qu'après avoir posté la sienne** ; si l'autre n'a rien posté, écran
  d'attente (relecture toutes les 15 s, Pingou prévient quand elle arrive).
- **Légende + devinette** : l'auteur choisit 1 question parmi 5 (réponse invisible sur la photo :
  moment, bruit, température, boisson, ce qu'il préfère) et donne sa vraie réponse ; l'autre la devine
  en découvrant la photo (photo « face cachée », on touche pour la retourner).
- Photo **modifiable tant que l'autre ne l'a pas découverte**, figée ensuite (`vu:<qui>`).

**Fait :** `src/games/photo/` (jeu générique `creerDefiPhoto`, **réutilisable tel quel pour le jour 19**
avec un fichier de contenu `photo-jour19.ts`), contenu `src/data/games/photo-jour3.ts`, registre.
Clés : `photo:<qui>`, `vu:<qui>`, `devine:<qui>`. Prise de vue : bouton appareil photo
(`capture="environment"`) + galerie ; compression faite par `backend.uploadPhoto`.
Mode démo : si l'autre n'a rien posté, une vue de fenêtre **dessinée au canevas** (`exemple.ts`) sert
de photo de l'autre ; la devinette faite contre cet exemple **n'est pas enregistrée** (sinon elle
serait comparée plus tard à la vraie question de l'autre — défaut trouvé en test, corrigé).
Vérifié à deux joueurs dans l'atelier (téléphone + ordinateur), et `npm run capture -- --jour=3 --case=3` :
0 erreur console.

**Prochaine étape :** jours 5 et 6 (en direct, d'abord poser `partie.ts` sur `joinLive`, voir #56),
en demandant d'abord leurs règles à Alexandre.

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
