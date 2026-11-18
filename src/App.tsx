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
import { PreparedEditor, RappelVeille } from "./ui/PreparedEditor";
import { RaceIndicator } from "./ui/RaceIndicator";
import { Settings, chargerPreferences } from "./ui/Settings";
import { FinalScreen } from "./ui/FinalScreen";
import { PINGOU_ROUTE, type PingouLine } from "./ui/pingou/lines";
import { aUnJeu, chargerJeu } from "./games/registry";

/** Heure locale en heures décimales ; ?heure=17:30 pour simuler (captures, tests) */
function hourNow() {
  const q = new URLSearchParams(location.search).get("heure");
  if (q) { const [h, m = "0"] = q.split(":"); return Number(h) + Number(m) / 60; }
  const d = new Date(); return d.getHours() + d.getMinutes() / 60;
}
/** Lumière 0 = plein jour, 1 = nuit noire, avec crépuscule (décembre : coucher ≈ 17 h, lever ≈ 8 h) */
function lightAt(h: number) {
  const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (h - a) / (b - a)));
  if (h >= 12) return ramp(16.25, 17.75);       // le soir : de 16 h 15 à 17 h 45
  return 1 - ramp(7.5, 8.75);                   // le matin : de 7 h 30 à 8 h 45
}
const isNightNow = () => lightAt(hourNow()) >= 0.5;
const other = (w: Who): Who => (w === "alexandre" ? "flavie" : "alexandre");
const EMPTY: Progress = { opened: [], completed: [] };
const PREPARED_DAYS = [4, 8, 12, 16, 20, 24];

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
  const [light, setLight] = useState(() => lightAt(hourNow()));
  const [forced, setForced] = useState(false); // le bouton ☀️/🌙 force jour ou nuit jusqu'au rechargement
  useEffect(() => {
    if (forced) return;
    const t = setInterval(() => { const l = lightAt(hourNow()); setLight(l); setNight(l >= 0.5); }, 60_000);
    return () => clearInterval(t);
  }, [forced]);
  const [today, setToday] = useState(0);
  const [progress, setProgress] = useState<Record<Who, Progress>>({ alexandre: EMPTY, flavie: EMPTY });
  const [open, setOpen] = useState<{ day: number; game?: GameModule } | null>(null);
  const [lines, setLines] = useState<PingouLine[]>([]);
  const [settings, setSettings] = useState(false);
  const [finale, setFinale] = useState(false);
  useEffect(() => { chargerPreferences(sound); }, []);
  const [editing, setEditing] = useState<number | null>(null);
  const [reminder, setReminder] = useState<number | null>(null);
  const partner = other(me);
  // prochaine case préparée que je peux encore écrire (tant que l'autre ne l'a pas ouverte)
  const nextToWrite = useMemo(
    () => PREPARED_DAYS.find((d) => d >= Math.max(1, today) && !progress[partner].opened.includes(d)) ?? null,
    [today, progress, partner],
  );
  // rappel la veille : la case de demain est-elle encore vide ?
  useEffect(() => {
    if (!today || !PREPARED_DAYS.includes(today + 1)) { setReminder(null); return; }
    void backend.getPrepared(today + 1, partner).then((r) => setReminder(r.status === "empty" ? today + 1 : null)).catch(() => setReminder(null));
  }, [backend, today, partner, editing]);

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

  // lumière : continue si la scène sait faire un crépuscule (setLight), sinon jour/nuit
  useEffect(() => {
    document.documentElement.dataset.nuit = night ? "oui" : "non";
    const s = sceneRef.current as (Scene & { setLight?: (amount: number) => void }) | null;
    if (!ready || !s) return;
    if (typeof s.setLight === "function") s.setLight(light);
    else s.setNight(night);
  }, [ready, night, light]);

  // ouverture directe depuis une notification de rappel : ?case=N
  useEffect(() => {
    if (!ready || !today) return;
    const n = Number(new URLSearchParams(location.search).get("case"));
    if (!n) return;
    const url = new URL(location.href); url.searchParams.delete("case"); history.replaceState(null, "", url);
    if ([4, 8, 12, 16, 20, 24].includes(n) && n > today) setEditing(n); // rappel : écrire la case de demain
    else if (n >= 1 && n <= today) dispatchEvent(new CustomEvent("node-tap", { detail: n }));
  }, [ready, today]);

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
    if (day === 24) { await sceneRef.current?.walkTo(me, day); setFinale(true); return; }
    sound.play("open");
    await sceneRef.current?.walkTo(me, day);
    const diff = Math.max(0, ...next[me].opened) - Math.max(0, ...next[partner].opened);
    const name = PLAYERS[partner].name;
    setLines([...PINGOU_ROUTE.ouverture(day), ...(diff > 0 ? PINGOU_ROUTE.avance(diff, name) : diff < 0 ? PINGOU_ROUTE.retard(-diff, name) : PINGOU_ROUTE.egalite(name))]);
  };

  const toggleNight = () => { sound.play(night ? "day" : "night"); setForced(true); setLight(night ? 0 : 1); setNight(!night); };
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
        <RaceIndicator me={me} progress={progress} compact />
        <div className="hud-actions">
          <span className="who-badge" style={{ ["--c" as string]: "#" + PLAYERS[me].coat.toString(16).padStart(6, "0") }}>{PLAYERS[me].name}</span>
          {nextToWrite && (
            <button className="round" onClick={() => { sound.play("tap"); setEditing(nextToWrite); }} title={`Préparer la case ${nextToWrite}`} aria-label={`Préparer la case ${nextToWrite} pour ${PLAYERS[partner].name}`}>✏️</button>
          )}
          <button className="round" onClick={toggleNight} title="Jour / nuit" aria-label="Basculer jour / nuit">{night ? "🌙" : "☀️"}</button>
          <button className="round" onClick={goToday} title="Aller à aujourd'hui" aria-label="Aller à la case du jour">📍</button>
          <button className="round" onClick={() => { sound.play("tap"); setSettings(true); }} title="Réglages" aria-label="Réglages">⚙️</button>
        </div>
      </header>

      {reminder && !open && !editing && (
        <div className="rappel-host"><RappelVeille jour={reminder} partenaire={partner} onOuvrir={() => setEditing(reminder)} /></div>
      )}

      {!open && !editing && !finale && <MascotDialog lines={lines} onDone={() => setLines([])} />}

      {editing && (
        <div className="modal" onClick={() => setEditing(null)}>
          <div className="edit-host" onClick={(e) => e.stopPropagation()}>
            <PreparedEditor day={editing} me={me} backend={backend} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}

      {settings && <Settings me={me} backend={backend} sound={sound} onClose={() => setSettings(false)} />}

      {finale && <FinalScreen me={me} progress={progress} sound={sound} onRevoir={() => setFinale(false)} onFermer={() => setFinale(false)} />}

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
