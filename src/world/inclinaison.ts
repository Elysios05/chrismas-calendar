// Inclinaison du téléphone (issue #10) : pencher l'appareil fait dériver la neige, comme un vent.
// `x` : -1 (penché à gauche) … 1 (à droite) ; `y` : -1 (redressé vers soi) … 1 (couché vers l'avant).
// Lissé, pour que les flocons glissent au lieu de sauter.

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export class Inclinaison {
  x = 0;
  y = 0;
  /** Valeurs brutes, avant lissage */
  private cx = 0;
  private cy = 0;
  /** Inclinaison avant/arrière de repos : on tient d'ordinaire un téléphone à ~40° */
  private repos: number | null = null;
  private actif = false;
  private readonly ecoute = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    // en paysage, gauche/droite et avant/arrière s'échangent
    const angle = (screen.orientation?.angle ?? 0) % 360;
    let lr = e.gamma, av = e.beta;
    if (angle === 90) { lr = e.beta; av = -e.gamma; }
    else if (angle === 270 || angle === -90) { lr = -e.beta; av = e.gamma; }
    else if (angle === 180) { lr = -e.gamma; av = -e.beta; }
    if (this.repos === null) this.repos = av;
    // le repos suit lentement la façon dont on tient le téléphone : seuls les gestes comptent
    this.repos += (av - this.repos) * 0.004;
    this.cx = Math.max(-1, Math.min(1, lr / 35));
    this.cy = Math.max(-1, Math.min(1, (av - this.repos) / 35));
  };

  /** iOS demande une autorisation, et seulement pendant un geste (toucher) */
  static demandeAutorisation(): boolean {
    const D = (globalThis as { DeviceOrientationEvent?: OrientationPermission }).DeviceOrientationEvent;
    return typeof D?.requestPermission === "function";
  }

  /** Branche le capteur. Sur iOS, à appeler pendant un toucher. Rend `false` si refusé ou absent. */
  async demarrer(): Promise<boolean> {
    if (this.actif) return true;
    if (typeof DeviceOrientationEvent === "undefined") return false;
    if (Inclinaison.demandeAutorisation()) {
      try {
        const D = DeviceOrientationEvent as unknown as OrientationPermission;
        if ((await D.requestPermission!()) !== "granted") return false;
      } catch { return false; }
    }
    addEventListener("deviceorientation", this.ecoute);
    this.actif = true;
    return true;
  }

  arreter() {
    removeEventListener("deviceorientation", this.ecoute);
    this.actif = false;
    this.cx = this.cy = 0;
  }

  /** À chaque image : rapproche doucement la valeur lissée de la mesure */
  update(dt: number) {
    const k = Math.min(1, 0.06 * dt);
    this.x += (this.cx - this.x) * k;
    this.y += (this.cy - this.y) * k;
  }

  /** Pour les tests : impose une inclinaison */
  simuler(x: number, y: number) { this.cx = x; this.cy = y; }
}
