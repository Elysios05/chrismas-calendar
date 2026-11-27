# Stratégie TikTok — Chrismas Calendar

_Préparé le 27 nov 2026 par l'équipe Marketing. Rien n'est publié : c'est la personne qui gère le compte qui poste._

## 0. Règles de sécurité (à lire avant tout)

La surprise pour la personne qui recevra le vrai calendrier ne doit pas fuiter.

- **Compte dédié** : un compte TikTok neuf au nom du produit (ex. `@chrismas.calendar`), pas lié à ton compte personnel, ton numéro ou tes contacts (désactiver « Suggérer ton compte aux contacts »). Ne pas suivre les proches depuis ce compte.
- **Ni visage, ni voix reconnaissable** : écran seul, texte à l'écran, voix de synthèse TikTok ou voix off transformée. Pas de prénoms réels, pas de lieu réel, pas de souvenirs perso, pas de photos perso.
- **Captures uniquement avec le salon fictif « Sam & Camille »** (`npm run capture -- --prenoms=Sam,Camille`). La commande refuse de capturer si un vrai prénom reste visible.
- **Angles « mon copain m'a codé un jeu » et making-of** : tant que la surprise n'est pas passée (case 1 ouverte le 1er décembre), les formuler à la 3e personne ou en fiction (« un dev a codé… »). Après le 1er décembre seulement, tu peux passer à la première personne, si tu es à l'aise avec l'idée que la personne puisse les voir.
- **Aucune promesse de prix** : « gratuit pour le moment » au plus, jamais « gratuit pour toujours ».

## 1. Positionnement

**Une phrase** : « Le calendrier de l'Avent pour les couples à distance : un petit jeu mobile à ouvrir chaque jour ensemble. »

**Ce qui nous distingue** (à répéter) :
1. Ce n'est pas un calendrier de chocolats ni une liste de messages : c'est un **monde en 3D isométrique** qu'on traverse comme un jeu.
2. **Des jeux à deux en direct**, chacun chez soi.
3. **Personnalisable en 5 minutes**, rien à installer : on envoie **un lien**.
4. Une mascotte attachante, **Pingou**.

**Ton** : chaleureux, un peu drôle, jamais commercial. On vend une émotion (« j'ai hâte d'ouvrir la case avec toi »), pas une fonctionnalité.

## 2. Cible

