# Mettre en ligne la version privée (Supabase) — guide pas à pas

Compte gratuit, ~30 minutes, **à faire une seule fois par Alexandre**. Tant que ce n'est pas fait, le site
tourne en **mode démo** (tout marche, mais les données restent dans le navigateur et chacun a les siennes).

> Ce qu'on obtient : **un seul Supabase pour tous les calendriers** (« salons », voir `docs/salons.md`).
> N'importe qui peut ensuite créer son calendrier depuis le site, sans rien installer : il choisit les
> prénoms, les couleurs et le contenu, puis envoie un **lien d'invitation** à l'autre personne, qui choisit
> son mot de passe et c'est tout. Chaque salon a sa progression, ses cases préparées **illisibles par l'autre
> avant le jour J** (vérifié par le serveur), ses photos privées, ses jeux en direct et ses rappels.
> Ton calendrier avec Flavie n'est qu'un salon parmi d'autres : tu le crées toi-même depuis le site (étape 11).

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
3. **Run**. Tu dois voir « Success. No rows returned ».
4. **Même chose, dans l'ordre**, avec les fichiers suivants (une nouvelle requête pour chacun) :
   [`0002_rappels.sql`](../supabase/migrations/0002_rappels.sql),
   [`0003_relance.sql`](../supabase/migrations/0003_relance.sql),
   [`0004_salons.sql`](../supabase/migrations/0004_salons.sql),
   [`0005_plafond_salons.sql`](../supabase/migrations/0005_plafond_salons.sql) (50 calendriers au plus),
   [`0006_securite.sql`](../supabase/migrations/0006_securite.sql) (limites, quotas, ménage nocturne des salons jamais utilisés).
   Exception par salon possible ensuite (photos plus grandes) : colonnes `photo_dimension`, `photo_octets_max`,
   `photo_max` de la table `salons`.

Tous les fichiers peuvent être relancés sans risque. Ça crée : les salons (`salons`, jetons d'invitation,
journal des créations), les tables de données (`profiles`, `progress`, `prepared_content`, `game_state`,
`push_subscriptions`…) toutes rangées **par salon**, le bucket privé `photos`, et les règles d'accès :
chaque compte ne voit **que son salon**.

## 3. Régler la connexion

Menu **Authentication** → **Sign In / Providers** (ou *Providers* → *Email*) :
- **Allow new users to sign up** : **désactivé**. Les comptes ne sont créés **que** par la fonction `salons`
  (étape 4), qui vérifie les limites ; personne ne peut créer de compte en direct.
- **Confirm email** : **désactivé** (pas besoin de cliquer un lien).
- Garde **Email** activé.

## 4. Déployer la fonction « salons » (création des calendriers et des comptes)

**Tu ne crées aucun compte à la main** : quand quelqu'un crée un calendrier sur le site, ou ouvre un lien
d'invitation et choisit son mot de passe, c'est la fonction `salons` qui crée le compte (côté serveur).

Dans un terminal, à la racine du dépôt (la 1re commande ouvre le navigateur pour te connecter) :
```bash
npx supabase login
npx supabase functions deploy salons --project-ref <ID-du-projet> --no-verify-jwt --use-api
```
L'ID du projet est le morceau `abcdefgh` de `https://abcdefgh.supabase.co`.
`--no-verify-jwt` est voulu : la fonction est appelée par des visiteurs pas encore connectés (création,
invitation) ; c'est la base qui vérifie tout (jeton à usage unique, limites).
Aucun secret à ajouter pour cette fonction.

> **Adresses e-mail** : chaque compte peut donner une vraie adresse (facultatif), qui ne sert qu'à
> « mot de passe oublié ». Sans adresse, le compte reçoit une adresse technique invisible
> (`<salon>-<place>@salons.invalid`) : on se connecte avec le prénom et le mot de passe, rien d'autre.
> Si Supabase refusait ces adresses techniques (erreur « Création du compte impossible… email »), la
> fonction essaie toute seule une autre forme ; en dernier recours, ajoute le secret `SALON_EMAIL_DOMAIN`
> (Edge Functions → Secrets) avec un nom de domaine à toi.

### Mot de passe oublié

Pour les comptes qui ont donné une vraie adresse, le site peut envoyer un lien « choisir un nouveau mot de
passe ». Pour que ce lien ramène sur le site :
**Authentication** → **URL Configuration** :
- *Site URL* : `https://<ton-compte>.github.io/chrismas-calendar/`
- *Redirect URLs* : ajoute la même adresse, et `http://localhost:5173/**` pour tester en local.

