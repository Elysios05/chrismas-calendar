// Vidéo 2 — « Un calendrier de l'Avent… qui est un vrai petit jeu » (script S1 amélioré).
// Actes : 1. l'accroche en deux temps · 2. les six mondes, un plan court chacun, la nuit tombe au marché ·
// 3. la route en accéléré et le traîneau qui s'envole le 24 · 4. l'appel (carte de fin).
import { AbsoluteFill } from "remotion";
import { Bloc, Bruit, Fin, HAUT_SUR, Pastille, Plan, T, Titre } from "../commun";
import M from "../rushes/monde.json";
import Z from "../rushes/zones.json";

const LIEUX = [
  { zone: "village", nom: "Le village de Saint-Nicolas", d: 36 },
  { zone: "lac", nom: "Le lac gelé", d: 34 },
  { zone: "marche", nom: "Le marché de Noël", d: 34 },
  { zone: "crepuscule", nom: "La nuit tombe…", d: 52 },
  { zone: "grotte", nom: "La grotte de glace", d: 34 },
  { zone: "pole", nom: "Le pôle Nord", d: 38 },
] as const;
export const D = { accroche: 34, lieux: LIEUX.reduce((a, l) => a + l.d, 0), route: 54, envol: 108, fin: 96 };
const de = { accroche: 0, lieux: D.accroche, route: D.accroche + D.lieux, envol: D.accroche + D.lieux + D.route, fin: D.accroche + D.lieux + D.route + D.envol };
export const DUREE_MONDE = de.fin + D.fin;
const debutLieu = (i: number) => de.lieux + LIEUX.slice(0, i).reduce((a, l) => a + l.d, 0);
const ENVOL_VITESSE = (M.fin - M.arrivee) / D.envol;

export const Monde = () => (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    {/* 1. accroche, premier temps */}
    <Bloc de={de.accroche} duree={D.accroche} nom="Accroche">
      <Plan rush="zones" debut={Z.montagnes + 10} images={D.accroche} zoom={[1.05, 1.15]} impact={false} />
      <Titre lignes={["Un calendrier", "de l'Avent…"]} taille={T.affiche} />
    </Bloc>

    {/* 2. les mondes */}
    {LIEUX.map((l, i) => (
      <Bloc key={l.zone} de={debutLieu(i)} duree={l.d} nom={l.nom}>
        <Plan rush="zones" debut={Z[l.zone] + (l.zone === "crepuscule" ? 0 : 66 - l.d - 2)} images={l.zone === "crepuscule" ? 66 : l.d}
          vitesse={l.zone === "crepuscule" ? 66 / l.d : 1} zoom={[1, 1.06]} />
        <Pastille texte={l.nom} y={i === 0 ? 1360 : HAUT_SUR + 20} retard={2} />
      </Bloc>
    ))}
    {/* l'accroche, second temps, sur le premier monde */}
    <Bloc de={de.lieux} duree={LIEUX[0].d} nom="Accroche (suite)">
      <Titre lignes={["…qui est un", "*vrai petit jeu*."]} taille={T.affiche} />
    </Bloc>

    {/* 3. la route en accéléré, puis le traîneau */}
    <Bloc de={de.route} duree={D.route} nom="La route en accéléré">
      <Plan rush="monde" debut={60} images={M.arrivee - 60} vitesse={(M.arrivee - 60) / D.route} zoom={[1.1, 1.1]} />
      <Titre lignes={["24 cases,", "une par *jour*."]} />
    </Bloc>
    <Bloc de={de.envol} duree={D.envol} nom="Le traîneau s'envole">
      <Plan rush="monde" debut={M.arrivee} images={M.fin - M.arrivee} vitesse={ENVOL_VITESSE} zoom={[1, 1.08]} origine="50% 40%" />
      <Titre lignes={["Et le 24,", "le traîneau *s'envole*."]} y={1180} retard={Math.round((M.envol - M.arrivee) / ENVOL_VITESSE) - 8} />
    </Bloc>

    {/* 4. l'appel */}
    <Bloc de={de.fin} duree={D.fin} nom="Fin">
      <Fin accroche={["Offre-le", "à ta moitié."]} />
    </Bloc>

    {LIEUX.map((l, i) => <Bruit key={l.zone} nom={i === 3 ? "jingle" : "pop"} a={debutLieu(i) + 2} volume={i === 3 ? 0.35 : 0.45} />)}
    <Bruit nom="whoosh" a={de.route} volume={0.5} />
    <Bruit nom="whoosh" a={de.route + 26} volume={0.4} />
    <Bruit nom="win" a={de.envol + Math.round((M.envol - M.arrivee) / ENVOL_VITESSE)} volume={0.5} />
    <Bruit nom="jingle" a={de.fin} volume={0.5} />
  </AbsoluteFill>
);
