# Équipe Monde & design (PixiJS)

**Mission** : le monde isométrique que l'on parcourt — beau, vivant, fluide sur téléphone.
**Dossier** : `src/world/` uniquement.

## Existant
- `iso.ts` projection 2:1, primitives ; `terrain.ts` route + relief en facettes (sommets `V`, pics, lac) ;
  `props.ts` décors vectoriels ; `zones.ts` les 6 mondes (couleurs, météo, ambiance) ; `actors.ts` personnages + Pingou ;
  `Scene.ts` rendu, caméra liée au défilement, brouillard, nuages, neige, mode nuit.

## À faire (par priorité) — mis à jour par le chef le 24 nov
**🆕 Renfort Jeux (choix d'Alexandre du 26 nov, #29)** : le chef te confie par écrit, en plus de `src/world/` :
1. ~~**Jour 22**~~ fait le 26 nov (branche `monde/jeu-22`). « Tri des cadeaux » (score à battre, PixiJS) → `src/games/tri-cadeaux/` + son contenu dans `src/data/games/`
   (contenu **générique** par défaut + schéma ; s'il y a du contenu propre à Alexandre & Flavie, il va dans
   `src/data/salons/alexandre-flavie.ts`, géré par l'équipe Jeux : demande-lui par #84).
2. ~~**Jour 21**~~ fait le 26 nov (branche `monde/jeu-21`). « Décorer le sapin à deux » (en direct, `joinLive`, voir #56) → `src/games/sapin/`.
3. Les lignes de ces deux jours dans `src/games/registry.ts` (conflit d'une ligne possible avec les Jeux : garder les deux).
Règles : `src/games/README.md`, `ctx.prenoms`, aucun accord de genre, règles validées par Alexandre avant de coder.

Méthode : prends le **premier point non fait** de cette liste, une branche et une PR par point, `npm run build`,
`npm run capture`, PR vers `main` (le chef fusionne), Journal à jour. Questions de goût : 2–3 options avec captures
**avant** de coder. **On ne coupe rien** (décision d'Alexandre du 24 nov). Mise en ligne le 30 nov au soir.

**🆕 Salons (décision d'Alexandre du 25 nov, avant le 30)** — lire `docs/salons.md`. Dès que le chef annonce dans **#84** la fusion du contrat `SalonApi`, ce point passe **en tête** : prénoms et couleurs des personnages, de Pingou et des panneaux viennent de la config du salon (`PLAYERS` = valeurs par défaut). En attendant, continue la liste.

1. ~~**#11** et **#42**~~ : faits le 24 nov (télésiège, lutin au chariot, emballeurs) — PR #80, issues commentées.
2. ~~**#23**~~ : fait le 25 nov (bascule jour/nuit reconstruite en arrière-plan) — PR à fusionner.
3. ~~**#14**~~ : fait le 25 nov (monde dessiné par lots autour de l'écran) — PR à fusionner.
4. **#12** : courte présentation à l'arrivée dans un nouveau monde.
5. **#10** : neige au gyroscope, lumière des maisons, halo sur le joueur.
6. ~~**#61**~~ : fait le 26 nov (`scene.snapshotAround(day, w, h)`) — à brancher par le chef et le Backend.

## Questions à poser à Alexandre
Style des montagnes, palette de chaque monde, densité du décor, look de Pingou et des personnages, animation d'ouverture.

## Journal
- 17 nov : terrain continu retenu ; Alexandre veut « de vraies montagnes en pointe, des falaises, une neige plus lisse ».
- 17 nov — direction artistique des montagnes (tâche 1), validée avec Alexandre sur captures :
  - **crêtes** : arêtes nettes et pics élancés (chaînes de sommets reliés, pas de cônes isolés) ;
  - **limite neige / roche** : franche et guidée par la pente, avec un liseré de poudreuse sur l'arête — plus de taches au hasard ;
  - **palette** : roche bleu-gris froid (`0x6e789a`), ombres violettes, neige très peu modelée pour rester lisse ;
  - **sapins** : 3 essences (épicéa, sapin, jeune pousse), 4 verts, neige variable ; au-dessus d'une certaine
    altitude les sapins cèdent la place aux rochers.
  - Rochers redessinés en blocs facettés coiffés de neige (`boulder()` dans `iso.ts`).
  - Reste à faire : liseré blanc dessiné sur l'arête elle-même, et reprise des autres mondes avec la même méthode.
- 17 nov — architecture par monde et bâtiments assis dans le relief, demandé par Alexandre :
  - **ancrage** : terrasse plate taillée dans la pente sous l'emprise du bâtiment (jamais sous la route),
    puis soubassement de pierre appareillée qui comble la marche restante côté aval (`drop` sur `PlacedProp`) ;
  - **architecture** : chalet à balcon de bois et rondins (montagnes), maison à colombages et pignon à redans
    (Saint-Nicolas et pôle Nord), cabane de bois avec appentis et tas de bûches (forêt et lac, grotte),
    maison étroite et haute à auvent rayé (marché). Les échoppes et l'atelier reçoivent aussi un soubassement.
  - Carrure (largeur, profondeur, hauteur, pente du toit) tirée au sort par maison : deux voisines diffèrent.
  - Quelques cabanes de bois ajoutées au bord du lac, qui n'avait aucune construction.
- 17 nov — densité et différence entre les mondes, demandées par Alexandre (« que ce soit beaucoup plus beau ») :
  - **village** : rangées de maisons serrées des deux côtés de la rue (trois bandes de densité dégressive),
    lampadaires réguliers, et une **place centrale** dégagée autour de la case du 6, avec sapin décoré,
    bonhomme de neige, lampadaires et badauds ;
  - **marché** : deux allées d'échoppes côte à côte, guirlandes lumineuses tendues au-dessus de la rue,
    brasiers et visiteurs. Premier essai trop serré (murs d'échoppes qui se chevauchaient) : échoppe
    rétrécie à 0,98 case de large et densité ramenée à 0,72 pour qu'elles se touchent sans se superposer ;
  - **forêt** : densité pilotée par un bruit basse fréquence (clairières), décroissante loin de la route,
    avec buissons enneigés ; chaque élément naturel est décalé au hasard pour casser l'effet plantation ;
  - **lac** : bleu glacier franc (`ice` sur la zone), plaques larges et bord givré.
  - Nouveaux décors : `bush`, `visitor`, `brazier`, `garland`.
  - Mesure : 10–11 i/s avant densification, 9–11 i/s après, sur ce conteneur sans carte graphique. Le plancher
    vient du rendu logiciel, pas du nombre de décors — mais il faudra mesurer sur un vrai téléphone (tâche 6).
- 18 nov — rues pavées, village chaleureux et marché vivant, demandés par Alexandre :
  - **pavés** : nouveau drapeau `paved` sur la zone ; au village et au marché la chaussée devient un fond de
    mortier clair couvert de pavés gris chauds légèrement différents, sans bande centrale, avec un liseré de
    neige tassée au bord ;
  - **chaleur du village** : une maison sur deux a ses fenêtres allumées même de jour, couronne de houx sur la
    porte, fumée qui monte de la cheminée, guirlandes tendues au-dessus de la chaussée, bancs, luges et badauds ;
  - **marché** : trois modèles d'échoppe (auvent rayé, chalet de vin chaud à toit enneigé qui fume, stand ouvert
    habillé de sapinage et de lanternes), et la **grande roue tourne** — jante et nacelles dans un conteneur que
    la scène fait pivoter, chaque nacelle contre-tournée pour rester droite ;
  - **séparation lac / marché** : la transition entre ces deux mondes passe de 6 à 18 cases, et la densité des
    constructions retombe près de chaque frontière (facteur `edge`), pour que chaque monde s'éteigne avant le suivant.
  - Piège rencontré : la fumée était bien dessinée mais invisible (blanc sur neige, bouffées minuscules). Vérifié
    en la coloriant en magenta et en comptant les pixels : 0 d'abord, puis 40 — donc rendue mais trop discrète.
    Corrigé en gris bleuté, bouffées plus grosses et plus opaques.
- 18 nov — grotte de glace et pôle Nord, les deux mondes restés au niveau prototype :
  - **grotte** : parois resserrées sur le chemin (le mur démarre à 1,7 case au lieu de 2,2 et monte plus vite),
    porche de glace à l'entrée et à la sortie (quatre piliers, linteau en gradins, stalactites et ombre portée),
    chemin de glace au lieu du goudron (`roadColor` sur la zone), pénombre franchement bleue, stalactites
    suspendues, lanternes de glace le long du passage ;
  - **pôle Nord** : aurores boréales — trois voiles qui ondulent dans un calque au-dessus du monde, teinte franche
    de jour et additive la nuit, leur force suivant la proximité de la zone ; plus un village : igloos, enclos de
    rennes, piles de cadeaux, lampions et promeneurs ;
  - Deux corrections après captures : les igloos, blancs sur neige, étaient invisibles (ajout d'un flanc ombré et
    d'un contour froid) ; les aurores en mode additif se perdaient en plein jour (teinte normale de jour).
  - Reste à faire pour ces mondes : le traîneau qui décolle le 24, et l'entrée de la grotte mériterait une vraie
    voûte percée plutôt qu'un portique.
  - **Outil** : un petit script qui compte les décors posés par monde (bundle esbuild de `buildTerrain`, sans
    PixiJS) a été décisif. Les captures ne disaient pas pourquoi la grotte semblait vide ; le comptage, si :
    elle ne contenait que 22 décors et **aucune** lanterne, parce que les parois resserrées rendaient toutes
    les cellules voisines du chemin trop pentues et que le filtre « pas de décor sur les falaises » les écartait.
  - Deux régressions trouvées au passage par ce comptage, invisibles sur les captures prises jusque-là :
    1. le dégradé de densité aux frontières de monde (8 cases de chaque côté) était si large qu'il vidait les
       mondes courts sur toute leur longueur — ramené à 4 ;
    2. les repères uniques (chalet, grande roue, atelier, traîneau, cabanes du lac) étaient posés **après** le
       décor courant, qui leur avait pris toutes les places libres : plusieurs avaient disparu. Ils sont
       maintenant posés en premier.
  - Le critère de terrain pour bâtir passe de 0,2 à 0,6 de pente : depuis que chaque bâtiment taille sa
    terrasse, refuser les coteaux ne servait qu'à vider les villages.
- 18 nov — finitions des mondes (en attendant la réponse à l'issue #35 sur l'animation d'ouverture) :
  - **voûte de la grotte** : le portique à quatre pieds devient une vraie paroi de glace percée d'une arche,
    orientée dans le sens de la marche (`alongX` sur le décor, lu sur le chemin), cintre en gradins et
    stalactites sous l'arc ;
  - **piste damée au pôle Nord** et **traces en travers** sur les chemins qui ne sont ni goudron ni pavés
    (piste et glace de la grotte) ;
  - **le traîneau décolle le 24** : la scène détecte que la case 24 est ouverte dans les états qu'elle reçoit,
    attelle deux rennes au traîneau, lui ajoute une traînée d'étoiles et le fait s'élever. Pas besoin de
    nouvelle API vers l'Interface : l'information est déjà dans `setStates`.
  - Piège : le traîneau disparaissait de l'écran dès qu'il décollait. La rotation et l'échelle étaient
    appliquées à un conteneur dont l'origine est celle du monde, pas celle du traîneau : le moindre
    `scale` le projetait à des centaines de pixels. Corrigé en ancrant un conteneur sur la case et en animant
    un conteneur interne, le traîneau étant dessiné en coordonnées relatives.
- 18 nov — météo scénarisée, un temps par jour (tâche 5, partiellement) :
  - Alexandre a choisi le scénario **marqué** : presque chaque jour a son temps, dans `src/world/weather.ts`
    (24 entrées, avec la tempête du 10 du cahier des charges). `snow`, `wind` et `speed` remplacent la météo
    du monde ; `fog` et `clouds` la modulent.
  - Le temps suit **le jour que l'on regarde** en défilant, pas la date : `Scene.dayAt()` lit la position de
    la caméra et donne un jour continu (10,4 = entre le 10 et le 11), et `weatherAt()` mélange les deux jours
    voisins. Aucun changement d'API vers l'interface.
  - `SceneCallbacks.onWeather` (optionnel) expose le libellé du temps (« Tempête sur le lac »), si l'interface
    veut un jour l'afficher ou faire commenter Pingou. Rien ne l'utilise encore.
  - Deux réglages après captures : le voile de tempête effaçait tout le décor (coefficient ramené de 0,25 à
    0,16), et un jour brumeux ne se sentait pas dans un monde clair — d'où un plancher de brouillard et une
    teinte froide quand `fog` dépasse 1.
  - **Limite connue** : le brouillard reste discret dans les mondes au sol clair, parce que le voile est un
    dégradé blanc posé sur le bas de l'écran. Pour un vrai brouillard il faudrait désaturer la scène entière.
  - Reste de la tâche 5 : le crépuscule doux. Il demande de passer la palette d'un booléen jour/nuit à un
    facteur continu, donc de toucher à ce que l'interface appelle (`setNight`) — à faire avec le chef de projet.
- 18 nov — performances (tâche 6), première passe :
  - **Décors groupés par tranche de profondeur** : au lieu de plusieurs centaines d'objets triés et transformés
    à chaque image, la scène manipule quelques dizaines de conteneurs. Les décors d'une même diagonale ont de
    toute façon la même profondeur, donc l'ordre de dessin ne change pas.
  - **Culling** : chaque tranche de décor, chaque bande de terrain et chaque case connaît la hauteur qu'elle
    occupe, et n'est dessinée que si elle touche l'écran.
  - **Mesure** : les images par seconde ne disent rien ici (le conteneur n'a pas de carte graphique, le coût est
    dominé par le rendu logiciel plein écran : 7–8 i/s avant comme après). J'ai donc mesuré le **temps processeur
    JavaScript par image** avec le profileur de Chrome, qui est ce que ces optimisations visent :
    | | avant | après |
    |---|---|---|
    | Village (j6) | 7,14 ms | 3,75 ms |
    | Marché (j13) | 6,70 ms | 4,53 ms |
    | Pôle Nord (j21) | 7,38 ms | 3,99 ms |
    Soit environ **45 % de temps processeur en moins par image**.
  - Le découpage du terrain en bandes **n'apporte aucun gain mesurable ici** : il n'y avait qu'un seul objet,
    donc rien à trier. Il est gardé parce qu'il évite d'envoyer au processeur graphique les milliers de polygones
    hors écran — ce qui compte sur un vrai téléphone, mais reste à confirmer sur appareil.
  - Reste à faire : la mesure sur un vrai téléphone, seule à pouvoir valider l'objectif de 60 i/s.
- 18 nov — animation d'ouverture et fin des reconstructions (priorités 1 et 2 de l'issue #29) :
  - **`playOpen(day)`** (contrat décidé par le chef dans l'issue #35, option A) : la caméra s'approche de la
    case, le couvercle saute et retombe à côté, des confettis partent, puis la caméra revient. Environ 1,2 s,
    ou 0,27 s sans confettis quand `document.documentElement.dataset.animations === "non"`. La promesse se
    résout à la fin, pour que l'interface ouvre ensuite sa fenêtre.
  - **`setStates` ne reconstruit plus toute la scène** (issue #23) : seules les cases dont l'état a changé sont
    redessinées. Mesuré dans le même binaire : reconstruction complète 69 à 103 ms, mise à jour ciblée 0 ms.
    Exception assumée : si la case 24 change d'état, tout est refait une fois, car le traîneau en dépend.
  - **`setLight(amount)`** : lumière continue, voile doré en fin d'après-midi qui vire au bleu profond.
    La palette n'est reconstruite qu'au passage du seuil de nuit (0,4), pas à chaque minute.
  - **Temps écoulé partout** : la marche des personnages et l'animation d'ouverture étaient comptées en images.
    Sur un écran à 120 Hz le personnage allait deux fois trop vite, et l'ouverture se serait éternisée sur un
    téléphone lent. Le pas d'animation est aussi borné, sans quoi la neige et les confettis faisaient un bond
    quand une image durait longtemps.
  - **Crochet de test** `window.__calendrier` (`giftScreenPos`, `giftState`, `scrollForDay`, `playOpen`),
    en développement et en simulation de jour seulement, pour que la Qualité ne dépende plus de la structure
    interne des cadeaux.
  - Piège : l'application a maintenant un écran de connexion, et tous mes scripts de capture photographiaient
    silencieusement la page de login. Ils passent désormais par « Voir la démo sans compte ».
- 19 nov — navigation (issue #9, priorité 3) :
  - **Diagnostic** : PixiJS pose `touch-action: none` sur le canvas, ce qui empêchait purement et simplement
    le pouce de faire défiler la carte. C'était la cause du point 1 d'Alexandre. Passé à `pan-y` : le
    défilement redevient celui du navigateur, avec son inertie, sans casser le toucher des cases.
  - **Choix d'Alexandre pour l'ordinateur** : les trois à la fois — molette, glisser à la souris, et les
    flèches du clavier (aucun bouton à l'écran). Haut et gauche remontent dans les dates, bas et droite
    descendent ; un appui = une date, avec défilement doux.
  - **Le personnage rejoint la caméra en marchant** (choix d'Alexandre), sans dépasser la dernière case
    ouverte, et sans interférer avec la marche commandée par l'interface à l'ouverture d'une case.
  - **Mur de brouillard** (choix d'Alexandre) : le défilement s'arrête un peu après la dernière case ouverte
    et le paysage se perd dans le brouillard juste en dessous. Deux essais avant de trouver l'équilibre : trop
    tôt, la dernière case elle-même disparaissait ; la limite recule maintenant de 0,15 écran et le dégradé
    s'ouvre sur 330 px.
  - **Limite** : la hauteur de la page est calculée par l'interface au montage et au redimensionnement. Quand
    une case s'ouvre, la carte s'allonge : faute de canal dédié, la scène émet un `resize` pour que l'interface
    recalcule. Un `onHeight` serait plus propre — demandé au chef dans l'issue #9.
- 19 nov — fin de carte, deuxième version (issues #9 et #13) :
  - **Brouillard abandonné** : Alexandre l'a jugé « moche, ça ne fait pas vrai ». Comme dans les jeux du même
    genre, la carte se ferme maintenant par des éléments du décor : un **banc de nuages** et un **panneau**
    planté au bord du chemin (choix d'Alexandre : « les deux »).
  - **Forme de la lisière** (demande d'Alexandre) : une seule droite dans le sens de la carte, comme le bord du
    lac — elle part du milieu en bas et monte vers la droite (x constant). Essayés puis écartés : une ligne
    plate à l'écran (« quel est l'intérêt ? ») et un chevron. Tout ce qui est au-delà est pavé de nuages.
  - **Bords latéraux (issue #13)** : Alexandre a demandé de suivre la recommandation de l'issue — des tuiles
    sur toute la largeur de l'écran et des décors très denses aux bords. Les nuages en lisière rendaient mal et
    sont retirés. Le terrain passe de 17 à **30 tuiles** de demi-largeur (le chemin s'écarte du centre de
    l'écran, 25 laissait encore un coin vide en fin de carte). Bords : crêtes en montagne et dans la grotte,
    **forêt serrée** partout ailleurs, avec une bande d'arbres derrière la lisière. Les parois de la grotte sont
    plafonnées (elles montaient sans fin avec la largeur). Coût mesuré au profileur : aucun écart visible.
  - **Corrections trouvées en route** : la route était dessinée d'un seul tenant et dépassait les nuages
    (découpée en tranches) ; une tranche de sol de trop restait visible ; les décors et cadeaux verrouillés au-delà
    sont masqués ; le défilement s'arrête quand les nuages atteignent le bas de l'écran, sans vide derrière.
  - À regarder plus tard : dans la grotte, le cadeau 20 est en partie caché par un bloc de glace (proche de #50).
- 19 nov — fin de carte, troisième passe (retours d'Alexandre : « sois plus pointilleux ») :
  - **Rôle des nuages** (précisé par Alexandre) : ils ne cachent pas le cadeau suivant, ils empêchent de
    parcourir toute la carte et d'en découvrir les décors dès le premier jour. La lisière laisse donc six pas de
    chemin libres après la case du jour, et englobe la case de demain si elle est proche (entre deux mondes le
    chemin est long : l'attendre repoussait les nuages hors de l'écran). Le cadeau de demain reste visible.
  - **Dessin** : comparé sur captures, nuages **ronds** retenus par Alexandre (dessous bleuté, corps, reflet en
    haut à gauche) plutôt qu'à facettes (qui ressemblaient à un champ de roches). Le mur court d'un bord à
    l'autre du monde, sur dix rangées.
  - **Défilement** (choix d'Alexandre) : on s'arrête **juste sous la case du jour**. Sur ordinateur, on ne voit
    donc qu'un coin de la barrière — accepté.
  - **Pas de clôture en bois** (choix d'Alexandre) : les nuages suffisent.
  - **Panneau « route barrée »** redessiné : deux poteaux, planche large avec un flocon, bandes rouges et
    blanches, lanterne toujours allumée (halo la nuit). Planté en travers du chemin, au dernier point qui reste
    dans l'écran d'un téléphone (là où la route entre dans les nuages, il sortait souvent de l'écran).
- 19 nov — vie du monde (#11) et village du Père Noël (#42), priorité 2 de l'issue #29. Branche `monde/vie-du-monde`.
  Choix d'Alexandre :
  - **un peu de tout d'abord** : dans chaque monde, 2–3 choses qui bougent (animaux, villageois, patineurs, lutins…) ;
  - **toucher un animal** : réaction propre à chaque espèce (lièvre et renard filent puis reviennent, chouette
    s'envole, phoque frappe des nageoires, ours se dresse) avec son cri via `sound.play` ;
  - **toucher un personnage** : il s'arrête, fait coucou, puis repart (les lutins rient : `elf-laugh`) ;
  - **pôle Nord** : maison du Père Noël en priorité, puis si possible bureau du courrier et écurie des rennes,
    à côté de la fabrique de jouets ; lutins qui font la navette fabrique ↔ traîneau.
  - Sons livrés par l'Audio (#11) : `fox`, `hare`, `owl`, `squirrel`, `reindeer`, `seal`, `bear`, `elf-laugh`,
    `elf-hammer`, `elf-hop`, `snowball`, `skate`, `ski`, `lift`. Le chef branchera `scene.setSound(sound)` depuis `App.tsx`.
  - **Livré (première passe)** — nouveau module `src/world/life.ts` :
    - habitants qui vivent dans les coordonnées de la grille, rangés à leur profondeur à chaque image, et qui ne
      bougent que lorsqu'ils sont à l'écran (culling vertical **et horizontal**) ;
    - déplacements : `wander` (animaux autour de chez eux, seulement sur des cases libres de tout décor et sans
      falaise : `makeGround`), `route` (passants sur le côté de la rue, lutins fabrique ↔ traîneau),
      `loop` (patineurs sur le lac), `slope` (skieurs qui godillent, puis repartent d'en haut), `still` ;
    - par monde : montagnes (lièvres, renard, 2 skieurs) ; village (5 passants, 2 paires d'enfants qui se
      lancent des boules de neige, écureuil) ; lac (3 patineurs, renards, lièvre, cerf, écureuil, 2 chouettes
      perchées en haut des sapins) ; marché (6 badauds, 3 musiciens avec notes qui s'envolent) ; grotte
      (2 phoques, ours blanc) ; pôle Nord (4 lutins porteurs, un lutin forgeron, rennes, ours, phoque) ;
    - au toucher : fuite puis retour (renard, lièvre, écureuil, renne), envol en cercle (chouette), applaudit
      (phoque), se dresse (ours), coucou de la main (passants, musiciens), saut (lutins, enfants, skieur),
      pirouette (patineur) ; cri via `sound.play`. **Un toucher près d'un cadeau (< 0,9 case) est rendu au
      cadeau** : un passant ne vole jamais le doigt d'une case ;
    - les patineurs statiques ne sont plus posés par `terrain.ts` (remplacés par les vrais).
  - **Pôle Nord** : l'atelier devient la **fabrique de jouets** (halle de briques, deux cheminées qui fument,
    enseigne, tapis roulant où défilent ours, toupies, cubes et voitures — anim `belt`) ; ajout de la **maison du
    Père Noël**, du **bureau du courrier** (sacs de lettres, boîte rouge) et de l'**écurie** (trois box, têtes de
    rennes qui dodelinent — anim `bob`, bottes de foin). Les trois sont posés au plus près de la fabrique
    (> 3,2 cases), sinon ils tombaient tout en bas de la carte. Enseignes en texte incliné comme le mur (`enseigne()`).
  - **Contrat** : `scene.setSound(sound)` ajouté ; le chef doit l'appeler depuis `App.tsx` (demandé dans #11).
    Sans lui, tout marche mais en silence.
  - Crochet de test : `__calendrier.life()` donne les habitants visibles (espèce, position écran, réaction).
  - **Piège de test** : après un saut de défilement, la caméra glisse encore latéralement plusieurs secondes ;
    toucher tout de suite rate la cible. Attendre ~5 s. Un toucher rendu à un cadeau ouvre sa fenêtre, qui
    bloque les touchers suivants du script.
  - Reste à faire : remontée mécanique (son `lift`), traîneau chargé par les lutins le 24, retours d'Alexandre
    sur captures (taille des animaux, densité).
  - Retour d'Alexandre : **animaux grossis de 30 %** (`scale 1.3` sur les espèces de `ANIMAUX`), pour qu'on les
    remarque et qu'on les touche facilement. Les personnages gardent leur taille.
  - PR #67 fusionnée par le chef, `setSound` branché dans `App.tsx`.
- 20 nov — corrections visuelles (priorité 3 de #29), branche `monde/corrections-visuelles`, PR #71 :
  - **#49 traîneau** : le cube vert (« hotte ») devient un sac de toile noué de rouge et deux paquets enrubannés.
  - **#50 cadeau 16** : la transition marché → grotte passe de 6 à 12 cases (`transitionLen`), et **règle
    générale** dans `terrain.ts` : devant chaque case (plus bas à l'écran), un cône (`devant`, 5 rangées,
    s'évasant) où seuls les décors bas (`LOW` : rochers, buissons, paquets, bancs, luges, barrières, lanternes
    de glace, badauds, bonshommes de neige, rennes, braseros) sont permis.
  - **Règle d'Alexandre : ne jamais supprimer de décor ; si ça ne passe pas, agrandir la carte.** Le décor est
    donc d'abord posé comme si la règle n'existait pas, puis chaque élément haut d'un cône est **déplacé** vers
    la place libre la plus proche (même monde, même distance à la route, hors cône). Vérifié au script de comptage :
    même code avec et sans cône (filtre des repères retiré) → 1673 décors des deux côtés, identiques type par type.
    Les repères (fabrique, chalet…) choisissent directement une place hors cône. Si un décor ne trouve aucune
    place, la console affiche « [monde] … agrandir la carte » : actuellement 0.
  - Le **grand sapin de la place du 6** passe derrière la case (il était pile devant).
  - **#48 aurores** : nouveau module `aurora.ts`. Abandon des polygones posés par-dessus tout l'écran.
    Les aurores sont des voiles texturés (texture générée une fois sur un canevas) glissés **dans le monde entre
    le sol et le décor** (`world` = `ground`, `aurora`, `objects`), donc maisons et sapins passent devant ; le
    calque est recalé chaque image en coordonnées d'écran. Plus un halo doux qui teinte la neige.
    Alexandre a choisi **B · Voiles** (trois larges bandes diffuses) plutôt que A · Rideaux (stries nettes).
  - Piège : `MeshRope` oriente la texture selon la normale du ruban ; dès qu'il ondule, les stries se
    déploient en éventail. Remplacé par un `MeshSimple` à deux sommets par colonne (haut/bas) : toujours vertical.
    Autre piège : `rope.width` est l'échelle du conteneur, pas l'épaisseur du ruban.
  - Prochaine étape (priorité 4 de #29) : #24 lisibilité des cadeaux, #18 icône Pingou, #12 présentation des mondes.
- 20 nov — lisibilité des cadeaux (#24, priorité 4 de #29), branche `monde/lisibilite-cadeaux` (partie de
  `monde/corrections-visuelles`, PR #71 pas encore fusionnée) :
  - **Étiquettes dans un calque du dessus** (`overlay` dans `Scene.ts`, posé après le voile, le brouillard et les
    nuages, recalé sur la caméra du monde à chaque image) : les numéros ne s'assombrissent plus la nuit et ne sont
    plus masqués par un décor. L'étiquette garde sa hauteur de repos (`labelY`) et saute avec le cadeau du jour ;
    elle est touchable et ouvre la case. Quand un cadeau est détruit, `dropLabel` retire aussi son étiquette.
  - **Style choisi par Alexandre : B · blanche cerclée** (contre A · pastille foncée et l'actuel) : pastille
    blanche bordée d'ardoise `0x3f4a66`, ombre portée, cadenas blanc dans un badge rond ardoise. Les pastilles
    rouges et vertes gagnent un liseré blanc et la même ombre.
  - **Lumière propre du cadeau du jour** : halo radial additif doré (`giftLight`, texture générée une fois) dans le
    calque du dessus, qui monte avec le soir (`light`) et pulse avec le cadeau. Rien de jour.
  - Bord du monde sur ordinateur : déjà réglé par les 30 tuiles de #13 (vérifié jour 1 en 1280×800).
    Après la case 24 : la place du pôle Nord remplit l'écran et le traîneau décolle (fait plus tôt).
  - Piège de capture : sur ordinateur, la caméra glisse encore latéralement après un saut ; attendre ~14 s avant
    de photographier, sinon le cadeau est hors champ.
  - PR #72 ouverte (à fusionner après #71). Prochaine étape : #18 icône Pingou, puis #12 présentation des mondes.

- 20 nov — icône de l'application (#18, priorité 4 de #29), branche `monde/icone-pingou` (partie de `main`) :
  - Deux variantes montrées à Alexandre (A · tête en grand plan avec clin d'œil, B · Pingou entier avec un cadeau) ;
    **il a choisi B**. Pingou repris de `PenguinPortrait` (`src/ui/Mascot.tsx`) : bonnet, écharpe, paquet doré
    à ruban rouge sous l'aile droite, sur un monticule de neige. Fond bleu nuit en dégradé radial (bord `#101a3a`),
    flocons, halo doré doux derrière lui pour le détacher du fond (le corps `#2b3c6c` est éclairci par rapport au
    portrait, sinon il se perd dans le bleu nuit).
  - Fichiers remplacés dans `public/icons/` aux mêmes noms : `icon-192`, `icon-512`, `apple-touch-icon` (180),
    `icon-maskable-512` (dessin réduit à 80 % pour la zone sûre d'Android). Source `public/icons/pingou.svg`.
    `badge-96.png` (badge monochrome des notifications) inchangé. Manifeste non touché (Backend).
  - Générateur : `node src/world/icone/genere-icone.mjs B public/icons` depuis la racine (Chromium de
    `/opt/pw-browsers`) ; sans argument, il produit les aperçus A et B dans le dossier courant.
  - PR #73 ouverte. Prochaine étape : #12 présentation des mondes.

- 24 nov — fin de #11 et #42 (priorité 1 du chef), branche `claude/intelligent-ride-qdbkzh` :
  - **Ce qui manquait** (relu dans les issues) : la remontée mécanique des skieurs (#11), et des lutins qui
    poussent un chariot et emballent (#42). Tout le reste était livré par la PR #67.
  - **Choix d'Alexandre** : **télésiège** (contre téléski à perches et télécabine) ; **chariot + emballage**
    (sans le chargement du traîneau le 24).
  - **Télésiège** (`chooseLift`, `drawLiftPart`, mouvement `lift` dans `life.ts`) : la ligne est choisie
    automatiquement dans les montagnes — part à 1,6–3,4 cases de la route, monte d'au moins 1,4, n'enjambe ni
    route ni bâtiment, reste à plus de 3,4 cases de toute case (sinon la gare du bas cachait la case 3).
    Le câble est droit d'une gare à l'autre, assez haut pour passer **au-dessus des sapins** (règle « ne jamais
    supprimer de décor ») : 2,4 au-dessus du sol au minimum. Pylônes tous les ~2,2 cases, gares en bois avec
    grande roue rouge. Sièges biplaces (parfois un seul skieur) qui montent chargés et redescendent vides ;
    au toucher le siège se balance autour de sa pince et le skieur fait coucou, son `lift`.
    Deux skieurs redescendent le long de la ligne (piste parallèle ; les deux skieurs au hasard sont gardés).
    Résultat : sur l'écran du jour 1, le télésiège est la pièce maîtresse du paysage.
  - **Lutin au chariot** (`elfCart`) : navette fabrique ↔ traîneau par un autre chemin que les porteurs,
    chariot chargé à l'aller, vide au retour, pause plus longue aux bouts. Son `elf-hop`.
  - **Emballeurs** (`elfWrap`, `addWrapBench`, `wrapStep`) : deux lutins face à face devant un établi près de la
    fabrique ; cycle d'environ 4 s : paquet brut, papier de couleur, ruban et nœud, il le pose sur la pile dans
    son dos ; pile pleine (4) → vidée. Place cherchée en cercles autour de la porte, à plus de 2,6 cases d'une case.
  - **Culling** : les pylônes ont une marge de 240 px (leur câble monte loin au-dessus de leur pied).
  - **Outil** : le comptage en Node marche **avec** PixiJS (bundle esbuild de `terrain.ts` + `life.ts`,
    `spawnLife(buildTerrain(), makePalette(false))`) — c'est lui qui a montré que l'établi et la piste
    ne trouvaient pas de place.
  - Reste possible (non demandé) : le chargement du traîneau par les lutins le 24.
  - Prochaine étape : **#23** (mesure avant/après avec `tests/qa/perf.mjs`).

- 25 nov — fin de #23 (priorité 2 du chef), branche `claude/intelligent-ride-qdbkzh` repartie de `main` (PR #80 fusionnée) :
  - **Déjà fait par la PR #47** : mise à jour ciblée des cadeaux (`setStates`), marche au temps écoulé,
    crochet `window.__calendrier`. **Restait** : la bascule jour/nuit (et le traîneau du 24) qui refaisait
    toute la scène d'un coup — 3,6 s de gel à CPU ×4, 1,5 s à CPU ×1 (`perf.mjs` du 24 nov, avant).
  - **Solution** : `build()` devient un générateur `buildSteps(b)` qui dessine dans des conteneurs neufs
    (`Built` : sol, décors, étiquettes, fin de carte, cadeaux, habitants, personnages). `rebuildLater(pal)`
    le fait avancer par **tranches de 8 ms** dans une boucle `MessageChannel` (hors des images, donc
    indépendante de leur fréquence ; tranche portée à la moitié de l'image si l'appareil rame), puis
    `commit()` échange les conteneurs. Les anciens sont détruits par tranches (`trash`).
    Seul le démarrage reste synchrone (`build()`).
  - **Triangulation d'avance** (`prepareGpu`) : PixiJS 8 triangule un `Graphics` à son premier rendu ;
    sans ça, l'image qui suit l'échange faisait tout le travail d'un coup. On appelle
    `renderer.graphicsContext.updateGpuContext` (API interne, protégée : si elle disparaît, on s'en passe).
  - **Cohérence** : la teinte du soir suit la lumière tout de suite, les couleurs du décor dès que la scène
    est prête. Un double toucher annule le travail. Les cadeaux changés pendant la reconstruction sont
    rattrapés à l'échange ; la fin de carte d'une scène en construction ne touche pas aux limites
    actuelles si les états ont changé ; l'échange attend la fin d'une ouverture de case (`focus`) ;
    les personnages gardent marche et orientation (`walkTo` relit `this.people[who]`).
  - **Mesures** (script de mesure de la bascule sur 4 à 30 s, SwiftShader très lent : ~1 img/s) :
    clic 2–66 ms (avant : reconstruction de 1 à 1,6 s dans l'effet React) ; calcul total réparti
    ~0,3–0,5 s (CPU ×1), ~1,3 s (CPU ×4) ; `commit()` 2–3 ms ; première image après l'échange
    62–104 ms à CPU ×1, ~270 ms à CPU ×4 (avant : 570–725 ms, en plus du gel). Sur un vrai téléphone
    à 60 img/s, la nouvelle palette arrive ~1 à 3 s après le toucher, sans à-coup.
  - `__calendrier.reconstruction()` → `{ enCours, calculMs, dureeMs, tranches, echangeMs }` pour la Qualité.
  - **Bloquant pour tout le monde (issue ouverte)** : depuis le nouvel en-tête (#51), `attendreScene` des
    outils Qualité attend `.hud` qui n'existe plus → `npm run capture` et `qa:perf` échouent (« Carte non
    atteinte »), et le bouton s'appelle « Passer en nuit/jour » (plus « Jour / nuit »). Mes captures de
    vérification sont donc faites avec mon script de mesure.
  - Prochaine étape : **Salons** dès l'annonce du contrat `SalonApi` dans #84, sinon **#14**.

- 25 nov — Salons (#84, en tête du brief), branche `claude/intelligent-ride-qdbkzh` (PR #91 fusionnée entre-temps :
  `main` refusionné dans la branche), **PR #93** :
  - **Rien d'autre à faire dans `src/world/`** : aucun prénom n'y est affiché (ni panneau, ni Pingou — les bulles
    sont à l'Interface). `PLAYERS.name` n'est lu que par `App.tsx` (lignes 157 et 232), à remplacer par
    `salon.config.joueurs[who].prenom` côté chef / Interface.
  - **Couleurs** : `scene.setJoueurs(joueurs | null)` (null = `PLAYERS`). Les deux personnages sont redessinés
    sur place (`Person.habiller`), sans reconstruire la scène ; une reconstruction en cours les reprend aussi,
    et les suivantes lisent `scene.apparence`. Type `CouleursJoueur` du contrat utilisé tel quel.
  - Revers du bonnet : avant, bleu foncé en dur pour tout bonnet non blanc → maintenant un ton plus clair (bonnet
    foncé) ou plus sombre (bonnet clair) ; les deux bonnets par défaut gardent exactement leur teinte.
    L'écharpe reste liée à la place (dorée / blanche).
  - **À brancher par le chef dans `App.tsx`** (demandé dans #84) :
    `backend.salons?.getSalon().then((s) => scene.setJoueurs(s?.config.joueurs ?? null))` puis
    `backend.salons?.onSalonChange((s) => scene.setJoueurs(s?.config.joueurs ?? null))` (désabonnement au démontage).
  - Crochets de test : `__calendrier.joueurs(j)` et `__calendrier.personnageEcran(who)` → `{ x, y, couleurs }`.
  - Vérifié (script perso, `npm run capture` toujours cassé, #90) : jour 3 mobile, couleurs changées en direct,
    puis bascule nuit : les couleurs du salon sont gardées.
  - Prochaine étape : **#14** (ne charger que le monde où l'on se trouve), sauf retour du chef.

- 25 nov — #14 (ne charger que le monde où l'on se trouve), branche `claude/intelligent-ride-qdbkzh` (PR #93 fusionnée,
  `main` refusionné dans la branche) :
  - **Constat** : la carte entière ne fait que ~3,6 écrans de haut sur téléphone (échelle 0,7) ; le rendu ne
    dessinait déjà que les tranches à l'écran, mais **tout était construit** au démarrage et à chaque bascule jour/nuit.
  - **Solution** (décision technique) : le monde est découpé une fois en **218 lots** (`decouperLots` : bandes de sol
    de 10 diagonales, tronçons de route, tranches de décor d'une unité de profondeur) dont on connaît la place sans
    les dessiner (sol exact, décors estimés large par `HAUTEUR_DECOR`, puis mesurés au premier dessin). `diffuser()`
    à chaque image : ce qui entre à l'écran est dessiné tout de suite, un **demi-écran d'avance** est préparé en
    arrière-plan (pompe `MessageChannel`, prioritaire sur la reconstruction), au-delà d'**un écran** on détruit.
    Rien n'est dessiné derrière le banc de nuages. La bascule jour/nuit ne redessine que les lots chargés.
    Les animations (roue, fumée, tapis…) vivent avec leur lot. Habitants et cadeaux : inchangés (déjà légers et
    figés hors écran).
  - **Mesure** (`perf.mjs` copié et corrigé dans mon brouillon, téléphone simulé, SwiftShader) : tas JS
    243 → 158 Mo (CPU ×4) et 190 → 162 Mo (CPU ×1) ; scène prête 8,6 → 6,0 s ; JS par image 63 → 30 ms (CPU ×4) ;
    plus longue tâche pendant le défilement 2,2 → 0,9 s (mais plus de petites tâches longues : lots dessinés
    à l'entrée d'écran quand l'appareil est trop lent pour les préparer).
  - Corrigé en route : les jouets du tapis roulant attendaient à l'origine du monde avant leur première image.
  - Crochet de test : `__calendrier.lots()` → `{ total, dessines, enAttente }`. En dev, la console signale un
    décor plus haut que l'estimation (« [monde] lot … plus grand que prévu »).
  - `npm run capture` remarche sur `main` (#90 réglé).
  - Prochaine étape : **#12** (présentation à l'arrivée dans un nouveau monde) — question de goût, options à montrer.

- 26 nov — #12 (présentation d'un monde à la première arrivée), branche `claude/intelligent-ride-qdbkzh` :
  - **Choix d'Alexandre** : « survol de la route » (pas le grand dézoom ni le lever de rideau), et **les montagnes
    aussi** sont présentées (au premier lancement, comme les autres mondes).
  - **Fonctionnement** (`src/world/presentation.ts` + fin de `Scene.ts`) : quand la caméra s'est posée 1,2 s dans
    un monde jamais présenté (pas de case en ouverture, pas de marche scriptée, pas de fenêtre ouverte, onglet visible),
    `sound.playJingle(zone)` puis survol ~3,5 s : recul (zoom 0,74), glissade le long de la route, retour en douceur
    (la caméra du survol est **mélangée** à celle du défilement : ni départ ni retour brusques).
  - **Sens** : arrivé par le haut (cas normal, ou au chargement) → vers la suite du monde ; revenu par le bas → vers
    l'entrée du monde. On s'arrête avant que le banc de nuages ne remplisse l'écran : le jour d'arrivée, le survol se
    réduit donc à un recul sur place (rien d'ouvert à montrer plus loin) — assumé, la suite reste une surprise.
  - **Coupure** : toucher, clic, molette, clavier → retour rapide (0,38 s), monde marqué présenté. Défilement
    automatique ou ouverture d'une case → survol effacé **sans** marquer (il reviendra au prochain arrêt).
  - **Mémoire** : `localStorage` `calendrier.mondesPresentes.<who>` (par joueur, par appareil ; pas de contrat backend).
    `animations = "non"` → jingle seul, monde marqué.
  - **Navigateur piloté** (`navigator.webdriver`) : jamais de déclenchement automatique, pour ne pas casser les
    captures et tests e2e. Crochets : `__calendrier.presenter(z)`, `figerSurvol(ms|null)`, `survol()`,
    `oublierPresentations()`.
  - Culling corrigé : `diffuser` et les habitants utilisent l'échelle réelle du monde (`world.scale`), pas `this.scale`.
  - **Aucun changement dans `App.tsx`** (la scène connaît déjà `leader` et le son). Le nom du monde s'anime déjà dans
    le HUD au changement de monde (Interface).
  - Vérifié (script perso dans mon brouillon, `npm run capture` ne sait pas photographier une animation) : jour 9 et
    jour 20 mobile, jour 20 ordinateur, coupure à la molette et mémoire en temps réel.
  - Prochaine étape : #10 (ambiance), #13 ; #61 (instantané pour le PDF) si le chef le remonte.

- 26 nov — #10 (ambiance), branche `claude/intelligent-ride-qdbkzh` :
  - **Lumière des maisons** — choix d'Alexandre : **B · flaques**, et **aussi les lampadaires**. L'ellipse beige
    sous chaque maison (et celle de la maison du Père Noël) est supprimée. La nuit, chaque fenêtre de la façade
    avant pose sur la neige une nappe en trapèze (`windowSpill` dans `props.ts`) : vive contre le mur, elle
    s'élargit en s'effaçant ; plus la fenêtre est haute, plus elle porte loin et pâlit. Les fenêtres passent par
    `fenetre()` dans `drawHouse`, qui les retient. Lampadaires : le grand disque en l'air devient un rond de
    lumière au pied (`groundPool`, vrai cercle au sol) et une petite lueur autour de la lanterne.
    Non touchés : lanterne du panneau « route barrée » (halo déjà validé), lanternes des chalets du marché, braseros.
  - **Halo du joueur** — **discret** (choix d'Alexandre) : `playerLight` dans le calque du dessus, même texture que
    la lumière du cadeau, teinte `0xffe2a8`, additif, suit son propre personnage (`leader`), alpha = 0,42 × soir.
    Rien en plein jour. Souffle très léger.
  - **Neige au gyroscope** — module `src/world/inclinaison.ts` (`deviceorientation`, gère le paysage, lissé, le
    repos avant/arrière suit lentement la tenue du téléphone). Pencher à gauche/droite fait dériver les flocons
    (les proches plus que les lointains) ; vers l'avant/l'arrière, ils tombent plus vite/lentement.
    **iOS** : autorisation demandée **au premier toucher de la carte** (choix d'Alexandre, contre Pingou ou réglage).
    Android et ordinateur : branché tout de suite. Crochet : `__calendrier.incliner(x, y)`.
  - Vérifié : `npm run capture` jour 8 21:00 mobile + ordinateur ; inclinaison simulée par le crochet.
    Pas testé sur un vrai iPhone (à faire par Alexandre après déploiement).
  - Prochaine étape : #61 (instantané pour le PDF) si le chef le remonte, sinon demander au chef dans #29.

- 26 nov — #61 (instantané du décor pour le PDF des souvenirs), branche `claude/intelligent-ride-qdbkzh` :
  - **API** : `scene.snapshotAround(day, width, height): Promise<string>` → data URL PNG (`""` si case inconnue).
    Contrat demandé par le chef dans #61, rien de nouveau dans `contracts.ts`.
  - **Rendu** : scène à part, hors écran, **toujours de jour** (même si l'écran est en nuit), avec le décor actuel :
    les lots du monde dont l'étendue coupe le cadre (`chargerLot` vers une cible jetable), un fond uni `bgDay` du
    monde de la case, les cadeaux voisins dans leur état actuel et **celui du jour forcé ouvert**. Sans étiquettes,
    personnages, Pingou, habitants, brouillard, nuages ni banc de nuages (le décor au-delà est dessiné).
    Cadre : 640 px du monde de large (`Scene.LARGEUR_INSTANTANE`), hauteur au ratio demandé, cadeau un peu sous le
    milieu ; `resolution = width / 640`. Décors animés posés une fois (`animerDecor`, extrait de `tick`) ; traîneau
    du 24 à mi-envol.
  - On rend la main toutes les ~30 ms de dessin. Mesuré sous SwiftShader (téléphone simulé, nuit) : 1,3 à 3,4 s par
    image de 900×600. Tout est détruit après l'extraction.
  - Crochet : `__calendrier.instantane(day, w = 800, h = 600)`. Vérifié sur les cases 1, 6, 9, 15, 20, 24
    (script perso dans mon brouillon, `npm run capture` ne sait pas faire d'instantané).
  - Reste : brancher dans `App.tsx` (chef) et dans `downloadSouvenirs` (Backend).
  - Prochaine étape : liste du brief terminée → demander la suite au chef dans #29.

- 26 nov (après-midi) — **liste du brief terminée** (#12 fermée par le chef, survol de la route fait par lui).
  Alexandre choisit d'**aider les Jeux** (contre relecture du monde ou performance téléphone).
  Demandé au chef dans #29 : me confier le **jour 22** (tri des cadeaux, score à battre, PixiJS) puis le **jour 21**
  (décorer le sapin à deux, en direct sur `joinLive`) et leurs lignes de `src/games/registry.ts`.
  - **Prochaine étape** : relire #29. Si le chef a confié les jours par écrit → branche `monde/jeu-22`,
    lire `src/games/README.md` et le jeu du jour 10 (`src/games/flocons/`, même genre), proposer 2–3 règles à
    Alexandre avant de coder. Sinon, ne rien toucher dans `src/games/` et attendre.

- 26 nov (soir) — **jour 22, tri des cadeaux** (score à battre), branche `monde/jeu-22`, confié par le chef dans #29 :
  - **Règle choisie par Alexandre : tapis roulant** (contre « étiquettes à lire » et « remplir le traîneau »).
    Les paquets sortent d'une trappe et avancent sur le tapis. On en attrape un au doigt et on le lâche dans la
    hotte de sa couleur. Il y a 3 hottes, plus une 4e (dorée) qui s'ouvre à 30 s, et une poubelle pour le charbon.
    Les erreurs : mauvaise hotte, cadeau tombé au bout du tapis, charbon dans une hotte. 3 erreurs et c'est fini.
    La série multiplie les points (plafond ×3) et le tapis accélère. Partie de 90 s, bonus par vie restante.
  - Chaque couleur a sa **forme** (★ rouge, sapin vert, boule bleue, cœur doré) sur l'étiquette et sur la hotte.
    Clavier : touches 1 à 5, qui envoient le paquet le plus avancé sur le tapis.
  - Même graine = mêmes paquets aux mêmes instants pour les deux. Vitesse en largeurs de tapis par seconde.
    Le terrain fait `min(largeur, 1,05 × hauteur, 760 px)`. Le paquet lâché hors des hottes revient sur le tapis.
  - Fichiers : `src/games/tri-cadeaux/` (index.tsx = habillage copié du jour 10, moteur.ts = PixiJS),
    `src/data/games/tri-cadeaux-jour22.ts` (tous les réglages, sans code), 3 lignes dans `registry.ts`.
    Jeu d'adresse : pas de schéma de contenu et rien à mettre dans le salon d'Alexandre & Flavie.
  - Vérifié : build, `npm run capture -- --jour=22 --case=22` (0 erreur), partie jouée dans l'atelier
    (`/jeux.html?jour=22`, 390×844 et 1280×800) : tri au doigt, au clavier, fin sur 3 erreurs, 4e hotte ouverte.
    `npm run capture` ne sait pas jouer une partie : mon script est resté dans mon brouillon.
  - **Prochaine étape** : jour 21 « Décorer le sapin à deux » (en direct, `joinLive`, voir #56 et les jours 5 et 6
    de l'équipe Jeux), dans `src/games/sapin/`. Proposer d'abord 2–3 règles à Alexandre.

- 26 nov (soir, suite) — **jour 22 fusionné** (PR #108). **Jour 21, le sapin à deux**, branche `monde/jeu-21`, PR #115 :
  - **Choix d'Alexandre** (les trois recommandations) : **déco libre** sans score ni chrono (contre « missions de
    Pingou » et « chacun sa moitié ») ; **miniature sur la carte** à côté du cadeau 21 jusqu'au 24 ;
    **fin = étoile tenue à deux** en même temps (contre un bouton « Allumer » ou pas de fin).
  - Panier : boule, guirlande (tracée au doigt), sucre d'orge, cœur, clochette, nœud, cadeau (au pied seulement),
    7 couleurs sans vert. Au doigt, la déco flotte au-dessus du doigt pour rester visible. « Annuler » enlève
    sa dernière déco. Limites : 40 décos et 6 guirlandes par personne.
  - Direct : la main de l'autre (avec la déco qu'il tient et son prénom) passe par `live.emit("main")`, et
    « je tiens l'étoile » par `live.emit("etoile")`. Rien de cela n'est enregistré. Les décos passent par le
    journal (`shared/partie.ts`, clé `sapin`), et l'arrivée d'une déco de l'autre fait un éclat avec son prénom.
  - Étoile : elle apparaît quand chacun a posé 6 décos. À deux, il faut la tenir 1,5 s ensemble. Seul, on la
    « tient en veille » (coup `veille`), et elle monte quand l'autre la tient à son tour. Ensuite viennent les
    lumières, le ciel de nuit, le feu d'artifice et `markCompleted`. La tenue se compte **en temps réel** : avec
    le `dt` plafonné, elle ne finissait jamais sur une machine lente.
  - Le liseré « qui a posé quoi », montré dans l'aperçu à Alexandre, a été remplacé par l'éclat et le prénom à
    l'arrivée, plus lisible. À lui redemander s'il y tient.
  - Fichiers : `src/games/sapin/` (index.tsx habillage, moteur.ts PixiJS, regles.ts pur, carte.ts, sapin.css),
    `src/data/games/sapin-jour21.ts` (pas de schéma : rien à personnaliser), 3 lignes dans `registry.ts`,
    et `src/world/Scene.ts` : `setSapin(SapinCarte | null)` dessine le petit sapin derrière le cadeau 21
    (il grandit avec le nombre de décos, et ses décos restent vives la nuit une fois allumé), crochet `__calendrier.sapin`.
  - **À brancher par le chef** dans `App.tsx` : `lireSapinCarte(backend).then((s) => scene.setSapin(s))`
    (`src/games/sapin/carte.ts`) au démarrage et à la fermeture de la case 21. Demandé dans #29 (option C recommandée pour la suite).
  - Vérifié : build, oxlint (seuls les avertissements « only-export-components » communs à tous les jeux),
    `npm run capture -- --jour=21 --case=21` (0 erreur), deux parties jouées à deux onglets dans l'atelier
    (390×844 et 1280×800 : direct, main de l'autre, guirlande, étoile à deux, lumières), une partie en différé
    (veille puis étoile au retour, rechargement), et la miniature sur la carte de jour et de nuit.
    Mes scripts sont restés dans mon brouillon (`npm run capture` ne sait ni jouer ni injecter le sapin).
  - **Prochaine étape** : liste Renfort Jeux terminée. Relire #29 pour la suite (relecture du monde ou
    performance téléphone, options B et C du 26 nov).
