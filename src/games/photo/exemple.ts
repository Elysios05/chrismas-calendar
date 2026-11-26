/**
 * Mode démo : une « photo » de vue de fenêtre dessinée au canevas, pour que le défi photo
 * soit jouable sans l'autre joueur. Tirage fixe : la même image à chaque fois.
 */

import { creerAlea } from "../shared/alea";

export function dessinerVueExemple(): string {
  const L = 600, H = 800;
  const c = document.createElement("canvas");
  c.width = L; c.height = H;
  const g = c.getContext("2d");
  if (!g) return "";
  const alea = creerAlea(3);

  // ciel du soir
  const ciel = g.createLinearGradient(0, 0, 0, H);
  ciel.addColorStop(0, "#2b3f7a"); ciel.addColorStop(0.55, "#8a7fb8"); ciel.addColorStop(1, "#f2b8a0");
  g.fillStyle = ciel; g.fillRect(0, 0, L, H);

  // toits enneigés et fenêtres allumées
  const toits = [[0, 520, 170], [150, 470, 190], [320, 540, 150], [440, 490, 180]] as const;
  for (const [x, y, w] of toits) {
    g.fillStyle = "#3a3550"; g.fillRect(x, y, w, H - y);
    g.fillStyle = "#f4f6fb";
    g.beginPath(); g.moveTo(x - 10, y + 6); g.lineTo(x + w / 2, y - 60); g.lineTo(x + w + 10, y + 6); g.closePath(); g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = alea.reel() < 0.6 ? "#ffd27a" : "#2a2640";
      g.fillRect(x + 22 + (i % 2) * (w / 2 - 10), y + 40 + Math.floor(i / 2) * 90, 34, 46);
    }
  }
  // cheminée et fumée
  g.fillStyle = "#5a3a3a"; g.fillRect(200, 400, 26, 50);
  g.fillStyle = "rgba(255,255,255,.35)";
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(214 + i * 10, 380 - i * 34, 14 + i * 5, 0, Math.PI * 2); g.fill(); }

  // neige qui tombe
  g.fillStyle = "rgba(255,255,255,.9)";
  for (let i = 0; i < 140; i++) {
    g.beginPath(); g.arc(alea.reel() * L, alea.reel() * H, 1 + alea.reel() * 3, 0, Math.PI * 2); g.fill();
  }

  // cadre de la fenêtre (bois) et croisillon
  g.strokeStyle = "#7a4e2d"; g.lineWidth = 34; g.strokeRect(17, 17, L - 34, H - 34);
  g.lineWidth = 18;
  g.beginPath(); g.moveTo(L / 2, 0); g.lineTo(L / 2, H); g.moveTo(0, H * 0.45); g.lineTo(L, H * 0.45); g.stroke();
  // buée en bas
  const buee = g.createLinearGradient(0, H - 160, 0, H);
  buee.addColorStop(0, "rgba(255,255,255,0)"); buee.addColorStop(1, "rgba(255,255,255,.45)");
  g.fillStyle = buee; g.fillRect(0, H - 160, L, 160);

  return c.toDataURL("image/jpeg", 0.8);
}

/** Jour 19 : un sapin décoré dans un coin de salon, le soir (même tirage à chaque fois). */
export function dessinerSapinExemple(): string {
  const L = 600, H = 800;
  const c = document.createElement("canvas");
  c.width = L; c.height = H;
  const g = c.getContext("2d");
  if (!g) return "";
  const alea = creerAlea(19);

  // mur chaud et parquet
  const mur = g.createLinearGradient(0, 0, 0, 600);
  mur.addColorStop(0, "#3b2a3f"); mur.addColorStop(1, "#6b4146");
  g.fillStyle = mur; g.fillRect(0, 0, L, 600);
  g.fillStyle = "#5a3826"; g.fillRect(0, 600, L, H - 600);
  g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 3;
  for (let y = 630; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(L, y); g.stroke(); }
  // halo des lumières
  const halo = g.createRadialGradient(300, 380, 40, 300, 380, 360);
  halo.addColorStop(0, "rgba(255,200,120,.35)"); halo.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = halo; g.fillRect(0, 0, L, H);

  // tronc et pot
  g.fillStyle = "#5a3a22"; g.fillRect(282, 600, 36, 50);
  g.fillStyle = "#b8343a";
  g.beginPath(); g.moveTo(230, 640); g.lineTo(370, 640); g.lineTo(352, 730); g.lineTo(248, 730); g.closePath(); g.fill();
  g.fillStyle = "#e0b04a"; g.fillRect(230, 640, 140, 12);

  // trois étages de branches
  // du bas vers le haut, pour que chaque étage recouvre le pied du suivant
  const etages = [[300, 610, 200], [200, 470, 160], [110, 330, 120]] as const; // [sommet, bas, demi-largeur]
  etages.forEach(([haut, bas, demi], i) => {
    g.fillStyle = i % 2 ? "#24804f" : "#1f6b45";
    g.beginPath(); g.moveTo(300, haut); g.lineTo(300 + demi, bas); g.lineTo(300 - demi, bas); g.closePath(); g.fill();
    g.fillStyle = "rgba(0,0,0,.12)"; // ombre sous chaque étage
    g.fillRect(300 - demi * 0.9, bas - 8, demi * 1.8, 8);
  });

  // guirlande lumineuse en festons
  for (const [y, demi] of [[270, 80], [410, 125], [550, 165]] as const) {
    g.strokeStyle = "rgba(255,230,160,.5)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(300 - demi, y - 30); g.quadraticCurveTo(300, y + 30, 300 + demi, y - 30); g.stroke();
    for (let t = 0; t <= 1; t += 0.1) {
      const x = (1 - t) ** 2 * (300 - demi) + 2 * (1 - t) * t * 300 + t ** 2 * (300 + demi);
      const yy = (1 - t) ** 2 * (y - 30) + 2 * (1 - t) * t * (y + 30) + t ** 2 * (y - 30);
      g.fillStyle = ["#ffe08a", "#ff9a8a", "#9ad8ff"][Math.floor(t * 10) % 3];
      g.beginPath(); g.arc(x, yy, 5, 0, Math.PI * 2); g.fill();
    }
  }

  // boules
  const couleurs = ["#d8343f", "#e8b84a", "#4f8fd8", "#f2f2f7"];
  for (let i = 0; i < 18; i++) {
    const y = 190 + alea.reel() * 390;
    const demi = (y - 110) * 0.38;
    const x = 300 + (alea.reel() * 2 - 1) * demi * 0.75;
    g.fillStyle = couleurs[i % couleurs.length];
    g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    g.beginPath(); g.arc(x - 4, y - 4, 3, 0, Math.PI * 2); g.fill();
  }

  // étoile au sommet
  g.fillStyle = "#ffd65a";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 14 : 34, a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(300 + r * Math.cos(a), 100 + r * Math.sin(a));
  }
  g.closePath(); g.fill();

  // cadeaux au pied
  for (const [x, w, h, coul] of [[150, 90, 70, "#3c7fd0"], [400, 80, 90, "#d8343f"], [470, 60, 50, "#e8b84a"]] as const) {
    g.fillStyle = coul; g.fillRect(x, 740 - h, w, h);
    g.fillStyle = "#f6f0e0"; g.fillRect(x + w / 2 - 6, 740 - h, 12, h); g.fillRect(x, 740 - h / 2 - 6, w, 12);
  }

  return c.toDataURL("image/jpeg", 0.8);
}
