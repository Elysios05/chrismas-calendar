import { useEffect, useRef, useState } from "react";
import { faceOf, textOf, type Expression, type PingouLine } from "./pingou/lines";
import { mouvementReduit } from "./useDialog";

export const MASCOT_NAME = "Pingou";

/** Les yeux et la bouche changent, le reste du pingouin ne bouge pas. */
function Face({ expression }: { expression: Expression }) {
  const eye = (cx: number, mirrored: boolean) => {
    // clin d'œil : seul l'œil droit se ferme
    if (expression === "clin" && mirrored) {
      return <path d={`M${cx - 4} 37 q4 3 8 0`} stroke="#1b2340" strokeWidth="2.4" fill="none" strokeLinecap="round" />;
    }
    if (expression === "content") {
      return <path d={`M${cx - 4.2} 38 q4.2 -5 8.4 0`} stroke="#1b2340" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
    }
    const r = expression === "surpris" ? 4.6 : 3.6;
    const cy = expression === "triste" ? 38.4 : 37;
    return (
      <>
        <circle cx={cx} cy={cy} r={r} fill="#1b2340" />
        <circle cx={cx + 1.2} cy={cy - 1.2} r={r * 0.33} fill="#fff" />
        {expression === "triste" && (
          <path d={`M${cx - 5} 32.6 q5 -1.6 10 1.2`} stroke="#1b2340" strokeWidth="1.8" fill="none" strokeLinecap="round" transform={mirrored ? `scale(-1 1) translate(${-2 * cx} 0)` : undefined} />
        )}
      </>
    );
  };

  return (
    <>
      {eye(43, false)}
      {eye(57, true)}
      {/* bec */}
      {expression === "surpris" ? (
        <ellipse cx="50" cy="46" rx="4.4" ry="5" fill="#ff9a3d" />
      ) : (
        <path d="M45 43 L55 43 L50 49Z" fill="#ff9a3d" />
      )}
      {expression === "triste" && <ellipse cx="66" cy="48" rx="2.2" ry="3.4" fill="#8fd0f5" opacity=".9" />}
    </>
  );
}

export function PenguinPortrait({ size = 72, expression = "neutre" }: { size?: number; expression?: Expression }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="94" rx="26" ry="5" fill="#1b2347" opacity=".15" />
      <ellipse cx="38" cy="90" rx="10" ry="5" fill="#ff9a3d" />
      <ellipse cx="62" cy="90" rx="10" ry="5" fill="#ff9a3d" />
      <ellipse cx="50" cy="66" rx="28" ry="26" fill="#223056" />
      <ellipse cx="50" cy="70" rx="18" ry="19" fill="#fff" />
      <ellipse cx="22" cy="64" rx="7" ry="15" fill="#1a2546" transform="rotate(18 22 64)" />
      <ellipse cx="78" cy="64" rx="7" ry="15" fill="#1a2546" transform="rotate(-18 78 64)" />
      <circle cx="50" cy="36" r="22" fill="#223056" />
      <ellipse cx="50" cy="40" rx="15" ry="13" fill="#fff" />
      <Face expression={expression} />
      <circle cx="37" cy="45" r="3.4" fill="#ff8fa3" opacity=".8" />
      <circle cx="63" cy="45" r="3.4" fill="#ff8fa3" opacity=".8" />
      <rect x="31" y="52" width="38" height="8" rx="4" fill="#d9354b" />
      <rect x="58" y="54" width="8" height="18" rx="4" fill="#d9354b" />
      <path d="M30 30 A20 20 0 0 1 70 30Z" fill="#d9354b" />
      <rect x="28" y="27" width="44" height="7" rx="3.5" fill="#fff" />
      <circle cx="64" cy="12" r="6" fill="#fff" />
    </svg>
  );
}

/**
 * Bulle de dialogue avec effet machine à écrire.
 * Un clic (ou Entrée / Espace) finit la ligne, puis passe à la suivante.
 */
export function MascotDialog({
  lines,
  onDone,
  variant = "flottant",
}: {
  lines: PingouLine[];
  onDone: () => void;
  /** « flottant » = posé en bas de l'écran ; « inline » = dans un écran ou une fenêtre */
  variant?: "flottant" | "inline";
}) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState("");
  const line = lines[i];
  const text = line === undefined ? "" : textOf(line);
  const face = line === undefined ? "neutre" : faceOf(line);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => { setI(0); }, [lines]);
  useEffect(() => {
    if (!text) { setShown(""); return; }
    // moins de mouvement demandé : la phrase s'affiche d'un coup
    if (mouvementReduit()) { setShown(text); return; }
    setShown("");
    let k = 0;
    const t = setInterval(() => { k++; setShown(text.slice(0, k)); if (k >= text.length) clearInterval(t); }, 22);
    return () => clearInterval(t);
  }, [text]);

  if (!lines.length) return null;
  const complete = shown.length >= text.length;
  const last = i >= lines.length - 1;
  const next = () => {
    if (!complete) { setShown(text); return; }
    if (!last) setI(i + 1); else onDone();
  };

  return (
    <button
      ref={btn}
      type="button"
      className={`mascot mascot--${variant}`}
      onClick={next}
      aria-label={complete ? (last ? "Fermer" : "Phrase suivante") : "Afficher la phrase en entier"}
    >
      <span className="mascot-portrait"><PenguinPortrait expression={face} /></span>
      <span className="mascot-bubble">
        <span className="mascot-name">{MASCOT_NAME}</span>
        {/* la machine à écrire est purement visuelle ; la phrase entière est annoncée une seule fois */}
        <span className="mascot-text" aria-hidden="true">
          {shown}<span className="caret" style={{ opacity: complete ? 0 : 1 }} />
        </span>
        <span className="pour-lecteurs" aria-live="polite">{MASCOT_NAME} dit : {text}</span>
        <span className="mascot-next" aria-hidden="true">{complete ? (last ? "✓" : "▶") : ""}</span>
      </span>
    </button>
  );
}