| Cible | Pourquoi | Comment la toucher |
|---|---|---|
| **Principale** : 18-30 ans en couple à distance (études, expatriation, travail, frontières) | Déjà très présents sur TikTok (#ldr, #relationàdistance), cherchent des rituels à deux en décembre | Hashtags LDR, sons romantiques, texte « tag ton/ta chéri·e » |
| **Secondaire** : couples à distance plus âgés, jeunes couples « geek » | Aiment l'idée d'un cadeau original | Angle « cadeau », partage en MP |
| **Tertiaire** : devs, makers, curieux de l'IA | Intéressés par le making-of d'agents IA ; relais utiles pour les étoiles GitHub | Angle 3, hashtags #buildinpublic #claude |

Le vrai prescripteur est **la personne qui crée** : la com s'adresse à elle (« envoie ça à ta moitié »), et c'est elle qui partage le lien.

## 3. Trois angles

### Angle A — Couple à distance (cœur de campagne, ~60 % des vidéos)
Émotion et envie. « 24 jours, 24 cases, un monde à traverser même quand on est à 800 km. » Montrer le monde, Pingou, les jeux, le mot doux d'une case préparée (texte fictif).
Formats : screen recordings esthétiques, « POV : ton/ta chéri·e t'envoie ça », « tag la personne qui te manque ».

### Angle B — « Mon copain m'a codé un jeu » (~20 %)
Récit et fierté. L'idée d'un cadeau fait main, devenue un jeu complet. À la 3e personne tant que la surprise n'est pas passée (voir §0). Cet angle transforme la vidéo en **cadeau-modèle** : « tu peux faire pareil, gratuitement, en 5 min » (sans avoir besoin de savoir coder).
Formats : « quelqu'un a codé un calendrier de l'Avent pour sa copine à distance », réaction aux premières cases, « ce que j'ai prévu à la case 12 » (en fictif).

### Angle C — Making-of IA (~20 %)
Curiosité et crédibilité technique. « Une personne, une équipe de 7 agents IA : monde, interface, jeux, backend, audio, qualité, chef de projet. » Montrer le dépôt GitHub, les PR, les issues, un agent qui répond à un autre, les captures avant/après.
Formats : « j'ai embauché 7 IA », time-lapse du monde qui se construit, « l'IA qui a dessiné ce pingouin en code ». Appel à l'action secondaire : ⭐ sur GitHub (lien en bio de la page projet, pas sur TikTok directement).

## 4. Calendrier de publication, 27 nov au 24 déc

Rythme réaliste pour une personne : **1 vidéo par jour jusqu'au 1er décembre** (urgence : les couples doivent créer **avant** le 1er), puis **3 à 4 par semaine**, puis un sprint avant Noël. Chaque vidéo ≈ 30 minutes de travail si elle est faite à partir de captures. Prévoir des vidéos « en réserve ».

Les numéros S1 à S8 renvoient à [`scripts-tiktok.md`](scripts-tiktok.md).

| Date | Angle | Vidéo | Objectif |
|---|---|---|---|
| Ven 27 nov | A | **S1** « Le calendrier de l'Avent pour les couples à distance » (captures) | lancement, attirer |
| Sam 28 nov | A | **S2** « POV : il·elle t'envoie ça » (captures, jour puis nuit) | partage en MP |
| Dim 29 nov | B | **S4** « Quelqu'un a codé un calendrier de l'Avent pour sa copine à distance » (3e personne) | storytelling |
| Lun 30 nov | A | **S3** « Dernière ligne droite : crée-le ce soir » (captures, compte à rebours) | conversion avant le 1er |
| Mar 1 déc | A | **S5** « Case 1 ouverte » : « c'est parti » (captures, jour 1) | rappel + urgence douce (« il n'est pas trop tard : crée le tien aujourd'hui, ouvre les cases en rattrapage ») |
| Mer 2 déc | C | **S6** « J'ai embauché 7 IA » | audience tech, GitHub |
| Jeu 3 déc | A | Extrait de jeu en direct (jeu du jour) | démontrer le « à deux » |
| Dim 6 déc | A | Duel de Saint-Nicolas (jeu 6, 🔴 en direct) | pic de Saint-Nicolas |
| Mar 8 déc | C | **S7** « Comment 7 agents IA se parlent » (issues, PR) | contenu making-of |
| Jeu 10 déc | A | Tempête de neige du jour 10 (capture) | variété visuelle |
| Dim 13 déc | A | Bonhomme de neige à deux | jeu à deux |
| Mar 15 déc | C | Dépôt GitHub : 1 mois de PR en 20 s | étoiles |
| Jeu 17 déc | A | **S8** « 3 jeux auxquels jouer à distance » (compilation) | contenu à partager |
| Dim 20 déc | A | Case préparée (fictive) : « le mot doux à la case 20 » | émotion |
| Mar 22 déc | B | « Ce qu'on garde de ce projet » (si tu es à l'aise avec la 1re personne) | communauté |
| Jeu 24 déc | A | Final : « Joyeux Noël de la part de Pingou » (feu d'artifice, jour 24) | clôture, fidélisation pour l'an prochain |

Les jours sans vidéo : répondre aux commentaires (2 × 10 min par jour, **c'est ce qui fait grimper la portée**), reposter en story, et épingler la meilleure vidéo.

**Meilleurs horaires** à tester : 12 h-13 h et 19 h-22 h (heure de Paris). Garder la même heure plusieurs jours pour comparer.

## 5. Bio, hashtags, appel à l'action

**Nom** : Chrismas Calendar
**Bio (80 caractères max conseillés)** :
`Le calendrier de l'Avent des couples à distance 🐧❄️ Crée le tien, c'est gratuit pour le moment ⬇️`
Variante : `24 cases à ouvrir à deux, où que vous soyez 🎄 Un jeu à envoyer à ta moitié ⬇️`

**Lien en bio** : https://elysios05.github.io/chrismas-calendar/ (page de création). Dans les légendes, écrire « lien dans la bio » (les liens ne sont pas cliquables dans les légendes TikTok).

**Appel à l'action** (une seule par vidéo, toujours dit ET écrit) :
- Avant le 1er : « Crée-le **avant le 1er décembre**, lien en bio. »
- Après le 1er : « Tu peux le créer aujourd'hui, les cases passées restent ouvrables. »
- Partage : « Envoie ça à la personne qui te manque. »
- Making-of : « Le code est public sur GitHub, lien en bio. »

**Hashtags** (5 à 7 par vidéo, 2 larges, 3 ciblés, 1 de marque) :
- Larges : `#fyp` `#noel` `#calendrierdelavent`
- Couple à distance : `#couplealadistance` `#relationadistance` `#ldr` `#longdistancerelationship` `#ldrcouple`
- Idée cadeau : `#ideecadeau` `#cadeaunoel` `#cadeaucouple`
- Jeu et tech : `#jeumobile` `#webgame` `#gamedev` `#indiedev`
- Making-of IA : `#claude` `#ia` `#codingtiktok` `#buildinpublic` `#vibecoding`
- Marque : `#chrismascalendar` `#pingou`

## 6. Mesurer

Tableau de suivi à remplir chaque matin (une ligne par vidéo, 24 h et 72 h après publication) :

| Indicateur | Où | Objectif indicatif |
|---|---|---|
| Vues, taux de visionnage jusqu'au bout | Analytics TikTok | > 40 % de rétention à 3 s |
| Partages et enregistrements | Analytics TikTok | le meilleur signal : « envoyer à sa moitié » |
| Clics vers le lien en bio | Analytics TikTok (si compte pro) | > 1 % des vues |
| **Salons créés** | Supabase (nombre de lignes dans la table des salons) ou le journal de la page de création | l'indicateur réel |
| Étoiles GitHub, visites du dépôt | GitHub > Insights > Traffic | quelques dizaines |

**Règle de pilotage** : après 5 vidéos, garder l'angle qui a le plus de partages (pas de vues), et refaire ses 2 meilleurs formats. Si une vidéo dépasse 10 000 vues, répondre en vidéo aux commentaires les plus drôles. Pour savoir d'où viennent les créations, ajouter un paramètre au lien en bio (ex. `?src=tiktok`) si l'Interface le permet (à demander au chef de projet par une issue ; sinon comparer les créations par jour).

**Garde-fou technique** : le Supabase gratuit a des quotas. Si une vidéo explose, prévenir le chef de projet (issue) pour surveiller l'usage et les limites de création.
