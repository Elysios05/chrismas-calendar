// Vidéo 3 — « 3 jeux pour jouer à deux quand on est loin » (scripts S5 + S8 améliorés).
// Actes : 1. l'accroche en pleine partie · 2. une case s'ouvre, puis les trois jeux (un numéro chacun) ·
// 3. la règle « chacun chez soi, meilleur score » · 4. l'appel (carte de fin).
import { AbsoluteFill } from "remotion";
import { Bloc, Bruit, Fin, HAUT_SUR, Pastille, Plan, T, Titre } from "../commun";
import F from "../rushes/flocons.json";
import L from "../rushes/luge.json";
import Q from "../rushes/quiz.json";

export const D = { accroche: 45, case: 36, luge: 78, flocons: 78, quiz: 84, regle: 60, fin: 96 };
const de = (() => { let t = 0; const o: Record<string, number> = {}; for (const [k, v] of Object.entries(D)) { o[k] = t; t += v; } o.total = t; return o; })();
export const DUREE_JEUX = de.total;

export const Jeux = () => (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    {/* 1. accroche : on est déjà dans la partie */}
    <Bloc de={de.accroche} duree={D.accroche} nom="Accroche">
      <Plan rush="flocons" debut={F.jeu + 125} images={D.accroche} zoom={[1.3, 1.4]} origine="50% 100%" impact={false} />
      <Titre lignes={["3 jeux à deux", "quand on est *loin*."]} taille={T.titre + 8} y={HAUT_SUR + 30} />
    </Bloc>

    {/* 2. une case s'ouvre, puis les jeux */}
    <Bloc de={de.case} duree={D.case} nom="Une case s'ouvre">
      <Plan rush="luge" debut={L.tap} images={L.fenetre - L.tap} vitesse={(L.fenetre - L.tap) / D.case} zoom={[1.3, 1.5]} origine="55% 52%" />
      <Titre lignes={["Chaque jour,", "une case s'*ouvre*…"]} />
    </Bloc>
    <Bloc de={de.luge} duree={D.luge} nom="Jeu 1 : la luge">
      <Plan rush="luge" debut={L.jeu + 20} images={D.luge} zoom={[1.15, 1.22]} origine="50% 100%" />
      <Pastille numero="1" texte="La descente en luge" retard={2} />
    </Bloc>
    <Bloc de={de.flocons} duree={D.flocons} nom="Jeu 2 : les flocons">
      <Plan rush="flocons" debut={F.jeu + 30} images={D.flocons} zoom={[1.12, 1.18]} origine="50% 100%" />
      <Pastille numero="2" texte="Pingou et les flocons" retard={2} />
    </Bloc>
    <Bloc de={de.quiz} duree={D.quiz} nom="Jeu 3 : le quiz">
      <Plan rush="quiz" debut={Q.jeu} images={D.quiz} zoom={[1.18, 1.26]} origine="50% 46%" />
      <Pastille numero="3" texte="Tu me connais ?" retard={2} />
    </Bloc>

    {/* 3. la règle */}
    <Bloc de={de.regle} duree={D.regle} nom="Chacun chez soi">
      <Plan rush="luge" debut={L.jeu + 150} images={D.regle / 2} vitesse={0.5} zoom={[1.2, 1.35]} origine="50% 100%" />
      <Titre lignes={["Chacun chez soi,", "le *meilleur score* gagne."]} />
    </Bloc>

    {/* 4. l'appel */}
    <Bloc de={de.fin} duree={D.fin} nom="Fin">
      <Fin accroche={["Défie ta moitié,", "même à 800 km."]} />
    </Bloc>

    <Bruit nom="tap" a={de.case + 2} />
    <Bruit nom="open" a={de.case + 8} volume={0.5} />
    <Bruit nom="pop" a={de.luge + 2} volume={0.5} />
    <Bruit nom="pop" a={de.flocons + 2} volume={0.5} />
    <Bruit nom="pop" a={de.quiz + 2} volume={0.5} />
    <Bruit nom="good" a={de.quiz + (Q.reponse ?? Q.jeu + 20) - Q.jeu + 2} volume={0.5} />
    <Bruit nom="win" a={de.regle + 6} volume={0.45} />
    <Bruit nom="jingle" a={de.fin} volume={0.5} />
  </AbsoluteFill>
);
