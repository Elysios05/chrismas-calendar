# Équipe Interface (React)

**Mission** : tout ce qui se trouve par-dessus le monde — lisible, mignon, agréable au doigt comme à la souris.
**Dossiers** : `src/ui/`, `src/index.css`.

## Existant
HUD (titre, choix Alexandre/Flavie, jour/nuit, aller à aujourd'hui), bulle de Pingou (`Mascot.tsx`), carte provisoire d'une case.

## À faire (par priorité)
1. **Écran de connexion** (choix du profil + mot de passe), en utilisant `BackendApi.signIn`.
2. **Fenêtre d'une case** : en-tête du jour, zone où se monte le `GameModule`, état terminé, revoir la case.
3. **Éditeur de case préparée** (mot doux + photos, aperçu tel que l'autre le verra), et **rappel la veille**.
4. **Lecture d'une case préparée** : lettre animée + polaroïds.
5. **Pingou scénarisé** : textes d'accueil, d'encouragement, de rappel ; expressions (content, surpris, triste) ; fichier de répliques.
6. Indicateur de la course (qui a combien de cases d'avance), réglages (son), écran de fin le 24.
7. Accessibilité de base et finitions responsives.

## Questions à poser à Alexandre
Ton et répliques de Pingou, maquettes des écrans (montrer des captures), ce que voit Flavie au premier lancement.

## Journal

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
