// Vidéo 4 — « J-1 : le 1er décembre, c'est demain » (script S3 amélioré, à poster le 30 novembre).
// Actes : 1. l'urgence (J-1 sur la nuit du pôle Nord) · 2. ce qu'on reçoit, un plan d'une seconde par promesse ·
// 3. « rien à installer » · 4. l'appel (carte de fin).
// Aucun nouveau rush : réutilise zones, surprise, luge, flocons et monde.
import { AbsoluteFill } from "remotion";
import { Bloc, Bruit, Fin, HAUT_SUR, Plan, T, Titre } from "../commun";
import F from "../rushes/flocons.json";
import M from "../rushes/monde.json";
import S from "../rushes/surprise.json";
import Z from "../rushes/zones.json";

const PROMESSES = [
  { texte: ["Une case", "par *jour*."], rush: "surprise", debut: S.tap, images: 42, zoom: [1.45, 1.6] as [number, number], origine: "43% 47%" },
  { texte: ["Des *jeux*", "à deux."], rush: "flocons", debut: F.jeu + 90, images: 42, zoom: [1.15, 1.22] as [number, number], origine: "50% 100%" },
  { texte: ["Des lettres", "*secrètes*."], rush: "surprise", debut: S.ouverture + 6, images: 42, zoom: [1, 1.1] as [number, number], origine: "50% 40%" },
  { texte: ["Un monde", "à *traverser*."], rush: "zones", debut: Z.lac + 20, images: 42, zoom: [1.05, 1.15] as [number, number], origine: "50% 50%" },
  { texte: ["Un grand final", "le *24*."], rush: "monde", debut: M.envol - 12, images: 48, zoom: [1, 1.08] as [number, number], origine: "50% 40%" },
];
export const D = { accroche: 54, promesses: PROMESSES.reduce((a, p) => a + p.images, 0), installer: 60, fin: 96 };
const de = { accroche: 0, promesses: D.accroche, installer: D.accroche + D.promesses, fin: D.accroche + D.promesses + D.installer };
export const DUREE_DEMAIN = de.fin + D.fin;
const debutPromesse = (i: number) => de.promesses + PROMESSES.slice(0, i).reduce((a, p) => a + p.images, 0);

export const Demain = () => (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    <Bloc de={de.accroche} duree={D.accroche} nom="J-1">
      <Plan rush="zones" debut={Z.pole + 10} images={D.accroche} zoom={[1.1, 1.25]} impact={false} />
      <Titre lignes={["*J-1*"]} taille={T.affiche * 2} y={HAUT_SUR} />
      <Titre lignes={["Le 1er décembre,", "c'est demain."]} y={HAUT_SUR + 300} retard={6} />
    </Bloc>

    {PROMESSES.map((p, i) => (
      <Bloc key={i} de={debutPromesse(i)} duree={p.images} nom={p.texte.join(" ").replace(/\*/g, "")}>
        <Plan rush={p.rush} debut={p.debut} images={p.images} zoom={p.zoom} origine={p.origine} />
        <Titre lignes={p.texte} taille={T.affiche} />
      </Bloc>
    ))}

    <Bloc de={de.installer} duree={D.installer} nom="Rien à installer">
      <Plan rush="zones" debut={Z.village + 6} images={D.installer} zoom={[1.05, 1.15]} />
      <Titre lignes={["Un lien à envoyer.", "*Rien* à installer."]} />
    </Bloc>

    <Bloc de={de.fin} duree={D.fin} nom="Fin">
      <Fin accroche={["Crée-le ce soir,", "ouvrez-le demain."]} />
    </Bloc>

    <Bruit nom="notify" a={2} volume={0.5} />
    {PROMESSES.map((_, i) => <Bruit key={i} nom="pop" a={debutPromesse(i) + 1} volume={0.45} />)}
    <Bruit nom="whoosh" a={de.installer} volume={0.4} />
    <Bruit nom="jingle" a={de.fin} volume={0.5} />
  </AbsoluteFill>
);
