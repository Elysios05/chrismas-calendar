# Mettre en ligne la version privée (Supabase) — guide pas à pas

Compte gratuit, ~20 minutes. Tant que ce n'est pas fait, le site tourne en **mode démo** (tout marche, mais
les données restent dans le navigateur et chacun a les siennes).

> Ce qu'on obtient : deux comptes (Alexandre, Flavie), la progression partagée, les cases préparées
> **illisibles par l'autre avant le jour J** (vérifié par le serveur, pas par le site), les photos privées
> et les jeux en direct.

---

## 1. Créer le projet

1. Va sur <https://supabase.com> → **Start your project** → connecte-toi avec GitHub.
2. **New project** :
   - *Name* : `calendrier-avent`
   - *Database password* : clique **Generate**, garde-le dans ton gestionnaire de mots de passe (on n'en aura plus besoin ici).
   - *Region* : **Central EU (Frankfurt)** (le plus proche de Ljubljana et de la France).
3. Attends 1–2 minutes que le projet soit prêt.

## 2. Créer les tables et les règles de sécurité

1. Menu de gauche → **SQL Editor** → **New query**.
2. Ouvre le fichier [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) du dépôt, copie **tout**, colle-le.
3. **Run**. Tu dois voir « Success. No rows returned ». (On peut le relancer sans risque.)

Ça crée : les tables `profiles`, `progress`, `prepared_content`, `game_state`, `app_settings`,
le bucket privé `photos` et toutes les règles d'accès.

## 3. Régler la connexion

Menu **Authentication** → **Sign In / Providers** (ou *Providers* → *Email*) :
- **Allow new users to sign up** : **désactivé** (personne d'autre ne peut créer de compte).
- **Confirm email** : **désactivé** (pas besoin de cliquer un lien).
- Garde **Email** activé.

## 4. Créer les deux comptes

Menu **Authentication** → **Users** → **Add user** → **Create new user**, deux fois :

| Pour | E-mail | Mot de passe |
|---|---|---|
| Alexandre | ta vraie adresse | celui que tu veux |
| Flavie | sa vraie adresse | celui que tu choisis pour elle (elle pourra le changer) |

Coche **Auto Confirm User**.

> **Les adresses ne sont écrites nulle part dans le dépôt** : le site les lit dans des variables
> (`VITE_EMAIL_ALEXANDRE`, `VITE_EMAIL_FLAVIE`, étapes 6 et 7).
> ⚠️ Mais elles **restent visibles dans le code JavaScript du site publié** (version privée) :
> quelqu'un qui fouille le code de la page pourrait les lire. Il ne pourrait rien en faire sans
> les mots de passe, mais c'est à savoir.

Puis relie chaque compte à son personnage : **SQL Editor** → nouvelle requête → colle, **remplace les deux
adresses** et **Run** :

```sql
insert into public.profiles (user_id, who)
select id, 'alexandre' from auth.users where email = 'ADRESSE_D_ALEXANDRE'
union all
select id, 'flavie'    from auth.users where email = 'ADRESSE_DE_FLAVIE'
on conflict (user_id) do update set who = excluded.who;

select p.who, u.email from public.profiles p join auth.users u on u.id = p.user_id;  -- doit afficher 2 lignes
```

### Mot de passe oublié

Le site peut envoyer un lien « choisir un nouveau mot de passe ». Pour que ce lien ramène sur le site :
**Authentication** → **URL Configuration** :
- *Site URL* : `https://<ton-compte>.github.io/chrismas-calendar/`
- *Redirect URLs* : ajoute la même adresse, et `http://localhost:5173/**` pour tester en local.

⚠️ Sans configuration supplémentaire, l'envoi d'e-mails de Supabase est **très limité** (quelques
e-mails par heure, et seulement vers les adresses des membres de ton organisation Supabase). Deux
solutions simples :
- inviter Flavie dans ton organisation Supabase (**Organization** → **Team** → **Invite**) ; ou
- en cas d'oubli, change son mot de passe toi-même : **Authentication** → **Users** → clic sur son
  compte → **Send password recovery** ou modifie-le directement.

## 5. Temps réel

Menu **Realtime** → **Settings** : désactive **Allow public access** (les salles de jeu n'acceptent
alors que vos deux comptes). Enregistre.

## 6. Récupérer les clés et tester en local

Menu **Project Settings** → **API** (ou **Data API** / **API Keys**) :
- **Project URL** → ressemble à `https://abcdefgh.supabase.co`
- **anon public** key (ou **publishable key**, `sb_publishable_…`) → longue chaîne.
  ⚠️ N'utilise **jamais** la clé `service_role` / `secret` dans le site.

À la racine du dépôt, crée un fichier **`.env.local`** (il est ignoré par git) :

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=colle-la-clé-anon-ici
VITE_EMAIL_ALEXANDRE=ton-adresse
VITE_EMAIL_FLAVIE=son-adresse
```

Puis `npm run dev` : le site passe automatiquement en mode Supabase (il demande le mot de passe).
Supprime ou renomme `.env.local` pour revenir au mode démo.

## 7. Brancher le site en ligne (GitHub Pages)

Sur GitHub, dépôt `chrismas-calendar` → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**, et crée :

| Nom | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | la Project URL |
| `VITE_SUPABASE_ANON_KEY` | la clé anon / publishable |
| `VITE_EMAIL_ALEXANDRE` | ton adresse (celle du compte) |
| `VITE_EMAIL_FLAVIE` | celle de Flavie |

Puis **Actions** → **Déploiement GitHub Pages** → **Run workflow** (ou pousse sur `main`).
Résultat :
- `https://<ton-compte>.github.io/chrismas-calendar/` → **version privée** (connexion obligatoire) ;
- `https://<ton-compte>.github.io/chrismas-calendar/demo/` → **version démo** publique, sans backend.

> La clé anon est faite pour être publique : la sécurité vient des règles côté serveur (étape 2).

## 8. Tester avant le 1er décembre

Les cases s'ouvrent selon la date **du serveur** : **à 7 h du matin, heure de Paris**
(avant 7 h, c'est encore la case de la veille). Pour simuler un jour :
**Table Editor** → `app_settings` → colonne `day_override` → mets par ex. `12` → **Save**.
**Remets-la à `NULL` avant le 1er décembre !**

Pour repartir de zéro après tes tests (SQL Editor) :
```sql
delete from public.progress; delete from public.game_state; delete from public.prepared_content;
```
Les photos de test se suppriment dans **Storage** → `photos`.

## Réglages modifiables (table `app_settings`)

| Colonne | Défaut | Rôle |
|---|---|---|
| `timezone` | `Europe/Paris` | fuseau de référence (Ljubljana est dans le même) |
| `open_hour` | `7` | heure d'ouverture de la case du jour (7 = 7 h du matin, 0 = minuit…) |
| `day_override` | `NULL` | force « aujourd'hui » pour tester |

Si tu changes `open_hour`, change aussi `OPEN_HOUR` dans `src/backend/config.ts` (utilisé par la démo).

## Bon à savoir

- **Projet gratuit mis en pause** après 7 jours sans aucune visite : si ça arrive avant décembre,
  ouvre le tableau de bord Supabase et clique **Restore project**. Pendant décembre, vos visites
  quotidiennes le gardent éveillé.
- **Case préparée figée** : tu peux modifier la case que tu prépares pour l'autre jusqu'au moment où
  il ou elle l'ouvre ; ensuite le serveur refuse toute modification.
- Photos : le site les réduit (2000 px max, JPEG) avant l'envoi ; le serveur refuse au-delà de 10 Mo.
- Vérifier les règles de sécurité sans Supabase (développeurs) : `bash supabase/tests/run_sql_tests.sh`.
