/**
 * Le bonhomme de neige qui fond : une erreur = un morceau en moins.
 * Ordre de disparition : chapeau, écharpe, bras, carotte, boutons, tête, corps.
 * Rien de sanglant : il fond dans une flaque qui grandit, et il a l'air désolé.
 */

const ORDRE = ["chapeau", "echarpe", "bras", "carotte", "boutons", "tete", "corps"] as const;
type Morceau = (typeof ORDRE)[number];

export function Bonhomme({ erreurs, total }: { erreurs: number; total: number }) {
  // Si le contenu change le nombre d'erreurs permises, on étale les 7 morceaux dessus.
  const perdus = new Set<Morceau>(
    ORDRE.filter((_, i) => erreurs >= Math.ceil(((i + 1) * total) / ORDRE.length)),
  );
  const parti = (m: Morceau) => perdus.has(m);
  const flaque = Math.min(1, erreurs / total);
  const fondu = perdus.size >= ORDRE.length;

  return (
    <svg className="pendu-bonhomme" viewBox="0 0 200 210" role="img"
      aria-label={`Bonhomme de neige : ${erreurs} erreur${erreurs > 1 ? "s" : ""} sur ${total}`}>
      {/* flaque : elle grandit à chaque erreur */}
      <ellipse cx="100" cy="193" rx={34 + flaque * 46} ry={7 + flaque * 7} fill="#bcd8ee" opacity={0.35 + flaque * 0.5} />

      {!parti("corps") && (
        <g className="pendu-part">
          <circle cx="100" cy="150" r="42" fill="#fbfdff" />
          <circle cx="100" cy="150" r="42" fill="none" stroke="#dce8f4" strokeWidth="2" />
        </g>
      )}

      {!parti("boutons") && !parti("corps") && (
        <g className="pendu-part" fill="#1b2747">
          <circle cx="100" cy="132" r="4" />
          <circle cx="100" cy="150" r="4" />
          <circle cx="100" cy="168" r="4" />
        </g>
      )}

      {!parti("bras") && !parti("corps") && (
        <g className="pendu-part" stroke="#8a5a2b" strokeWidth="5" strokeLinecap="round">
          <path d="M62 132 L26 112 M36 116 L30 102 M36 116 L22 118" />
          <path d="M138 132 L174 112 M164 116 L170 102 M164 116 L178 118" />
        </g>
      )}

      {!parti("tete") && (
        <g className="pendu-part">
          <circle cx="100" cy="86" r="28" fill="#fbfdff" />
          <circle cx="100" cy="86" r="28" fill="none" stroke="#dce8f4" strokeWidth="2" />
          <circle cx="90" cy="80" r="3.4" fill="#1b2747" />
          <circle cx="110" cy="80" r="3.4" fill="#1b2747" />
          {/* la bouche s'inverse quand ça tourne mal */}
          <path
            d={flaque > 0.5 ? "M88 100 Q100 92 112 100" : "M88 95 Q100 104 112 95"}
            fill="none" stroke="#1b2747" strokeWidth="3" strokeLinecap="round"
          />
        </g>
      )}

      {!parti("carotte") && !parti("tete") && (
        <polygon className="pendu-part" points="100,88 100,96 126,92" fill="#f08a2c" />
      )}

      {!parti("echarpe") && !parti("tete") && (
        <g className="pendu-part" fill="#d9354b">
          <rect x="74" y="108" width="52" height="12" rx="6" />
          <rect x="112" y="112" width="13" height="30" rx="6" />
        </g>
      )}

      {!parti("chapeau") && !parti("tete") && (
        <g className="pendu-part" fill="#1b2747">
          <rect x="68" y="58" width="64" height="8" rx="4" />
          <rect x="80" y="32" width="40" height="28" rx="4" />
          <rect x="80" y="50" width="40" height="8" fill="#d9354b" />
        </g>
      )}

      {fondu && (
        <g className="pendu-part">
          <circle cx="78" cy="186" r="4" fill="#8a5a2b" />
          <polygon points="112,184 112,190 132,187" fill="#f08a2c" />
          <rect x="86" y="178" width="30" height="8" rx="4" fill="#d9354b" />
        </g>
      )}
    </svg>
  );
}
