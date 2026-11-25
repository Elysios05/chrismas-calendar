// Test du texte des notifications : node --experimental-strip-types supabase/tests/message_test.ts
import { reminderMessage } from "../functions/rappel-veille/message.ts";

const m16 = reminderMessage(16, "alexandre");
const m24 = reminderMessage(24, "flavie");
const ok = (c: boolean, msg: string) => { if (!c) { console.error("ÉCHEC : " + msg); process.exit(1); } console.log("  ok ", msg); };
ok(m16.body.includes("demain c'est la case 16") && m16.body.includes("encore vide"), "texte du 16");
ok(m16.body.includes("Flavie l'ouvrira à 7 h"), "nomme l'autre personne");
ok(m16.title.includes("🐧") && m16.path === "./?case=16", "titre signé Pingou, lien relatif");
ok(m24.body.includes("la toute dernière") && m24.body.includes("Alexandre"), "texte spécial pour le 24");
ok(new TextEncoder().encode(JSON.stringify(m16)).length < 3000, "message < 3 Ko (limite push ~4 Ko)");
const r16 = reminderMessage(16, "flavie", "relance");
const r24 = reminderMessage(24, "alexandre", "relance");
ok(r16.body.includes("case 16 est toujours vide") && r16.body.includes("Alexandre l'ouvre demain à 7 h"), "relance du 16");
ok(r16.title.includes("Pingou") && r16.path === "./?case=16", "relance signée Pingou, même lien");
ok(r24.body.includes("toute dernière") && r24.body.includes("Flavie"), "relance spéciale du 24");
ok(reminderMessage(16, "alexandre", "rappel").body === m16.body, "rappel de 20 h inchangé (validé par Alexandre)");
const s16 = reminderMessage(16, "flavie", "rappel", { prenom: "Inès", autre: "Léo", salonId: "abc-1" });
ok(s16.body.includes("Léo l'ouvrira à 7 h") && !s16.body.includes("Alexandre") && s16.to === "Inès", "prénoms du salon");
ok(s16.path === "./?salon=abc-1&case=16", "lien vers le bon salon");
ok(reminderMessage(16, "flavie", "relance", { autre: "Léo" }).body.includes("Léo l'ouvre demain"), "relance avec les prénoms du salon");
console.log("Tous les tests du message sont passés.");
