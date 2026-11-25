import { useCallback, useEffect, useState } from "react";
import type { BackendApi, ReminderStatus } from "../core/contracts";

/**
 * Rappels par notification : la veille d'une case préparée encore vide, à 20 h.
 * Le site ne peut rien envoyer tout seul (GitHub Pages) : c'est le serveur qui pousse la
 * notification, et il faut d'abord que l'appareil soit abonné — d'où ce bouton.
 */

const EXPLICATION: Record<ReminderStatus, string> = {
  active: "Un rappel t'arrivera la veille, à 20 h, si la case du lendemain est encore vide.",
  off: "Un rappel la veille à 20 h, si la case du lendemain est encore vide. Six fois en tout.",
  denied:
    "Les notifications sont bloquées pour ce site. Pour les réautoriser : touche le cadenas (ou « Aa ») à côté de l'adresse, puis Notifications → Autoriser.",
  unsupported: "Ce navigateur ne sait pas recevoir de notifications. Pingou te le rappellera à ta prochaine visite.",
  "needs-install":
    "Sur iPhone et iPad, il faut d'abord ajouter le site à l'écran d'accueil : Partager → Sur l'écran d'accueil, puis rouvrir le calendrier depuis l'icône. (iOS 16.4 minimum.)",
};

export function RemindersRow({ backend }: { backend: BackendApi }) {
  const [etat, setEtat] = useState<ReminderStatus | null>(null);
  const [occupe, setOccupe] = useState(false);

  const relire = useCallback(async () => {
    setEtat((await backend.reminderStatus?.()) ?? "unsupported");
  }, [backend]);

  useEffect(() => { void relire(); }, [relire]);

  /**
   * ATTENTION : `enableReminders()` doit être le PREMIER `await` du clic.
   * Les navigateurs n'acceptent la demande d'autorisation que dans un geste de l'utilisateur,
   * et un `await` glissé avant ferait perdre ce geste.
   */
  const activer = (e: React.MouseEvent) => {
    e.preventDefault();
    if (occupe) return;
    setOccupe(true);
    const promesse = backend.enableReminders?.();   // appelé avant tout await
    void (promesse ?? Promise.resolve("unsupported" as ReminderStatus))
      .then((r) => setEtat(r))
      .catch(() => setEtat("denied"))
      .finally(() => setOccupe(false));
  };

  if (etat === null) return null;   // on n'affiche rien tant qu'on ne sait pas

  return (
    <div className="reg-ligne reg-ligne--bloc">
      <div className="reg-texte">
        Rappels sur cet appareil
        <span className="reg-aide">{EXPLICATION[etat]}</span>
      </div>

      {etat === "off" && (
        <button className="btn reg-activer" type="button" onClick={activer} disabled={occupe}>
          {occupe ? "Un instant…" : "Activer les rappels"}
        </button>
      )}
      {etat === "active" && <span className="reg-actif">Activés ✓</span>}
    </div>
  );
}
