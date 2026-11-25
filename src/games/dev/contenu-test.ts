/**
 * Atelier : un salon de test pour vérifier que chaque jeu lit bien le contenu du salon et les prénoms.
 * « perso » : un contenu personnalisé valide ; « abime » : un contenu mal rempli (le jeu doit garder son défaut).
 */
import type { Who } from "../../core/contracts";

export const PRENOMS_TEST: Record<Who, string> = { alexandre: "Camille", flavie: "Sam" };

export const CONTENU_PERSO: Record<number, unknown> = {
  1: {
    nombre: 3,
    questions: [
      { emoji: "🧀", surMoi: "Ton fromage préféré ?", surAutre: "Le fromage préféré de {autre} ?", options: ["Comté", "Brie", "Chèvre"] },
      { emoji: "🚲", surMoi: "Ton moyen de transport rêvé ?", surAutre: "Le transport rêvé de {autre} ?", options: ["Vélo", "Train"] },
      { emoji: "🎵", surMoi: "Ta chanson du moment ?", surAutre: "La chanson du moment de {autre} ?", options: ["Une ballade", "Du rap", "Du jazz", "Rien"] },
    ],
  },
  3: { titre: "Ton petit-déjeuner", emoji: "☕", consigne: "Photographie ton petit-déjeuner de ce matin.", idees: ["Bon appétit !"],
    questions: [{ texte: "J'ai bien dormi ?", options: ["Oui", "Non"] }, { texte: "Je suis en retard ?", options: ["Oui", "Un peu", "Non"] }] },
  5: { nous: ["Tente", "Kayak", "Crêpe", "Chat", "Montagne", "Guitare"].map((mot) => ({ mot })) },
  7: { enigmes: [
    { emojis: "🧀🔥", reponse: "la raclette" }, { emojis: "🚲🏔️", reponse: "le col", indice: "Ça monte." }, { emojis: "🐱💤", reponse: "la sieste" },
  ] },
  9: { nbDessins: 2, themes: [{ texte: "Notre plus beau fou rire" }, { texte: "Le plat de dimanche", idee: "ex. les lasagnes" }, { texte: "Un animal croisé" }] },
  11: { nombre: 3, questions: [
    { type: "qui", emoji: "🍕", texte: "Qui commande toujours la même pizza ?" },
    { type: "choix", emoji: "🌧️", texte: "Dimanche de pluie :", options: ["Film", "Jeux", "Sieste"] },
    { type: "choix", emoji: "❌", texte: "Question sans options, doit disparaître" },
    { type: "qui", emoji: "🧦", texte: "Qui a les pieds froids ?" },
  ] },
  15: { motsParPartie: 2, mots: [{ mot: "Kayak", indice: "Ça flotte." }, { mot: "Crêpe party", indice: "Chandeleur.", perso: true }, { mot: "Tente", indice: "On dort dedans." }] },
  17: { mots: ["KAYAK|Bateau étroit", "CREPE|Ronde et sucrée", "TENTE|Maison de toile", "GUITARE|Six cordes", "MONTAGNE|Ça grimpe",
    "CHAT|Ronronne", "LAC|Eau calme", "VELO|Deux roues", "PLAGE|Sable", "NEIGE|Blanche et froide", "SAPIN|Toujours vert", "ETOILE|Tout en haut"]
    .map((l, i) => ({ mot: l.split("|")[0], definition: l.split("|")[1], perso: i % 2 === 0 })) },
};

/** Contenu abîmé : chaque jeu doit garder son contenu par défaut (et ne pas planter). */
export const CONTENU_ABIME: Record<number, unknown> = {
  1: { nombre: "dix", questions: [{ surMoi: 3 }] },
  3: { questions: "aucune" },
  5: { nous: [{ mot: "" }] },
  7: { enigmes: [null, { emojis: "🎄" }] },
  9: { nbDessins: 99, themes: [] },
  11: { questions: [{ type: "inconnu" }] },
  15: { mots: [{ mot: "<script>", indice: "x" }] },
  17: { mots: [{ mot: "DEUX MOTS", definition: "non" }] },
};
