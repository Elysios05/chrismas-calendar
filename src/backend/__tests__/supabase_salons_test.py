#!/usr/bin/env python3
"""
Test de SupabaseBackend.salons dans un vrai navigateur, avec un FAUX Supabase (variables factices +
requêtes interceptées par Playwright). Vérifie le parcours : création d'un salon → lien d'invitation →
première connexion de l'invité·e → connexion par le lien du salon sur un 3e appareil.

Usage (depuis la racine du dépôt) :
    python3 src/backend/__tests__/supabase_salons_test.py

Les vraies règles (RLS, jetons, quotas) sont testées en SQL : supabase/tests/run_sql_tests.sh.
Ici on vérifie seulement que le site appelle les bonnes fonctions et réagit bien à leurs réponses.
"""
import json
import os
import subprocess
import time
import urllib.parse
import uuid

from playwright.sync_api import sync_playwright

from demo_backend_test import ROOT, CHROME, check, wait_port
import demo_backend_test as base

PORT = int(os.environ.get("TEST_PORT", "5198"))
HOST = "https://abcdefghijklmnop.supabase.co"
BASE = f"http://localhost:{PORT}/src/backend/__tests__/harness.html"


class FakeSupabase:
    """Juste assez de Supabase pour les salons (Auth, PostgREST, Edge Function « salons »)."""

    def __init__(self):
        self.salons = {}       # id -> {config, created_at}
        self.users = {}        # email -> {id, password, who, salon}
        self.tokens = {}       # access_token -> email
        self.invitations = {}  # jeton -> {salon, used}
        self.requests = []

    def user_of(self, req):
        auth = req.headers.get("authorization", "")
        email = self.tokens.get(auth.removeprefix("Bearer "))
        return self.users.get(email) if email else None

    def handle(self, route):
        req = route.request
        url = urllib.parse.urlparse(req.url)
        path, q = url.path, urllib.parse.parse_qs(url.query)
        body = {}
        if req.post_data:
            try:
                body = json.loads(req.post_data)
            except ValueError:
                body = {}
        self.requests.append((req.method, path, url.query))
        cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "*"}

        def reply(status, data, headers=None):
            h = dict(cors, **(headers or {}))
            h["Content-Type"] = "application/json"
            route.fulfill(status=status, headers=h, body="" if data is None else json.dumps(data))

        if req.method == "OPTIONS":
            return route.fulfill(status=200, headers=cors, body="ok")
        me = self.user_of(req)

        # ----- Edge Function « salons » -----
        if path == "/functions/v1/salons":
            pw = body.get("motDePasse") or ""
            if len(pw) < 6:
                return reply(400, {"code": "MOT_DE_PASSE_FAIBLE", "message": "Trop court."})
            if body.get("action") == "creer":
                sid = str(uuid.uuid4())
                self.salons[sid] = {"config": body["config"], "created_at": "2026-11-25T10:00:00Z"}
                tok = uuid.uuid4().hex * 2
                self.invitations[tok] = {"salon": sid, "used": False}
                email = f"{sid}-alexandre@salons.invalid"
                self.users[email] = {"id": str(uuid.uuid4()), "password": pw, "who": "alexandre", "salon": sid}
                return reply(200, {"salonId": sid, "jeton": tok, "email": email})
            if body.get("action") == "accepter":
                inv = self.invitations.get(body.get("jeton"))
                if not inv:
                    return reply(404, {"code": "INVITATION_INVALIDE", "message": "Lien pas valable."})
                if inv["used"]:
                    return reply(409, {"code": "INVITATION_UTILISEE", "message": "Ce lien d'invitation a déjà servi."})
                inv["used"] = True
                email = f"{inv['salon']}-flavie@salons.invalid"
                self.users[email] = {"id": str(uuid.uuid4()), "password": pw, "who": "flavie", "salon": inv["salon"]}
                return reply(200, {"salonId": inv["salon"], "email": email})

        # ----- Auth -----
        if path == "/auth/v1/token":
            u = self.users.get(body.get("email"))
            if not u or u["password"] != body.get("password"):
                return reply(400, {"error": "invalid_grant", "error_description": "Invalid login credentials",
                                   "code": "invalid_credentials", "msg": "Invalid login credentials"})
            tok = "tok-" + uuid.uuid4().hex
            self.tokens[tok] = body["email"]
            user = {"id": u["id"], "email": body["email"], "aud": "authenticated", "role": "authenticated",
                    "app_metadata": {}, "user_metadata": {}, "created_at": "2026-11-25T10:00:00Z"}
            return reply(200, {"access_token": tok, "token_type": "bearer", "expires_in": 3600,
                               "expires_at": int(time.time()) + 3600, "refresh_token": "r-" + tok, "user": user})
        if path == "/auth/v1/logout":
            return route.fulfill(status=204, headers=cors, body="")

        # ----- PostgREST -----
        if path == "/rest/v1/profiles":
            if req.method == "HEAD" or "count=exact" in (req.headers.get("prefer") or ""):
                n = sum(1 for u in self.users.values() if me and u["salon"] == me["salon"] and u["who"] == "flavie")
                return route.fulfill(status=200, headers=dict(cors, **{"Content-Range": f"0-0/{n}"}), body="")
            uid = q.get("user_id", ["eq."])[0][3:]
            rows = [{"who": u["who"], "salon_id": u["salon"]} for u in self.users.values() if u["id"] == uid]
            return reply(200, rows)
        if path == "/rest/v1/salons":
            sid = q.get("id", ["eq."])[0][3:]
            if not me or me["salon"] != sid or sid not in self.salons:
                return reply(200, [])
            if req.method == "PATCH":
                self.salons[sid]["config"] = body["config"]
                return reply(200, [{"id": sid}])
            s = self.salons[sid]
            return reply(200, [{"id": sid, "config": s["config"], "created_at": s["created_at"]}])
        if path == "/rest/v1/progress":
            return reply(201, None)
        if path.startswith("/rest/v1/rpc/"):
            fn = path.rsplit("/", 1)[1]
            if fn == "salon_public":
                s = self.salons.get(body["p_salon"])
                if not s:
                    return reply(200, None)
                arrive = any(u["salon"] == body["p_salon"] and u["who"] == "flavie" for u in self.users.values())
                return reply(200, {"id": body["p_salon"], "joueurs": s["config"]["joueurs"], "inviteArrive": arrive,
                                   "createdAt": s["created_at"]})
            if fn == "salon_invitation_info":
                inv = self.invitations.get(body["p_token"])
                if not inv:
                    return reply(200, {"statut": "invalide"})
                return reply(200, {"statut": "utilisee" if inv["used"] else "valide", "jeton": body["p_token"],
                                   "salonId": inv["salon"], "joueurs": self.salons[inv["salon"]]["config"]["joueurs"]})
            if fn == "salon_login_email":
                for email, u in self.users.items():
                    if u["salon"] == body["p_salon"] and u["who"] == body["p_place"]:
                        return reply(200, email)
                return reply(200, None)
            if fn == "salon_invitation":
                if not me or me["who"] != "alexandre":
                    return reply(400, {"code": "42501", "message": "NON_AUTORISE : seule la personne qui a créé le calendrier peut inviter"})
                for tok, inv in self.invitations.items():
                    if inv["salon"] == me["salon"] and not inv["used"]:
                        return reply(200, tok)
                return reply(400, {"code": "P0001", "message": "INVITATION_UTILISEE : l'autre personne a déjà rejoint le calendrier"})
            if fn == "advent_today":
                return reply(200, 12)
        return reply(404, {"message": "non simulé : " + path})


