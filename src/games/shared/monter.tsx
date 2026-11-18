/**
 * Pont entre le contrat `GameModule.mount(el, ctx)` (DOM) et React.
 * Chaque jeu React se résume à : `mount: (el, ctx) => monterReact(el, <MonJeu ctx={ctx} />)`.
 *
 * Deux précautions, parce que l'élément prêté par l'hôte ne nous appartient pas :
 *  - on monte dans une boîte à nous (`.jeu-boite`) ajoutée dans l'élément, jamais dans
 *    l'élément lui-même : sinon un remontage (« Revoir la case ») crée une deuxième racine
 *    React sur le même nœud pendant que l'ancienne se démonte, et l'écran se vide ;
 *  - la boîte donne au jeu une hauteur utilisable même si l'hôte est une simple div de 180 px.
 */

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function monterReact(el: HTMLElement, noeud: ReactNode): () => void {
  const boite = document.createElement("div");
  boite.className = "jeu-boite";
  el.appendChild(boite);
  const racine = createRoot(boite);
  racine.render(noeud);
  // Démontage différé : React refuse un unmount pendant son propre rendu.
  return () => { queueMicrotask(() => { racine.unmount(); boite.remove(); }); };
}
