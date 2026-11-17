/**
 * Tirage au sort reproductible (mulberry32).
 * Indispensable pour les scores à battre : avec la même graine, les deux joueurs
 * ont exactement la même piste, donc la comparaison des scores est juste.
 */

export type Alea = {
  /** Nombre entre 0 (inclus) et 1 (exclu) */
  reel(): number;
  /** Entier entre min et max inclus */
  entier(min: number, max: number): number;
  /** Vrai avec la probabilité p */
  chance(p: number): boolean;
  /** Un élément au hasard dans la liste */
  parmi<T>(liste: readonly T[]): T;
};

export function creerAlea(graine: number): Alea {
  let a = graine >>> 0;
  const reel = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    reel,
    entier: (min, max) => min + Math.floor(reel() * (max - min + 1)),
    chance: (p) => reel() < p,
    parmi: (liste) => liste[Math.floor(reel() * liste.length)],
  };
}
