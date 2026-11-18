# Équipe Monde & design (PixiJS)

**Mission** : le monde isométrique que l'on parcourt — beau, vivant, fluide sur téléphone.
**Dossier** : `src/world/` uniquement.

## Existant
- `iso.ts` projection 2:1, primitives ; `terrain.ts` route + relief en facettes (sommets `V`, pics, lac) ;
  `props.ts` décors vectoriels ; `zones.ts` les 6 mondes (couleurs, météo, ambiance) ; `actors.ts` personnages + Pingou ;
  `Scene.ts` rendu, caméra liée au défilement, brouillard, nuages, neige, mode nuit.

## À faire (par priorité)
1. **Direction artistique des montagnes** : crêtes nettes, limite neige/roche propre, rochers, sapins plus variés. Valider avec Alexandre sur captures.
2. **Transitions entre mondes** fondues dans le paysage (neige → pavés, forêt qui s'éclaircit vers le lac…).
3. Finir chaque monde : village (place centrale pour le 6), lac (patineurs, bord gelé), marché (allées, grand sapin, grande roue),
   grotte (entrée, parois de glace, lumière bleue), pôle Nord (aurores, atelier, traîneau qui décolle le 24).
4. **Ouverture d'une case** : animation (zoom caméra, couvercle qui saute, confettis) exposée par une méthode de `Scene`.
5. Météo par jour (tempête le 10), jour/nuit doux (crépuscule), fenêtres et lampadaires allumés la nuit.
6. Performances mobile : regrouper la géométrie, ne dessiner que ce qui est visible, 60 i/s sur un téléphone moyen.

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
