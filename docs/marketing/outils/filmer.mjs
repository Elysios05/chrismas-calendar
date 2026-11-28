// Équipe Marketing — film du VRAI site, image par image, pour les vidéos TikTok.
//
//   QA_PORT=4199 node docs/marketing/outils/filmer.mjs <plan> [--de=N] [--a=N] [--heure=HH:MM] [--sortie=dossier]
//
// Principe : le rendu PixiJS est piloté à la main. On arrête le ticker de la scène, puis, pour chaque image,
// on pose le défilement, on avance le temps de la scène d'exactement 1/30 s et on photographie (JPEG q92).
// Résultat : une vidéo parfaitement fluide même si le navigateur (SwiftShader) ne fait qu'une image par seconde.
// Fenêtre 540×960 à l'échelle 2 = 1080×1920 (9:16), le même rendu qu'un téléphone (échelle de la scène ≈ identique).
// Salon fictif « Sam & Camille » obligatoire : le script échoue si « Alexandre », « Flavie » ou « Ljubljana »
// apparaît dans le texte visible.
//
// Les plans (voir PLANS plus bas) : monde, zones, case, surprise, makingof. Images écrites dans /tmp/film/<plan>-<heure>/.
//
// --propre : « rushes » sans aucun texte incrusté (les textes, zooms et coupes sont faits au montage, dans
// docs/marketing/montage/ avec Remotion). Le script écrit alors aussi <sortie>/marques.json : le numéro des
// images clés (toucher du cadeau, fenêtre, début du jeu, lettre…), pour que le montage coupe au bon endroit
// même si la durée d'une animation du site change. Tout refaire : `npm run videos` dans docs/marketing/montage/.
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import * as C from "../../../tests/qa/commun.mjs";

const opt = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const plan = process.argv[2];
const FPS = 30;
const PRENOMS = ["Sam", "Camille"];
const INTERDITS = /Alexandre|Flavie|Ljubljana/;
const heure = String(opt.heure ?? "12:00");
const de = Number(opt.de ?? 0), a = opt.a !== undefined ? Number(opt.a) : Infinity;
const sortie = path.resolve(String(opt.sortie ?? `/tmp/film/${plan}-${heure.replace(":", "h")}`));
const PROPRE = Boolean(opt.propre);
/** Images clés du rush (numéro de la prochaine image photographiée), écrites dans marques.json */
const marques = {};
const marquer = (nom, valeur) => { marques[nom] = valeur ?? numero; };

const VUE = { viewport: { width: 540, height: 960 }, deviceScaleFactor: Number(process.env.ECHELLE ?? 2), isMobile: true, hasTouch: true };

/** Hasard rejouable : deux passages (jour, nuit) donnent la même neige et les mêmes animaux, pour les fondus. */
const HASARD = () => {
  let s = 20261201;
  Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

/** La scène (instance de Scene) retrouvée dans l'arbre React : sceneRef de App.tsx. */
const TROUVER_SCENE = () => {
  const hote = document.querySelector(".stage-host");
  const cle = Object.keys(hote).find((k) => k.startsWith("__reactFiber$"));
  for (let f = hote[cle]; f; f = f.return) {
    let garde = 0;
    for (let h = f.memoizedState; h && typeof h === "object" && "next" in h && garde++ < 200; h = h.next) {
      const v = h.memoizedState;
      if (v && typeof v === "object" && v.current && typeof v.current.tick === "function" && v.current.terrain) { globalThis.__scene = v.current; return true; }
    }
  }
  return null;
};

async function ouvrir(navigateur, { jour, ouverts = [], prepares = [], cacherUI = true, horloge = false }) {
  const ctx = await navigateur.newContext({ ...VUE, timezoneId: C.FUSEAU, locale: "fr-FR" });
  const hm = heure.match(/^(\d{1,2}):(\d{2})$/);
  const date = `2026-11-30T${hm[1].padStart(2, "0")}:${hm[2]}:00+01:00`;
  // horloge : temps entièrement simulé (Date, minuteries, requestAnimationFrame, performance.now), avancé image par image
  await C.preparerContexte(ctx, horloge ? {} : { heure: date });
  if (horloge) await ctx.clock.install({ time: new Date(date) });
  if (!process.env.SANS_HASARD) await ctx.addInitScript(HASARD);
  await ctx.addInitScript(([ouverts, prepares]) => {
    // progression du salon de démo : cases déjà ouvertes (le 24 ouvert = le traîneau s'envole)
    if (!localStorage.getItem("cc-demo:data-v2")) localStorage.setItem("cc-demo:data-v2", JSON.stringify({
      progress: { alexandre: { opened: ouverts, completed: ouverts }, flavie: { opened: ouverts, completed: ouverts } },
      prepared: prepares, gameState: {},
    }));
  }, [ouverts, prepares]);
  const page = await ctx.newPage();
  const msgs = C.collecterConsole(page);
  await C.ouvrirDemo(page, { jour, prenoms: PRENOMS });
  await C.fermerPingou(page);
  if (cacherUI) await page.addStyleTag({ content: ".mascot,.rappel-host{display:none!important}" });
  await page.evaluate(TROUVER_SCENE);
  return { ctx, page, msgs };
}

/** Vérifie qu'aucun vrai prénom ni lieu n'est à l'écran (texte visible, titres, libellés). */
async function controler(page) {
  const t = await page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll("[title],[aria-label],[alt]")].flatMap((e) => [e.title, e.getAttribute("aria-label"), e.getAttribute("alt")])].join("\n"));
  const m = t.match(INTERDITS);
  if (m) throw new Error(`texte interdit à l'écran : ${m[0]}`);
}

