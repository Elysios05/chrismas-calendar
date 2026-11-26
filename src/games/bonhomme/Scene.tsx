/**
 * Jour 13 — la scène du bonhomme (SVG) : place du marché de nuit, les deux boules, les objets posés.
 * Sert à la décoration (objets déplaçables) et au souvenir de fin (image téléchargeable).
 */

import type { PointerEvent as PE, ReactNode, Ref } from "react";
import type { BonhommeContent, TypeDeco } from "../../data/games/bonhomme-jour13";
import { SCENE, geometrie, position, type Boule, type Geo, type Objet } from "./modele";

export type ObjetVu = { o: Objet; moi: boolean };

/** Dessin d'un objet, centré sur (x, y) ; `r` = rayon de la boule qui le porte ; `cote` = -1 à gauche */
export function DessinObjet({ type, x, y, r, cote, contenu }: {
  type: TypeDeco; x: number; y: number; r: number; cote: number; contenu: BonhommeContent;
}) {
  const deco = contenu.decos.find((d) => d.type === type);
  const t = (deco?.taille ?? 0.3) * r;
  switch (type) {
    case "charbon":
      return <circle cx={x} cy={y} r={t / 2} fill="#2a2c36" />;
    case "carotte": {
      const s = cote < 0 ? -1 : 1;
      return (
        <g>
          <path d={`M ${x} ${y - t * 0.16} L ${x + s * t} ${y + t * 0.05} L ${x} ${y + t * 0.16} Z`} fill="#f08a24" />
          <path d={`M ${x + s * t * 0.3} ${y - t * 0.08} l ${s * t * 0.06} ${t * 0.07} M ${x + s * t * 0.55} ${y - t * 0.02} l ${s * t * 0.05} ${t * 0.06}`}
            stroke="#c4661a" strokeWidth={Math.max(1, t * 0.04)} strokeLinecap="round" />
        </g>
      );
    }
    case "branche": {
      const s = cote < 0 ? -1 : 1;
      const w = Math.max(2, t * 0.07);
      return (
        <g stroke="#6b4a2f" strokeWidth={w} strokeLinecap="round" fill="none">
          <path d={`M ${x} ${y} L ${x + s * t} ${y - t * 0.38}`} />
          <path d={`M ${x + s * t * 0.62} ${y - t * 0.24} l ${s * t * 0.16} ${-t * 0.26}`} />
          <path d={`M ${x + s * t * 0.78} ${y - t * 0.3} l ${s * t * 0.24} ${t * 0.02}`} />
        </g>
      );
    }
    case "echarpe": {
      const l = t * 1.5, h = t * 0.26;
      return (
        <g>
          <rect x={x - l / 2} y={y - h / 2} width={l} height={h} rx={h / 2} fill="#d9354b" />
          <rect x={x + l * 0.16} y={y} width={h * 0.9} height={t * 0.75} rx={h * 0.3} fill="#c22b40" transform={`rotate(-8 ${x + l * 0.16} ${y})`} />
          {[-0.3, -0.05, 0.2].map((k) => (
            <rect key={k} x={x + k * l} y={y - h / 2} width={h * 0.35} height={h} fill="#fff" opacity={0.85} />
          ))}
          <rect x={x + l * 0.16} y={y + t * 0.48} width={h * 0.9} height={h * 0.3} fill="#fff" opacity={0.85} transform={`rotate(-8 ${x + l * 0.16} ${y})`} />
        </g>
      );
    }
    case "bonnet": {
      const l = t * 1.25, h = t * 0.85;
      return (
        <g>
          <path d={`M ${x - l / 2} ${y} Q ${x - l * 0.45} ${y - h} ${x + l * 0.1} ${y - h * 1.05} Q ${x + l * 0.5} ${y - h * 0.7} ${x + l / 2} ${y} Z`} fill="#2fa37a" />
          <circle cx={x + l * 0.12} cy={y - h * 1.08} r={t * 0.17} fill="#fff" />
          <rect x={x - l * 0.56} y={y - t * 0.2} width={l * 1.12} height={t * 0.3} rx={t * 0.14} fill="#fff" />
        </g>
      );
    }
    default:
      return (
        <text x={x} y={y} fontSize={t * 1.15} textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}>
          {deco?.emoji ?? "❓"}
        </text>
      );
  }
}

function BouleSvg({ g, id }: { g: Geo; id: string }) {
  if (!g.connue) {
    return (
      <g>
        <ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.8)"
          strokeWidth={2.5} strokeDasharray="7 7" />
        <text x={g.cx} y={g.cy} fontSize={Math.min(42, g.r * 0.7)} textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,.85)" fontWeight={700}>?</text>
      </g>
    );
  }
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef4fb" />
          <stop offset="1" stopColor="#c5d4e7" />
        </radialGradient>
      </defs>
      <ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fill={`url(#${id})`} />
    </g>
  );
}

