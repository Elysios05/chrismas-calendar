// Assemblage : backend → connexion → monde, fenêtres des cases, jeux, son, Pingou
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Application } from "pixi.js";
import type { BackendApi, GameModule, Progress, Who, ZoneId } from "./core/contracts";
import { createBackend } from "./backend";
import { sound } from "./audio";
import { Scene, type NodeState } from "./world/Scene";
import { ZONES } from "./world/zones";
import { PLAYERS } from "./world/actors";
import { MascotDialog } from "./ui/Mascot";
import { LoginScreen } from "./ui/LoginScreen";
import { DayWindow } from "./ui/DayWindow";
import { PINGOU_ROUTE, type PingouLine } from "./ui/pingou/lines";
import { aUnJeu, chargerJeu } from "./games/registry";

const isNightNow = () => { const h = new Date().getHours(); return h >= 17 || h < 7; };
const other = (w: Who): Who => (w === "alexandre" ? "flavie" : "alexandre");
const EMPTY: Progress = { opened: [], completed: [] };

export default function App() {
  const [backend, setBackend] = useState<BackendApi | null>(null);
  const [me, setMe] = useState<Who | null | undefined>(undefined); // undefined = on ne sait pas encore

  useEffect(() => {
    let off = () => {};
    (async () => {
      const b = await createBackend();
      setBackend(b);
      setMe(await b.me().catch(() => null));
      off = b.onAuthChange((w) => setMe(w));
    })();
    return () => off();
  }, []);

  // le son ne peut démarrer qu'après un geste de l'utilisateur
  useEffect(() => {
    const go = () => { void sound.unlock(); removeEventListener("pointerdown", go); };
    addEventListener("pointerdown", go);
    return () => removeEventListener("pointerdown", go);
  }, []);

  if (!backend || me === undefined) return <div className="boot">❄️</div>;
  if (!me) return <LoginScreen backend={backend} onSignedIn={setMe} />;
  return <Calendar backend={backend} me={me} />;
}

