// Vidéo 1 — « POV : un secret t'attend dans la case 4 » (scripts S2 + S4 améliorés).
// Actes : 1. l'accroche sur la carte (le cadeau 4) · 2. la découverte (enveloppe, lettre, billet) ·
// 3. l'élargissement (le monde : 24 jours à deux) · 4. l'appel (carte de fin bleu nuit).
import { AbsoluteFill } from "remotion";
import { Bloc, Bruit, Fin, Pastille, Plan, T, Titre, HAUT_SUR } from "../commun";
import S from "../rushes/surprise.json";
import Z from "../rushes/zones.json";

/** Découpage (images à 30 i/s) : chaque plan dure 1 à 2 s */
export const D = { accroche: 42, tap: 40, enveloppe: 40, ouverture: 34, lettre1: 60, lettre2: 54, billet: 48, monde: 3 * 20, fin: 96 };
const de = (() => { let t = 0; const o: Record<string, number> = {}; for (const [k, v] of Object.entries(D)) { o[k] = t; t += v; } o.total = t; return o; })();
export const DUREE_SURPRISE = de.total;

export const Surprise = () => (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    {/* 1. accroche : on fonce vers le cadeau 4, puis on le touche */}
    <Bloc de={de.accroche} duree={D.accroche} nom="Accroche">
      <Plan rush="surprise" debut={0} images={S.tap} vitesse={S.tap / D.accroche} zoom={[1.2, 1.55]} origine="43% 47%" impact={false} />
    </Bloc>
    <Bloc de={de.tap} duree={D.tap} nom="Le cadeau s'ouvre">
      <Plan rush="surprise" debut={S.tap} images={45} vitesse={45 / D.tap} zoom={[1.55, 1.7]} origine="43% 47%" impact={false} />
    </Bloc>
    <Bloc de={0} duree={D.accroche + D.tap} nom="Titre d'accroche">
      <Pastille texte="POV" />
      <Titre lignes={["Un secret t'attend", "dans la *case 4*…"]} taille={T.titre + 8} y={HAUT_SUR + 140} retard={2} />
    </Bloc>

    {/* 2. la découverte */}
    <Bloc de={de.enveloppe} duree={D.enveloppe} nom="Enveloppe">
      <Plan rush="surprise" debut={S.enveloppe} images={D.enveloppe} zoom={[1.05, 1.3]} origine="50% 78%" />
      <Titre lignes={["Une lettre,", "rien que pour toi."]} />
    </Bloc>
    <Bloc de={de.ouverture} duree={D.ouverture} nom="Ouverture">
      <Plan rush="surprise" debut={S.ouverture + 2} images={D.ouverture} zoom={[1, 1.12]} origine="50% 40%" />
    </Bloc>
    <Bloc de={de.lettre1} duree={D.lettre1} nom="Lettre : 47 jours">
      <Plan rush="surprise" debut={S.lettre} images={D.lettre1} zoom={[1.25, 1.33]} origine="50% 21.9%" glisse={[0, 100, 0, 100]} />
      <Titre lignes={["47 jours", "sans se voir…"]} taille={T.affiche} y={HAUT_SUR - 10} />
    </Bloc>
    <Bloc de={de.lettre2} duree={D.lettre2} nom="Lettre : 19 jours">
      <Plan rush="surprise" debut={S.lettre + D.lettre1} images={D.lettre2} zoom={[1.12, 1.2]} origine="50% 57.5%" glisse={[0, -120, 0, -150]} />
      <Titre lignes={["Dans 19 jours,", "on se *retrouve*."]} inverse />
    </Bloc>
    <Bloc de={de.billet} duree={D.billet} nom="Le billet">
      <Plan rush="surprise" debut={S.lettre + D.lettre1 + D.lettre2} images={D.billet} zoom={[1.6, 1.78]} origine="47% 100%" />
      <Titre lignes={["Et un billet", "*aller simple*."]} inverse />
    </Bloc>

    {/* 3. le monde autour */}
    {(["village", "lac", "pole"] as const).map((z, i) => (
      <Bloc key={z} de={de.monde + i * 20} duree={20} nom={`Monde : ${z}`}>
        <Plan rush="zones" debut={Z[z] + 30} images={20} zoom={[1.05, 1.15]} />
      </Bloc>
    ))}
    <Bloc de={de.monde} duree={D.monde} nom="Titre du monde">
      <Titre lignes={["24 cases à ouvrir,", "chacun chez soi."]} />
    </Bloc>

    {/* 4. l'appel */}
    <Bloc de={de.fin} duree={D.fin} nom="Fin">
      <Fin accroche={["Crée le vôtre", "pour ta moitié."]} />
    </Bloc>

    {/* bruitages du site */}
    <Bruit nom="tap" a={de.tap} />
    <Bruit nom="open" a={de.tap + 4} volume={0.5} />
    <Bruit nom="pop" a={de.enveloppe} volume={0.5} />
    <Bruit nom="unlock" a={de.ouverture} volume={0.5} />
    <Bruit nom="whoosh" a={de.lettre1} volume={0.35} />
    <Bruit nom="whoosh" a={de.lettre2} volume={0.35} />
    <Bruit nom="good" a={de.billet + 4} volume={0.5} />
    {[0, 1, 2].map((i) => <Bruit key={i} nom="whoosh" a={de.monde + i * 20} volume={0.3} />)}
    <Bruit nom="jingle" a={de.fin} volume={0.5} />
  </AbsoluteFill>
);
