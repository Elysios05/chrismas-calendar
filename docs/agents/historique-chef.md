# Historique des échanges entre Alexandre et le chef de projet

Résumé chronologique et fidèle, pour qu'une session chef neuve (sur n'importe quel compte) ne perde rien.
La référence reste `docs/agents/chef.md` (procédures, état, décisions).

## 17 novembre — cadrage
- Demande : calendrier de l'Avent pour Alexandre et Flavie, en ligne (GitHub Pages), interface très neige/Noël, chemin qui descend au défilement, une case par jour avec activités, mots à remplir, mini-jeux, photos souvenirs, animations, le plus interactif possible.
- Alexandre exige qu'on lui pose des questions **avant** d'écrire quoi que ce soit.
- Réponses successives :
  - Mélange cases-jeux + cases préparées ; **seulement 6 cases préparées** (4, 8, 12, 16, 20, 24), toujours préparées par les deux.
  - Ambiance : plusieurs mondes (montagnes, Saint-Nicolas, forêt/lac, marché, grotte de glace, pôle Nord), nuit selon l'heure réelle, météo scénarisée.
  - Activités : réflexion, adresse, souvenirs/mots doux ; couple **à distance** → jeux en direct (Pictionary, quiz synchro, duels, créations à deux) et en différé (défi photo croisé, score à battre, dessin à deviner, activités synchronisées).
  - Ouverture le jour J avec rattrapage ; démo fictive publique + version privée (un mot de passe par personne) ; téléphone et ordinateur ; rappel la veille.
  - Prénom : **Flavie**. Contenu d'exemple à remplacer plus tard. Musique composée libre de droits qui suit les ambiances.
  - Architecture « très qualitative, comme un jeu mobile » : React + TypeScript + Vite, PixiJS (2D isométrique), GSAP, Tone.js, Supabase avec mode démo.
  - Style isométrique vectoriel plat (dioramas enneigés). Personnages Alexandre/Flavie, **chacun sa position** (course). Mascotte **Pingou** (pingouin).
  - Îlots flottants rejetés → **terrain continu** ; relief en facettes (vraies montagnes en pointe, falaises, neige lisse).
- Dépôt **Elysios05/chrismas-calendar** (privé). Équipes : Monde, Interface, Jeux en sessions directes chez Alexandre ; Backend, Audio, Qualité en arrière-plan via le chef. Équipes → chef par **issues GitHub**.
- Backend : ouverture **7 h**, vraies adresses e-mail, photos 2000 px, case figée après ouverture par l'autre, démo dans /demo/, e-mails via **Brevo** (expéditeur : Hotmail d'Alexandre), e-mail de Pingou validé.
- Audio : **airs de Noël du domaine public** par monde (Mon beau sapin, Il est né, Douce nuit, Vive le vent, God Rest Ye, We Wish You) ; volumes **musique 50 %, effets 60 %** ; garder le bruit de pas ; bruitages d'ambiance par monde.
- Rappel : **notification push à 20 h**, relance **22 h 30** ; textes validés ; icône Pingou.

## 18 novembre — retours de tests
- 11 retours sur le déploiement 6a8adb5 : déplacement au pouce, neige au gyroscope, faisceau des maisons, animaux interactifs, halo sur le joueur, déplacement ordinateur plus simple, personnage qui suit la caméra sans entrer dans les zones verrouillées, animation de présentation de chaque monde, ne charger que la zone courante, combler les bords, personnages animés → tickets #9 à #14.
- Workflow `main.yml` supprimé avec son accord (doublon de `deploy.yml`).
- Surveillance des tickets demandée (15 min).
- Fin du monde : scène finale avec le traîneau qui décolle. Pôle Nord : village du Père Noël, lutins, fabrique de jouets (#42). Pas de deuxième équipe Jeux.

## 19 novembre
- 6 retours : déplacement au doigt (PR #57), menus du haut (#51), aurores (#48), mouvement du décor (#11/#42), carré vert du traîneau (#49), cadeau 16 caché (#50).
- Souvenirs : HTML imprimable en PDF (PR #58), avec fond et décors (PR #62).
- Règles d'économie de contexte (journal puis `/clear`), ticket unique de questions #59, modèle par tâche.
- Outil de capture commun décidé (`npm run capture`, PR #70).
- Question d'un deuxième abonnement : possible, les comptes ne partagent rien, la coopération passe par le dépôt.

## 20–24 novembre
- 20 nov : PR #69 à #73 fusionnées (tests e2e, capture, aurores, cadeaux lisibles, icône Pingou). Limite hebdomadaire atteinte, Audio (#68) interrompu.
- 24 nov : estimation du reste (~40 tâches) et pistes pour tenir le 30 (voir `chef.md`, « Où on en est »). Alexandre envisage un deuxième abonnement : point de reprise écrit dans `chef.md`.
