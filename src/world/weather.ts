// Météo scénarisée, un temps par jour.
// `snow`, `wind` et `speed` remplacent la météo du monde traversé ; `fog` et `clouds` la modulent
// (1 = l'ambiance normale du monde, 2 = deux fois plus). `label` est là pour que l'interface puisse
// un jour l'afficher ou faire commenter Pingou.
export type DayWeather = {
  snow: number;
  wind: number;
  speed: number;
  fog: number;
  clouds: number;
  label: string;
};

const W = (snow: number, wind: number, speed: number, fog: number, clouds: number, label: string): DayWeather =>
  ({ snow, wind, speed, fog, clouds, label });

/** Le temps qu'il fait, jour par jour. Le 10, la tempête du cahier des charges. */
export const DAY_WEATHER: Record<number, DayWeather> = {
  // Montagnes
  1: W(0.25, 0.1, 0.8, 0.5, 0.5, "Grand beau sur les sommets"),
  2: W(0.7, 0.3, 1.1, 0.8, 1, "Neige légère sur la piste"),
  3: W(0.45, 0.15, 0.9, 1.4, 1.4, "Ciel voilé"),
  4: W(1.1, 0.25, 0.8, 1, 1.2, "Gros flocons"),
  // Village de Saint-Nicolas
  5: W(0.55, 0.1, 0.7, 0.7, 0.8, "Neige douce sur les toits"),
  6: W(0.15, 0, 0.6, 0.3, 0.3, "Belle éclaircie"),
  7: W(0.3, 0.05, 0.5, 2.6, 0.6, "Brouillard givrant"),
  8: W(0.8, 0.2, 0.9, 1.3, 1.5, "Ciel bas"),
  // Forêt et lac gelé
  9: W(0.9, 0.4, 1.1, 1.2, 1.2, "Neige continue sous les sapins"),
  10: W(2.4, 2.2, 2.6, 1.8, 1.6, "Tempête sur le lac"),
  11: W(0.1, 0.1, 0.6, 0.4, 0.2, "Grand froid, ciel dégagé"),
  12: W(0.35, 0.1, 0.6, 2.2, 0.8, "Brume sur la glace"),
  // Marché de Noël
  13: W(0.5, 0.15, 0.8, 0.8, 0.9, "Neige fine sur les allées"),
  14: W(0.2, 0.3, 1, 1.6, 1.4, "Redoux, air humide"),
  15: W(0.05, 0.05, 0.5, 0.3, 0.2, "Ciel clair, nuit étoilée"),
  16: W(0.85, 0.1, 0.6, 1, 1.1, "Flocons lents"),
  // Grotte de glace
  17: W(0.12, 0, 0.4, 1, 0, "À l'abri sous la montagne"),
  18: W(0.4, 1.2, 1.4, 1.2, 0, "Courant d'air glacé"),
  19: W(0.08, 0, 0.3, 0.8, 0, "Calme absolu"),
  20: W(0.3, 0.15, 0.5, 1.5, 0, "Givre sur les parois"),
  // Pôle Nord
  21: W(0.35, 0.1, 0.7, 0.5, 0.4, "Nuit claire, aurores"),
  22: W(0.7, 1.6, 1.8, 0.9, 1, "Vent polaire"),
  23: W(0.9, 0.3, 1, 1, 1.1, "Neige régulière"),
  24: W(1.3, 0.1, 0.5, 0.7, 0.8, "Gros flocons, soir de Noël"),
};

/** Le temps à un instant du parcours : `day` peut tomber entre deux jours, on mélange alors les deux. */
export function weatherAt(day: number): DayWeather {
  const a = DAY_WEATHER[Math.max(1, Math.min(24, Math.floor(day)))];
  const b = DAY_WEATHER[Math.max(1, Math.min(24, Math.ceil(day)))];
  const t = day - Math.floor(day);
  if (a === b || t === 0) return a;
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    snow: m(a.snow, b.snow),
    wind: m(a.wind, b.wind),
    speed: m(a.speed, b.speed),
    fog: m(a.fog, b.fog),
    clouds: m(a.clouds, b.clouds),
    label: t < 0.5 ? a.label : b.label,
  };
}
