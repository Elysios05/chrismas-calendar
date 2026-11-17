import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Application } from "pixi.js";
import { Scene, type NodeState } from "./world/Scene";
import { ZONES } from "./world/zones";
import { PLAYERS, type Who } from "./world/actors";
import { PLANNING, KIND_LABEL } from "./data/planning";
import { MascotDialog } from "./ui/Mascot";

const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};

/** Jour courant : ?jour=N pour tester, sinon la vraie date en décembre (démo = 9 hors décembre) */
function computeToday() {
  const q = new URLSearchParams(location.search).get("jour");
  if (q) return Math.max(0, Math.min(24, +q));
  const d = new Date();
  return d.getMonth() === 11 ? Math.min(24, d.getDate()) : 9;
}
const isNightNow = () => { const h = new Date().getHours(); return h >= 17 || h < 7; };

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [height, setHeight] = useState(3000);
  const [zone, setZone] = useState(0);
  const [night, setNight] = useState(isNightNow());
  const [who, setWho] = useState<Who>(() => store.get("who", "alexandre"));
  const [opened, setOpened] = useState<Record<Who, number[]>>(() => store.get("opened", { alexandre: [1, 2, 3, 4, 5, 6], flavie: [1, 2, 3, 4, 5, 6, 7] }));
  const [modal, setModal] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const today = useMemo(computeToday, []);

  const states = useMemo(() => {
    const m = new Map<number, NodeState>();
    for (let d = 1; d <= 24; d++) m.set(d, d > today ? "locked" : opened[who].includes(d) ? "opened" : "available");
    return m;
  }, [today, opened, who]);

  // --- création de la scène Pixi ---
  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    (async () => {
      await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
      try { await document.fonts.load("700 20px Fredoka"); } catch { /* police non chargée */ }
      if (cancelled) { app.destroy(true); return; }
      host.current!.appendChild(app.canvas);
      const scene = new Scene(app, {
        onNodeTap: (day) => window.dispatchEvent(new CustomEvent("node-tap", { detail: day })),
        onZone: setZone,
      }, isNightNow());
      sceneRef.current = scene;
      window.dispatchEvent(new Event("scene-ready"));
    })();
    return () => { cancelled = true; sceneRef.current = null; try { app.destroy(true, { children: true }); } catch { /* pas encore initialisée */ } };
  }, []);

  // synchronise états, nuit, positions
  const sync = useCallback(() => {
    const s = sceneRef.current; if (!s) return;
    s.setStates(states);
    for (const w of ["alexandre", "flavie"] as Who[]) {
      const last = Math.max(0, ...opened[w]);
      if (!s.people[w]?.walking) s.setPosition(w, last);
    }
    s.leader = who;
    s.penguinPos = s.pos[who] - 1.1;
    setHeight(s.worldHeight);
  }, [states, opened, who]);

  useEffect(() => {
    const ready = () => {
      sync();
      const s = sceneRef.current!;
      const target = Math.max(0, s.scrollForDay(Math.max(1, today)));
      setTimeout(() => window.scrollTo({ top: target, behavior: "smooth" }), 600);
      setLines([
        `Coucou ${PLAYERS[who].name} ! Moi c'est Pingou, je vais vous guider tout le long du chemin jusqu'à Noël 🐧`,
        "Chaque jour, une nouvelle case s'ouvre sur la route. Toi et Flavie avancez chacun de votre côté… on verra qui arrive en premier au traîneau !",
        `Aujourd'hui c'est la case ${today}. Clique sur le cadeau qui brille ✨`,
      ]);
    };
    window.addEventListener("scene-ready", ready);
    return () => window.removeEventListener("scene-ready", ready);
  }, [sync, today, who]);

  useEffect(() => { sync(); }, [sync]);
  useEffect(() => { sceneRef.current?.setNight(night); sync(); }, [night]); // eslint-disable-line react-hooks/exhaustive-deps

  // défilement -> caméra
  useEffect(() => {
    const on = () => sceneRef.current?.setScroll(scrollY);
    const rs = () => { const s = sceneRef.current; if (s) { s.resize(); setHeight(s.worldHeight); } };
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", rs);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", rs); };
  }, []);

  // clic sur une case
  useEffect(() => {
    const onTap = (e: Event) => {
      const day = (e as CustomEvent<number>).detail;
      if (day > today) {
        setLines([`Hé, pas si vite ! La case ${day} s'ouvrira le ${day} décembre. Patience… ❄️`]);
        return;
      }
      setModal(day);
    };
    addEventListener("node-tap", onTap);
    return () => removeEventListener("node-tap", onTap);
  }, [today]);

  const openDay = async (day: number) => {
    setModal(null);
    const s = sceneRef.current;
    const next = { ...opened, [who]: [...new Set([...opened[who], day])] };
    if (s) await s.walkTo(who, day);
    setOpened(next); store.set("opened", next);
    const other: Who = who === "alexandre" ? "flavie" : "alexandre";
    const diff = Math.max(0, ...next[who]) - Math.max(0, ...next[other]);
    setLines([
      `Bravo ! Case ${day} ouverte 🎉`,
      diff > 0 ? `Tu as ${diff} case${diff > 1 ? "s" : ""} d'avance sur ${PLAYERS[other].name} 😏` : diff < 0 ? `${PLAYERS[other].name} a encore ${-diff} case${diff < -1 ? "s" : ""} d'avance… on accélère ?` : `Vous êtes à égalité avec ${PLAYERS[other].name} 💞`,
    ]);
  };

  const switchWho = (w: Who) => { setWho(w); store.set("who", w); };
  const info = modal ? PLANNING[modal - 1] : null;

  return (
    <>
      <div ref={host} className="stage-host" />
      <div style={{ height }} aria-hidden="true" />

      <header className="hud">
        <div className="brand">
          <span className="brand-kicker">Calendrier de l'Avent</span>
          <span className="brand-title">Alexandre & Flavie</span>
        </div>
        <div className="zone-pill" key={zone}>{ZONES[zone]?.name}</div>
        <div className="hud-actions">
          <div className="who">
            {(["alexandre", "flavie"] as Who[]).map((w) => (
              <button key={w} className={w === who ? "on" : ""} onClick={() => switchWho(w)} style={{ ["--c" as string]: "#" + PLAYERS[w].coat.toString(16) }}>
                {PLAYERS[w].name}
              </button>
            ))}
          </div>
          <button className="round" onClick={() => setNight(!night)} title="Jour / nuit">{night ? "🌙" : "☀️"}</button>
          <button className="round" onClick={() => { const s = sceneRef.current; if (s) scrollTo({ top: s.scrollForDay(Math.max(1, today)), behavior: "smooth" }); }} title="Aller à aujourd'hui">📍</button>
        </div>
      </header>

      <MascotDialog lines={lines} onDone={() => setLines([])} />

      {info && (
        <div className="modal" onClick={() => setModal(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="card-emoji">{info.emoji}</div>
            <div className="card-day">{info.day} décembre · {KIND_LABEL[info.kind]}</div>
            <h2>{info.title}</h2>
            <p className="card-note">Prototype : le contenu de la case arrivera ici.</p>
            <div className="card-actions">
              <button className="btn ghost" onClick={() => setModal(null)}>Plus tard</button>
              <button className="btn" onClick={() => openDay(info.day)}>{opened[who].includes(info.day) ? "Revoir la case" : "Ouvrir la case"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
