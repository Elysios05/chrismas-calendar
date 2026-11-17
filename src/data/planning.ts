export type DayKind = "jeu" | "direct" | "differe" | "prepare" | "photo" | "synchro" | "score";

export const PLANNING: { day: number; kind: DayKind; title: string; emoji: string }[] = [
  { day: 1, kind: "jeu", title: "Quiz « Est-ce que tu me connais ? »", emoji: "❓" },
  { day: 2, kind: "score", title: "Descente en luge — score à battre", emoji: "🛷" },
  { day: 3, kind: "photo", title: "Défi photo croisé : la vue de ta fenêtre", emoji: "📸" },
  { day: 4, kind: "prepare", title: "Case préparée par vous deux", emoji: "💝" },
  { day: 5, kind: "direct", title: "Pictionary de Noël en direct", emoji: "🎨" },
  { day: 6, kind: "direct", title: "Duel de Saint-Nicolas : attrape les friandises", emoji: "🍬" },
  { day: 7, kind: "jeu", title: "Rébus en emojis", emoji: "🧩" },
  { day: 8, kind: "prepare", title: "Case préparée par vous deux", emoji: "💝" },
  { day: 9, kind: "differe", title: "Dessin à deviner", emoji: "✏️" },
  { day: 10, kind: "score", title: "Attrape-flocons dans la tempête", emoji: "❄️" },
  { day: 11, kind: "direct", title: "Quiz « Sommes-nous synchro ? »", emoji: "💞" },
  { day: 12, kind: "prepare", title: "Case préparée par vous deux", emoji: "💝" },
  { day: 13, kind: "direct", title: "Bonhomme de neige à deux", emoji: "⛄" },
  { day: 14, kind: "synchro", title: "Même recette de biscuits, chacun chez soi", emoji: "🍪" },
  { day: 15, kind: "jeu", title: "Pendu du bonhomme qui fond", emoji: "💧" },
  { day: 16, kind: "prepare", title: "Case préparée par vous deux", emoji: "💝" },
  { day: 17, kind: "jeu", title: "Mots croisés de votre histoire", emoji: "🔠" },
  { day: 18, kind: "direct", title: "Bataille de boules de neige", emoji: "☃️" },
  { day: 19, kind: "photo", title: "Défi photo croisé : ta déco de Noël", emoji: "📸" },
  { day: 20, kind: "prepare", title: "Case préparée par vous deux", emoji: "💝" },
  { day: 21, kind: "direct", title: "Décorer le sapin à deux", emoji: "🎄" },
  { day: 22, kind: "score", title: "Tri des cadeaux — score à battre", emoji: "🎁" },
  { day: 23, kind: "synchro", title: "Film de Noël lancé au même moment", emoji: "🎬" },
  { day: 24, kind: "prepare", title: "Case préparée par vous deux + grand final", emoji: "🌟" },
];

export const KIND_LABEL: Record<DayKind, string> = {
  jeu: "Mini-jeu", direct: "En direct à deux", differe: "Chacun son tour", prepare: "Préparée par vous deux",
  photo: "Défi photo", synchro: "Activité synchronisée", score: "Score à battre",
};
