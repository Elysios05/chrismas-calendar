# `npm run capture` : une photo rapide de l'appli

Commande commune à toutes les équipes (ne réécrivez plus de script Playwright jetable).
Elle passe la connexion démo, vérifie que la carte est vraiment affichée (sinon elle échoue avec un message clair),
ferme la bulle de Pingou, se place sur la case du jour, puis prend la photo.

```bash
npm run capture -- --jour=12 --heure=21:00 --case=12     # la fenêtre de la case 12, la nuit
npm run capture -- --jour=21 --appareils=ordinateur      # le monde au jour 21, ordinateur seul
npm run capture                                          # jour 1, 12 h, mobile + ordinateur
```

| Option | Rôle | Défaut |
|---|---|---|
| `--jour=N` | jour simulé (1 à 24) | 1 |
| `--heure=HH:MM` | heure de Paris simulée (21:00 = nuit) | 12:00 |
| `--case=N` | ouvre la fenêtre de la case N après connexion | aucune |
| `--joueur=alexandre\|flavie` | qui est connecté | alexandre |
| `--appareils=mobile,ordinateur` | 390×844 (x2) et 1280×800 | les deux |
| `--attente=ms` | délai avant la photo | 1500 |
| `--sortie=dossier` | où écrire les PNG | `/tmp/captures` (hors dépôt) |
| `--sans-build` | ne construit jamais (échoue si `dist/` manque) | construit seulement si `dist/` est absent ou plus vieux que `src/` |

Sortie : chemins des images, puis les erreurs console (hors avertissements). Code de sortie 1 si une capture a échoué.

## Durées mesurées (WebGL logiciel SwiftShader)
- Capture simple (jour 1, un appareil) : environ 27 s.
- Avec `--case=N` : environ 50 s par appareil (l'animation d'ouverture de la case est lente).
- Un build à froid ajoute quelques secondes ; `--sans-build` l'évite quand `dist/` est à jour.

## Ce que la commande fait pour vous
- Heure figée (`page.clock`), police Fredoka locale, Chrome du système avec les réglages SwiftShader.
- Le rendu PixiJS est coupé pendant les attentes (sinon ~1 image/s) puis l'image est figée pour la photo ;
  la caméra est amenée à sa position finale sans attendre son lissage.
- Pour des séries (plusieurs jours, jour/nuit, planches contact) : `npm run qa:captures`.