Sans configuration supplémentaire, l'envoi d'e-mails de Supabase est **très limité** (quelques e-mails
par heure, et seulement vers les membres de ton organisation Supabase). On branche donc un service
d'envoi gratuit : voir l'**étape 9 (Brevo)**. En attendant, en cas d'oubli, tu peux changer un mot de
passe toi-même : **Authentication** → **Users** → clic sur le compte (le compte d'une place se retrouve
avec `select p.who, u.email from public.profiles p join auth.users u on u.id = p.user_id where p.salon_id = '<id du salon>';`).

## 5. Temps réel

Menu **Realtime** → **Settings** : désactive **Allow public access** (chaque salle de jeu n'accepte
alors que les deux membres de son salon). Enregistre.

## 6. Récupérer les clés et tester en local

Menu **Project Settings** → **API** (ou **Data API** / **API Keys**) :
- **Project URL** → ressemble à `https://abcdefgh.supabase.co`
- **anon public** key (ou **publishable key**, `sb_publishable_…`) → longue chaîne.
  ⚠️ N'utilise **jamais** la clé `service_role` / `secret` dans le site.

À la racine du dépôt, crée un fichier **`.env.local`** (il est ignoré par git) :

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=colle-la-clé-anon-ici
# Rappels (étape 10) :
VITE_VAPID_PUBLIC_KEY=
```

Puis `npm run dev` : le site passe automatiquement en mode Supabase (page d'accueil « Créer notre
calendrier », ou écran de connexion du dernier salon ouvert). Supprime ou renomme `.env.local` pour revenir
au mode démo. (`VITE_EMAIL_ALEXANDRE` / `VITE_EMAIL_FLAVIE` ne servent plus : les adresses sont dans chaque salon.)

> Si la création d'un calendrier répond « Le serveur des calendriers ne répond pas » : la fonction `salons`
> n'est pas déployée (étape 4), ou la `Project URL` / la clé est fausse. Si le site répond « Mot de passe
> incorrect » alors que le mot de passe est bon : vérifie que tu es bien sur le lien de **ton** salon
> (`?salon=…`) ; le site affiche encore ce même message pour toute erreur de connexion.

## 7. Brancher le site en ligne (GitHub Pages)

Sur GitHub, dépôt `chrismas-calendar` → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**, et crée :

| Nom | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | la Project URL |
| `VITE_SUPABASE_ANON_KEY` | la clé anon / publishable |
| `VITE_VAPID_PUBLIC_KEY` | clé publique des rappels (étape 10) |

(Les anciens secrets `VITE_EMAIL_ALEXANDRE` / `VITE_EMAIL_FLAVIE` ne servent plus ; tu peux les supprimer.)

Vérifie aussi, **une seule fois** : **Settings** → **Pages** → *Build and deployment* → **Source** : **GitHub Actions**
(sinon le déploiement se termine sans rien publier).

Puis **Actions** → **Déploiement GitHub Pages** → **Run workflow** (ou pousse sur `main`).
Résultat :
- `https://<ton-compte>.github.io/chrismas-calendar/` → **le site** : accueil « Créer notre calendrier », puis chaque salon avec ses comptes ;
- `https://<ton-compte>.github.io/chrismas-calendar/demo/` → **version démo** publique, sans backend.

> La clé anon est faite pour être publique : la sécurité vient des règles côté serveur (étape 2).

## 8. Tester avant le 1er décembre

