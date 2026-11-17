import type { PropKind } from "./props";

export type Weather = { snow: number; wind: number; speed: number; fog?: boolean };

export type Zone = {
  id: string;
  name: string;
  bgDay: number;
  bgNight: number;
  ground: number; // couleur de la neige (dessus des tuiles)
  props: { kind: PropKind; weight: number }[];
  landmarks: PropKind[]; // éléments placés en priorité (1 de chaque)
  lake?: boolean;
  weather: Weather;
};

export const ZONES: Zone[] = [
  {
    id: "montagnes", name: "Les Montagnes", bgDay: 0x8fc3dc, bgNight: 0x101a3a, ground: 0xf7f5f0,
    props: [{ kind: "tree", weight: 6 }, { kind: "rock", weight: 2 }, { kind: "treeSmall", weight: 3 }, { kind: "deer", weight: 0.5 }],
    landmarks: ["mountain", "mountain", "mountain", "chalet", "snowman"],
    weather: { snow: 0.6, wind: 0.2, speed: 1 },
  },
  {
    id: "saint-nicolas", name: "Le Village de Saint-Nicolas", bgDay: 0xf3c6a5, bgNight: 0x1d1838, ground: 0xfbf3ea,
    props: [{ kind: "house", weight: 4 }, { kind: "tree", weight: 3 }, { kind: "lamp", weight: 2 }, { kind: "treeSmall", weight: 2 }],
    landmarks: ["house", "house", "house", "snowman", "presents"],
    weather: { snow: 0.4, wind: 0, speed: 0.7 },
  },
  {
    id: "lac", name: "La Forêt et le Lac gelé", bgDay: 0x9fd6c6, bgNight: 0x0f2230, ground: 0xf3f7f6,
    props: [{ kind: "tree", weight: 8 }, { kind: "treeSmall", weight: 4 }, { kind: "deer", weight: 1 }, { kind: "rock", weight: 1 }],
    landmarks: ["skater", "skater", "skater", "deer"],
    lake: true,
    weather: { snow: 1.6, wind: 1.4, speed: 1.8 }, // tempête
  },
  {
    id: "marche", name: "Le Marché de Noël", bgDay: 0xf4a347, bgNight: 0x2a1530, ground: 0xfff6ea,
    props: [{ kind: "stall", weight: 4 }, { kind: "tree", weight: 2 }, { kind: "lamp", weight: 2 }, { kind: "presents", weight: 1 }],
    landmarks: ["bigTree", "wheel", "stall", "stall", "stall"],
    weather: { snow: 0.5, wind: 0.1, speed: 0.8 },
  },
  {
    id: "grotte", name: "La Grotte de glace", bgDay: 0x45c3df, bgNight: 0x0b2236, ground: 0xeefaff,
    props: [{ kind: "crystal", weight: 5 }, { kind: "rock", weight: 2 }, { kind: "treeSmall", weight: 1 }],
    landmarks: ["crystal", "crystal", "mountain"],
    weather: { snow: 0.3, wind: 0, speed: 0.5 },
  },
  {
    id: "pole-nord", name: "Le Pôle Nord", bgDay: 0xb8366a, bgNight: 0x1a0f2e, ground: 0xfff5f8,
    props: [{ kind: "cane", weight: 3 }, { kind: "presents", weight: 3 }, { kind: "tree", weight: 2 }, { kind: "deer", weight: 1 }],
    landmarks: ["workshop", "sleigh", "deer", "deer", "bigTree"],
    weather: { snow: 0.8, wind: 0.3, speed: 1 },
  },
];

export const DAYS_PER_ZONE = 4;
