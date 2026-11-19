#!/usr/bin/env python3
"""
Test des souvenirs avec décors (option `decor`) : Chrome headless + Playwright.
Usage : python3 src/backend/__tests__/souvenirs_decor_test.py
Génère une image factice par jour (canvas), exporte, vérifie les <img>, imprime en PDF
(/tmp/souvenirs-decor.pdf) et en capture (/tmp/souvenirs-decor-*.png).
"""
import os, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
import demo_backend_test as t  # réutilise open_page, check, wait_port

FAKE = """async (day) => {
  const c = document.createElement('canvas'); c.width = 900; c.height = 360;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 360); sky.addColorStop(0, '#2b4a8c'); sky.addColorStop(1, '#bcd6f5');
  g.fillStyle = sky; g.fillRect(0, 0, 900, 360);
  g.fillStyle = '#eef4ff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i*170-60, 360); g.lineTo(i*170+40, 120+(i%3)*30); g.lineTo(i*170+140, 360); g.fill(); }
  g.fillStyle = '#c0392b'; g.font = 'bold 90px sans-serif'; g.fillText('Case ' + day, 300, 250);
  return c.toDataURL('image/png');
}"""

def main():
    env = dict(os.environ, VITE_SUPABASE_URL="", VITE_SUPABASE_ANON_KEY="")
    vite = subprocess.Popen(["npx", "vite", "--port", str(t.PORT), "--strictPort"], cwd=t.ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        t.wait_port(t.PORT)
        with sync_playwright() as pw:
            b = pw.chromium.launch(executable_path=t.CHROME, headless=True)
            ctx = b.new_context()
            p = t.open_page(ctx, "moi=flavie&jour=24&demo-reset")
            M = "import('/src/backend/souvenirs.ts').then(m => m.exportSouvenirs(backend%s)).then(b => b.text())"
            base = p.evaluate(M % "")
            t.check('class="bandeau"' not in base and "couverture" not in base.split("</style>")[1], "sans decor : mise en page actuelle")
            nul = p.evaluate(M % ", { decor: async () => null }")
            t.check('class="bandeau"' not in nul, "decor → null : pas de bandeau, pas de casse")
            boom = p.evaluate(M % ", { decor: async () => { throw new Error('x'); } }")
            t.check('class="bandeau"' not in boom and "<article" in boom, "decor qui plante : export intact")
            bad = p.evaluate(M % ", { decor: async () => 'http://exemple.fr/x.png' }")
            t.check('class="bandeau"' not in bad, "decor non data:image refusé")
            html = p.evaluate("(async () => { const fake = " + FAKE + "; const m = await import('/src/backend/souvenirs.ts'); return (await m.exportSouvenirs(backend, { decor: fake })).text(); })()")
            n_sec = html.count("<section")
            t.check(html.count('class="bandeau"') == n_sec and n_sec >= 3, f"un bandeau par case ({n_sec})")
            t.check('class="couverture"' in html and "Le pôle Nord, case 24" in html, "page de garde avec le décor du jour 24")
            t.check("background-image" not in html, "vraies balises <img>, pas de background-image")
            t.check("<svg" in html and "flocons" in html, "flocons et bordure en SVG")
            Path("/tmp/souvenirs-decor.html").write_text(html, encoding="utf-8")
            v = ctx.new_page()
            v.set_viewport_size({"width": 390, "height": 844})
            v.goto("file:///tmp/souvenirs-decor.html")
            v.screenshot(path="/tmp/souvenirs-decor-mobile.png")
            v.pdf(path="/tmp/souvenirs-decor.pdf", format="A4", print_background=False, margin=dict(top="12mm", bottom="12mm", left="10mm", right="10mm"))
            v.close(); b.close()
    finally:
        vite.terminate()
    print(f"\nSouvenirs avec décors : {t.passed} vérifications.")

if __name__ == "__main__":
    try: main()
    except AssertionError as e:
        print(e); sys.exit(1)
