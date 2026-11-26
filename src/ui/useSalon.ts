import { useEffect, useState } from "react";
import type { BackendApi, Salon, Who } from "../core/contracts";
import { PLAYERS } from "../world/actors";

/** Prénoms de repli (sans salon, ou avant son chargement) : `PLAYERS` ne sert plus qu'à ça (docs/salons.md). */
export const PRENOMS_PAR_DEFAUT: Record<Who, string> = { alexandre: PLAYERS.alexandre.name, flavie: PLAYERS.flavie.name };

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

/** Prénoms du salon courant, avec repli sur `PRENOMS_PAR_DEFAUT` : pour les écrans qui ont le backend. */
export function usePrenoms(backend: BackendApi): Record<Who, string> {
  return prenomsDuSalon(useSalon(backend)) ?? PRENOMS_PAR_DEFAUT;
}

/** Titre générique de `index.html`, remis quand on quitte la carte (déconnexion) ou sans salon. */
export const TITRE_GENERIQUE = "Calendrier de l'Avent";

/**
 * Titre de l'onglet d'après le salon (#110) : « Calendrier de l'Avent — Prénom & Prénom ».
 * Sans salon (ou avant son chargement), on garde le titre générique : jamais les prénoms de repli,
 * qui seraient faux pour un autre couple.
 */
export function useTitreDuSalon(salon: Salon | null): void {
  const prenoms = prenomsDuSalon(salon);
  const titre = prenoms ? `${TITRE_GENERIQUE} — ${prenoms.alexandre} & ${prenoms.flavie}` : TITRE_GENERIQUE;
  useEffect(() => {
    document.title = titre;
  }, [titre]);
  useEffect(() => () => { document.title = TITRE_GENERIQUE; }, []);
}
