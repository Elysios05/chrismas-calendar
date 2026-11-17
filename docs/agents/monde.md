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
