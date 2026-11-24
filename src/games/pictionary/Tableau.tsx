/**
 * Le tableau carré : affiche un dessin (en direct, rejoué ou fini) et, si `crayon` est donné,
 * permet de dessiner au doigt / à la souris.
 * Les éléments vivent dans une ref partagée avec le jeu : pas de rendu React à chaque point.
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import { peindre, type Element, type Trait } from "./dessin";

export type Crayon = {
  c: number;
  e: number;
  /** Heure locale (Date.now) du début de la manche : sert à horodater les points */
  debut: number;
  /** Prévenu à chaque ajout : indice de l'élément et points ajoutés (x, y, t…) */
  onPoints: (i: number, el: Trait, nouveaux: number[]) => void;
};

export function Tableau({
  elements, crayon, jusqua, sale,
}: {
  elements: MutableRefObject<(Element | undefined)[]>;
  crayon?: Crayon | null;
  /** Rejeu : renvoie l'instant (ms) jusqu'où montrer le dessin ; repeint à chaque image */
  jusqua?: () => number;
  /** Mis à vrai par le jeu quand des éléments arrivent de l'extérieur */
  sale?: MutableRefObject<boolean>;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const crayonRef = useRef(crayon);
  crayonRef.current = crayon;
  const jusquaRef = useRef(jusqua);
  jusquaRef.current = jusqua;
  const local = useRef(true);

  /* ---------- taille : le plus grand carré qui tient ---------- */
  useEffect(() => {
    const b = boite.current, c = toile.current;
    if (!b || !c) return;
    const ajuster = () => {
      const cote = Math.max(80, Math.floor(Math.min(b.clientWidth, b.clientHeight)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.style.width = c.style.height = `${cote}px`;
      c.width = c.height = Math.round(cote * dpr);
      local.current = true;
    };
    ajuster();
    const ro = new ResizeObserver(ajuster);
    ro.observe(b);
    return () => ro.disconnect();
  }, []);

  /* ---------- boucle d'affichage ---------- */
  useEffect(() => {
    let id = 0;
    const boucle = () => {
      const c = toile.current;
      const cx = c?.getContext("2d");
      const rejeu = jusquaRef.current;
      if (c && cx && (rejeu || local.current || sale?.current)) {
        local.current = false;
        if (sale) sale.current = false;
        peindre(cx, c.width, elements.current, rejeu ? rejeu() : Infinity);
      }
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [elements, sale]);

  /* ---------- saisie ---------- */
  useEffect(() => {
    const c = toile.current;
    if (!c) return;
    let enCours: { i: number; el: Trait } | null = null;

    const point = (ev: PointerEvent) => {
      const r = c.getBoundingClientRect();
      const x = Math.round(((ev.clientX - r.left) / r.width) * 1000);
      const y = Math.round(((ev.clientY - r.top) / r.height) * 1000);
      return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
    };
    const instant = () => Math.max(0, Math.round(Date.now() - (crayonRef.current?.debut ?? Date.now())));

    const bas = (ev: PointerEvent) => {
      const cr = crayonRef.current;
      if (!cr) return;
      ev.preventDefault();
      c.setPointerCapture(ev.pointerId);
      const [x, y] = point(ev);
      const el: Trait = { c: cr.c, e: cr.e, p: [x, y, instant()] };
      const i = elements.current.length;
      elements.current.push(el);
      enCours = { i, el };
      local.current = true;
      cr.onPoints(i, el, el.p.slice());
    };
    const bouge = (ev: PointerEvent) => {
      const cr = crayonRef.current;
      if (!enCours || !cr) return;
      ev.preventDefault();
      const p = enCours.el.p;
      // les événements groupés (stylet, souris rapide) donnent un trait plus fidèle
      const evs = typeof ev.getCoalescedEvents === "function" ? ev.getCoalescedEvents() : [ev];
      const ajout: number[] = [];
      for (const e of evs.length ? evs : [ev]) {
        const [x, y] = point(e);
        const n = p.length;
        const dx = x - p[n - 3], dy = y - p[n - 2];
        if (dx * dx + dy * dy < 25) continue; // moins de 5 unités : inutile
        const t = instant();
        p.push(x, y, t);
        ajout.push(x, y, t);
      }
      if (ajout.length) { local.current = true; cr.onPoints(enCours.i, enCours.el, ajout); }
    };
    const haut = () => { enCours = null; };

    c.addEventListener("pointerdown", bas);
    c.addEventListener("pointermove", bouge);
    c.addEventListener("pointerup", haut);
    c.addEventListener("pointercancel", haut);
    return () => {
      c.removeEventListener("pointerdown", bas);
      c.removeEventListener("pointermove", bouge);
      c.removeEventListener("pointerup", haut);
      c.removeEventListener("pointercancel", haut);
    };
  }, [elements]);

  return (
    <div className="pic-tableau" ref={boite}>
      <canvas ref={toile} className={crayon ? "pic-toile actif" : "pic-toile"} aria-label="Tableau à dessin" />
    </div>
  );
}
