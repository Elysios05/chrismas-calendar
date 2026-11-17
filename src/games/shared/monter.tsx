/**
 * Pont entre le contrat `GameModule.mount(el, ctx)` (DOM) et React.
 * Chaque jeu React se résume à : `mount: (el, ctx) => monterReact(el, <MonJeu ctx={ctx} />)`.
 */

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function monterReact(el: HTMLElement, noeud: ReactNode): () => void {
  const racine = createRoot(el);
  racine.render(noeud);
  // Démontage différé : React refuse un unmount pendant son propre rendu.
  return () => { queueMicrotask(() => racine.unmount()); };
}
