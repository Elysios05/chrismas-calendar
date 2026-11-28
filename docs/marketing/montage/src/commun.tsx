// Briques communes des vidéos TikTok : plans filmés (avec mouvement de caméra), titres animés, pastilles,
// bruitages et carte de fin. Charte : voir ../design.md (5 tailles de texte, une seule couleur d'accent).
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import type { CSSProperties, ReactNode } from "react";
import { lienSite } from "./lien";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/* ------------------------------------------------------------------ charte */
export const ENCRE = "#17224a"; // bleu nuit de l'appli : contour des textes, fond de la carte de fin
export const CREME = "#fffdf7";
export const ACCENT = "#d9354b"; // rouge des cadeaux : UNE chose par image (le mot qui compte, le bouton)
/** Les 5 tailles (px, vidéo 1080 de large) */
export const T = { affiche: 120, titre: 84, etiquette: 56, note: 40, mini: 32 } as const;
/** Bord gauche commun à tous les titres, et marges des zones sûres TikTok */
export const BORD = 84;
export const DROITE_LIBRE = 170; // colonne des boutons TikTok (j'aime, commentaires…)
export const HAUT_SUR = 210; // sous la barre « Suivis / Pour toi »
export const BAS_SUR = 420; // légende + barre du bas

const fredoka = Promise.all([
  loadFont({ family: "Fredoka", url: staticFile("fonts/fredoka-latin-600-normal.woff2"), weight: "600" }),
  loadFont({ family: "Fredoka", url: staticFile("fonts/fredoka-latin-700-normal.woff2"), weight: "700" }),
]);
void fredoka;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ------------------------------------------------------------------ plans filmés */
type Camera = {
  /** zoom au début et à la fin du plan */
  zoom?: [number, number];
  /** point fixe du zoom, en % de l'image (ex. "50% 40%") */
  origine?: string;
  /** glissement (px) au début et à la fin : [x0, y0, x1, y1] */
  glisse?: [number, number, number, number];
};

/**
 * Un plan tiré d'un rush (public/rushes/<rush>.mp4) : de l'image `debut` du rush, `images` images du rush,
 * lues à la vitesse `vitesse`. Caméra : zoom et glissement continus sur toute la durée du plan,
 * plus un petit « coup de zoom » à l'arrivée (la coupe se sent).
 */
