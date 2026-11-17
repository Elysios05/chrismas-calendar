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
console.log("Tous les tests du message sont passés.");