Les cases s'ouvrent selon la date **du serveur** : **à 7 h du matin, heure de Paris**
(avant 7 h, c'est encore la case de la veille).

**Simuler un jour pour UN salon** (les autres ne sont pas touchés) : **Table Editor** → `salons` → la ligne de
ton salon (colonne `id` = le morceau après `?salon=` dans ton lien de connexion) → colonne `day_override` →
par ex. `12` → **Save**. Remets `NULL` après. (La colonne `day_override` de `app_settings` existe aussi, mais
elle change le jour de **tous** les salons : ne l'utilise plus une fois que d'autres couples sont inscrits.)

Pour retrouver un salon par les prénoms :
```sql
select id, config->'joueurs'->'alexandre'->>'prenom' as createur, config->'joueurs'->'flavie'->>'prenom' as invite,
       day_override, created_at
from public.salons order by created_at desc;
```

**Teste dans un salon de test, puis supprime-le** (étape 11). Une case ouverte pendant les tests est figée et
un rappel noté au journal ne repartirait pas : le plus simple est de jeter tout le salon de test.
```sql
select public.supprimer_salon('<id du salon de test>');   -- salon, données, comptes et appareils
```
Les photos de test se suppriment dans **Storage** → `photos` → dossier `<id du salon>` → **Delete**.

## Réglages modifiables (table `app_settings`)

| Colonne | Défaut | Rôle |
|---|---|---|
| `timezone` | `Europe/Paris` | fuseau de référence (Ljubljana est dans le même) |
| `open_hour` | `7` | heure d'ouverture de la case du jour (7 = 7 h du matin, 0 = minuit…) |
| `day_override` | `NULL` | force « aujourd'hui » pour tester |
| `reminder_hour` / `reminder_minute` | `20` / `0` | heure du rappel de la veille (étape 10) |
| `followup_time` | `22:30` | heure de la relance si la case est toujours vide (`NULL` = pas de relance) |
| `salon_photo_max` | `150` | nombre maximal de photos par salon |
| `salon_creations_par_heure` | `5` | calendriers qu'un même appareil (adresse IP) peut créer par heure |
| `salon_creations_par_jour` | `50` | calendriers créés par jour sur tout le site (protège l'offre gratuite) |

Si tu changes `open_hour`, change aussi `OPEN_HOUR` dans `src/backend/config.ts` (utilisé par la démo).

## Bon à savoir

- **Projet gratuit mis en pause** après 7 jours sans aucune visite : si ça arrive avant décembre,
  ouvre le tableau de bord Supabase et clique **Restore project**. Pendant décembre, vos visites
  quotidiennes le gardent éveillé.
- **Case préparée figée** : tu peux modifier la case que tu prépares pour l'autre jusqu'au moment où
  il ou elle l'ouvre ; ensuite le serveur refuse toute modification (texte, et aussi remplacement ou
  suppression des photos de cette case).
- Photos : le site les réduit (2000 px max, JPEG) avant l'envoi ; le serveur refuse au-delà de 10 Mo et au-delà
  de `salon_photo_max` photos par salon. Rangement : `photos/<id du salon>/<place>/…`.
- **Ménage** : un salon créé mais jamais rejoint (pas d'invité·e, aucune case ouverte, aucune photo) depuis
  plus de 14 jours peut être supprimé avec ses comptes : `select public.purge_salons_vides();` (renvoie le nombre
  de salons supprimés). À lancer à la main de temps en temps.
- **Surveiller l'offre gratuite** : **Project Settings** → **Usage** (base 500 Mo, stockage 1 Go, 50 000 comptes).
  Nombre de salons : `select count(*) from public.salons;`.
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

(Le prénom est celui de l'autre personne **du salon**.) Un toucher sur la notification ouvre le site sur la case, dans le bon salon. Pièces en jeu : le site (abonnement de
l'appareil), une **Edge Function** Supabase `rappel-veille` (envoi) et une **tâche planifiée** (`pg_cron`).

### 10.1 Créer les tables
Déjà fait à l'étape 2 (`0002_rappels.sql` et `0003_relance.sql`). Les rappels marchent pour **tous les salons**,
avec les prénoms de chaque salon dans le texte.

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
2. Vérifie l'abonnement : **Table Editor** → `push_subscriptions` → une ligne avec `who = alexandre` et le `salon_id` de ton salon.
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
   Un envoi de test (avec `day` ou `force`) **n'est pas inscrit au journal** : il n'empêche pas le vrai rappel.
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

---

## 11. Checklist de test, seul avec deux appareils (avant le 30 novembre)

**Flavie ne fait rien** : tu joues les deux rôles avec **deux appareils** (ton téléphone = place 1, le
créateur ; un 2e téléphone, une tablette ou l'ordinateur en **fenêtre privée** = place 2, l'invité·e), dans un
**salon de test** que tu supprimes à la fin. Le vrai calendrier avec Flavie se crée tout à la fin (partie H).

À faire dans l'ordre. Coche au fur et à mesure ; au premier ✗, note ce que tu vois (message exact, capture)
et dis-le à Claude.

**A. Création du salon** — appareil 1
- [ ] Le site en ligne affiche l'accueil « Créer notre calendrier » (si la carte s'ouvre sans rien demander,
      c'est le mode démo : les secrets GitHub de l'étape 7 manquent).
- [ ] Crée un calendrier avec des prénoms de test (ex. « Testeur » et « Testeuse »), des couleurs, un mot de
      passe, **sans** adresse e-mail. → La carte s'affiche, avec le prénom « Testeur » (pas « Alexandre »).
- [ ] La page « lien à envoyer » donne **deux liens** : le lien de connexion (`…?salon=…`, à garder) et le
      lien d'invitation (`…?invitation=…`). Copie l'`id` du salon (après `?salon=`) dans tes notes.
- [ ] **Table Editor** → `salons` : une ligne avec tes prénoms ; `profiles` : une ligne `alexandre` avec ce `salon_id`.

**B. Lien d'invitation → première connexion** — appareil 2
- [ ] Envoie-toi le lien d'invitation (message, e-mail…) et ouvre-le sur l'appareil 2 : l'accueil salue
      « Testeuse » et demande de **choisir un mot de passe**.
- [ ] Mot de passe trop court (moins de 6 caractères) → refusé avec un message clair.
- [ ] Choisis un mot de passe → la carte s'affiche, côté « Testeuse ». `profiles` a maintenant 2 lignes pour ce salon.
- [ ] Rouvre **le même lien d'invitation** (appareil 2, ou une autre fenêtre privée) → « déjà servi » et renvoi
      vers la connexion : le lien ne sert qu'une fois.
- [ ] Sur l'appareil 1, le réglage « nouveau lien d'invitation » n'est plus proposé (ou refusé : la place est prise).

**C. Connexion par le lien du salon**
- [ ] Appareil 2 : ferme et rouvre le site → toujours connecté·e, dans le bon salon.
- [ ] Ouvre le **lien de connexion** dans une nouvelle fenêtre privée : écran de connexion avec les deux prénoms ;
      mauvais mot de passe → « Mot de passe incorrect » ; mot de passe de Testeur sur la place Testeuse → refusé ;
      bon mot de passe → la carte.
- [ ] Modifie un prénom dans les réglages du salon (appareil 1) → il change aussi sur l'appareil 2 (au plus tard
      en rechargeant).

**D. Case préparée (le cœur du secret)** — `day_override` du salon de test à `12` (étape 8)
- [ ] Appareil 1 prépare la case 12 pour l'autre : un texte et une photo, puis enregistre, et la relit.
- [ ] Appareil 2 ouvre la case 12 : texte **et** photo.
- [ ] Appareil 1 essaie de modifier la case 12 → refus (« Cette case a déjà été ouverte… »).
- [ ] `day_override` à `4` : appareil 1 prépare la case 20 ; appareil 2 ne peut pas l'ouvrir (cadenas).
- [ ] **Storage** → `photos` : seau **Private**, photos rangées dans `<id du salon>/alexandre/`.

**E. Jeux et progression**
- [ ] Quand l'appareil 1 ouvre une case, l'appareil 2 voit sa progression avancer.
- [ ] Un jeu en direct, les deux appareils côte à côte : même salle (présence), départ synchronisé.

**F. Rappels (notification de 20 h)**
- [ ] Active les rappels sur les deux appareils (voir « Pour Alexandre et Flavie », étape 10) :
      `push_subscriptions` montre une ligne par appareil, avec le bon `who` et le `salon_id` du salon de test.
- [ ] Simulation à blanc (10.7, point 3) : la réponse liste ton salon de test pour la case 16.
- [ ] Envoi réel (10.7, point 4) : la notification arrive, avec le prénom **de test** de l'autre ; un toucher
      ouvre le site **sur la case 16**. Même chose avec `"kind": "relance"`.
- [ ] Remplis la case 16 d'un côté, relance la simulation à blanc : cette place n'est **plus** dans la liste.
- [ ] Planification : `select * from cron.job;` montre 2 lignes (`rappel-veille`, `relance-veille`) actives.
- [ ] iPhone : test fait **depuis l'icône** sur l'écran d'accueil (pas depuis Safari).

**G. Deux salons ne se voient pas** (facultatif, 5 minutes)
- [ ] Appareil 2, fenêtre privée neuve : crée un 2e salon de test. Il ne voit ni les cases, ni les photos, ni la
      progression du premier ; le lien de connexion du premier y demande un mot de passe.

**H. Ménage, puis le vrai calendrier**
- [ ] Supprime les salons de test (étape 8) : `select public.supprimer_salon('<id>');` pour chacun, puis leurs
      dossiers dans **Storage** → `photos`. Sur tes appareils, déconnecte-toi.
- [ ] `select count(*) from public.salons;` → `0` ; `select day_override from public.app_settings;` → `NULL`.
- [ ] Le 30 au soir : crée **votre** calendrier (prénoms Alexandre et Flavie, couleurs, contenu des jeux), garde
      le lien de connexion, et envoie le lien d'invitation à Flavie. Pour elle : ouvrir le lien, choisir son mot
      de passe, accepter les notifications (sur iPhone : ajouter d'abord le site à l'écran d'accueil).
