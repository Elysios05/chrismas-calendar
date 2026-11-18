import { useEffect, useRef } from "react";

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tout ce qu'une fenêtre modale doit faire pour être utilisable au clavier :
 *  - le focus entre dans la fenêtre à l'ouverture ;
 *  - Tab et Maj+Tab tournent en boucle dedans, on ne tombe jamais sur la page derrière ;
 *  - Échap ferme ;
 *  - à la fermeture, le focus revient sur l'élément qui a ouvert la fenêtre.
 *
 * À poser sur l'élément qui porte `role="dialog"`.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const panneau = useRef<T>(null);

  useEffect(() => {
    const ouvreur = document.activeElement as HTMLElement | null;
    const el = panneau.current;

    // premier élément utile, sinon le panneau lui-même
    const premier = el?.querySelector<HTMLElement>(FOCUSABLES);
    (premier ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const cibles = [...el.querySelectorAll<HTMLElement>(FOCUSABLES)].filter((n) => n.offsetParent !== null);
      if (!cibles.length) return;
      const debut = cibles[0]!;
      const fin = cibles[cibles.length - 1]!;
      if (e.shiftKey && document.activeElement === debut) { e.preventDefault(); fin.focus(); }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); debut.focus(); }
    };

    document.addEventListener("keydown", onKey);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // la page derrière ne défile plus
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
      ouvreur?.focus?.();
    };
  }, [onClose]);

  return panneau;
}

/** Vrai si la personne a demandé moins de mouvement (système ou réglage du site). */
export function mouvementReduit() {
  if (document.documentElement.dataset.animations === "non") return true;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
