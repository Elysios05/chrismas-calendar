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
