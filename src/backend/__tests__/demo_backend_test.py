#!/usr/bin/env python3
"""
Test du DemoBackend dans un vrai navigateur (Chrome headless + Playwright).

Usage (depuis la racine du dépôt) :
    python3 src/backend/__tests__/demo_backend_test.py

Lance un serveur Vite temporaire, ouvre deux onglets (Alexandre et Flavie) sur
src/backend/__tests__/harness.html et vérifie : jour simulé, progression,
cases préparées (règle du jour J), photos, état des jeux, salle temps réel.
"""
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
PORT = int(os.environ.get("TEST_PORT", "5199"))
BASE = f"http://localhost:{PORT}/src/backend/__tests__/harness.html"

passed = 0


def check(cond, msg):
    global passed
    if not cond:
        raise AssertionError("ÉCHEC : " + msg)
    passed += 1
    print("  ok ", msg)


def wait_port(port, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(f"http://localhost:{port}/", timeout=1)
            return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("Le serveur Vite ne démarre pas")


def open_page(ctx, query):
    p = ctx.new_page()
    p.on("pageerror", lambda e: print("  [erreur page]", e))
    p.goto(f"{BASE}?{query}")
    p.wait_for_function("window.backendReady === true")
    return p


def main():
    env = dict(os.environ, VITE_SUPABASE_URL="", VITE_SUPABASE_ANON_KEY="")  # force le mode démo
    vite = subprocess.Popen(
        ["npx", "vite", "--port", str(PORT), "--strictPort"],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
    )
    try:
        wait_port(PORT)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            ctx = browser.new_context()  # même contexte = localStorage partagé, comme deux onglets
            a = open_page(ctx, "moi=alexandre&jour=10&demo-reset")

            print("Base")
            check(a.evaluate("backend.mode") == "demo", "mode démo choisi sans variables Supabase")
            check(a.evaluate("backend.me()") == "alexandre", "?moi=alexandre connecte l'onglet")
            check(a.evaluate("backend.today()") == 10, "?jour=10 simule le 10")

            print("Progression")
            a.evaluate("backend.markOpened(10)")
            err = a.evaluate("backend.markOpened(11).then(() => null, e => e.message)")
            check(err is not None, f"case 11 refusée le 10 ({err})")
            a.evaluate("backend.markCompleted(10)")
            prog = a.evaluate("backend.getProgress('alexandre')")
            check(10 in prog["opened"] and 10 in prog["completed"], "case 10 ouverte et terminée")
            check(len(a.evaluate("backend.getProgress('flavie')")["opened"]) == 7, "progression d'exemple de Flavie")

            print("Cases préparées")
            check(a.evaluate("backend.getPrepared(8, 'alexandre')") is not None, "case 8 (de Flavie) lisible le 10")
            check(a.evaluate("backend.getPrepared(12, 'alexandre')") is None, "case 12 illisible avant le jour J")
            a.evaluate("backend.savePrepared(16, { message: 'Surprise du 16', photos: [] })")
            mine = a.evaluate("backend.getPrepared(16, 'flavie')")
            check(mine and mine["message"] == "Surprise du 16" and mine["from"] == "alexandre", "l'auteur relit sa case future")
            err = a.evaluate("backend.savePrepared(5, { message: 'x', photos: [] }).then(() => null, e => e.message)")
            check(err is not None, "jour 5 n'est pas une case préparée")

            print("Photo")
            url = a.evaluate("""(async () => {
                const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
                const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 1600, 1200);
                const blob = await new Promise(r => c.toBlob(r, 'image/png'));
                return backend.uploadPhoto(blob);
            })()""")
            check(url.startswith("data:image/jpeg"), "uploadPhoto renvoie une image compressée")
            a.evaluate(f"backend.savePrepared(16, {{ message: 'Surprise du 16', photos: [{url!r}] }})")

            print("Deuxième onglet (Flavie)")
            b = open_page(ctx, "moi=flavie&jour=10")
            check(b.evaluate("backend.me()") == "flavie", "onglet 2 = Flavie")
            check(a.evaluate("backend.me()") == "alexandre", "onglet 1 reste Alexandre")
            check(b.evaluate("backend.getPrepared(16, 'flavie')") is None, "Flavie ne lit pas la case 16 le 10")
            b16 = open_page(ctx, "moi=flavie&jour=16")
            got = b16.evaluate("backend.getPrepared(16, 'flavie')")
            check(got and got["message"] == "Surprise du 16" and len(got["photos"]) == 1, "Flavie lit la case 16 le 16, avec la photo")
            b16.close()

            print("État des jeux")
            b.evaluate("backend.setGameState(10, 'score:flavie', { points: 42 })")
            check(a.evaluate("backend.getGameState(10, 'score:flavie')") == {"points": 42}, "état partagé entre onglets")
            check(a.evaluate("backend.getGameState(10, 'inconnu')") is None, "clé absente → null")

            print("Salle temps réel")
            a.evaluate("""window.got = []; window.online = [];
                window.room = backend.joinRoom('test');
                room.on('ping', (p, from) => got.push({ p, from }));
                room.presence(o => { window.online = o; }); 0""")
            b.evaluate("""window.got = []; window.online = [];
                window.room = backend.joinRoom('test');
                room.on('ping', (p, from) => got.push({ p, from }));
                room.presence(o => { window.online = o; }); 0""")
            a.wait_for_function("online.length === 2", timeout=5000)
            b.wait_for_function("online.length === 2", timeout=5000)
            check(True, "présence : les deux sont en ligne")
            a.evaluate("room.send('ping', { n: 1 })")
            b.wait_for_function("got.length === 1", timeout=5000)
            msg = b.evaluate("got[0]")
            check(msg == {"p": {"n": 1}, "from": "alexandre"}, "message reçu avec l'expéditeur")
            time.sleep(0.3)
            check(a.evaluate("got.length") == 0, "on ne reçoit pas ses propres messages")
            b.evaluate("room.leave()")
            a.wait_for_function("online.length === 1 && online[0] === 'alexandre'", timeout=5000)
            check(True, "présence : départ de Flavie détecté")
            a.evaluate("room.leave()")

            print("Connexion")
            a.evaluate("backend.signOut()")
            check(a.evaluate("backend.me()") is None, "déconnexion")
            a.evaluate("backend.signIn('flavie', 'nimportequoi')")
            check(a.evaluate("backend.me()") == "flavie", "connexion avec n'importe quel mot de passe")

            print("Jour réel")
            c = open_page(ctx, "moi=alexandre")
            t = c.evaluate("backend.today()")
            check(1 <= t <= 24, f"sans ?jour : {t} (9 hors décembre)")

            browser.close()
    finally:
        vite.terminate()
        try:
            vite.wait(5)
        except subprocess.TimeoutExpired:
            vite.kill()
    print(f"\nTous les tests du DemoBackend sont passés ({passed} vérifications).")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(e)
        sys.exit(1)
