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

À trancher avec Alexandre : ton de Pingou, fréquence de ses interventions,
emplacement de sa bulle (dans la fenêtre vs flottante), et s'il faut un « mot de passe oublié ».