/** Pilote la scène à la main : plus de ticker automatique, chaque image est calculée puis photographiée. */
async function prendreLaMain(page) {
  await page.evaluate(() => {
    const app = globalThis.__qaApp;
    app.ticker.stop();
    globalThis.__t = app.ticker.lastTime || performance.now();
    globalThis.__pas = async (y, n = 1, rendre = true) => {
      if (y !== null) { scrollTo(0, y); globalThis.__scene?.setScroll(scrollY); }
      const r = app.renderer, rendu = r.__rendu ?? r.render;
      r.__rendu = rendu;
      r.render = rendre ? rendu : () => {};
      for (let i = 0; i < n; i++) { globalThis.__t += 1000 / 30; app.ticker.update(globalThis.__t); }
      r.render = rendu;
      return globalThis.__scene?.zoneNow ?? -1;
    };
    // le traîneau du 24 repart de zéro : on le voit s'arracher du sol
    // caméra de cinéma : on part du cadrage courant et on glisse vers `cible()` en zoomant (p de 0 à 1)
    globalThis.__viser = (p, zoomMax, cible) => {
      const sc0 = globalThis.__scene, w = sc0.world;
      if (!globalThis.__depart) {
        const sc = w.scale.x;
        globalThis.__depart = { x: (innerWidth / 2 - w.x) / sc, y: (innerHeight * 0.44 - w.y) / sc };
      }
      const d = globalThis.__depart, c = cible();
      const e = p * p * p * (p * (p * 6 - 15) + 10);
      sc0.focus = { x: d.x + (c.x - d.x) * e, y: d.y + (c.y - d.y) * e, zoom: 1 + (zoomMax - 1) * e };
    };
    globalThis.__traineau = () => {
      for (const ch of globalThis.__scene.charges.values()) for (const a of ch.anims) if (a.kind === "takeoff") {
        const g = globalThis.__scene.world.toLocal(a.node.getGlobalPosition()); return { x: g.x, y: g.y };
      }
      return { x: 0, y: 0 };
    };
    globalThis.__decoller = () => {
      for (const ch of globalThis.__scene.charges.values()) for (const a of ch.anims) if (a.kind === "takeoff") a.t = 0;
    };
  });
}

/** Opacité d'un texte visible de l'image `a` à l'image `b`, avec fondus de 8 images */
const fenetre = (k, a, b) => Math.max(0, Math.min(1, (k - a) / 8, (b - k) / 8));

/**
 * Calque de textes posé sur la page (police Fredoka de l'appli : accents garantis).
 * Zones sûres TikTok : rien dans les 15 % du bas ni contre le bord droit.
 */
async function poserCalque(page) {
  if (PROPRE) { await page.evaluate(() => { globalThis.__ecrire = () => {}; }); return; }
  await page.addStyleTag({ content: `
    #film{position:fixed;inset:0;pointer-events:none;z-index:99999;font-family:Fredoka,sans-serif}
    #film>div{position:absolute;left:7%;right:14%;opacity:0;color:#fff;font-weight:700;line-height:1.1;
      -webkit-text-stroke:7px #17224a;paint-order:stroke fill;text-shadow:0 4px 18px rgba(10,16,40,.45)}
    #film .voile{z-index:-1;inset:0 0 auto 0;height:42%;left:0;right:0;-webkit-text-stroke:0;
      background:linear-gradient(rgba(14,20,48,.55),rgba(14,20,48,0))}
    #film .haut,#film .haut2{top:10%;font-size:46px}
    #film .zone{top:11%;font-size:24px;right:auto;font-weight:600;color:#1d2b4f;text-shadow:none;-webkit-text-stroke:0;background:rgba(255,255,255,.94);
      padding:8px 18px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.18)}
    #film .milieu{top:27%;font-size:40px}
    #film .bas{top:auto;bottom:22%;font-size:42px;right:6%}
    #film .voile-bas{z-index:-1;inset:auto 0 0 0;height:50%;left:0;right:0;-webkit-text-stroke:0;
      background:linear-gradient(rgba(14,20,48,0),rgba(14,20,48,.6))}
  ` });
  await page.evaluate(() => {
    const d = document.createElement("div"); d.id = "film"; document.body.appendChild(d);
    globalThis.__ecrire = (textes) => {
      for (const t of textes) {
        const cle = t.id.replace(/ /g, ".");
        let e = d.querySelector(`.${cle}`);
        if (!e) { e = document.createElement("div"); e.className = t.id; d.appendChild(e); }
        if (e.innerHTML !== t.html) e.innerHTML = t.html;
        e.style.opacity = String(t.o);
        e.style.transform = `translateY(${(1 - t.o) * 14}px)`;
      }
    };
  });
}

