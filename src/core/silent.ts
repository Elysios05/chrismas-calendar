import type { SoundApi } from "./contracts";

/** Son muet conforme au contrat : à utiliser partout où l'audio n'est pas (encore) branché. */
export const silentSound: SoundApi = {
  setEnabled() {},
  setVolume() {},
  setMusicVolume() {},
  setSfxVolume() {},
  setWeather() {},
  setWind() {},
  unlock: async () => {},
  setZone() {},
  setGameMusic() {},
  play() {},
};
