# Backend : mode d'emploi pour les autres équipes

On l'obtient avec `const backend = await createBackend()` (`src/backend/index.ts`) : Supabase si les variables sont
définies, sinon le mode démo. Le contrat est dans `src/core/contracts.ts`.

## Jeux en direct : `LiveGame` (`src/backend/realtime.ts`)

Pour les 6 jeux à deux (Pictionary, duel, quiz synchro, bonhomme à deux, boules de neige, sapin à deux).
Ça marche pareil en démo (deux onglets) et avec Supabase.

```ts
import { joinLive } from "../../backend";

type Etat = { dessinateur: Who; mot: number; scores: Record<Who, number> };

const live = await joinLive<Etat>(ctx.backend, ctx.day, {
  initialState: { dessinateur: "alexandre", mot: 0, scores: { alexandre: 0, flavie: 0 } },
  countdownMs: 3000,            // facultatif
  // name: "manche-2",          // facultatif : autre salle le même jour
});

live.onPartner((la) => afficher(la ? "Flavie est là 🎉" : "En attente de Flavie…"));
live.onReady(({ me, partner }) => majBoutons(me, partner));
live.onStart(({ startsAt, seed, resumed }) => {
  // startsAt est en heure LOCALE : comparable à Date.now(), déjà corrigé du décalage d'horloge
  lancerCompteARebours(startsAt);
  tirerLesMots(seed);           // même graine des deux côtés → mêmes mots, même grille…
  if (resumed) reprendreLaPartie(live.state);
});
live.onState((etat, par) => redessiner(etat));

boutonPret.onclick = () => live.setReady(true);
// pendant la partie :
live.update((e) => ({ ...e, scores: { ...e.scores, [ctx.me]: e.scores[ctx.me] + 1 } }));
live.emit("trait", { x, y });   // flux rapide, non sauvegardé (traits de dessin, tirs…)
live.on("trait", (p, de) => dessinerTrait(p));

// à la fin (dans la fonction de nettoyage du GameModule) :
live.leave();
```

| Élément | Rôle |
|---|---|
| `onPartner(cb)` | l'autre arrive (`true`) ou part (`false`, détecté en quelques secondes) |
| `setReady(bool)` / `onReady(cb)` | « Prêt ? » de chaque côté |
| `onStart(cb)` | départ synchronisé quand les deux sont prêts (Alexandre fixe l'heure, sur une horloge commune) |
| `phase` | `"attente"`, `"compte-a-rebours"` ou `"en-jeu"` |
| `state`, `setState(s)`, `update(fn)`, `onState(cb)` | état partagé ; **le dernier écrit gagne** ; sauvegardé (`getGameState(jour, "live:partie")`) |
| `emit(ev, p)` / `on(ev, cb)` | messages propres au jeu, non sauvegardés |
| `now()` / `toLocal(t)` | horloge commune (ms) et conversion vers l'heure locale |
| `reset()` | nouvelle partie (efface départ et « prêt », garde l'état) |
| `leave()` | quitter la salle |

**Reprise** : si une page est rechargée ou si le réseau coupe, le joueur retrouve en revenant l'état le plus récent
(sauvegardé et renvoyé par l'autre). `onStart` est alors rappelé avec `resumed: true` si la partie avait déjà démarré.

**Limites à connaître**
- L'état partagé est remplacé en entier à chaque écriture. Pour des actions simultanées (deux joueurs qui marquent
  en même temps), préférez `emit` et laissez un seul joueur (par ex. Alexandre, `LEADER`) écrire l'état.
- Juste après l'arrivée de l'autre, l'horloge commune met environ 1 s à se caler.
- Si l'autre n'est pas là, prévoyez la version tour par tour du cahier des charges : `setGameState` / `getGameState`.

Tester à deux en démo : deux onglets, `?moi=alexandre&jour=5` et `?moi=flavie&jour=5`.

## Autres méthodes hors contrat

- **Mot de passe oublié** : `hasPasswordRecovery(backend)` → `resetPassword(who)`, `inPasswordRecovery()`,
  `updatePassword(pw)`.
- **Souvenirs** : `exportSouvenirs(backend)` / `downloadSouvenirs(backend)` (à partir du 24 décembre).
  Voir `src/backend/souvenirs.ts`.