/**
 * Mode horloge (plans avec interface : ouverture d'une case, jeu, lettre) : on fige le temps de la page,
 * puis chaque image avance tout d'exactement 1/30 s : minuteries, requestAnimationFrame (donc PixiJS : monde
 * ET mini-jeu), et les animations CSS (pilotées une à une par l'API Web Animations).
 */
async function figerTemps(page) {
  const maintenant = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(maintenant + 50));
  await page.evaluate(() => {
    globalThis.__animer = (ms) => {
      for (const a of document.getAnimations()) {
        if (!a.__suivi) { a.__suivi = true; a.pause(); a.currentTime = 0; continue; }
        const fin = a.effect?.getComputedTiming().endTime ?? Infinity;
        const t = (a.currentTime ?? 0) + ms;
        if (t >= fin) a.finish(); else { a.pause(); a.currentTime = t; }
      }
    };
  });
}
let reste = 0;
async function avancer(page, n = 1) {
  for (let i = 0; i < n; i++) {
    reste += 1000 / FPS; const ms = Math.floor(reste); reste -= ms;
    await page.clock.runFor(ms);
    await page.evaluate((ms) => __animer(ms), ms);
  }
}

/** Courbe douce (accélère puis freine) */
const doux = (t) => t * t * (3 - 2 * t);
const tresDoux = (t) => t * t * t * (t * (t * 6 - 15) + 10);

