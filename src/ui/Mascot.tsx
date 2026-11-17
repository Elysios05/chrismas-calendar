import { useEffect, useState } from "react";

export const MASCOT_NAME = "Pingou";

export function PenguinPortrait({ size = 72 }: { size?: number }) {
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
      <circle cx="43" cy="37" r="3.6" fill="#1b2340" />
      <circle cx="57" cy="37" r="3.6" fill="#1b2340" />
      <circle cx="44.2" cy="35.8" r="1.2" fill="#fff" />
      <circle cx="58.2" cy="35.8" r="1.2" fill="#fff" />
      <path d="M45 43 L55 43 L50 49Z" fill="#ff9a3d" />
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

/** Bulle de dialogue avec effet machine à écrire */
export function MascotDialog({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState("");
  const line = lines[i] ?? "";

  useEffect(() => { setI(0); }, [lines]);
  useEffect(() => {
    setShown("");
    let k = 0;
    const t = setInterval(() => { k++; setShown(line.slice(0, k)); if (k >= line.length) clearInterval(t); }, 22);
    return () => clearInterval(t);
  }, [line]);

  if (!lines.length) return null;
  const complete = shown.length >= line.length;
  const next = () => {
    if (!complete) { setShown(line); return; }
    if (i < lines.length - 1) setI(i + 1); else onDone();
  };
  return (
    <div className="mascot" onClick={next} role="dialog" aria-live="polite">
      <div className="mascot-portrait"><PenguinPortrait /></div>
      <div className="mascot-bubble">
        <div className="mascot-name">{MASCOT_NAME}</div>
        <p>{shown}<span className="caret" style={{ opacity: complete ? 0 : 1 }} /></p>
        <span className="mascot-next">{complete ? (i < lines.length - 1 ? "▶" : "✓") : ""}</span>
      </div>
    </div>
  );
}
