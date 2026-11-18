import { useEffect, useMemo, useState } from "react";
import type { Progress, SoundApi, Who } from "../core/contracts";
import { MascotDialog, PenguinPortrait } from "./Mascot";
import { PINGOU_CASE, type PingouLine } from "./pingou/lines";
import { avancee } from "./RaceIndicator";

const PRENOM: Record<Who, string> = { alexandre: "Alexandre", flavie: "Flavie" };

/** Une gerbe de feu d'artifice : des étincelles qui partent dans toutes les directions. */
function Gerbe({ x, y, teinte, retard }: { x: number; y: number; teinte: number; retard: number }) {
  return (
    <span className="feu" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${retard}s` }}>
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="feu-etincelle"
          style={{
            ["--a" as string]: `${i * 30}deg`,
            ["--t" as string]: `hsl(${(teinte + i * 7) % 360} 90% 65%)`,
            animationDelay: `${retard}s`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Écran de fin, le 24 au soir : le feu d'artifice, le compte de la route,
 * et le dernier mot de Pingou avant qu'il monte dans le traîneau.
 */
export function FinalScreen({
  me,
  progress,
  sound,
  onRevoir,
  onFermer,
}: {
  me: Who;
  progress: Record<Who, Progress>;
  sound?: SoundApi;
  /** Retour sur la route pour relire les lettres */
  onRevoir?: () => void;
  onFermer?: () => void;
}) {
  const autre: Who = me === "alexandre" ? "flavie" : "alexandre";
  const [lines, setLines] = useState<PingouLine[]>(PINGOU_CASE.jour24(PRENOM[autre]));

  const gerbes = useMemo(
    // réparties en haut et tout en bas : le ciel reste visible autour de la carte
    () => Array.from({ length: 9 }, (_, i) => ({
      x: 8 + (i * 29) % 84,
      y: i % 3 === 2 ? 86 + (i % 2) * 6 : 7 + (i * 17) % 24,
      teinte: (i * 47) % 360,
      retard: (i * 0.38) % 2.6,
    })),
    [],
  );

  useEffect(() => { sound?.setGameMusic("victory"); return () => sound?.setGameMusic(null); }, [sound]);

  const ensemble = progress[me].completed.filter((d) => progress[autre].completed.includes(d)).length;

  return (
    <div className="final">
      <div className="final-ciel" aria-hidden="true">
        {gerbes.map((g, i) => <Gerbe key={i} {...g} />)}
      </div>

      <main className="final-carte">
        <div className="final-portrait"><PenguinPortrait size={108} expression="content" /></div>
        <p className="final-kicker">24 décembre</p>
        <h1 className="final-titre">Vous y êtes</h1>
        <p className="final-sous">
          Vingt-quatre cases, deux pays, une seule route. Et vous êtes arrivés ensemble.
        </p>

        <ul className="final-compte">
          <li><strong>{avancee(progress[me])}</strong> cases pour toi</li>
          <li><strong>{avancee(progress[autre])}</strong> pour {PRENOM[autre]}</li>
          <li><strong>{ensemble}</strong> faites par vous deux</li>
        </ul>

        <div className="final-actions">
          {onRevoir && <button className="btn ghost" type="button" onClick={onRevoir}>Relire vos lettres</button>}
          {onFermer && <button className="btn" type="button" onClick={onFermer}>Joyeux Noël 🌟</button>}
        </div>
      </main>

      <MascotDialog key={JSON.stringify(lines)} lines={lines} variant="inline" onDone={() => setLines([])} />
    </div>
  );
}