function Calendar({ backend, me }: { backend: BackendApi; me: Who }) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(3000);
  const [zone, setZone] = useState(0);
  const [night, setNight] = useState(isNightNow());
  const [today, setToday] = useState(0);
  const [progress, setProgress] = useState<Record<Who, Progress>>({ alexandre: EMPTY, flavie: EMPTY });
  const [open, setOpen] = useState<{ day: number; game?: GameModule } | null>(null);
  const [lines, setLines] = useState<PingouLine[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const partner = other(me);

  const loadProgress = useCallback(async () => {
    const [a, f] = await Promise.all((["alexandre", "flavie"] as Who[]).map((w) => backend.getProgress(w).catch(() => EMPTY)));
    const next = { alexandre: a, flavie: f };
    setProgress(next);
    return next;
  }, [backend]);

  useEffect(() => { void backend.today().then(setToday); void loadProgress(); }, [backend, loadProgress]);

  const states = useMemo(() => {
    const m = new Map<number, NodeState>();
    for (let d = 1; d <= 24; d++) m.set(d, d > today ? "locked" : progress[me].opened.includes(d) ? "opened" : "available");
    return m;
  }, [today, progress, me]);

  // --- scène Pixi ---
  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    (async () => {
      await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
      try { await document.fonts.load("700 20px Fredoka"); } catch { /* police non chargée */ }
      if (cancelled) { app.destroy(true); return; }
      host.current!.appendChild(app.canvas);
      sceneRef.current = new Scene(app, {
        onNodeTap: (day) => dispatchEvent(new CustomEvent("node-tap", { detail: day })),
        onZone: setZone,
      }, isNightNow());
      setReady(true);
    })();
    return () => { cancelled = true; sceneRef.current = null; try { app.destroy(true, { children: true }); } catch { /* pas encore initialisée */ } };
  }, []);

  // états des cases et positions des personnages
  useEffect(() => {
    const s = sceneRef.current; if (!ready || !s) return;
    s.setStates(states);
    for (const w of ["alexandre", "flavie"] as Who[]) {
      if (!s.people[w]?.walking) s.setPosition(w, Math.max(0, ...progress[w].opened));
    }
    s.leader = me;
    s.penguinPos = s.pos[me] - 1.1;
    setHeight(s.worldHeight);
  }, [ready, states, progress, me]);

  // accueil : on descend jusqu'à la case du jour
  useEffect(() => {
    const s = sceneRef.current; if (!ready || !s || !today) return;
    setTimeout(() => scrollTo({ top: Math.max(0, s.scrollForDay(Math.min(24, today))), behavior: "smooth" }), 600);
    const waiting = Array.from({ length: today }, (_, i) => i + 1).filter((d) => !progress[me].opened.includes(d));
    setLines([
      `Coucou ${PLAYERS[me].name} ! C'est moi, Pingou 🐧`,
      ...(waiting.length > 1 ? PINGOU_ROUTE.caseEnRetard(waiting[0]) : []),
      `Aujourd'hui c'est la case ${Math.min(24, today)}. Touche le cadeau qui brille ✨`,
    ]);
    // une seule fois au chargement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, today]);

  useEffect(() => { if (ready) { sceneRef.current?.setNight(night); } }, [ready, night]);

  // ambiance sonore selon le monde traversé
  useEffect(() => {
    const id = (ZONES[zone]?.id ?? "montagnes") as ZoneId;
    sound.setZone(id, night);
    sound.setWeather(id === "lac" && today >= 10 && today <= 11);
    sound.setWind(id === "montagnes" ? 0.7 : id === "pole-nord" ? 0.4 : 0.1);
  }, [zone, night, today]);

  // défilement → caméra
  useEffect(() => {
    const on = () => sceneRef.current?.setScroll(scrollY);
    const rs = () => { const s = sceneRef.current; if (s) { s.resize(); setHeight(s.worldHeight); } };
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", rs);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", rs); };
  }, []);

  // toucher une case
  useEffect(() => {
    const onTap = async (e: Event) => {
      const day = (e as CustomEvent<number>).detail;
      if (day > today) { sound.play("locked"); setLines(PINGOU_ROUTE.caseVerrouillee(day)); return; }
      sound.play("select");
      const game = aUnJeu(day) ? (await chargerJeu(day)) ?? undefined : undefined;
      setLines([]);
      setOpen({ day, game });
    };
    addEventListener("node-tap", onTap);
    return () => removeEventListener("node-tap", onTap);
  }, [today]);

  const closeDay = async () => {
    const day = open?.day;
    setOpen(null);
    if (!day) return;
    const wasOpened = progress[me].opened.includes(day);
    const next = await loadProgress();
    if (wasOpened || !next[me].opened.includes(day)) return;
    sound.play("open");
    await sceneRef.current?.walkTo(me, day);
    const diff = Math.max(0, ...next[me].opened) - Math.max(0, ...next[partner].opened);
    const name = PLAYERS[partner].name;
    setLines([...PINGOU_ROUTE.ouverture(day), ...(diff > 0 ? PINGOU_ROUTE.avance(diff, name) : diff < 0 ? PINGOU_ROUTE.retard(-diff, name) : PINGOU_ROUTE.egalite(name))]);
  };

  const toggleSound = () => { const on = !soundOn; setSoundOn(on); sound.setEnabled(on); if (on) sound.play("tap"); };
  const toggleNight = () => { sound.play(night ? "day" : "night"); setNight(!night); };
  const goToday = () => { sound.play("tap"); const s = sceneRef.current; if (s && today) scrollTo({ top: s.scrollForDay(Math.min(24, today)), behavior: "smooth" }); };

  return (
    <>
      <div ref={host} className="stage-host" />
      <div style={{ height }} aria-hidden="true" />

      <header className="hud">
        <div className="brand">
          <span className="brand-kicker">Calendrier de l'Avent{backend.mode === "demo" ? " · démo" : ""}</span>
          <span className="brand-title">Alexandre & Flavie</span>
        </div>
        <div className="zone-pill" key={zone}>{ZONES[zone]?.name}</div>
        <div className="hud-actions">
          <span className="who-badge" style={{ ["--c" as string]: "#" + PLAYERS[me].coat.toString(16).padStart(6, "0") }}>{PLAYERS[me].name}</span>
          <button className="round" onClick={toggleSound} title="Son" aria-label="Couper ou remettre le son">{soundOn ? "🔔" : "🔕"}</button>
          <button className="round" onClick={toggleNight} title="Jour / nuit" aria-label="Basculer jour / nuit">{night ? "🌙" : "☀️"}</button>
          <button className="round" onClick={goToday} title="Aller à aujourd'hui" aria-label="Aller à la case du jour">📍</button>
          <button className="round" onClick={() => void backend.signOut()} title="Se déconnecter" aria-label="Se déconnecter">⏏️</button>
        </div>
      </header>

      {!open && <MascotDialog lines={lines} onDone={() => setLines([])} />}

      {open && (
        <DayWindow
          day={open.day}
          me={me}
          backend={backend}
          sound={sound}
          game={open.game}
          dejaTerminee={progress[me].completed.includes(open.day)}
          onClose={() => void closeDay()}
        />
      )}
    </>
  );
}
