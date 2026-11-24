# Équipe Audio (Tone.js)

**Mission** : une musique composée dans le navigateur qui suit le monde traversé, et des effets sonores. Tout est original, donc libre de droits.
**Dossier** : `src/audio/`. Implémente `SoundApi` (`src/core/contracts.ts`).

## À faire
1. Moteur : démarrage au premier geste (contrainte des navigateurs), volume, coupure, fondus enchaînés.
2. Une ambiance par monde (montagnes : boîte à musique aérienne ; village : clochettes et accordéon ; lac : nappes douces ;
   marché : valse joyeuse ; grotte : glassy, réverbérée ; pôle Nord : grand thème final), variantes nuit.
3. Musiques de jeu (calme, action, victoire) et effets (`Sfx`).
4. Rester léger : peu de voix simultanées, pas de fichier audio lourd.

## Questions à poser à Alexandre
Envoyer de courts extraits (enregistrements) pour valider l'ambiance de chaque monde avant de tout composer.

## Journal

### 2026-11-17 — Socle audio (branche `audio/socle`)
**Fait**
- `src/audio/engine.ts` : `SoundEngine` implémente `SoundApi` ; instance unique exportée `sound` (aussi via `src/audio/index.ts`).
  - Tone.js chargé par import dynamique (morceau séparé). L'AudioContext est créé et réveillé pendant le premier geste
    (pointerdown/keydown/touchend), de façon synchrone (exigé par iOS), puis confié à Tone. `navigator.audioSession = "playback"`
    quand disponible (son même avec le bouton silencieux de l'iPhone).
  - Fondus enchaînés : 2,5 s entre ambiances, 1,2 s vers/depuis une musique de jeu. Chaque morceau a sa propre horloge
    (séquenceur maison avec 0,3 s d'avance), donc deux tempos différents peuvent se chevaucher.
  - En plus du contrat : `setVolume(0..1)`, `getVolume()`, `isEnabled()`, `unlock()`.
  - Contexte audio mis en pause quand le son est coupé ou l'onglet caché (batterie).
  - Limiteur final à -1,5 dBFS.
- 6 ambiances (`pieces/worlds.ts`), boucles de 37 à 58 s, toutes composées en code ; variante nuit : tempo -15 %,
  filtre plus sombre, percussions coupées, accompagnement allégé, -3 à -5 dB.
  | Monde | Tonalité / tempo | Instruments |
  |---|---|---|
  | montagnes | fa majeur, 84 | boîte à musique (mélodie + arpège), nappe, célesta |
  | saint-nicolas | sol majeur, 104 | marimba, accordéon « oum-pa », basse, clochettes, grelots |
  | lac | ré (lydien), 72 | nappes, célesta en écho, verre chanté, sub |
  | marche | do majeur, valse 3/4, 150 | flûte, glockenspiel, tuba, accordéon, grelots |
  | grotte | la mineur, 66 | bourdon, nappe sombre, verre (écho + réverbération 7 s), gouttes |
  | pole-nord | ré majeur, 112 | cuivres, cordes, glockenspiel, basse, timbales, grelots |
- Musiques de jeu (`pieces/games.ts`) : `calm` (marimba, 92), `action` (la mineur, 140), `victory` (fanfare, 120).
- Effets (`sfx.ts`) : open, good, bad, pop, win, locked, step, whoosh — courts et doux.
- Mixage mesuré instrument par instrument (rendus solo + EBU R128) ; chaque morceau jour ≈ -16 LUFS intégrés,
  nuit ≈ -19 à -21. Aucun clic détecté au raccord des boucles (détecteur de discontinuités sur boucle complète + 6 s).
- Démo : `npm run dev` puis `/audio-demo.html` (boutons jour/nuit, jeux, effets, volume, coupure, export WAV).
  `src/audio/render.ts` : rendu hors ligne (Tone.Offline) en WAV.
- Extraits envoyés à Alexandre (via le chef de projet) : `/home/claude/previews-audio/`.

**CPU** : réverbération par convolution (native, peu coûteuse) avec réponse impulsionnelle générée en code ;
polyphonie plafonnée (3 à 6 voix par instrument), 4 à 6 instruments par morceau. Dans le bac à sable (2 cœurs lents),
un morceau se calcule 2 à 3,5× plus vite que le temps réel ; les voix FM (boîte à musique) sont le poste le plus cher.
Si un téléphone peine : raccourcir les extinctions des notes FM ou passer l'arpège des montagnes sur un timbre plus simple.

**En attente d'Alexandre** : validation des ambiances (voir questions dans le rapport du 17/11).
**Reste à faire** : brancher `sound` dans l'app (chef/interface : `sound.setZone(...)` selon la position, bouton son),
ajuster selon les retours, tester sur un vrai téléphone.

### 2026-11-17 (soir) — Airs de Noël, volumes, effets et bruitages (branche `audio/airs-de-noel`)
**Retour d'Alexandre** : l'énergie est très bien, mais il faut que ce soit beaucoup plus Noël, avec des airs reconnaissables.
Musique à 50 %, effets à 60 %. Garder le bruit de pas, sonoriser un maximum d'interactions, ajouter des bruitages d'ambiance.

**Airs (tous du domaine public, mélodies seules)** — écrits dans `pieces/carols.ts`
| Monde / jeu | Air | Arrangement |
|---|---|---|
| montagnes | « Mon beau sapin » (1824) | boîte à musique, 2e passage avec célesta et chœur « ooh », grelots |
| saint-nicolas | « Il est né le divin enfant » (refrain–couplet–refrain) | marimba, accordéon en polka, clochettes, cloche du village |
| lac | « Douce nuit » (Gruber, 1818) | célesta, puis chœur, nappes, cristaux en écho |
| marche | « Vive le vent » / Jingle Bells (Pierpont, 1857), refrain puis couplet, 4/4 | flûte puis fanfare de cuivres, glockenspiel, tuba, grelots |
| grotte | « God Rest Ye Merry Gentlemen » (mi mineur) | verre réverbéré, bourdon, chœur sur le refrain, gouttes |
| pole-nord | « We Wish You a Merry Christmas » + rappels de « Mon beau sapin », « Douce nuit », « Vive le vent » | cuivres, boîte à musique, célesta, chœur, cloches, timbales |
| calm | « Mon beau sapin » en berceuse | célesta, marimba |
| action | refrain de « Vive le vent » à 168 | boîte à musique, batterie, grelots |
| victory | dernière phrase de « We Wish You… » | cuivres, glockenspiel en écho, chœur |
Sources des notes : « Il est né » et « God Rest Ye » vérifiés sur le code LilyPond des articles Wikipédia ; les autres de mémoire
(airs très connus), avec contrôle automatique des mesures et de l'harmonie.
**Non fait** : « Saint Nicolas, patron des écoliers ». Aucune source fiable de la mélodie trouvée : question posée à Alexandre.

**Moteur**
- Bus séparés : musique (défaut 0,5), effets (défaut 0,6), ambiance (branché sur les effets, à moitié pendant un jeu).
  Nouvelles méthodes : `setMusicVolume`, `setSfxVolume`, `setWeather(storm)`, `setWind(0..1)` (+ getters).
- 13 effets en plus (`ExtraSfx` dans `sfx.ts`) : tap, select, hover, talk (voix de Pingou, notes pentatoniques), pingou, day, night,
  unlock, photo, send, notify, jingle, snow. `play()` accepte `Sfx | ExtraSfx`.
- `ambience.ts` : bruitages par monde (vent et sifflement des crêtes, forêt et oiseaux / chouette la nuit, eau sous la glace et
  craquements de glace, brouhaha, cloches, traîneaux qui passent, verres qui tintent, gouttes en écho), tempête partout.
  Fondu de 2,5 s avec le monde.

**À demander au chef (contrat)** : ajouter à `SoundApi` `setMusicVolume`, `setSfxVolume`, `setWeather`, `setWind` ;
étendre `Sfx` avec les 13 effets ; l'appli doit appeler `setWind` en montagne (1 près du col) et `setWeather(true)` le jour 10.
Niveaux mesurés : mondes de jour ≈ -16 LUFS, nuits ≈ -19, ambiances ≈ -24 (tempête ≈ -18,5), aucun clic aux raccords.
Dans l'appli, avec les volumes par défaut : musique ≈ -22 LUFS, ambiance ≈ -28, effets au-dessus de la musique.
Extraits renouvelés dans `/home/claude/previews-audio/` (+ `ambiance-<monde>.mp3`, `ambiance-tempete.mp3`).

### 2026-11-19 — Lot 3 (branche `audio/lot-3`)
- **Jingles d'arrivée** (`pieces/jingles.ts`, `sound.playJingle(zone)`) : 2 à 3 s sur le début de l'air du monde, puis un accord
  qui résonne. Joués sur le bus des effets ; la musique descend à 30 % le temps du jingle.
- **Effets animaux, personnages, présence** (`CharacterSfx` dans `sfx.ts`) : fox, hare, owl, squirrel, reindeer, seal, bear,
  elf-laugh, elf-hammer, elf-hop, snowball, skate, ski, lift, partner-in, partner-out. Pic momentané -17 à -21 LUFS (comme les autres).
- **Musiques de jeux en direct** : `duel` (« Deck the Halls », 152 bpm, batterie et grelots) et `cosy` (« We Wish You » en valse douce,
  célesta, chœur, feu de cheminée qui crépite). Les deux à -16 LUFS.
- Voix de Pingou (`talk`) et cri (`pingou`) inchangés à l'oreille (vélocités compensées après la hausse du synthé partagé).
- Test anti-exceptions étendu aux 28 effets (`tests/e2e/audio-sfx.spec.ts`).
- « Saint Nicolas, patron des écoliers » : l'air vient du « Galop des tambours » de J.-B.-J. Tolbecque (1839, domaine public,
  source RTBF), mais aucune partition lisible trouvée : le village reste sur « Il est né ».
- Extraits : `/home/claude/previews-audio/lot3/`.

### 2026-11-24 — Exceptions Tone.js (branche `audio/tone-exceptions`, ticket #68)
**Cause** : `Tone.PolySynth` ne programme pas ses notes tout de suite ; il les confie à une minuterie (`context.setTimeout`)
qui les rejoue plus tard, hors de nos `try/catch`. Fil principal en retard → heure passée ramenée à « maintenant » →
deux attaques au même instant sur la même voix → « Start time must be strictly greater… » / « time must be >= last scheduled time ».
**Fait**
- `src/audio/voices.ts` : `VoicePool` remplace tous les `PolySynth` (instruments, tintement de verres, cloches des effets) :
  notes programmées immédiatement, heure toujours ≥ maintenant + 4 ms et strictement croissante par voix (2 ms d'écart),
  note sautée si elle a plus de 100 ms de retard ou s'il n'y a plus de voix libre (comme PolySynth). `guard()` fait de même
  pour les synthés monophoniques (basse, flûte, bruits, membranes, gouttes). `audioErrors.count` compte les exceptions rattrapées.
- Ambiances : un bruitage n'est plus déclenché dans le passé et ne peut plus lever d'exception.
**Vérifié** : `tsc -b` et build OK ; `npm run capture` jour 9 mobile, jour 21 nuit (mobile + ordinateur), case 2 : 0 erreur.
Test de charge maison (fil principal bloqué 0,3 à 1,5 s par à-coups, changements de monde, 40 cycles) : 0 exception, son bien
présent en sortie. Note : le problème ne se reproduisait plus non plus sur `main` dans ce bac à sable (dépend de la machine) ;
le correctif supprime le mécanisme en cause plutôt que le symptôme.
**Attention captures** : un serveur Qualité tourne souvent déjà sur le port 4180 (copie `wt-qualite`) ; `npm run capture` le
réutilise alors et photographie SA version. Lancer avec `QA_PORT=4191 npm run capture …` pour tester sa propre branche.
**Reste** : que la Qualité confirme sur sa campagne complète (`qa:captures`).
