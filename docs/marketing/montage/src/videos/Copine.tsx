// Vidéo 5 — « POV : regardez ce que mon copain m'a fait pour l'Avent 🥹 » (format tendance TikTok).
// Pas de personne, pas de visage, pas de voix : un POV écrit à la 1re personne, posé sur l'écran du téléphone
// (le vrai site filmé, salon fictif). Ton spontané, réactions courtes, émotion d'abord.
// Actes : 1. l'accroche (la carte, le cadeau 4 qui s'ouvre) · 2. la découverte, une réaction par plan
// (lettre, « je pleure », photos, jeux) · 3. la nuit et deux bulles de message · 4. l'appel (carte de fin).
// Aucun nouveau rush : surprise, flocons et monde.
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Bloc, Bruit, BORD, CREME, DROITE_LIBRE, ENCRE, Fin, HAUT_SUR, Pastille, Plan, T, Titre } from "../commun";
import F from "../rushes/flocons.json";
import M from "../rushes/monde.json";
import S from "../rushes/surprise.json";

/** Découpage (images à 30 i/s) */
export const D = { accroche: 50, tap: 36, enveloppe: 42, ouverture: 30, lettre: 54, photo: 48, jeu: 54, nuit: 66, fin: 96 };
const de = (() => { let t = 0; const o: Record<string, number> = {}; for (const [k, v] of Object.entries(D)) { o[k] = t; t += v; } o.total = t; return o; })();
export const DUREE_COPINE = de.total;

/**
 * Bulle de message (façon messagerie du téléphone) : `envoye` = la mienne, à droite, bleu nuit ;
 * sinon la sienne, à gauche, crème. Arrive en « pop » à l'image `retard`.
 */
const Bulle = ({ texte, y, envoye = false, retard = 0 }: { texte: string; y: number; envoye?: boolean; retard?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - retard, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const r = 44;
  return (
    <div style={{
      position: "absolute", top: y, ...(envoye ? { right: DROITE_LIBRE } : { left: BORD }), maxWidth: 1080 - BORD - DROITE_LIBRE,
      scale: String(0.5 + 0.5 * s), opacity: Math.min(1, s * 3), transformOrigin: envoye ? "100% 100%" : "0% 100%",
      background: envoye ? ENCRE : CREME, color: envoye ? CREME : ENCRE, border: `5px solid ${ENCRE}`,
      borderRadius: envoye ? `${r}px ${r}px 10px ${r}px` : `${r}px ${r}px ${r}px 10px`,
      padding: "20px 36px 26px", fontFamily: "Fredoka", fontWeight: 600, fontSize: T.etiquette, lineHeight: 1.05,
      letterSpacing: "-0.01em", whiteSpace: "nowrap",
    }}>
      {texte}
    </div>
  );
};

/** « en train d'écrire… » : trois points qui sautillent dans une bulle crème, avant la réponse. */
const Ecrit = ({ y, de: debut, a }: { y: number; de: number; a: number }) => {
  const frame = useCurrentFrame();
  if (frame < debut || frame >= a) return null;
  const o = interpolate(frame, [debut, debut + 4], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", top: y, left: BORD, opacity: o, display: "flex", gap: 14, background: CREME,
      border: `5px solid ${ENCRE}`, borderRadius: "44px 44px 44px 10px", padding: "34px 40px" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 20, height: 20, borderRadius: 99, background: ENCRE,
          translate: `0px ${Math.min(0, Math.sin((frame - i * 3) / 2.5)) * 10}px` }} />
      ))}
    </div>
  );
};