let numero = 0;
async function photo(page, garder) {
  const i = numero++;
  if (!garder) return;
  await page.screenshot({ path: path.join(sortie, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
}
const dansPlage = () => numero >= de && numero < a;

/* ------------------------------------------------------------------ plans */

/** Contenu fictif de la case préparée (salon « Sam & Camille ») : une lettre et deux « photos » dessinées. */
const svg = (corps) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">${corps}</svg>`);
const PHOTO_TASSES = svg(`<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2550"/><stop offset="1" stop-color="#47507f"/></linearGradient></defs>
<rect width="480" height="480" fill="url(#c)"/><g fill="#fff" opacity=".85"><circle cx="60" cy="70" r="4"/><circle cx="150" cy="40" r="3"/><circle cx="300" cy="90" r="4"/><circle cx="410" cy="50" r="3"/><circle cx="360" cy="160" r="3"/><circle cx="90" cy="170" r="3"/></g>
<rect x="0" y="330" width="480" height="150" fill="#8a5a3c"/><rect x="0" y="322" width="480" height="14" fill="#6e452d"/>
<g><rect x="105" y="235" width="110" height="100" rx="14" fill="#d9354b"/><path d="M215 255 q40 0 40 30 t-40 30" stroke="#d9354b" stroke-width="14" fill="none"/><ellipse cx="160" cy="240" rx="55" ry="10" fill="#7a3b1e"/></g>
<g><rect x="265" y="235" width="110" height="100" rx="14" fill="#2f6fb5"/><path d="M375 255 q40 0 40 30 t-40 30" stroke="#2f6fb5" stroke-width="14" fill="none"/><ellipse cx="320" cy="240" rx="55" ry="10" fill="#7a3b1e"/></g>
<g stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"><path d="M145 215 q-14 -22 0 -44 t0 -44"/><path d="M335 215 q14 -22 0 -44 t0 -44"/></g>
<path d="M240 205 c-18 -26 -58 -6 -30 22 l30 26 l30 -26 c28 -28 -12 -48 -30 -22z" fill="#ffd66b"/>`);
const PHOTO_BILLET = svg(`<rect width="480" height="480" fill="#f3c6a5"/><g transform="rotate(-8 240 240)">
<rect x="50" y="150" width="380" height="190" rx="18" fill="#fffdf7"/><rect x="50" y="150" width="380" height="54" rx="18" fill="#d9354b"/><rect x="50" y="186" width="380" height="18" fill="#d9354b"/>
<text x="74" y="186" font-family="Fredoka,sans-serif" font-size="26" font-weight="700" fill="#fff">BILLET · ALLER SIMPLE</text>
<text x="74" y="250" font-family="Fredoka,sans-serif" font-size="30" font-weight="700" fill="#1d2b4f">23 décembre</text>
<text x="74" y="292" font-family="Fredoka,sans-serif" font-size="22" font-weight="500" fill="#5a6684">Voiture 7 · place 42 · fenêtre</text>
<line x1="340" y1="214" x2="340" y2="330" stroke="#c9cfdc" stroke-width="3" stroke-dasharray="8 8"/>
<path d="M385 258 c-14 -20 -46 -4 -24 18 l24 20 l24 -20 c22 -22 -10 -38 -24 -18z" fill="#d9354b"/></g>`);
const LETTRE = [
  "Sam,",
  "Ça fait 47 jours qu'on ne s'est pas vus. Alors j'ai caché ce petit mot dans la case 4, pour que tu ouvres un bout de moi ce matin.",
  "Regarde bien la deuxième photo. Dans 19 jours, c'est moi qui sonne à ta porte. Garde-moi une place sous le plaid ❤️",
  "Camille",
].join("\n");

const PLANS = {
  /** « Making-of » : en haut le vrai code qui défile, en bas le monde (images du plan « monde »), puis plein écran. */
  async makingof(navigateur) {
    const dossierMonde = String(opt.monde ?? "/tmp/film/monde-12h00");
    const images = readdirSync(dossierMonde).filter((f) => f.endsWith(".jpg")).sort();
    if (!images.length) throw new Error(`filmer d'abord le plan « monde » (${dossierMonde})`);
    // le vrai code du monde, sans aucune ligne qui nommerait quelqu'un
    const src = readFileSync(path.join(C.RACINE, "src/world/Scene.ts"), "utf8").split("\n").slice(1383, 1560)
      .filter((l) => !INTERDITS.test(l));
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const colorer = (l) => {
      const i = l.indexOf("//");
      const code = i >= 0 ? l.slice(0, i) : l, com = i >= 0 ? l.slice(i) : "";
      return esc(code).replace(/\b(const|let|for|if|else|return|of|this|new|function|private|true|false|null)\b/g, '<b class="k">$1</b>')
        .replace(/\b(\d+(\.\d+)?)\b/g, '<b class="n">$1</b>') + (com ? `<i>${esc(com)}</i>` : "");
    };
    const commits = execSync("git rev-list --count HEAD", { cwd: C.RACINE }).toString().trim();
    const premier = execSync("git log --reverse --format=%ad --date=short", { cwd: C.RACINE }).toString().split("\n")[0];
    const jours = Math.max(1, Math.round((Date.now() - new Date(premier).getTime()) / 86400000));
    const police = path.join(C.RACINE, "node_modules/@fontsource/fredoka/files");
    const dossier = "/tmp/film/makingof-page"; mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, "index.html"), `<!doctype html><meta charset="utf-8"><style>
      @font-face{font-family:Fredoka;font-weight:600;src:url(file://${police}/fredoka-latin-600-normal.woff2)}
      @font-face{font-family:Fredoka;font-weight:700;src:url(file://${police}/fredoka-latin-700-normal.woff2)}
      html,body{margin:0;width:540px;height:960px;overflow:hidden;background:#0f1530}
      #code{position:absolute;left:0;right:0;top:0;height:480px;overflow:hidden;background:#141a33;font:12.5px/1.55 "DejaVu Sans Mono",monospace;color:#cfd8f5}
      #code .onglet{position:absolute;top:0;left:0;right:0;height:34px;background:#0c1126;color:#8f9bc4;font:600 13px Fredoka;padding:9px 16px;box-sizing:border-box;z-index:2}
      #code .onglet span{color:#fff;background:#232b50;border-radius:6px;padding:3px 8px;margin-right:8px}
      #lignes{position:absolute;top:40px;left:14px;white-space:pre}
      #lignes .k{color:#ff8fb1;font-weight:normal}#lignes .n{color:#ffd66b;font-weight:normal}#lignes i{color:#6f7aa6}
      #monde{position:absolute;left:0;right:0;bottom:0;height:480px;overflow:hidden}
      #monde img{position:absolute;left:0;width:540px;height:960px}
      #titre{position:absolute;left:7%;right:6%;top:395px;color:#fff;font:700 40px/1.1 Fredoka;-webkit-text-stroke:7px #17224a;paint-order:stroke fill}
      #equipes{position:absolute;left:5%;right:10%;top:110px;display:flex;flex-wrap:wrap;gap:10px}
      #equipes div{font:600 21px Fredoka;color:#17224a;background:#fff;border-radius:999px;padding:7px 15px;box-shadow:0 6px 18px rgba(0,0,0,.3)}
    </style>
    <div id="code"><div class="onglet"><span>Scene.ts</span>src/world · PixiJS · TypeScript</div><div id="lignes">${src.map(colorer).join("\n")}</div></div>
    <div id="monde"><img id="img"></div><div id="equipes"></div><div id="titre"></div>`);
    const ctx = await navigateur.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`file://${dossier}/index.html`);
    await page.evaluate(() => document.fonts.load("700 40px Fredoka"));
    const EQUIPES = ["Monde & design", "Interface", "Jeux", "Backend", "Audio", "Qualité", "Chef de projet"];
    const N = 17 * FPS, PLEIN = 12.5 * FPS;
    const textes = [
      [0, 3.4, "Un dev.<br>7 agents IA."],
      [3.6, 7.6, "Chacun<br>son équipe."],
      [7.8, 11.8, `${jours} jours.<br>${commits} commits.`],
      [12.6, 17, "Et ce monde,<br>c'est eux qui l'ont codé."],
    ];
    for (let k = 0; k < N; k++) {
      const s = k / FPS;
      const t = textes.find(([a, b]) => s >= a && s < b);
      const o = t ? Math.min(1, (s - t[0]) * 5, (t[1] - s) * 5) : 0;
      // bascule plein écran : le code remonte, le monde prend toute la hauteur
      const e = tresDoux(Math.max(0, Math.min(1, (k - PLEIN) / (0.8 * FPS))));
      const img = images[Math.min(images.length - 1, Math.round(k * (images.length - 1) / (N - 1)))];
      await page.evaluate(({ k, e, img, t, o, n, eq }) => {
        document.getElementById("lignes").style.transform = `translateY(${-k * 2.2}px)`;
        document.getElementById("code").style.transform = `translateY(${-e * 480}px)`;
        const m = document.getElementById("monde"); m.style.height = `${480 + e * 480}px`;
        const im = document.getElementById("img"); if (!im.src.endsWith(img)) im.src = img;
        im.style.top = `${-240 * (1 - e)}px`;
        const ti = document.getElementById("titre"); ti.innerHTML = t ?? ""; ti.style.opacity = o;
        ti.style.top = `${395 - e * 280}px`;
        const q = document.getElementById("equipes");
        q.innerHTML = eq.slice(0, n).map((x) => `<div>${x}</div>`).join("");
        q.style.opacity = n ? String(Math.max(0, Math.min(1, (7.6 * 30 - k) / 6))) : "0";
      }, { k, e, img: `file://${dossierMonde}/${img}`, t: t?.[2], o, n: s >= 3.6 && s < 7.8 ? Math.min(7, Math.floor((s - 3.8) / 0.45) + 1) : 0, eq: EQUIPES });
      await page.waitForFunction(() => document.getElementById("img").complete);
      if (k === 0) await controler(page);
      await photo(page, dansPlage());
    }
    await ctx.close();
  },

  /** « La surprise » : la nuit, une case préparée en secret ; l'enveloppe, puis la lettre. */
  async surprise(navigateur) {
    const prepares = [{ day: 4, from: "flavie", to: "alexandre", message: LETTRE, photos: [PHOTO_TASSES, PHOTO_BILLET], updatedAt: "2026-12-03T22:00:00.000Z" }];
    const { page, ctx } = await ouvrir(navigateur, { jour: 4, ouverts: [1, 2, 3], prepares, horloge: true, cacherUI: false });
    await poserCalque(page);
    await page.addStyleTag({ content: ".stage-host ~ .hud, .entete, .rappel-host{visibility:hidden!important}" });
    await page.evaluate(() => scrollTo({ top: __calendrier.scrollForDay(4) + 40, behavior: "instant" }));
    await page.waitForTimeout(1500);
    await C.fermerPingou(page);
    await figerTemps(page);
    await avancer(page, 30);
    await controler(page);
    const ecrire = (t) => page.evaluate((t) => __ecrire(t), t);
    const film = async (n, textes = () => []) => {
      for (let i = 0; i < n; i++) { await avancer(page); await ecrire(textes(i, n)); await photo(page, dansPlage()); }
    };
    const accroche = (i) => [{ id: "haut", html: "Une case préparée<br>en secret…<br>rien que pour toi.", o: fenetre(i, -99, 2.6 * FPS) },
      { id: "voile", html: "", o: fenetre(i, -99, 2.6 * FPS) }];
    await film(1 * FPS, accroche);
    const p = await C.positionCadeau(page, 4);
    marquer("tap");
    await page.touchscreen.tap(p.x, p.y);
    await film(1.6 * FPS, (i) => accroche(i + FPS));
    for (let i = 0; i < 90 && !(await page.locator(".sheet-cta").count()); i++) await avancer(page); // coupe
    marquer("fenetre");
    await film(0.9 * FPS, () => [{ id: "haut", html: "", o: 0 }, { id: "voile", html: "", o: 0 }]);
    await page.locator(".sheet-cta").click();
    for (let i = 0; i < 60 && !(await page.locator(".prep-enveloppe").count()); i++) await avancer(page);
    marquer("enveloppe");
    await film(1.4 * FPS);
    marquer("ouverture");
    await page.locator(".prep-enveloppe").click();
    // la lettre : on s'en approche doucement pendant qu'on la lit
    const LECTURE = Number(opt.duree ?? 9) * FPS;
    for (let i = 0; i < LECTURE; i++) {
      await avancer(page);
      if (i === Math.round(1.2 * FPS)) marquer("lettre");
      const z = PROPRE ? 1 : 1 + 0.07 * tresDoux(Math.min(1, i / LECTURE));
      await page.evaluate((z) => { const s = document.querySelector(".sheet-panel"); if (s) { s.style.transformOrigin = "50% 30%"; s.style.scale = String(z); } }, z);
      await ecrire([{ id: "bas", html: "Tag la personne<br>qui te manque.", o: fenetre(i, LECTURE - 3 * FPS, Infinity) },
        { id: "voile-bas", html: "", o: fenetre(i, LECTURE - 3 * FPS, Infinity) }]);
      if (i % 30 === 0) await controler(page);
      await photo(page, dansPlage());
    }
    await ctx.close();
  },

  /** « Une case qui s'ouvre » : jour 2, on touche le cadeau, il s'ouvre, et on joue vraiment à la luge. */
  async case(navigateur) {
    const J = Number(opt.jour ?? 10); // 10 = attrape-flocons dans la tempête (2 = luge)
    const { page, ctx } = await ouvrir(navigateur, { jour: J, ouverts: Array.from({ length: J - 1 }, (_, i) => i + 1), horloge: true });
    await poserCalque(page);
    await page.addStyleTag({ content: ".stage-host ~ .hud, .entete{visibility:hidden!important}" });
    await page.evaluate((j) => scrollTo({ top: __calendrier.scrollForDay(j) + 40, behavior: "instant" }), J);
    await page.waitForTimeout(1500);
    await figerTemps(page);
    await avancer(page, 30);
    await controler(page);
    let k = 0;
    const ecrire = (t) => page.evaluate((t) => __ecrire(t), t);
    const film = async (n, textes = () => []) => {
      for (let i = 0; i < n; i++, k++) {
        await avancer(page);
        await ecrire(textes(i, n));
        await photo(page, dansPlage());
      }
    };
    const accroche = (i) => [{ id: "haut", html: "Chaque jour,<br>une case à ouvrir…", o: fenetre(i, -99, 2.4 * FPS) },
      { id: "voile", html: "", o: fenetre(i, -99, 2.4 * FPS) }];
    // 1) le monde, le cadeau du jour qui attend
    await film(0.8 * FPS, accroche);
    const p = await C.positionCadeau(page, J);
    marquer("tap");
    await page.touchscreen.tap(p.x, p.y);
    // 2) ouverture : zoom, couvercle, confettis, puis la fenêtre de la case
    await film(1.6 * FPS, (i) => accroche(i + 0.8 * FPS));
    for (let i = 0; i < 90 && !(await page.locator(".sheet-cta").count()); i++) await avancer(page); // coupe
    marquer("fenetre");
    await film(0.5 * FPS, () => [{ id: "haut", html: "", o: 0 }, { id: "voile", html: "", o: 0 }]);
    await page.locator(".sheet-cta").click();
    for (let i = 0; i < 60 && !(await page.locator(".jeu-btn").count()); i++) await avancer(page);
    marquer("regles");
    await film(0.6 * FPS);
    await page.locator(".jeu-btn").last().click();
    marquer("jeu");
    // 3) la partie : pilote automatique qui louvoie entre les sapins (flèches du clavier) ;
    //    pour un quiz, il touche une réponse toutes les 1,3 s
    const quiz = (await page.locator(".quiz-options, .quiz-q").count()) > 0 || J === 1 || J === 11;
    const touches = ["ArrowLeft", "ArrowRight"];
    let appui = null;
    const DUREE = Number(opt.duree ?? 11) * FPS;
    for (let i = 0; i < DUREE; i++) {
      if (quiz) {
        if (i % 39 === 20) {
          const b = page.locator(".quiz-options button:not([disabled])");
          const n = await b.count();
          if (n) { if (!marques.reponse) marquer("reponse"); await b.nth((i * 7) % n).click().catch(() => {}); }
          else await page.locator(".jeu-btn").last().click({ timeout: 500 }).catch(() => {});
        }
        await avancer(page);
        await photo(page, dansPlage());
        continue;
      }
      const voulu = Math.sin(i / 17) + 0.6 * Math.sin(i / 7.3) > 0.35 ? 1 : Math.sin(i / 17) + 0.6 * Math.sin(i / 7.3) < -0.35 ? 0 : null;
      if (voulu !== appui) {
        if (appui !== null) await page.keyboard.up(touches[appui]);
        if (voulu !== null) await page.keyboard.down(touches[voulu]);
        appui = voulu;
      }
      await avancer(page);
      await ecrire([{ id: "milieu", html: i < DUREE - 2.6 * FPS ? "Des mini-jeux à deux,<br>chacun chez soi." : "24 cases.<br>24 surprises.", o: Math.min(fenetre(i, 1.5 * FPS, Infinity), 1) },
      ]);
      await photo(page, dansPlage());
      if (i % 60 === 0) console.log(`  partie ${i} / ${DUREE}`);
    }
    await ctx.close();
  },

  /**
   * « Les zones » : un plan court par monde (montagnes, village, lac, marché, grotte, pôle Nord), caméra qui
   * s'approche doucement (zoom 1,1 → 1,5) en glissant de côté ; plus la nuit qui tombe sur le marché.
   * Chaque plan dure --duree secondes (2 par défaut) ; marques.json donne l'image de début de chacun.
   */
  async zones(navigateur) {
    const tous = Array.from({ length: 24 }, (_, i) => i + 1);
    const { page, ctx } = await ouvrir(navigateur, { jour: 24, ouverts: tous });
    await page.addStyleTag({ content: ".stage-host ~ *{visibility:hidden!important}" });
    await prendreLaMain(page);
    await controler(page);
    const N = Math.round(Number(opt.duree ?? 2) * FPS);
    // jour : case du jour visée ; lumiere : [début, fin] (0 = jour, 1 = nuit) ; dx : glissement latéral (px monde)
    const ZONES = [
      { nom: "montagnes", jour: 1, lumiere: [0, 0], dx: 40 },
      { nom: "village", jour: 6, lumiere: [0, 0], dx: -40 },
      { nom: "lac", jour: 11, lumiere: [0, 0], dx: 40 },
      { nom: "marche", jour: 15, lumiere: [0, 0], dx: -40 },
      { nom: "crepuscule", jour: 16, lumiere: [0, 1], dx: 30 },
      { nom: "grotte", jour: 19, lumiere: [1, 1], dx: -30 },
      { nom: "pole", jour: 23, lumiere: [1, 1], dx: 30 },
    ].filter((z) => !opt.seulement || String(opt.seulement).split(",").includes(z.nom));
    for (const z of ZONES) {
      const y = await page.evaluate((d) => __calendrier.scrollForDay(d), z.jour);
      // la caméra et les décors se posent (sans rendu : rapide)
      const c = await page.evaluate(async ([y, l]) => {
        __scene.focus = null; __scene.setLight(l);
        await __pas(y, 75, false);
        const w = __scene.world, sc = w.scale.x;
        return { x: (innerWidth / 2 - w.x) / sc, y: (innerHeight * 0.44 - w.y) / sc };
      }, [y, z.lumiere[0]]);
      marquer(z.nom);
      for (let k = 0; k < N; k++) {
        const u = k / Math.max(1, N - 1);
        const e = 1 - Math.pow(1 - u, 2); // part vite (on arrive après une coupe), freine en fin de plan
        const l = z.lumiere[0] + (z.lumiere[1] - z.lumiere[0]) * doux(u);
        await page.evaluate(([c, e, dx, l]) => {
          __scene.setLight(l);
          __scene.focus = { x: c.x + dx * e, y: c.y, zoom: 1.1 + 0.4 * e };
          return __pas(null, 1, true);
        }, [c, e, z.dx, l]);
        await photo(page, dansPlage());
      }
      console.log(`  ${z.nom} ✓`);
    }
    await ctx.close();
  },

  /** Sonde : état de la scène (mise au point du script) */
  async sonde(navigateur) {
    const tous = Array.from({ length: 24 }, (_, i) => i + 1);
    const { page, ctx } = await ouvrir(navigateur, { jour: 24, ouverts: tous });
    await page.waitForTimeout(3000);
    await page.evaluate(() => scrollTo(0, 1e5)); await page.waitForTimeout(4000);
    await prendreLaMain(page);
    console.log(await page.evaluate(async () => { __scene.setLight(1); await __pas(3080, 5); __decoller(); const out = []; for (let i = 0; i < 6; i++) { await __pas(3080, 20, false); await new Promise((r) => setTimeout(r, 300)); let t = []; for (const ch of __scene.charges.values()) for (const a of ch.anims) if (a.kind === "takeoff") t.push(a.t.toFixed(2)); out.push(t.join("/") + (__scene.pending ? "P" : "")); } return out.join(" "); }));
    console.log(await page.evaluate(() => { const s = __scene; const r = []; for (const ch of s.charges.values()) for (const a of ch.anims) if (a.kind === "takeoff") { const g = a.node.getGlobalPosition(); r.push([a.t, g.x, g.y, a.node.parent.getGlobalPosition().y]); }
      return JSON.stringify({ r, scrollY, max: s.maxScroll, sh: document.documentElement.scrollHeight, bout: s.terrain.bout }); }));
    console.log(await page.evaluate(() => { const s = __scene; let n = 0; for (const ch of s.charges.values()) for (const a of ch.anims) if (a.kind === "takeoff") n++;
      return JSON.stringify({ e24: s.states.get(24), e1: s.states.get(1), flying: s.flying, pending: !!s.pending, takeoff: n, opened: localStorage.getItem("cc-demo:data-v2")?.slice(0, 120) }); }));
    await ctx.close();
  },
  /** « Le monde » : travelling continu du jour 1 au pôle Nord ; la nuit tombe au marché, aurores, puis le traîneau décolle. */
  async monde(navigateur) {
    const tous = Array.from({ length: 24 }, (_, i) => i + 1);
    const { page, ctx } = await ouvrir(navigateur, { jour: 24, ouverts: tous });
    await page.addStyleTag({ content: ".stage-host ~ *{visibility:hidden!important}" });
    await poserCalque(page);
    const yDebut = 0;
    const yFin = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    console.log(`› route : ${yDebut} → ${yFin} px`);
    await prendreLaMain(page);
    await page.evaluate((y) => __pas(y, 90, false), yDebut); // la caméra et les décors se posent
    await controler(page);
    const DUREE = Number(opt.duree ?? 17) * FPS, FIN = Number(opt.fin ?? 7) * FPS;
    const NUIT = [0.6, 0.7]; // la lumière baisse entre ces deux moments du trajet
    let zone = -1, zoneDepuis = -999, decolle = false;
    const NOMS = ["Les Montagnes", "Le Village de Saint-Nicolas", "La Forêt et le Lac gelé", "Le Marché de Noël", "La Grotte de glace", "Le Pôle Nord"];
    for (let k = 0; k < DUREE + FIN; k++) {
      const u = Math.min(1, k / DUREE);
      // départ lancé (accroche), vitesse régulière, freinage doux à l'arrivée
      const v = u < 0.8 ? (u / 0.8) * 0.88 : 0.88 + 0.12 * Math.sin(((u - 0.8) / 0.2) * Math.PI / 2);
      const y = yDebut + (yFin - yDebut) * v;
      const lumiere = doux(Math.max(0, Math.min(1, (u - NUIT[0]) / (NUIT[1] - NUIT[0]))));
      const garder = dansPlage();
      // le traîneau attend au sol (remis à zéro à chaque image) jusqu'au moment voulu, puis s'envole
      if (k >= DUREE + 1.2 * FPS) decolle = true;
      if (!decolle) await page.evaluate(() => __decoller());
      // à l'arrivée : on s'approche du traîneau, caméra fixe, et il s'envole dans le cadre
      const pv = k >= DUREE ? Math.min(1, (k - DUREE) / (1.8 * FPS)) : null;
      if (k === DUREE) marquer("arrivee", k);
      if (k === Math.round(DUREE + 1.2 * FPS)) marquer("envol", k);
      if (k === DUREE) await page.evaluate(() => { const t = __traineau(); globalThis.__cibleFin = { x: t.x + 50, y: t.y - 62 }; });
      const z = await page.evaluate(([y, l, g, pv]) => {
        __scene.setLight(l);
        if (pv !== null) __viser(pv, 2.4, () => globalThis.__cibleFin);
        return __pas(y, 1, g);
      }, [y, lumiere, garder, pv]);
      if (z !== zone && z >= 0) { zone = z; zoneDepuis = k; marquer(`zone${z}`, k); }
      // textes : accroche, nom du monde traversé, chute
      const textes = [];
      textes.push({ id: "haut", html: "24 jours.<br>Un monde entier<br>à traverser à deux.", o: fenetre(k, -99, 2.6 * FPS) });
      const nomVisible = k > 2.8 * FPS && k < DUREE ? fenetre(k, zoneDepuis + 4, zoneDepuis + 4 + 1.8 * FPS) : 0;
      textes.push({ id: "zone", html: NOMS[zone] ?? "", o: nomVisible });
      textes.push({ id: "bas", html: "Et le 24,<br>le traîneau s'envole.", o: fenetre(k, DUREE - 0.2 * FPS, DUREE + 3.4 * FPS) });
      textes.push({ id: "bas fin", html: "Le calendrier de&nbsp;l'Avent<br>des couples à&nbsp;distance.", o: fenetre(k, DUREE + 3.8 * FPS, Infinity) });
      textes.push({ id: "voile", html: "", o: fenetre(k, -99, 2.6 * FPS) });
      textes.push({ id: "voile-bas", html: "", o: fenetre(k, DUREE - 0.2 * FPS, Infinity) });
      await page.evaluate((t) => __ecrire(t), textes);
      await photo(page, garder);
      if (k % 60 === 0) console.log(`  image ${k} / ${DUREE + FIN}`);
    }
    await ctx.close();
  },
};

if (!PLANS[plan]) { console.error(`Plan inconnu. Plans : ${Object.keys(PLANS).join(", ")}`); process.exit(2); }
if (!opt.de) rmSync(sortie, { recursive: true, force: true }); // --de : on ne refait qu’une partie, le reste est gardé
mkdirSync(sortie, { recursive: true });
const srv = await C.servir();
const navigateur = await C.lancerChrome();
const t0 = Date.now();
try { await PLANS[plan](navigateur); }
finally { await navigateur.close(); srv.stop(); }
marquer("fin");
writeFileSync(path.join(sortie, "marques.json"), JSON.stringify(marques, null, 1));
console.log(`✓ ${plan} : images dans ${sortie} (${Math.round((Date.now() - t0) / 1000)} s)`);
