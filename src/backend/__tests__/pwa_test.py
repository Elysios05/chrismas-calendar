#!/usr/bin/env python3
"""
Test des rappels côté navigateur (Chrome headless + Playwright) — sans vrai projet Supabase.

Usage (depuis la racine du dépôt) :
    python3 src/backend/__tests__/pwa_test.py

1. Build du site, servi dans un sous-dossier /chrismas-calendar/ comme sur GitHub Pages :
   manifeste et icônes trouvés, service worker enregistré avec la bonne portée, et une
   notification push simulée (CDP) affichée avec le texte et le lien vers la case.
2. SupabaseBackend (URL factice) : reminderStatus() → off, needs-install sur iPhone hors écran d'accueil.
"""
import base64
import functools
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
passed = 0

# Clé publique VAPID factice mais bien formée (point P-256 non compressé, 65 octets)
FAKE_VAPID = base64.urlsafe_b64encode(b"\x04" + bytes(range(1, 65))).decode().rstrip("=")


def check(cond, msg):
    global passed
    if not cond:
        raise AssertionError("ÉCHEC : " + msg)
    passed += 1
    print("  ok ", msg)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def wait_http(url, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("serveur injoignable : " + url)


def test_build_subfolder(pw):
    print("Site construit, servi dans /chrismas-calendar/")
    tmp = Path(tempfile.mkdtemp())
    try:
        subprocess.run(["npx", "vite", "build", "--outDir", str(tmp / "chrismas-calendar"), "--emptyOutDir"],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       env=dict(os.environ, VITE_SUPABASE_URL="", VITE_SUPABASE_ANON_KEY=""))
        port = free_port()
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass
        handler = functools.partial(Quiet, directory=str(tmp))
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://localhost:{port}/chrismas-calendar/"
        wait_http(base)

        browser = pw.chromium.launch(executable_path=CHROME, headless=True)
        ctx = browser.new_context()
        ctx.grant_permissions(["notifications"], origin=f"http://localhost:{port}")
        page = ctx.new_page()
        page.goto(base + "?jour=3")

        man_href = page.evaluate("document.querySelector('link[rel=manifest]').href")
        check(man_href == base + "manifest.webmanifest", f"lien du manifeste relatif au sous-dossier ({man_href})")
        man = json.loads(urllib.request.urlopen(man_href).read())
        check(man["start_url"] == "./" and man["scope"] == "./", "start_url et scope relatifs")
        for ic in man["icons"]:
            url = base + ic["src"]
            check(urllib.request.urlopen(url).status == 200, f"icône {ic['src']} ({ic['sizes']}, {ic['purpose']})")
        apple = page.evaluate("document.querySelector('link[rel=apple-touch-icon]').href")
        check(urllib.request.urlopen(apple).status == 200, "apple-touch-icon accessible")

        scope = page.evaluate("""(async () => {
            const reg = await navigator.serviceWorker.register(new URL('sw.js', location.href).href);
            await navigator.serviceWorker.ready;
            return reg.scope;
        })()""")
        check(scope == base, f"service worker enregistré pour {scope}")

        # Notification push simulée via le protocole de débogage de Chrome
        cdp = ctx.new_cdp_session(page)
        regs = []
        cdp.on("ServiceWorker.workerRegistrationUpdated", lambda e: regs.extend(e["registrations"]))
        cdp.send("ServiceWorker.enable")
        end = time.time() + 5
        while not regs and time.time() < end:
            page.wait_for_timeout(100)
        reg_id = next(r["registrationId"] for r in regs if r["scopeURL"] == base)
        payload = {"title": "🐧 Psst… petit rappel de Pingou", "body": "Psst… demain c'est la case 16 !", "day": 16, "path": "./?case=16"}
        cdp.send("ServiceWorker.deliverPushMessage",
                 {"origin": f"http://localhost:{port}", "registrationId": reg_id, "data": json.dumps(payload)})
        page.evaluate("""window.__notif = null; (async () => { const reg = await navigator.serviceWorker.ready;
            for (let i = 0; i < 200 && !window.__notif; i++) { const n = await reg.getNotifications();
              if (n.length) window.__notif = { title: n[0].title, body: n[0].body, tag: n[0].tag, url: n[0].data && n[0].data.url, icon: n[0].icon };
              await new Promise(r => setTimeout(r, 25)); } })(); 0""")
        cdp.send("ServiceWorker.deliverPushMessage",
                 {"origin": f"http://localhost:{port}", "registrationId": reg_id, "data": json.dumps(payload)})
        page.wait_for_function("window.__notif", timeout=5000)
        notif = page.evaluate("window.__notif")
        check(notif["title"] == payload["title"] and "case 16" in notif["body"], "notification affichée avec le texte de Pingou")
        check(notif["url"] == base + "?case=16", f"clic → ouvre la case 16 ({notif['url']})")
        check(notif["tag"] == "rappel-case-16" and notif["icon"] == base + "icons/icon-192.png", "tag et icône corrects")
        browser.close()
        srv.shutdown()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_offline(pw):
    print("Hors ligne : racine et /demo/ s'ouvrent quand le serveur est coupé")
    tmp = Path(tempfile.mkdtemp())
    try:
        env = dict(os.environ, VITE_SUPABASE_URL="", VITE_SUPABASE_ANON_KEY="")
        for out in ("chrismas-calendar", "chrismas-calendar/demo"):
            subprocess.run(["npx", "vite", "build", "--outDir", str(tmp / out), "--emptyOutDir"], cwd=ROOT, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)

        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass
        browser = pw.chromium.launch(executable_path=CHROME, headless=True)
        for path in ("chrismas-calendar/", "chrismas-calendar/demo/"):
            port = free_port()  # nouveau serveur (et nouvelle origine) pour chaque version
            srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(tmp)))
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            base = f"http://localhost:{port}/{path}"
            ctx = browser.new_context()
            page = ctx.new_page()
            page.goto(base + "?moi=alexandre&jour=5")
            page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
            page.wait_for_function("""caches.keys().then(async ks => {
                const k = ks.find(n => n.startsWith('cc-fichiers-') && n.endsWith('|' + location.href.split('?')[0]));
                if (!k) return false;
                const c = await caches.open(k); return (await c.keys()).some(r => /assets\\/index-.*\\.js$/.test(r.url));
            })""", timeout=15000)
            check(True, f"{path} : application rangée dans le cache")
            urls = page.evaluate("""(async () => { const out = []; for (const k of await caches.keys()) {
                for (const r of await (await caches.open(k)).keys()) out.push(r.url); } return out; })()""")
            check(not any("supabase" in u for u in urls), f"{path} : aucune donnée Supabase dans le cache ({len(urls)} fichiers)")
            srv.shutdown()
            srv.server_close()
            page.reload()
            page.wait_for_function("document.querySelector('#root') && document.querySelector('#root').children.length > 0", timeout=15000)
            check(True, f"{path} : s'ouvre serveur coupé")
            page.goto(base + "?jour=12")
            page.wait_for_function("document.querySelector('#root').children.length > 0", timeout=15000)
            check(True, f"{path} : marche aussi avec d'autres paramètres d'adresse")
            ctx.close()
        browser.close()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_supabase_status(pw):
    print("SupabaseBackend : statut des rappels (URL factice)")
    port = free_port()
    env = dict(os.environ, VITE_SUPABASE_URL="https://exemple-factice.supabase.co", VITE_SUPABASE_ANON_KEY="cle-factice",
               VITE_VAPID_PUBLIC_KEY=FAKE_VAPID)
    vite = subprocess.Popen(["npx", "vite", "--port", str(port), "--strictPort"], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        wait_http(f"http://localhost:{port}/")
        url = f"http://localhost:{port}/src/backend/__tests__/harness.html"
        browser = pw.chromium.launch(executable_path=CHROME, headless=True)

        ctx = browser.new_context()
        p = ctx.new_page()
        p.goto(url)
        p.wait_for_function("window.backendReady === true")
        check(p.evaluate("backend.mode") == "supabase", "mode supabase")
        check(p.evaluate("backend.reminderStatus()") == "off", "Chrome, autorisation pas encore demandée → off")
        ctx.close()

        ctx = browser.new_context()
        ctx.grant_permissions(["notifications"], origin=f"http://localhost:{port}")
        p = ctx.new_page()
        p.goto(url)
        p.wait_for_function("window.backendReady === true")
        check(p.evaluate("backend.reminderStatus()") == "off", "autorisé mais pas abonné → off")
        ctx.close()

        ctx = browser.new_context(user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
                                             "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
        p = ctx.new_page()
        p.goto(url)
        p.wait_for_function("window.backendReady === true")
        check(p.evaluate("backend.reminderStatus()") == "needs-install", "iPhone hors écran d'accueil → needs-install")
        ctx.close()
        browser.close()
    finally:
        vite.terminate()
        try:
            vite.wait(5)
        except subprocess.TimeoutExpired:
            vite.kill()


def main():
    with sync_playwright() as pw:
        test_build_subfolder(pw)
        test_offline(pw)
        test_supabase_status(pw)
    print(f"\nTous les tests des rappels (navigateur) sont passés ({passed} vérifications).")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(e)
        sys.exit(1)