export const Copine = () => (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    {/* 1. accroche : la carte, on fonce vers le cadeau 4, il s'ouvre */}
    <Bloc de={de.accroche} duree={D.accroche} nom="Accroche">
      <Plan rush="surprise" debut={0} images={S.tap} vitesse={S.tap / D.accroche} zoom={[1.2, 1.55]} origine="43% 47%" impact={false} />
    </Bloc>
    <Bloc de={de.tap} duree={D.tap} nom="Le cadeau s'ouvre">
      <Plan rush="surprise" debut={S.tap} images={45} vitesse={45 / D.tap} zoom={[1.55, 1.7]} origine="43% 47%" impact={false} />
    </Bloc>
    <Bloc de={0} duree={D.accroche + D.tap} nom="POV">
      <Pastille texte="POV" />
    </Bloc>
    <Bloc de={0} duree={D.accroche} nom="Titre d'accroche">
      <Titre lignes={["Regardez ce que mon", "copain m'a fait 🥹"]} y={HAUT_SUR + 140} retard={2} />
    </Bloc>
    <Bloc de={de.tap} duree={D.tap} nom="Titre : un calendrier">
      <Titre lignes={["un calendrier", "de l'*Avent* !!"]} y={HAUT_SUR + 140} />
    </Bloc>

    {/* 2. la découverte, une réaction par plan */}
    <Bloc de={de.enveloppe} duree={D.enveloppe} nom="Enveloppe">
      <Plan rush="surprise" debut={S.enveloppe} images={D.enveloppe} zoom={[1.05, 1.3]} origine="50% 78%" />
      <Titre lignes={["il a caché une lettre", "dans la *case 4*…"]} />
    </Bloc>
    <Bloc de={de.ouverture} duree={D.ouverture} nom="Ouverture">
      <Plan rush="surprise" debut={S.ouverture + 2} images={D.ouverture} zoom={[1, 1.12]} origine="50% 40%" />
    </Bloc>
    <Bloc de={de.lettre} duree={D.lettre} nom="Je pleure">
      <Plan rush="surprise" debut={S.lettre} images={D.lettre} zoom={[1.25, 1.33]} origine="50% 21.9%" glisse={[0, 100, 0, 100]} />
      <Titre lignes={["je pleure 😭"]} taille={T.affiche} y={HAUT_SUR - 10} />
    </Bloc>
    <Bloc de={de.photo} duree={D.photo} nom="Photo-souvenir">
      <Plan rush="surprise" debut={S.lettre + D.lettre} images={D.photo} zoom={[2.2, 2.35]} origine="24% 96%" />
      <Titre lignes={["il a mis", "nos *souvenirs* 🥺"]} inverse />
    </Bloc>
    <Bloc de={de.jeu} duree={D.jeu} nom="Des jeux">
      <Plan rush="flocons" debut={F.jeu + 90} images={D.jeu} zoom={[1.15, 1.22]} origine="50% 100%" />
      <Titre lignes={["et y a des *JEUX*", "en plus ??"]} />
    </Bloc>

    {/* 3. la nuit au pôle Nord, et la conversation */}
    <Bloc de={de.nuit} duree={D.nuit} nom="La nuit + messages">
      <Plan rush="monde" debut={M.envol - 24} images={D.nuit} zoom={[1.02, 1.1]} origine="50% 40%" />
      <Bulle texte="t'es pas croyable 😭❤️" y={HAUT_SUR + 60} envoye retard={4} />
      <Ecrit y={HAUT_SUR + 210} de={18} a={34} />
      <Bulle texte="joyeux Noël, mon cœur" y={HAUT_SUR + 210} retard={34} />
    </Bloc>

    {/* 4. l'appel */}
    <Bloc de={de.fin} duree={D.fin} nom="Fin">
      <Fin accroche={["Fais-le pour", "ta moitié."]} />
    </Bloc>

    {/* bruitages du site */}
    <Bruit nom="tap" a={de.tap} />
    <Bruit nom="open" a={de.tap + 4} volume={0.5} />
    <Bruit nom="pop" a={de.enveloppe} volume={0.5} />
    <Bruit nom="unlock" a={de.ouverture} volume={0.5} />
    <Bruit nom="whoosh" a={de.lettre} volume={0.35} />
    <Bruit nom="good" a={de.photo + 2} volume={0.45} />
    <Bruit nom="pop" a={de.jeu + 2} volume={0.5} />
    <Bruit nom="notify" a={de.nuit + 4} volume={0.45} />
    <Bruit nom="notify" a={de.nuit + 34} volume={0.45} />
    <Bruit nom="jingle" a={de.fin} volume={0.5} />
  </AbsoluteFill>
);
