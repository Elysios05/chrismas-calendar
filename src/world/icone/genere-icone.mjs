// Génère les icônes de l'appli (Pingou, issue 18) : node src/world/icone/genere-icone.mjs B public/icons
// (sans argument : aperçus A et B dans le dossier courant)
import { createRequire } from 'module'; const { chromium } = createRequire(process.cwd() + '/')('playwright');
import fs from 'fs';

const NAVY = '#101a3a';
// flocons déterministes
function flakes(seed, n, safe) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * 100, y = r() * 100, rad = 0.35 + r() * 0.6;
    if (safe && Math.hypot(x - 50, y - 52) < 34) continue;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="#cfe0ff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}
const bg = (seed) => `
  <defs>
    <radialGradient id="ciel" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="#26386e"/><stop offset=".6" stop-color="#16224a"/><stop offset="1" stop-color="${NAVY}"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffd27a" stop-opacity=".38"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#ciel)"/>
  ${flakes(seed, 46, true)}`;

// A · tête seule, grand plan
const tete = `
  <circle cx="50" cy="56" r="44" fill="url(#halo)"/>
  <circle cx="50" cy="58" r="33" fill="#3a5196" opacity=".55"/>
  <g transform="translate(50 60) scale(1.5) translate(-50 -40)">
    <circle cx="50" cy="36" r="22" fill="#2b3c6c"/>
        <ellipse cx="50" cy="40" rx="15" ry="13" fill="#fff"/>
    <circle cx="43" cy="37" r="3.6" fill="#1b2340"/><circle cx="44.2" cy="35.8" r="1.2" fill="#fff"/>
    <path d="M53 37 q4 -4.6 8 0" stroke="#1b2340" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M45 43 L55 43 L50 49Z" fill="#ff9a3d"/>
    <circle cx="37" cy="45" r="3.4" fill="#ff8fa3" opacity=".85"/>
    <circle cx="63" cy="45" r="3.4" fill="#ff8fa3" opacity=".85"/>
    <rect x="31" y="54" width="38" height="8" rx="4" fill="#d9354b"/>
    <path d="M30 30 A20 20 0 0 1 70 30Z" fill="#d9354b"/>
    <rect x="28" y="27" width="44" height="7" rx="3.5" fill="#fff"/>
    <circle cx="64" cy="12" r="6" fill="#fff"/>
  </g>`;

// B · Pingou entier avec un cadeau
const entier = `
  <ellipse cx="50" cy="88" rx="44" ry="10" fill="#e8f1ff"/>
  <circle cx="50" cy="52" r="38" fill="url(#halo)"/>
  <g transform="translate(50 52) scale(.86) translate(-50 -52)">
    <ellipse cx="38" cy="90" rx="10" ry="5" fill="#ff9a3d"/>
    <ellipse cx="62" cy="90" rx="10" ry="5" fill="#ff9a3d"/>
    <ellipse cx="50" cy="66" rx="28" ry="26" fill="#2b3c6c"/>
    <ellipse cx="50" cy="70" rx="18" ry="19" fill="#fff"/>
    <ellipse cx="22" cy="64" rx="7" ry="15" fill="#1f2c55" transform="rotate(18 22 64)"/>
    <circle cx="50" cy="36" r="22" fill="#2b3c6c"/>
    <ellipse cx="50" cy="40" rx="15" ry="13" fill="#fff"/>
    <circle cx="43" cy="37" r="3.6" fill="#1b2340"/><circle cx="44.2" cy="35.8" r="1.2" fill="#fff"/>
    <circle cx="57" cy="37" r="3.6" fill="#1b2340"/><circle cx="58.2" cy="35.8" r="1.2" fill="#fff"/>
    <path d="M45 43 L55 43 L50 49Z" fill="#ff9a3d"/>
    <circle cx="37" cy="45" r="3.4" fill="#ff8fa3" opacity=".85"/>
    <circle cx="63" cy="45" r="3.4" fill="#ff8fa3" opacity=".85"/>
    <rect x="31" y="52" width="38" height="8" rx="4" fill="#d9354b"/>
    <rect x="34" y="54" width="8" height="16" rx="4" fill="#d9354b"/>
    <path d="M30 30 A20 20 0 0 1 70 30Z" fill="#d9354b"/>
    <rect x="28" y="27" width="44" height="7" rx="3.5" fill="#fff"/>
    <circle cx="64" cy="12" r="6" fill="#fff"/>
    <!-- cadeau tenu sous l'aile droite -->
    <g transform="rotate(-8 74 74)">
      <rect x="60" y="64" width="26" height="22" rx="2" fill="#e8b23a"/>
      <rect x="70.5" y="64" width="5" height="22" fill="#d9354b"/>
      <rect x="60" y="72" width="26" height="5" fill="#d9354b"/>
      <path d="M73 64 q-9 -9 -10 -1 q2 3 10 1Z M73 64 q9 -9 10 -1 q-2 3 -10 1Z" fill="#d9354b"/>
    </g>
    <ellipse cx="66" cy="74" rx="5" ry="8" fill="#1f2c55" transform="rotate(-30 66 74)"/>
  </g>`;

const svg = (body, seed, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${bg(seed)}<g transform="translate(50 50) scale(${1 - pad}) translate(-50 -50)">${body}</g></svg>`;

const variants = {
  A: { body: tete, seed: 7 },
  B: { body: entier, seed: 11 },
};
const which = process.argv[2] || 'preview';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
async function png(svgText, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svgText.replace('width="100" height="100"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
}
if (which === 'preview') {
  for (const [k, v] of Object.entries(variants)) {
    fs.writeFileSync(`pingou-${k}.svg`, svg(v.body, v.seed));
    await png(svg(v.body, v.seed), 512, `prev-${k}.png`);
    await png(svg(v.body, v.seed, 0.2), 512, `prev-${k}-maskable.png`);
  }
} else {
  const v = variants[which]; const out = process.argv[3];
  fs.writeFileSync(`${out}/pingou.svg`, svg(v.body, v.seed));
  await png(svg(v.body, v.seed), 512, `${out}/icon-512.png`);
  await png(svg(v.body, v.seed), 192, `${out}/icon-192.png`);
  await png(svg(v.body, v.seed), 180, `${out}/apple-touch-icon.png`);
  await png(svg(v.body, v.seed, 0.2), 512, `${out}/icon-maskable-512.png`);
}
await browser.close();
