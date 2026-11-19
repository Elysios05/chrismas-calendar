/**
 * Page de démo audio : écouter chaque ambiance (jour/nuit), les musiques de jeu
 * et les effets. Lancer `npm run dev` puis ouvrir /audio-demo.html.
 */
import type { ZoneId } from "../core/contracts";
import { sound, type GameMood } from "./engine";
import { renderAmbience, renderJingle, renderPiece, renderSfx, stressSfx, toWav, wavBase64 } from "./render";
import { CHARACTER_SFX, SFX_LIST } from "./sfx";

const ZONES: [ZoneId, string][] = [
  ["montagnes", "Montagnes"],
  ["saint-nicolas", "Village de Saint-Nicolas"],
  ["lac", "Forêt et lac gelé"],
  ["marche", "Marché de Noël"],
  ["grotte", "Grotte de glace"],
  ["pole-nord", "Pôle Nord"],
];
const MOODS: [GameMood, string][] = [["calm", "Jeu calme"], ["action", "Jeu d'action"], ["victory", "Victoire"], ["duel", "Duel à deux"], ["cosy", "Création à deux"]];

const css = `
  body { font-family: system-ui, sans-serif; background: #0f2236; color: #eef6ff; margin: 0; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 18px 0 8px; color: #9cc8f0; }
  p { margin: 0 0 8px; opacity: .8; font-size: 13px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
  .name { min-width: 190px; font-size: 14px; }
  button { font: inherit; font-size: 14px; border: 0; border-radius: 10px; padding: 8px 12px; background: #2b5c8a; color: #fff; cursor: pointer; }
  button:hover { background: #3a74ab; } button.on { background: #e05a5a; } button.dl { background: #33465a; font-size: 12px; }
  #status { position: sticky; top: 0; background: #0f2236; padding: 6px 0; font-size: 13px; }
`;

const root = document.getElementById("demo")!;
root.innerHTML = `<style>${css}</style>
  <h1>Démo audio du calendrier</h1>
  <p>Toute la musique est composée en code (Tone.js) : aucun fichier audio.</p>
  <div id="status">Clique sur un bouton pour démarrer le son.</div>
  <div class="row"><button id="mute">Couper le son</button>
    <label>Général <input id="vol" type="range" min="0" max="1" step="0.01" value="1"></label>
    <label>Musique <input id="mvol" type="range" min="0" max="1" step="0.01" value="0.5"></label>
    <label>Effets et ambiance <input id="svol" type="range" min="0" max="1" step="0.01" value="0.6"></label></div>
  <div class="row"><button id="storm">Tempête : non</button>
    <label>Vent (col) <input id="wind" type="range" min="0" max="1" step="0.01" value="0.5"></label></div>
  <h2>Ambiances des mondes</h2><div id="zones"></div>
  <h2>Musiques de jeu</h2><div id="moods"></div>
  <h2>Effets</h2><div class="row" id="sfx"></div>
  <h2>Animaux, personnages, présence</h2><div class="row" id="chars"></div>`;

const status = root.querySelector<HTMLDivElement>("#status")!;
const setStatus = (s: string) => (status.textContent = s);
let active: HTMLButtonElement | null = null;
const mark = (b: HTMLButtonElement) => {
  active?.classList.remove("on");
  b.classList.add("on");
  active = b;
};

function button(label: string, onClick: (b: HTMLButtonElement) => void, cls = "") {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = () => onClick(b);
  return b;
}

async function download(id: string, night: boolean) {
  setStatus(`Rendu de « ${id} » en cours…`);
  const buf = await renderPiece(id, night, 30);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(toWav(buf));
  a.download = `${id}-${night ? "nuit" : "jour"}.wav`;
  a.click();
  setStatus("Fichier prêt.");
}

const zones = root.querySelector("#zones")!;
for (const [id, name] of ZONES) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<span class="name">${name}</span>`;
  for (const night of [false, true]) {
    row.append(button(night ? "Nuit" : "Jour", (b) => {
      sound.setGameMusic(null);
      sound.setZone(id, night);
      mark(b);
      setStatus(`Ambiance : ${name} (${night ? "nuit" : "jour"}) — fondu enchaîné de 2,5 s`);
    }));
  }
  row.append(button("Jingle", () => sound.playJingle(id)));
  row.append(button("WAV", () => void download(id, false), "dl"));
  zones.append(row);
}

const moods = root.querySelector("#moods")!;
const mrow = document.createElement("div");
mrow.className = "row";
for (const [mood, name] of MOODS) {
  mrow.append(button(name, (b) => {
    sound.setGameMusic(mood);
    mark(b);
    setStatus(`Musique de jeu : ${name}`);
  }));
}
mrow.append(button("Retour à l'ambiance", (b) => {
  sound.setGameMusic(null);
  mark(b);
  setStatus("Retour à l'ambiance du monde");
}));
moods.append(mrow);

const sfxRow = root.querySelector("#sfx")!;
for (const s of SFX_LIST) sfxRow.append(button(s, () => sound.play(s)));
const charRow = root.querySelector("#chars")!;
for (const s of CHARACTER_SFX) charRow.append(button(s, () => sound.play(s)));

root.querySelector<HTMLButtonElement>("#mute")!.onclick = (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  const on = !sound.isEnabled();
  sound.setEnabled(on);
  b.textContent = on ? "Couper le son" : "Rétablir le son";
};
const slider = (id: string, fn: (v: number) => void) =>
  (root.querySelector<HTMLInputElement>(id)!.oninput = (e) => fn(Number((e.target as HTMLInputElement).value)));
slider("#vol", (v) => sound.setVolume(v));
slider("#mvol", (v) => sound.setMusicVolume(v));
slider("#svol", (v) => sound.setSfxVolume(v));
slider("#wind", (v) => sound.setWind(v));
let storm = false;
root.querySelector<HTMLButtonElement>("#storm")!.onclick = (e) => {
  storm = !storm;
  sound.setWeather(storm);
  (e.currentTarget as HTMLButtonElement).textContent = `Tempête : ${storm ? "oui" : "non"}`;
};

// Accès pour l'automatisation (rendu des extraits)
Object.assign(window, { __audio: { renderPiece, renderSfx, renderAmbience, renderJingle, stressSfx, wavBase64 } });