/** Décor fixe : ciel de nuit, chalets illuminés, sol enneigé */
function Decor() {
  const lampions = Array.from({ length: 13 }, (_, i) => i);
  return (
    <g>
      <defs>
        <linearGradient id="bh-ciel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2a52" />
          <stop offset="1" stopColor="#4b6aa3" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={SCENE.l} height={SCENE.h} fill="url(#bh-ciel)" />
      {[[30, 40], [80, 22], [140, 52], [210, 30], [265, 60], [250, 14], [110, 90]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#fff" opacity={0.8} />
      ))}
      {/* chalets du marché */}
      {[[-10, 70], [62, 58], [200, 64], [262, 72]].map(([x, l], i) => (
        <g key={x} opacity={0.9}>
          <rect x={x} y={SCENE.sol - 92} width={l} height={60} fill={i % 2 ? "#6b4a2f" : "#7d5636"} />
          <path d={`M ${x - 8} ${SCENE.sol - 90} L ${x + l / 2} ${SCENE.sol - 124} L ${x + l + 8} ${SCENE.sol - 90} Z`} fill="#f4f8fd" />
          <rect x={x + l * 0.2} y={SCENE.sol - 76} width={l * 0.6} height={18} fill="#ffd27a" opacity={0.85} />
        </g>
      ))}
      <path d={`M 0 ${SCENE.sol - 132} Q ${SCENE.l / 2} ${SCENE.sol - 104} ${SCENE.l} ${SCENE.sol - 132}`} stroke="#2a2c36" strokeWidth={1} fill="none" opacity={0.5} />
      {lampions.map((i) => {
        const x = (i + 0.5) * (SCENE.l / lampions.length);
        const tt = x / SCENE.l;
        const y = (1 - tt) * (1 - tt) * (SCENE.sol - 132) + 2 * (1 - tt) * tt * (SCENE.sol - 104) + tt * tt * (SCENE.sol - 132);
        return <circle key={i} cx={x} cy={y + 3} r={3} fill={["#ffd27a", "#ff7a8a", "#8fe3c0"][i % 3]} />;
      })}
      {/* sol */}
      <path d={`M 0 ${SCENE.sol - 24} Q ${SCENE.l * 0.3} ${SCENE.sol - 36} ${SCENE.l * 0.55} ${SCENE.sol - 26} T ${SCENE.l} ${SCENE.sol - 28} L ${SCENE.l} ${SCENE.h} L 0 ${SCENE.h} Z`} fill="#eef4fb" />
      <ellipse cx={SCENE.l / 2} cy={SCENE.sol + 2} rx={95} ry={10} fill="rgba(27,39,71,.16)" />
    </g>
  );
}

export function SceneBonhomme({
  contenu, corps, tete, objets, svgRef, enMain, surPrendre, enfants,
}: {
  contenu: BonhommeContent;
  corps: Boule | null;
  tete: Boule | null;
  objets: ObjetVu[];
  svgRef?: Ref<SVGSVGElement>;
  /** Objet en cours de déplacement (coordonnées de la scène) */
  enMain?: { type: TypeDeco; x: number; y: number } | null;
  surPrendre?: (o: Objet, e: PE<SVGGElement>) => void;
  enfants?: ReactNode;
}) {
  const geo = geometrie(contenu, corps, tete);
  // les gros objets (écharpe, bras) passent derrière les petits (charbon, boutons)
  const ordre = (t: TypeDeco) => (t === "branche" ? 0 : t === "echarpe" || t === "bonnet" || t === "chapeau" ? 2 : 1);
  const tries = [...objets].sort((a, b) => ordre(a.o.type) - ordre(b.o.type));
  const geoMain = enMain ? geometrie(contenu, corps, tete) : null;
  return (
    <svg ref={svgRef} className="bh-scene" viewBox={`0 0 ${SCENE.l} ${SCENE.h}`} preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <Decor />
      {/* les bras passent derrière le corps */}
      {tries.filter((x) => x.o.type === "branche").map((x) => <ObjetSvg key={x.o.id} x={x} geo={geo} contenu={contenu} surPrendre={surPrendre} />)}
      <BouleSvg g={geo.corps} id="bh-corps" />
      <BouleSvg g={geo.tete} id="bh-tete" />
      {tries.filter((x) => x.o.type !== "branche").map((x) => <ObjetSvg key={x.o.id} x={x} geo={geo} contenu={contenu} surPrendre={surPrendre} />)}
      {enMain && geoMain && (
        <g opacity={0.85} style={{ pointerEvents: "none" }}>
          <DessinObjet type={enMain.type} x={enMain.x} y={enMain.y}
            r={Math.hypot(enMain.x - geoMain.tete.cx, enMain.y - geoMain.tete.cy) / geoMain.tete.r
              <= Math.hypot(enMain.x - geoMain.corps.cx, enMain.y - geoMain.corps.cy) / geoMain.corps.r ? geoMain.tete.r : geoMain.corps.r}
            cote={enMain.x < SCENE.l / 2 ? -1 : 1} contenu={contenu} />
        </g>
      )}
      {enfants}
    </svg>
  );
}

function ObjetSvg({ x, geo, contenu, surPrendre }: {
  x: ObjetVu; geo: ReturnType<typeof geometrie>; contenu: BonhommeContent;
  surPrendre?: (o: Objet, e: PE<SVGGElement>) => void;
}) {
  const p = position(geo, x.o);
  const prenable = x.moi && !!surPrendre;
  return (
    <g className={prenable ? "bh-objet moi" : "bh-objet"}
      onPointerDown={prenable ? (e) => surPrendre!(x.o, e) : undefined}>
      <DessinObjet type={x.o.type} x={p.x} y={p.y} r={p.r} cote={x.o.u < 0 ? -1 : 1} contenu={contenu} />
    </g>
  );
}
