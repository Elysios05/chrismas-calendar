# Salons — calendrier clé en main pour n'importe quel couple

Décidé par Alexandre le 25 nov 2026 (0 h 20), **à livrer avant le 30 nov**. Référence pour toutes les équipes.

## Ce que veut Alexandre
- **N'importe qui** peut créer un calendrier (un « salon ») depuis le site, sans rien installer.
- Le créateur **paramètre tout** : prénoms, couleurs des personnages, contenu personnel des jeux (questions du quiz,
  énigmes, rébus…), puis reçoit **un lien à donner à la personne choisie**.
- La personne invitée **n'a rien à faire** : elle ouvre le lien, choisit son mot de passe à la première connexion
  (ou la session s'ouvre directement), et c'est tout. Seul geste inévitable : accepter les notifications
  (sur iPhone : ajouter le site à l'écran d'accueil, règle d'Apple).
- **Flavie ne fait rien d'autre** : Alexandre teste seul, avec deux appareils, avant le 30.
- Le salon d'Alexandre et Flavie n'est qu'un salon parmi d'autres (le premier).

## Principes techniques (décidés par le chef)
1. **Un seul Supabase pour tous les salons** (celui d'Alexandre), un seul site GitHub Pages. Personne d'autre
   n'installe quoi que ce soit. Le guide `docs/supabase.md` ne concerne qu'Alexandre, une seule fois.
2. **Les clés internes `alexandre` / `flavie` du type `Who` restent** : elles désignent les **places** du salon
   (`alexandre` = place 1, le créateur ; `flavie` = place 2, l'invité·e). **Aucun texte affiché ne doit plus
   contenir « Alexandre » ou « Flavie » en dur** : tout passe par la configuration du salon
   (`salon.joueurs[who].prenom`, couleurs…). Pas de grand renommage : zéro conflit entre équipes.
3. **Configuration du salon** (stockée par salon, lisible par ses deux membres) :
   - `joueurs.alexandre|flavie` : prénom, couleurs (manteau, bonnet, pompon, cheveux, cheveux longs) ;
   - `contenu` : un objet par jour de jeu personnalisable (`contenu["1"]` = questions du quiz, etc.), qui
     **remplace** le contenu par défaut de `src/data/games/` ; absent = contenu par défaut (générique).
   - Le contenu par défaut de `src/data/games/` est **générique**. Le contenu personnel d'un couple n'est **jamais** dans
     le dépôt (public) : il vit seulement dans la config de son salon (Supabase), ou dans `prive/` (ignoré par git).
4. **Liens** : création de salon → lien de connexion du créateur (à garder) + **lien d'invitation** pour l'autre
   (jeton à usage unique, puis choix du mot de passe). E-mail facultatif, seulement pour « mot de passe oublié ».
5. **Création ouverte à tous** → garde-fous : quotas par salon (photos : nombre et taille), limite de création
   (par appareil / par heure), purge possible des salons vides. Le chef surveille l'usage du Supabase gratuit.
6. **Mode démo** (`/demo/`) : un salon fictif, inchangé pour l'utilisateur, et un parcours « créer un salon »
   simulé en local pour tester les écrans sans Supabase.
7. **Textes sans accord de genre** : comme on ne connaît pas les personnes, aucune phrase ne doit dépendre de
   « il/elle » (ex. à corriger : « S'il n'est pas là… il répondra » dans `DayWindow`). Tournures neutres :
   « Si Flavie n'est pas là, tu joues ton tour et la réponse viendra plus tard. » À vérifier dans `src/ui/`
   (Pingou compris), `src/games/`, les e-mails et les notifications.
8. Rappels, temps réel, cases préparées figées, ouverture à 7 h : **par salon**, mêmes règles qu'avant.

## Qui fait quoi
| Équipe | Lot |
|---|---|
| Chef | Contrat (`src/core/contracts.ts`) : délégué au Backend pour ce lot, relu à la fusion ; assemblage `App.tsx` (routes : accueil, création, invitation). |
| Backend | Schéma multi-salons + RLS + invitations + quotas, `SalonApi` dans le contrat, DemoBackend multi-salons, guide mis à jour. **En premier : le contrat et le DemoBackend** (débloque les autres). |
| Interface | Accueil « Créer notre calendrier », assistant de création (prénoms, couleurs, contenu), page « lien à envoyer », première connexion par lien (choix du mot de passe), écran de connexion par salon, réglages du salon. Éditeur de contenu **générique** qui lit le schéma de chaque jeu. |
| Jeux | Chaque jeu lit son contenu dans `ctx` (contenu du salon, sinon défaut) et exporte un **schéma de contenu** (champs à remplir, avec exemples) pour l'éditeur générique. À faire pour les jeux déjà livrés puis pour chaque nouveau. Prénoms jamais en dur. |
| Monde | Personnages, Pingou, panneaux : prénoms et couleurs depuis la config du salon (`PLAYERS` ne sert plus que de valeurs par défaut). |
| Qualité | Parcours e2e : créer un salon → inviter → l'invité·e se connecte par le lien → jouer ; deux salons ne se voient pas. |