export const Plan = ({ rush, debut, images, vitesse = 1, zoom = [1, 1], origine = "50% 50%", glisse = [0, 0, 0, 0], impact = true }: {
  rush: string; debut: number; images: number; vitesse?: number; impact?: boolean;
} & Camera) => {
  const frame = useCurrentFrame();
  const duree = Math.max(1, Math.round(images / vitesse));
  const u = Math.min(1, frame / duree);
  const e = Easing.bezier(0.25, 0.1, 0.25, 1)(u);
  const coup = impact ? interpolate(frame, [0, 7], [1.06, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: ENCRE }}>
      <AbsoluteFill style={{
        scale: String((zoom[0] + (zoom[1] - zoom[0]) * e) * coup),
        translate: `${glisse[0] + (glisse[2] - glisse[0]) * e}px ${glisse[1] + (glisse[3] - glisse[1]) * e}px`,
        transformOrigin: origine,
      }}>
        <Video src={staticFile(`rushes/${rush}.mp4`)} trimBefore={debut} durationInFrames={images} playbackRate={vitesse} muted
          style={{ width: "100%", height: "100%" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ textes */
/** `*mot*` = mot en couleur d'accent. Une ligne par élément du tableau (coupées à la main, jamais par le navigateur). */
const morceaux = (ligne: string) => ligne.split(/(\*[^*]+\*)/).filter(Boolean).map((m, i) =>
  m.startsWith("*") ? <span key={i} style={{ color: ACCENT }}>{m.slice(1, -1)}</span> : <span key={i}>{m}</span>);

const styleTexte = (taille: number, couleur = "#fff", contour = true): CSSProperties => ({
  fontFamily: "Fredoka", fontWeight: 700, fontSize: taille, lineHeight: 0.98, letterSpacing: "-0.02em",
  color: couleur, whiteSpace: "nowrap",
  ...(contour ? { WebkitTextStroke: `${Math.round(taille * 0.16)}px ${ENCRE}`, paintOrder: "stroke fill" } : {}),
});

/**
 * Titre posé sur l'image, façon légende TikTok : chaque ligne dans son étiquette crème (lisible sur n'importe
 * quel plan, sans voile ni ombre), qui arrive (montée + léger rebond) avec 3 images de décalage.
 * `fond={false}` : texte seul (carte de fin). `y` : haut du bloc (px). Sortie = coupe franche.
 */
export const Titre = ({ lignes, taille = T.titre, y = HAUT_SUR + 40, retard = 0, couleur, fond = true, inverse = false }: {
  lignes: string[]; taille?: number; y?: number; retard?: number; couleur?: string; fond?: boolean;
  /** étiquettes bleu nuit, texte crème : pour les plans déjà clairs (lettre, photo) */
  inverse?: boolean;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: BORD, top: y, right: DROITE_LIBRE }}>
      {lignes.map((l, i) => {
        const s = spring({ frame: frame - retard - i * 3, fps, config: { damping: 14, stiffness: 180, mass: 0.7 } });
        return (
          <div key={i} style={{ opacity: Math.min(1, s * 2), translate: `0px ${(1 - s) * 50}px`, marginBottom: fond ? -2 : taille * 0.1 }}>
            <span style={{ ...styleTexte(taille, couleur ?? (fond && !inverse ? ENCRE : CREME), false), display: "inline-block",
              ...(fond ? { background: inverse ? ENCRE : CREME, padding: `${taille * 0.1}px ${taille * 0.26}px ${taille * 0.17}px`, borderRadius: taille * 0.24 } : {}) }}>
              {morceaux(l)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** Pastille (nom d'un lieu, d'un jeu) : fond crème, texte bleu nuit, arrive en « tampon ». */
export const Pastille = ({ texte, y = HAUT_SUR + 20, retard = 0, numero }: { texte: string; y?: number; retard?: number; numero?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - retard, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", left: BORD, top: y, display: "flex", alignItems: "center", gap: 22,
      scale: String(0.6 + 0.4 * s), opacity: Math.min(1, s * 3), transformOrigin: "0% 50%",
      background: CREME, borderRadius: 999, padding: "18px 38px 20px", border: `6px solid ${ENCRE}` }}>
      {numero && <span style={{ ...styleTexte(T.etiquette, CREME, false), background: ACCENT, borderRadius: 999, padding: "4px 22px 8px" }}>{numero}</span>}
      <span style={{ ...styleTexte(T.etiquette, ENCRE, false) }}>{texte}</span>
    </div>
  );
};

/** Cadre de lecture : rectangle arrondi qui se dessine autour d'une ligne de la lettre (pas de surbrillance floue). */
export const Souligne = ({ x, y, l, h, retard = 0 }: { x: number; y: number; l: number; h: number; retard?: number }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - retard, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ position: "absolute", left: x, top: y, width: l * p, height: h, border: p > 0 ? `7px solid ${ACCENT}` : "none", borderRadius: 18 }} />;
};

/* ------------------------------------------------------------------ son */
/** Bruitage du site (public/audio/sfx-<nom>.wav, qui démarre 0,2 s après le début du fichier) calé sur l'image `a`. */
export const Bruit = ({ nom, a, volume = 0.6 }: { nom: string; a: number; volume?: number }) => (
  <Sequence from={a - 6} durationInFrames={45} name={`son ${nom}`} layout="none">
    <Audio src={staticFile(`audio/sfx-${nom}.wav`)} volume={volume} />
  </Sequence>
);

/* ------------------------------------------------------------------ carte de fin */
/**
 * Fond tiré du sujet : la grille d'un calendrier de l'Avent (4 × 6 cases numérotées), en filets crème à 12 %.
 * Les cases s'allument une à une (le calendrier se remplit), la 24 en dernier.
 */
const Grille = ({ allumees, libres }: { allumees: number; libres: number[] }) => {
  const W = 1080, H = 1920, cols = 4, rows = 6, m = 56, g = 22;
  const cw = (W - 2 * m - (cols - 1) * g) / cols, ch = (H - 2 * m - (rows - 1) * g) / rows;
  return (
    <AbsoluteFill>
      {Array.from({ length: 24 }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const on = Math.max(0, Math.min(1, allumees - i));
        if (libres.includes(r)) return null; // jamais de filet sous le texte
        return (
          <div key={i} style={{ position: "absolute", left: m + c * (cw + g), top: m + r * (ch + g), width: cw, height: ch,
            border: `3px solid rgba(255,253,247,${0.1 + 0.08 * on})`, borderRadius: 26, boxSizing: "border-box" }}>
            <div style={{ position: "absolute", right: 22, bottom: 14, fontFamily: "Fredoka", fontWeight: 600, fontSize: T.note,
              color: `rgba(255,253,247,${0.14 + 0.16 * on})` }}>{i + 1}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Carte de fin : appel à l'action + adresse du site (src/lien.ts) ou « Lien en bio ». `accroche` : 1 ou 2 lignes au-dessus du bouton. */
export const Fin = ({ accroche = ["Crée le vôtre", "pour ta moitié."] }: { accroche?: string[] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icone = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const bouton = spring({ frame: frame - 12, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  // adresse du site : une seule source, src/lien.ts ("" = seulement « Lien en bio »)
  const lien = lienSite();
  const coupe = lien.indexOf("/");
  const pouls = 1 + 0.035 * Math.max(0, Math.sin((frame - 30) / 6)) * (frame > 30 ? 1 : 0);
  return (
    <AbsoluteFill style={{ backgroundColor: ENCRE }}>
      <Grille allumees={interpolate(frame, [0, 40], [0, 24], clamp)} libres={[1, 2, 3, 4]} />
      <div style={{ position: "absolute", left: BORD, top: 390, width: 250, height: 250, borderRadius: 60, overflow: "hidden",
        scale: String(icone), border: `6px solid ${CREME}`,
        // Pingou se dandine : la carte de fin n'est jamais une image figée
        rotate: `${Math.sin(frame / 7) * 4}deg`, translate: `0px ${Math.sin(frame / 3.5) * -6}px` }}>
        <Img src={staticFile("pingou.svg")} style={{ width: "100%", height: "100%" }} />
      </div>
      <Titre lignes={accroche} taille={T.titre} y={700} retard={4} fond={false} couleur={CREME} />
      <div style={{ position: "absolute", left: BORD, top: 950, scale: String(bouton * pouls), transformOrigin: "0% 50%",
        background: ACCENT, borderRadius: 999, padding: "26px 54px 32px", ...styleTexte(T.etiquette + 8, CREME, false) }}>
        C'est gratuit
      </div>

      <div style={{ position: "absolute", left: BORD, top: 1135, opacity: interpolate(frame, [18, 26], [0, 1], clamp) }}>
        {lien ? (
          <>
            {coupe > 0 && <div style={{ ...styleTexte(T.note, CREME, false), fontWeight: 600, opacity: 0.8 }}>{lien.slice(0, coupe + 1)}</div>}
            <div style={{ ...styleTexte(T.etiquette, CREME, false), marginTop: 6 }}>{coupe > 0 ? lien.slice(coupe + 1) : lien}</div>
            <div style={{ ...styleTexte(T.mini, CREME, false), fontWeight: 600, opacity: 0.7, marginTop: 22 }}>(lien en bio)</div>
          </>
        ) : (
          <div style={{ ...styleTexte(T.etiquette, CREME, false) }}>Lien en bio 👆</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Raccourci : une séquence nommée (from + durée en images) */
export const Bloc = ({ de, duree, nom, children }: { de: number; duree: number; nom: string; children: ReactNode }) => (
  <Sequence from={de} durationInFrames={duree} name={nom}>{children}</Sequence>
);
