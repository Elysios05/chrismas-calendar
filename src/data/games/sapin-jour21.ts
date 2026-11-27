/**
 * Jour 21 — « Décorer le sapin à deux » : réglages et textes, sans code.
 * Décoration libre, en direct ou chacun son tour. Le sapin reste jusqu'au 24.
 * Rien à personnaliser dans un salon (pas de schéma) : ce sont des réglages de jeu.
 */

export type TypeDeco = "boule" | "sucre" | "coeur" | "cloche" | "noeud" | "cadeau" | "guirlande";

export type SapinContent = {
  /** Décos posées par chacun pour faire apparaître l'étoile */
  seuilEtoile: number;
  /** Décos au plus par personne (garde l'état de la case léger) */
  maxDecos: number;
  /** Guirlandes au plus par personne */
  maxGuirlandes: number;
  /** Temps à tenir l'étoile du doigt (ms) */
  tenueEtoileMs: number;
  /** Palette proposée, en 0xRRGGBB (pas de vert : il disparaîtrait sur le sapin) */
  couleurs: { nom: string; hex: number }[];
  /** Ordre du panier */
  decos: { type: TypeDeco; nom: string }[];
};

export const SAPIN_JOUR21: SapinContent = {
  seuilEtoile: 6,
  maxDecos: 40,
  maxGuirlandes: 6,
  tenueEtoileMs: 1500,
  couleurs: [
    { nom: "Rouge", hex: 0xd9354b },
    { nom: "Or", hex: 0xf2b632 },
    { nom: "Bleu", hex: 0x2f7fd6 },
    { nom: "Argent", hex: 0xc9d4e2 },
    { nom: "Rose", hex: 0xe86fa0 },
    { nom: "Violet", hex: 0x8a5cd6 },
    { nom: "Blanc", hex: 0xfff8ec },
  ],
  decos: [
    { type: "boule", nom: "Boule" },
    { type: "guirlande", nom: "Guirlande" },
    { type: "sucre", nom: "Sucre d'orge" },
    { type: "coeur", nom: "Cœur" },
    { type: "cloche", nom: "Clochette" },
    { type: "noeud", nom: "Nœud" },
    { type: "cadeau", nom: "Cadeau" },
  ],
};

/** Répliques de Pingou. {autre} = prénom de l'autre. */
export const SAPIN_LIGNES = {
  arrivee: "Un sapin tout nu… Choisis une déco en bas, puis pose-la du doigt sur les branches 🎄",
  autreLa: "{autre} est là ! Vous décorez ensemble, en direct ✨",
  autreArrive: "{autre} vient d'arriver au pied du sapin !",
  autrePart: "{autre} a quitté le sapin… Continue, je garde tout : vos décos l'attendront.",
  seul: "{autre} n'est pas là pour l'instant. Tes décos l'attendront sur le sapin.",
  horsSapin: "Ça, ça va sur les branches !",
  cadeauPied: "Les cadeaux, c'est au pied du sapin 🎁",
  plein: "Tu as posé toutes tes décos ! Tu peux en enlever avec « Annuler ».",
  etoilePrete: "L'étoile est arrivée ⭐ Tenez-la à deux en même temps pour la poser là-haut !",
  etoileAttendre: "Tiens bon… il faut que {autre} la tienne aussi !",
  etoileVeille: "Tu as tenu l'étoile ✨ Elle montera dès que {autre} la tiendra à son tour.",
  etoileAutreVeille: "{autre} a déjà tenu l'étoile pour toi. À ton tour : garde le doigt dessus !",
  etoilePosee: "Les lumières s'allument ! Votre sapin brillera sur la carte jusqu'au 24 🌟",
};
