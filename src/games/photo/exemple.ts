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
