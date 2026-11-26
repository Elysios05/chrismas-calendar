/**
 * Jour 13, phase 2 — décorer le bonhomme à deux.
 * On glisse un objet du plateau sur le bonhomme ; on reprend un de ses objets pour le déplacer,
 * ou on le ramène sur le plateau pour l'enlever. Les objets de l'autre sont visibles, pas déplaçables.
 */

import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import type { BonhommeContent, TypeDeco } from "../../data/games/bonhomme-jour13";
import { DessinObjet, SceneBonhomme, type ObjetVu } from "./Scene";
import { SCENE, geometrie, rattacher, type Boule, type Objet } from "./modele";

type EnMain = { type: TypeDeco; x: number; y: number; id: string; dedans: boolean };

let compteur = 0;
const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function Decorer({
  contenu, corps, tete, miens, siens, surChange, max,
}: {
  contenu: BonhommeContent;
  corps: Boule | null;
  tete: Boule | null;
  miens: Objet[];
  /** Objets de l'autre, déjà posés */
  siens: Objet[];
  surChange: (objets: Objet[]) => void;
  max: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [enMain, setEnMain] = useState<EnMain | null>(null);
  const enMainRef = useRef(enMain);
  enMainRef.current = enMain;
  const miensRef = useRef(miens);
  miensRef.current = miens;

  const versScene = (cx: number, cy: number) => {
    const s = svg.current;
    const m = s?.getScreenCTM();
    if (!s || !m) return { x: -999, y: -999, dedans: false };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    const b = s.getBoundingClientRect();
    const dedans = cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom
      && p.x >= 0 && p.x <= SCENE.l && p.y >= 0 && p.y <= SCENE.h;
    return { x: p.x, y: p.y, dedans };
  };

  // pendant un déplacement, on suit le doigt partout dans la page
  useEffect(() => {
    if (!enMain) return;
    const bouge = (e: PointerEvent) => {
      const p = versScene(e.clientX, e.clientY);
      setEnMain((m) => (m ? { ...m, ...p } : m));
    };
    const lache = (e: PointerEvent) => {
      const p = versScene(e.clientX, e.clientY);
      const m = enMainRef.current;
      setEnMain(null);
      if (m && p.dedans) {
        const geo = geometrie(contenu, corps, tete);
        const o: Objet = { id: m.id, type: m.type, ...rattacher(geo, p.x, p.y) };
        surChange([...miensRef.current.filter((x) => x.id !== m.id), o]);
      }
    };
    addEventListener("pointermove", bouge);
    addEventListener("pointerup", lache);
    addEventListener("pointercancel", lache);
    return () => {
      removeEventListener("pointermove", bouge);
      removeEventListener("pointerup", lache);
      removeEventListener("pointercancel", lache);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enMain !== null, corps, tete]);

  const prendreDuPlateau = (type: TypeDeco, e: PE) => {
    if (miens.length >= max) return;
    e.preventDefault();
    setEnMain({ type, id: nouvelId(), ...versScene(e.clientX, e.clientY) });
  };

  const reprendre = (o: Objet, e: PE) => {
    e.preventDefault();
    e.stopPropagation();
    // l'objet quitte la scène le temps du déplacement ; lâché hors de la scène, il est enlevé
    surChange(miens.filter((x) => x.id !== o.id));
    setEnMain({ type: o.type, id: o.id, ...versScene(e.clientX, e.clientY) });
  };

  const vus: ObjetVu[] = [
    ...siens.map((o) => ({ o, moi: false })),
    ...miens.map((o) => ({ o, moi: true })),
  ];
  const reste = max - miens.length;

  return (
    <div className="bh-deco">
      <div className="bh-scene-boite">
        <SceneBonhomme contenu={contenu} corps={corps} tete={tete} objets={vus} svgRef={svg}
          enMain={enMain?.dedans ? enMain : null} surPrendre={reprendre} />
        {enMain && !enMain.dedans && <div className="bh-retirer">Lâche ici pour l'enlever</div>}
      </div>
      <div className="bh-plateau" aria-label="Objets à poser">
        {contenu.decos.map((d) => {
          const r = 22 / d.taille;
          return (
            <button key={d.type} className="bh-piece" disabled={reste <= 0} title={d.nom}
              onPointerDown={(e) => prendreDuPlateau(d.type, e)}>
              <svg viewBox="-24 -24 48 48" aria-hidden>
                <DessinObjet type={d.type} x={d.type === "branche" ? -18 : d.type === "carotte" ? -10 : 0}
                  y={d.type === "branche" ? 8 : d.type === "bonnet" ? 12 : 0}
                  r={d.type === "branche" ? 40 : d.type === "echarpe" ? 28 : d.type === "carotte" ? r * 1.5 : r}
                  cote={1} contenu={contenu} />
              </svg>
              <span>{d.nom}</span>
            </button>
          );
        })}
      </div>
      <div className="bh-compte">{reste > 0 ? `Encore ${reste} objet${reste > 1 ? "s" : ""} à poser` : "Tu as posé tous tes objets"}</div>
    </div>
  );
}
