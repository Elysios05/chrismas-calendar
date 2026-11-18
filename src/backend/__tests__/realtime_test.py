#!/usr/bin/env python3
"""
Test des utilitaires de jeux en direct (src/backend/realtime.ts) en mode démo, à deux pages.

Usage (depuis la racine du dépôt) :
    python3 src/backend/__tests__/realtime_test.py

L'horloge de Flavie est volontairement décalée de +5 s pour vérifier la compensation.
"""
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
PORT = int(os.environ.get("TEST_PORT", "5196"))
BASE = f"http://localhost:{PORT}/src/backend/__tests__/harness.html"
SKEW = 5000
passed = 0


def check(cond, msg):
    global passed
    if not cond:
        raise AssertionError("ÉCHEC : " + msg)
    passed += 1
    print("  ok ", msg)


SETUP = """async ([skew]) => {
  const R = await import('/src/backend/realtime.ts');
  const me = await backend.me();
  window.log = { partner: [], ready: [], state: [], start: [] };
  window.g = new R.LiveGame(backend, me, 5, {
    initialState: { n: 0 }, countdownMs: 3000, clock: () => Date.now() + skew,
  });
  await g.loaded;
  g.onPartner(h => log.partner.push(h));
  g.onReady(r => log.ready.push(r));
  g.onState((s, by) => log.state.push({ s, by }));
  g.onStart(s => log.start.push(s));
  return me;
}"""


def open_page(ctx, query, skew):
    p = ctx.new_page()
    p.on("pageerror", lambda e: print("  [erreur page]", e))
    p.goto(f"{BASE}?{query}")
    p.wait_for_function("window.backendReady === true")
    p.evaluate(SETUP, [skew])
    return p


def main():
    env = dict(os.environ, VITE_SUPABASE_URL="", VITE_SUPABASE_ANON_KEY="")
    vite = subprocess.Popen(["npx", "vite", "--port", str(PORT), "--strictPort"], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        end = time.time() + 30
        while True:
            try:
                urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=1)
                break
            except Exception:
                if time.time() > end:
                    raise
                time.sleep(0.3)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            ctx = browser.new_context()
            a = open_page(ctx, "moi=alexandre&jour=5&demo-reset", 0)
            b = open_page(ctx, "moi=flavie&jour=5", SKEW)

            print("Présence")
            a.wait_for_function("g.partnerPresent", timeout=6000)
            b.wait_for_function("g.partnerPresent", timeout=6000)
            check(True, "chacun voit l'autre arriver")
            check(a.evaluate("g.phase") == "attente", "phase « attente » avant le départ")

            print("Horloge commune")
            b.wait_for_function("Math.abs(g.clockInfo.offset + %d) < 60" % SKEW, timeout=6000)
            off = b.evaluate("g.clockInfo")
            check(True, f"décalage de Flavie estimé à {off['offset']:.0f} ms (réel -{SKEW}), aller-retour {off['rtt']} ms")
            check(abs(a.evaluate("g.now()") - b.evaluate("g.now()")) < 150, "les deux horloges communes concordent")

            print("Prêt ? puis départ synchronisé")
            a.evaluate("g.setReady(true)")
            time.sleep(0.3)
            check(b.evaluate("log.ready.at(-1)") == {"me": False, "partner": True}, "Flavie voit Alexandre prêt")
            check(a.evaluate("log.start.length") == 0, "pas de départ tant que l'autre n'est pas prêt·e")
            b.evaluate("g.setReady(true)")
            a.wait_for_function("log.start.length === 1", timeout=3000)
            b.wait_for_function("log.start.length === 1", timeout=3000)
            sa, sb = a.evaluate("log.start[0]"), b.evaluate("log.start[0]")
            check(sa["seed"] == sb["seed"], "même graine des deux côtés")
            ecart = abs(sa["startsAt"] - (sb["startsAt"] - SKEW))
            check(ecart < 60, f"départs alignés malgré +5 s d'écart d'horloge (écart {ecart:.0f} ms)")
            reste = sa["startsAt"] - a.evaluate("Date.now()")
            check(1500 < reste <= 3000, f"compte à rebours d'environ 3 s ({reste:.0f} ms restants)")
            check(a.evaluate("g.phase") == "compte-a-rebours", "phase « compte-a-rebours »")
            a.wait_for_function("g.phase === 'en-jeu'", timeout=4000)
            b.wait_for_function("g.phase === 'en-jeu'", timeout=4000)
            check(True, "les deux passent « en-jeu »")

            print("État partagé")
            a.evaluate("g.setState({ n: 1 })")
            b.wait_for_function("g.state.n === 1", timeout=3000)
            check(b.evaluate("log.state.at(-1).by") == "alexandre", "Flavie reçoit l'état d'Alexandre")
            b.evaluate("g.update(s => ({ n: s.n + 1 }))")
            a.wait_for_function("g.state.n === 2", timeout=3000)
            check(True, "Alexandre reçoit la mise à jour de Flavie")
            a.evaluate("g.on('trait', (p, from) => { window.trait = { p, from }; }); 0")
            b.evaluate("g.emit('trait', { x: 3, y: 4 })")
            a.wait_for_function("window.trait", timeout=3000)
            check(a.evaluate("trait") == {"p": {"x": 3, "y": 4}, "from": "flavie"}, "messages propres au jeu (emit/on)")

            print("Reprise après déconnexion")
            time.sleep(0.7)  # laisse passer la sauvegarde différée
            b.close()
            a.wait_for_function("log.partner.at(-1) === false", timeout=8000)
            check(True, "Alexandre voit Flavie partir")
            a.evaluate("g.setState({ n: 3 })")  # change pendant l'absence de Flavie
            time.sleep(0.7)
            b = open_page(ctx, "moi=flavie&jour=5", SKEW)
            b.wait_for_function("g.state.n === 3", timeout=6000)
            check(True, "Flavie retrouve l'état le plus récent")
            b.wait_for_function("log.start.length >= 1", timeout=6000)
            check(b.evaluate("log.start[0].resumed") is True and b.evaluate("g.phase") == "en-jeu",
                  "Flavie reprend la partie déjà commencée")
            a.wait_for_function("log.partner.at(-1) === true", timeout=6000)
            check(True, "Alexandre voit Flavie revenir")

            print("Nouvelle partie")
            a.evaluate("g.reset()")
            b.wait_for_function("g.phase === 'attente'", timeout=3000)
            check(a.evaluate("g.phase") == "attente", "reset : retour en attente des deux côtés")
            browser.close()
    finally:
        vite.terminate()
        try:
            vite.wait(5)
        except subprocess.TimeoutExpired:
            vite.kill()
    print(f"\nTous les tests du temps réel sont passés ({passed} vérifications).")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(e)
        sys.exit(1)
