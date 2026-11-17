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

Sans configuration supplémentaire, l'envoi d'e-mails de Supabase est **très limité** (quelques e-mails
par heure, et seulement vers les membres de ton organisation Supabase). On branche donc un service
d'envoi gratuit : voir l'**étape 9 (Brevo)**. En attendant, en cas d'oubli, tu peux changer un mot de
passe toi-même : **Authentication** → **Users** → clic sur le compte.

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
# Rappels (étape 10) :
VITE_VAPID_PUBLIC_KEY=
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
| `VITE_VAPID_PUBLIC_KEY` | clé publique des rappels (étape 10) |

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
| `reminder_hour` / `reminder_minute` | `20` / `0` | heure du rappel de la veille (étape 10) |
| `followup_time` | `22:30` | heure de la relance si la case est toujours vide (`NULL` = pas de relance) |

Si tu changes `open_hour`, change aussi `OPEN_HOUR` dans `src/backend/config.ts` (utilisé par la démo).

## Bon à savoir

- **Projet gratuit mis en pause** après 7 jours sans aucune visite : si ça arrive avant décembre,
  ouvre le tableau de bord Supabase et clique **Restore project**. Pendant décembre, vos visites
  quotidiennes le gardent éveillé.
- **Case préparée figée** : tu peux modifier la case que tu prépares pour l'autre jusqu'au moment où
  il ou elle l'ouvre ; ensuite le serveur refuse toute modification.
- Photos : le site les réduit (2000 px max, JPEG) avant l'envoi ; le serveur refuse au-delà de 10 Mo.
- Vérifier les règles de sécurité sans Supabase (développeurs) : `bash supabase/tests/run_sql_tests.sh`.

---

## 9. Envoyer les e-mails « mot de passe oublié » avec Brevo (gratuit)

**Pourquoi Brevo ?** C'est le seul des deux qui marche **sans nom de domaine à toi** : Resend, sans
domaine vérifié, n'envoie qu'à l'adresse de ton propre compte Resend (donc pas à Flavie), alors que
Brevo accepte comme expéditeur une simple adresse (Gmail, Hotmail…) vérifiée par un code. L'offre
gratuite (environ 300 e-mails par jour) est très largement suffisante pour deux comptes.