CALL = """async ([expr]) => {
  try { return { ok: await eval(expr) }; }
  catch (e) { return { err: e.code || null, msg: String(e.message) }; }
}"""


def call(page, expr):
    return page.evaluate(CALL, [expr])


def main():
    fake = FakeSupabase()
    env = dict(os.environ, VITE_SUPABASE_URL=HOST, VITE_SUPABASE_ANON_KEY="eyJfake.eyJfake.sig", VITE_VAPID_PUBLIC_KEY="")
    vite = subprocess.Popen(["npx", "vite", "--port", str(PORT), "--strictPort"], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        wait_port(PORT)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)

            def device(query=""):
                ctx = browser.new_context()
                ctx.route(HOST + "/**", fake.handle)
                p = ctx.new_page()
                p.on("pageerror", lambda e: print("  [erreur page]", e))
                p.goto(f"{BASE}?{query}")
                p.wait_for_function("window.backendReady === true")
                return p

            cfg = {"joueurs": {
                "alexandre": {"prenom": " Léo ", "couleurs": {"coat": 1, "hat": 2, "pompom": 3, "hair": 4, "longHair": False}},
                "flavie": {"prenom": "Inès", "couleurs": {"coat": 5, "hat": 6, "pompom": 7, "hair": 8, "longHair": True}}},
                "contenu": {"1": {"questions": [{"q": "Notre film ?"}]}}}

            print("Créateur (appareil A)")
            a = device()
            check(a.evaluate("backend.mode") == "supabase", "mode Supabase avec des variables (factices)")
            check(call(a, "backend.salons.getSalon()") == {"ok": None}, "première visite : pas de salon (écran d'accueil)")
            r = call(a, f"backend.salons.creerSalon({{ config: {json.dumps(cfg)}, motDePasse: '123' }})")
            check(r.get("err") == "MOT_DE_PASSE_FAIBLE", "mot de passe trop court refusé avant l'appel")
            r = call(a, f"backend.salons.creerSalon({{ config: {json.dumps(cfg)}, motDePasse: 'secret1' }})")["ok"]
            sid = r["salon"]["id"]
            check(r["lienConnexion"].endswith(f"?salon={sid}") and "?invitation=" in r["lienInvitation"], "liens de connexion et d'invitation")
            check(r["salon"]["config"]["joueurs"]["alexandre"]["prenom"] == "Léo", "prénom nettoyé, salon lu par son membre")
            check(r["salon"]["config"]["contenu"]["1"]["questions"][0]["q"] == "Notre film ?", "contenu des jeux lu par son membre")
            check(not r["salon"]["inviteArrive"], "invitée pas encore arrivée")
            check(call(a, "backend.me()") == {"ok": "alexandre"}, "créateur connecté à la place 1")
            check(a.evaluate("localStorage.getItem('cc-salon')") == sid, "salon retenu sur l'appareil")
            jeton = r["lienInvitation"].split("?invitation=")[1]
            check(call(a, "backend.salons.lienInvitation()")["ok"] == r["lienInvitation"], "lien d'invitation en cours")

            print("Invitée (appareil B)")
            b = device("invitation=" + jeton)
            info = call(b, "backend.salons.lireInvitation()")["ok"]
            check(info["statut"] == "valide" and info["joueurs"]["flavie"]["prenom"] == "Inès", "lien lu depuis l'adresse, prénoms pour l'accueil")
            check(call(b, "backend.salons.lireInvitation('n-importe-quoi')")["ok"] == {"statut": "invalide"}, "jeton inconnu → invalide")
            check(call(b, f"backend.salons.accepterInvitation('{jeton}', 'abc')").get("err") == "MOT_DE_PASSE_FAIBLE",
                  "mot de passe de l'invitée vérifié")
            b.evaluate("window.salons = []; backend.salons.onSalonChange((s) => window.salons.push(s && s.id)); 0")
            check("ok" in call(b, f"backend.salons.accepterInvitation('{jeton}', 'secret2')"), "invitation acceptée")
            check(call(b, "backend.me()") == {"ok": "flavie"}, "invitée connectée à la place 2")
            sb = call(b, "backend.salons.getSalon()")["ok"]
            check(sb["id"] == sid and sb["inviteArrive"] and sb["config"]["contenu"]["1"], "invitée : salon complet ouvert")
            b.wait_for_function("window.salons.length > 0")
            check(sid in b.evaluate("window.salons"), "onSalonChange prévenu à l'arrivée")
            r2 = call(b, f"backend.salons.accepterInvitation('{jeton}', 'secret2')")
            check(r2.get("err") == "INVITATION_UTILISEE" and "déjà servi" in r2["msg"], "jeton à usage unique (code et message du serveur)")
            check(call(b, "backend.salons.lienInvitation()").get("err") == "NON_AUTORISE", "invitée : pas de lien d'invitation")
            check(call(a, "backend.salons.lienInvitation()").get("err") == "INVITATION_UTILISEE", "créateur : plus de lien une fois l'invitée arrivée")

            print("Troisième appareil, par le lien du salon")
            c = device("salon=" + sid)
            pub = call(c, "backend.salons.getSalon()")["ok"]
            check(pub["id"] == sid and pub["config"]["contenu"] == {} and pub["config"]["joueurs"]["flavie"]["prenom"] == "Inès",
                  "visiteur : prénoms sans le contenu")
            check(call(c, "backend.me()") == {"ok": None}, "pas connecté")
            check(call(c, "backend.signIn('flavie', 'mauvais')")["msg"] == "Mot de passe incorrect.", "mauvais mot de passe")
            check("ok" in call(c, "backend.signIn('flavie', 'secret2')") and call(c, "backend.me()") == {"ok": "flavie"},
                  "connexion par place avec l'adresse du salon")
            check(call(c, "backend.salons.getSalon()")["ok"]["config"]["contenu"]["1"], "contenu lisible une fois connecté")
            r3 = call(c, "backend.salons.ouvrirSalon('00000000-0000-0000-0000-00000000dead')")
            check(r3.get("err") == "SALON_INCONNU" and call(c, "backend.salons.getSalon()")["ok"]["id"] == sid,
                  "salon inconnu refusé, on reste dans le sien")
            check(call(c, "backend.salons.ouvrirSalon('pas-un-uuid')").get("err") == "SALON_INCONNU", "lien abîmé refusé")

            print("Réglages et données du salon")
            cfg2 = json.loads(json.dumps(cfg))
            cfg2["joueurs"]["flavie"]["prenom"] = "Inès-Marie"
            m = call(a, f"backend.salons.modifierSalon({json.dumps(cfg2)})")["ok"]
            check(m["config"]["joueurs"]["flavie"]["prenom"] == "Inès-Marie", "créateur : réglages modifiés")
            check(call(a, "backend.salons.modifierSalon({ joueurs: {} })").get("err") == "CONFIG_INVALIDE", "réglages invalides refusés")
            check(call(c, f"backend.salons.modifierSalon({json.dumps(cfg2)})").get("ok") is not None, "invitée : réglages modifiables")
            call(a, "backend.markOpened(3)")
            q = [qq for (m_, p_, qq) in fake.requests if p_ == "/rest/v1/progress"]
            check(bool(q) and urllib.parse.unquote(q[-1]).find("on_conflict=salon_id,who,day") >= 0,
                  "progression : conflit sur (salon, place, jour)")
            check("ok" in call(a, "backend.signOut()") and call(a, "backend.me()") == {"ok": None}, "déconnexion")
            check(call(a, "backend.salons.getSalon()")["ok"]["config"]["contenu"] == {}, "après déconnexion : contenu plus lisible")
            browser.close()
        print(f"Tous les tests des salons Supabase sont passés ({base.passed} vérifications).")
    finally:
        vite.terminate()


if __name__ == "__main__":
    main()
