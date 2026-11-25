import { useEffect, useState } from "react";
import type { BackendApi, Salon, Who } from "../core/contracts";

/**
 * Salon courant (prénoms, couleurs, contenu des jeux), tenu à jour via `onSalonChange`.
 * `null` tant qu'il n'est pas chargé, ou s'il n'y a pas de salon (faux backend d'atelier).
 */
export function useSalon(backend: BackendApi): Salon | null {
  const [salon, setSalon] = useState<Salon | null>(null);
  useEffect(() => {
    const api = backend.salons;
    if (!api) { setSalon(null); return; }
    let vivant = true;
    api.getSalon().then((s) => { if (vivant) setSalon(s); }).catch(() => { /* on garde les replis */ });
    const stop = api.onSalonChange((s) => { if (vivant) setSalon(s); });
    return () => { vivant = false; stop(); };
  }, [backend]);
  return salon;
}

/** Prénoms des deux places, ou `undefined` sans salon (chaque appelant choisit son repli). */
export function prenomsDuSalon(salon: Salon | null): Record<Who, string> | undefined {
  if (!salon) return undefined;
  return { alexandre: salon.config.joueurs.alexandre.prenom, flavie: salon.config.joueurs.flavie.prenom };
}

/** Contenu personnalisé d'un jour, ou `undefined` → le jeu prend son contenu par défaut. */
export function contenuDuJour(salon: Salon | null, day: number): unknown {
  return salon?.config.contenu[String(day)] ?? undefined;
}