> À vérifier au moment de l'inscription : les conditions de Brevo changent de temps en temps
> (voir « Si les e-mails n'arrivent pas » plus bas).

### 9.1 Créer le compte Brevo
1. Va sur <https://www.brevo.com> → **S'inscrire gratuitement** (avec ton adresse habituelle).
2. Remplis le profil demandé (nom, « usage personnel » ; pas besoin de site web) et choisis l'offre **Gratuite**.
3. Confirme ton adresse avec le lien reçu par e-mail.

### 9.2 Ajouter l'expéditeur
1. En haut à droite : ton nom → **Expéditeurs, domaines et IP dédiées** → **Expéditeurs** → **Ajouter un expéditeur**.
2. *Nom* : `Pingou du calendrier` — *E-mail* : ton adresse (Hotmail/Gmail).
3. Brevo t'envoie un **code** : colle-le pour valider l'expéditeur.

### 9.3 Récupérer les identifiants SMTP
1. Ton nom → **SMTP et API** → onglet **SMTP**.
2. Note les 4 informations affichées :
   - **Serveur SMTP** : `smtp-relay.brevo.com`
   - **Port** : `587`
   - **Identifiant** (login) : une adresse du genre `xxxxxx@smtp-brevo.com`
   - **Clé SMTP** : clique **Générer une nouvelle clé SMTP**, nomme-la `supabase`, et **copie-la tout de suite**
     (elle ne s'affiche qu'une fois). C'est le « mot de passe » SMTP.

(Si l'écran de Brevo affiche d'autres valeurs que celles-ci, ce sont les siennes qui comptent.)

### 9.4 Les saisir dans Supabase
**Authentication** → **Emails** → onglet **SMTP Settings** → active **Enable Custom SMTP** :

| Champ Supabase | Valeur |
|---|---|
| Sender email | l'adresse validée à l'étape 9.2 |
| Sender name | `Pingou du calendrier` |
| Host | `smtp-relay.brevo.com` |
| Port number | `587` |
| Username | l'identifiant `…@smtp-brevo.com` |
| Password | la clé SMTP |
| Minimum interval between emails | laisse la valeur par défaut |

**Save**. (La clé SMTP reste dans Supabase : elle ne va ni dans le dépôt ni dans GitHub.)

Ensuite **Authentication** → **Rate Limits** : vérifie que *Rate limit for sending emails* vaut au moins
quelques e-mails par heure (par ex. 10).

### 9.5 Mettre l'e-mail en français, signé Pingou
**Authentication** → **Emails** → onglet **Templates** → **Reset Password** :
- *Subject* : `🐧 Pingou t'aide à retrouver ton mot de passe`
- *Message body* (onglet **Source**) : remplace tout par le contenu du fichier
  [`supabase/templates/reset-password.html`](../supabase/templates/reset-password.html) du dépôt
  (garde bien `{{ .ConfirmationURL }}`, c'est le lien).
- **Save**.

Aperçu du texte :
> **Oups, la clé du calendrier s'est perdue dans la neige !**
> C'est Pingou ! Quelqu'un (toi, j'espère 😉) a demandé un nouveau mot de passe pour ouvrir les cases du
> calendrier de l'Avent. Pas de panique : j'ai retrouvé la clé sous un flocon.
> [🔑 Choisir un nouveau mot de passe]
> Le lien ne marche qu'une fois et pendant peu de temps, alors ne traîne pas trop dans la poudreuse !
> Des bisous givrés, **Pingou** 🐧

### 9.6 Adresse de retour du lien
Déjà fait à l'étape 4 (« Mot de passe oublié ») ; vérifie dans **Authentication** → **URL Configuration** :
- *Site URL* : `https://<ton-compte>.github.io/chrismas-calendar/`
- *Redirect URLs* : cette même adresse **et** `http://localhost:5173/**`.

Sans ça, le lien de l'e-mail renverrait vers une mauvaise page.

### 9.7 Tester
1. **Authentication** → **Users** → clic sur **ton** compte → **Send password recovery**.
2. Tu dois recevoir l'e-mail de Pingou en quelques secondes (regarde aussi les **spams / courrier indésirable**).
3. Clique le bouton : tu arrives sur le site, qui doit te proposer de choisir un nouveau mot de passe.
4. Une fois que ça marche pour toi, fais pareil avec le compte de Flavie (préviens-la avant 😉).

Dans Brevo, **Transactionnel** → **Logs** (ou **Statistiques**) montre chaque e-mail envoyé et s'il a été délivré.

### Si les e-mails n'arrivent pas
- **Dans les spams** : fréquent quand l'expéditeur est une adresse Gmail/Hotmail envoyée par un autre service.
  Demande à Flavie de marquer le premier e-mail « Pas un spam » et d'ajouter l'expéditeur à ses contacts.
- **Brevo remplace l'expéditeur** ou refuse l'adresse Gmail/Hotmail : certains fournisseurs (Gmail, Yahoo…)
  imposent maintenant des règles anti-usurpation, et Brevo peut alors exiger un domaine. Dans ce cas, le
  plus simple reste de changer le mot de passe depuis Supabase (**Authentication** → **Users**).
- **Rien dans les logs Brevo** : revérifie l'identifiant et la clé SMTP dans Supabase (9.4).
- **Compte Brevo en attente de validation** : à la création, Brevo peut vérifier le compte avant
  d'autoriser l'envoi (quelques heures). Réessaie plus tard.


---

## 10. Rappels la veille au soir (notifications sur le téléphone)

**Ce que ça fait** : la veille d'une case préparée (3, 7, 11, 15, 19 et 23 décembre), **à 20 h, heure de
Paris**, si ta case pour l'autre est encore vide, ton téléphone reçoit :
> 🐧 Psst… petit rappel de Pingou — *Psst… demain c'est la case 16, et elle est encore vide ! Flavie l'ouvrira à 7 h.*

**Relance à 22 h 30** si la case est **toujours** vide :
> 🐧 Toc toc… Pingou insiste (gentiment) — *La case 16 est toujours vide, et Flavie l'ouvre demain à 7 h ! Il te reste ce soir : deux lignes et une photo, et je file me coucher 💤💌*

Un toucher sur la notification ouvre le site sur la case. Pièces en jeu : le site (abonnement de
l'appareil), une **Edge Function** Supabase `rappel-veille` (envoi) et une **tâche planifiée** (`pg_cron`).

### 10.1 Créer les tables
**SQL Editor** → colle **tout** [`supabase/migrations/0002_rappels.sql`](../supabase/migrations/0002_rappels.sql) → **Run**,
puis pareil avec [`supabase/migrations/0003_relance.sql`](../supabase/migrations/0003_relance.sql) (la relance de 22 h 30).

### 10.2 Générer les clés VAPID (une fois)
Dans un terminal, à la racine du dépôt :
```bash
npx web-push generate-vapid-keys
```
Tu obtiens une **Public Key** et une **Private Key**. Garde-les dans ton gestionnaire de mots de passe.
- La **publique** va dans le site (ce n'est pas un secret) ;
- la **privée** ne va **que** dans les secrets de la fonction (jamais dans le dépôt ni dans GitHub).

Invente aussi un **CRON_SECRET** : une longue phrase au hasard (ex. `openssl rand -hex 24`).

### 10.3 Déclarer les secrets de la fonction
Supabase → **Edge Functions** → **Secrets** (ou *Manage secrets*) → ajoute :

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | la clé publique |
| `VAPID_PRIVATE_KEY` | la clé privée |
| `VAPID_SUBJECT` | `https://<ton-compte>.github.io/chrismas-calendar/` |
| `CRON_SECRET` | ta phrase secrète |

### 10.4 Déployer la fonction
Dans un terminal, à la racine du dépôt (la 1re commande ouvre le navigateur pour te connecter) :
```bash
npx supabase login
npx supabase functions deploy rappel-veille --project-ref <ID-du-projet> --no-verify-jwt --use-api
```
L'ID du projet est le morceau `abcdefgh` de `https://abcdefgh.supabase.co`.
`--no-verify-jwt` est voulu : la fonction vérifie elle-même le `CRON_SECRET`.
(Dans le tableau de bord, **Edge Functions** → `rappel-veille` → *Details* : « Verify JWT » doit être **désactivé**.)

### 10.5 Planifier le rappel de 20 h et la relance de 22 h 30
1. **Database** → **Extensions** : active **pg_cron** et **pg_net** (ou laisse le script le faire).
2. **SQL Editor** → colle [`supabase/cron_rappel.sql`](../supabase/cron_rappel.sql), **remplace les deux valeurs
   entre chevrons** (l'URL du projet et ton `CRON_SECRET`, sans les `< >`) → **Run**.

Deux tâches sont créées : `rappel-veille` (18 h et 19 h UTC) et `relance-veille` (20 h 30 et 21 h 30 UTC).
La base ne répond qu'à 20 h et 22 h 30 **heure de Paris**, ce qui gère tout seul l'heure d'hiver et l'heure
d'été. (Si tu changes `reminder_hour` ou `followup_time` dans `app_settings`, change aussi ces horaires.)
Tu avais déjà lancé ce script avant la relance ? Relance-le simplement : il est ré-exécutable.

### 10.6 Brancher la clé publique sur le site
- En local, dans `.env.local` : `VITE_VAPID_PUBLIC_KEY=la-clé-publique`
- Sur GitHub : nouveau secret `VITE_VAPID_PUBLIC_KEY` (même endroit qu'à l'étape 7), puis relance le déploiement.

### 10.7 Tester
1. Sur ton téléphone, active les rappels sur le site (voir ci-dessous).
2. Vérifie l'abonnement : **Table Editor** → `push_subscriptions` → une ligne avec `who = alexandre`.
3. **SQL Editor** → simulation à blanc (personne ne reçoit rien, la réponse dit qui serait prévenu) :
   ```sql
   select net.http_post(
     url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/rappel-veille',
     headers := jsonb_build_object('Content-Type', 'application/json',
       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_cron_secret')),
     body := '{"day": 16, "force": true, "dry": true}'::jsonb);
   -- puis, quelques secondes après :
   select status_code, content from net._http_response order by created desc limit 1;
   ```
4. Même requête **sans** `"dry": true` → la notification arrive sur ton téléphone (si ta case 16 est vide).
   Pour voir la relance : `'{"day": 16, "kind": "relance", "force": true}'`.
5. Le 3 décembre à 20 h, ça partira tout seul. Historique : `select * from public.reminder_log;` et
   `select * from cron.job_run_details order by start_time desc limit 5;`

### Pour Alexandre et Flavie : activer les rappels sur son téléphone

**iPhone / iPad** (iOS **16.4 minimum** : *Réglages → Général → Informations → Version d'iOS*)
1. Ouvre le site dans **Safari** (pas Chrome ni Instagram).
2. Bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvre le calendrier **depuis la nouvelle icône du sapin** sur l'écran d'accueil, et connecte-toi.
4. Touche **« Activer les rappels »** → **Autoriser**.
   Sans les étapes 2–3, l'iPhone ne propose pas les notifications : c'est une règle d'Apple.

**Android** (Chrome)
1. Ouvre le site dans **Chrome** et connecte-toi.
2. Touche **« Activer les rappels »** → **Autoriser**.
3. (Conseillé) Menu **⋮** → **Ajouter à l'écran d'accueil** / **Installer l'application**.

**Ça ne marche pas ?**
- Tu as touché « Ne pas autoriser » : *iPhone* → Réglages → Notifications → Calendrier → Autoriser ;
  *Android* → appui long sur l'icône (ou cadenas 🔒 dans la barre d'adresse) → Notifications → Autoriser.
- Mode « Ne pas déranger » / Concentration actif à 20 h : la notification arrive en silence.
- Changement de téléphone ou réinstallation : réactive simplement les rappels.
- Se déconnecter du site désactive les rappels sur cet appareil.
