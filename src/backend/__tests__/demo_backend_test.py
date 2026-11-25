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

            print("Exemples selon le jour simulé (ticket #32)")
            j1 = open_page(ctx, "moi=alexandre&jour=1")
            for w in ("alexandre", "flavie"):
                p1 = j1.evaluate(f"backend.getProgress('{w}')")
                check(p1 == {"opened": [], "completed": []}, f"jour 1 : rien d'ouvert ni de terminé pour {w}")
            check(j1.evaluate("backend.getPrepared(4, 'flavie')") == {"status": "empty"}, "jour 1 : pas de case préparée d'exemple")
            check(j1.evaluate("backend.getGameState(2, 'score:flavie')") is None, "jour 1 : pas de score d'exemple")
            j1.close()
            j3 = open_page(ctx, "moi=alexandre&jour=3")
            check(j3.evaluate("backend.getProgress('flavie')")["opened"] == [1, 2], "jour 3 : exemples limités aux jours 1 et 2")
            check(j3.evaluate("backend.getGameState(2, 'score:flavie')") == 1840, "jour 3 : score de la luge (jour 2) présent")
            check(j3.evaluate("backend.getPrepared(4, 'alexandre')") == {"status": "locked"}, "jour 3 : case 4 encore verrouillée")
            j3.close()
            j4 = open_page(ctx, "moi=alexandre&jour=4")
            check(j4.evaluate("backend.getPrepared(4, 'alexandre')")["status"] == "ready", "jour 4 : la case 4 d'exemple est prête")
            check(4 not in j4.evaluate("backend.getProgress('alexandre')")["opened"], "jour 4 : la case du jour reste à ouvrir")
            j4.close()

            print("Progression")
            a.evaluate("backend.markOpened(10)")
            err = a.evaluate("backend.markOpened(11).then(() => null, e => e.message)")
            check(err is not None, f"case 11 refusée le 10 ({err})")
            a.evaluate("backend.markCompleted(10)")
            prog = a.evaluate("backend.getProgress('alexandre')")
            check(10 in prog["opened"] and 10 in prog["completed"], "case 10 ouverte et terminée")
            check(len(a.evaluate("backend.getProgress('flavie')")["opened"]) == 7, "progression d'exemple de Flavie")

            back = open_page(ctx, "moi=alexandre&jour=5")
            check(10 not in back.evaluate("backend.getProgress('alexandre')")["opened"], "revenir au jour 5 masque la case 10 ouverte")
            back.close()

            print("Cases préparées")
            r8 = a.evaluate("backend.getPrepared(8, 'alexandre')")
            check(r8["status"] == "ready" and r8["content"]["from"] == "flavie", "case 8 (de Flavie) lisible le 10")
            check(a.evaluate("backend.getPrepared(12, 'alexandre')") == {"status": "locked"}, "case 12 « locked » avant le jour J")
            check(a.evaluate("backend.getPrepared(20, 'flavie')") == {"status": "empty"}, "case 20 pas encore écrite → « empty »")
            a.evaluate("backend.savePrepared(16, { message: 'Surprise du 16', photos: [] })")
            mine = a.evaluate("backend.getPrepared(16, 'flavie')")
            check(mine["status"] == "ready" and mine["content"]["message"] == "Surprise du 16", "l'auteur relit sa case future")
            err = a.evaluate("backend.savePrepared(4, { message: 'retouche', photos: [] }).then(() => null, e => e.message)")
            check(err is not None and "déjà été ouverte" in err, f"case 4 figée car déjà ouverte par Flavie ({err})")
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
            check(b.evaluate("backend.getPrepared(16, 'flavie')") == {"status": "locked"}, "Flavie ne lit pas la case 16 le 10")
            b16 = open_page(ctx, "moi=flavie&jour=16")
            b16.wait_for_function("backend.getPrepared(16, 'flavie').then(r => r.status === 'ready' && r.content.photos.length === 1)", timeout=5000)
            got = b16.evaluate("backend.getPrepared(16, 'flavie')")
            check(got["status"] == "ready" and got["content"]["message"] == "Surprise du 16" and len(got["content"]["photos"]) == 1,
                  "Flavie lit la case 16 le 16, avec la photo")
            a.evaluate("backend.savePrepared(16, { message: 'Surprise du 16 (v2)', photos: [] })")
            check(True, "l'auteur peut encore modifier tant que ce n'est pas ouvert")
            b16.evaluate("backend.markOpened(16)")
            # localStorage se propage entre onglets de façon asynchrone : on attend que l'onglet 1 le voie
            a.wait_for_function("backend.getProgress('flavie').then(p => p.opened.includes(16))", timeout=5000)
            err = a.evaluate("backend.savePrepared(16, { message: 'v3', photos: [] }).then(() => null, e => e.message)")
            check(err is not None and "déjà été ouverte" in err, "case 16 figée dès que Flavie l'a ouverte")
            b16.close()

            print("État des jeux")
            b.evaluate("backend.setGameState(10, 'score:flavie', { points: 42 })")
            a.wait_for_function("backend.getGameState(10, 'score:flavie').then(v => v && v.points === 42)", timeout=5000)
            check(True, "état partagé entre onglets")
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
            a.evaluate("window.auth = []; backend.onAuthChange(w => auth.push(w)); 0")
            a.evaluate("backend.signOut()")
            check(a.evaluate("backend.me()") is None, "déconnexion")
            a.evaluate("backend.signIn('flavie', 'nimportequoi')")
            check(a.evaluate("backend.me()") == "flavie", "connexion avec n'importe quel mot de passe")
            check(a.evaluate("auth") == [None, "flavie"], "onAuthChange prévient de la déconnexion puis de la connexion")
            check(a.evaluate("backend.resetPassword('flavie').then(() => backend.inPasswordRecovery())") is False,
                  "resetPassword sans effet en démo")

            print("Rester connecté·e (ticket #4)")
            a.evaluate("backend.signIn('alexandre', 'x', { rester: false })")
            check(a.evaluate("backend.me()") == "alexandre", "connexion sans « rester »")
            n = open_page(ctx, "jour=10")  # nouvel onglet = navigateur rouvert, sans ?moi
            check(n.evaluate("backend.me()") is None, "rester: false → session oubliée dans un nouvel onglet")
            n.close()
            a.evaluate("backend.signIn('alexandre', 'x')")
            n = open_page(ctx, "jour=10")
            check(n.evaluate("backend.me()") == "alexandre", "rester par défaut → session retrouvée")
            n.close()

            print("Rappels (ticket #5)")
            check(a.evaluate("backend.reminderStatus()") == "unsupported", "démo : rappels « unsupported » par défaut")
            r = open_page(ctx, "moi=flavie&rappels=off")
            check(r.evaluate("backend.reminderStatus()") == "off", "?rappels=off simulé")
            check(r.evaluate("backend.enableReminders()") == "active", "enableReminders → active (simulé)")
            check(r.evaluate("backend.reminderStatus()") == "active", "état gardé pour l'onglet")
            r.close()

            print("Ouverture à 7 h (heure de Paris)")
            cases = a.evaluate("""import('/src/backend/config.ts').then(c => [
                c.adventDayFor(new Date('2026-12-10T05:59:00Z')),   // 6 h 59 à Paris
                c.adventDayFor(new Date('2026-12-10T06:00:00Z')),   // 7 h 00 à Paris
                c.adventDayFor(new Date('2026-12-01T05:30:00Z')),   // 1er déc. 6 h 30
                c.adventDayFor(new Date('2026-12-01T05:30:00Z'), 9),
                c.adventDayFor(new Date('2027-01-01T02:00:00Z')),
            ])""")
            check(cases == [9, 10, 0, 9, 24], f"avant 7 h = la veille ({cases})")

            print("Souvenirs (après Noël)")
            err = a.evaluate("import('/src/backend/souvenirs.ts').then(m => m.exportSouvenirs(backend)).then(() => null, e => e.message)")
            check(err is not None and "24 décembre" in err, f"avant le 24 : refusé ({err})")
            s24 = open_page(ctx, "moi=flavie&jour=24")
            s24.evaluate("backend.savePrepared(20, { message: 'Joyeux <Noël> & bises\\n\\nÀ très vite', photos: [] })")
            html = s24.evaluate("import('/src/backend/souvenirs.ts').then(m => m.exportSouvenirs(backend)).then(b => b.text())")
            n_lettres = html.count('<article class="lettre')
            check(n_lettres >= 7, f"le 24 : page de souvenirs avec {n_lettres} lettres")
            check(html.count('<img src="data:') >= 6, "photos intégrées dans le fichier (data:)")
            check("Coucou mon cœur" in html and "De Flavie pour Alexandre" in html, "lettres des deux côtés")
            check("&lt;Noël&gt; &amp; bises" in html and "<Noël>" not in html, "texte échappé (pas de HTML injecté)")
            check("<p>À très vite</p>" in html, "paragraphes conservés")
            Path("/tmp/souvenirs-demo.html").write_text(html, encoding="utf-8")
            v = ctx.new_page()
            v.set_viewport_size({"width": 390, "height": 844})
            v.goto("file:///tmp/souvenirs-demo.html")
            v.screenshot(path="/tmp/souvenirs-mobile.png", full_page=False)
            check(v.locator("button.imprimer").is_visible(), "bouton « Enregistrer en PDF » visible")
            check(v.evaluate("document.querySelector('button.imprimer').getAttribute('onclick')") == "window.print()",
                  "le bouton lance window.print()")
            v.emulate_media(media="print")
            check(not v.locator("button.imprimer").is_visible(), "bouton masqué à l'impression")
            v.pdf(path="/tmp/souvenirs-demo.pdf", prefer_css_page_size=True, print_background=True)
            pdf = Path("/tmp/souvenirs-demo.pdf").read_bytes()
            n_pages = pdf.count(b"/Type /Page") - pdf.count(b"/Type /Pages")
            check(n_pages == n_lettres + 1, f"PDF A4 : page de garde + une page par lettre ({n_pages} pages)")
            check(b"/MediaBox [0 0 594.9" in pdf or b"/MediaBox [0 0 595" in pdf, "format A4")
            v.close()
            s24.close()

            print("Salons (docs/salons.md)")
            ERR = "async (f) => { try { await f(); return null; } catch (e) { return [e.code ?? null, e.message]; } }"

            def err(page, expr):
                return page.evaluate(f"({ERR})(() => {expr})")

            s0 = open_page(ctx, "demo-reset&jour=12&moi=alexandre")
            sd = s0.evaluate("backend.salons.getSalon()")
            check(sd["id"] == "demo" and sd["demo"] and sd["inviteArrive"], "salon démo par défaut")
            check(sd["config"]["joueurs"]["flavie"]["prenom"] == "Flavie"
                  and sd["config"]["joueurs"]["alexandre"]["couleurs"]["coat"] == 0x2F6FB5, "config démo = PLAYERS")
            check(len(s0.evaluate("backend.getProgress('flavie')")["opened"]) > 0, "salon démo : exemples conservés")
            cfg = ("{ joueurs: { alexandre: { prenom: ' Léo ', couleurs: { coat: 1, hat: 2, pompom: 3, hair: 4, longHair: false } },"
                   " flavie: { prenom: 'Inès', couleurs: { coat: 5, hat: 6, pompom: 7, hair: 8, longHair: true } } },"
                   " contenu: { '1': { questions: [{ q: 'Notre film ?', choix: ['A', 'B'], bonne: 0 }] } } }")
            e = err(s0, "backend.salons.creerSalon({ config: " + cfg + ", motDePasse: '123' })")
            check(e and e[0] == "MOT_DE_PASSE_FAIBLE", f"mot de passe trop court refusé ({e})")
            bad = cfg.replace("' Léo '", "'  '")
            e = err(s0, "backend.salons.creerSalon({ config: " + bad + ", motDePasse: 'secret1' })")
            check(e and e[0] == "CONFIG_INVALIDE", f"prénom vide refusé ({e})")
            e = err(s0, "backend.salons.creerSalon({ config: " + cfg.replace("'1':", "'25':") + ", motDePasse: 'secret1' })")
            check(e and e[0] == "CONFIG_INVALIDE", f"jour de contenu invalide refusé ({e})")
            cree = s0.evaluate("backend.salons.creerSalon({ config: " + cfg + ", motDePasse: 'secret1' })")
            sid = cree["salon"]["id"]
            check(sid != "demo" and not cree["salon"]["inviteArrive"], "salon créé, invité·e pas encore arrivé·e")
            check(cree["salon"]["config"]["joueurs"]["alexandre"]["prenom"] == "Léo", "prénom rogné")
            check(f"?salon={sid}" in cree["lienConnexion"] and "?invitation=" in cree["lienInvitation"], "deux liens fournis")
            check(s0.evaluate("backend.me()") == "alexandre", "créateur connecté (place alexandre)")
            p0 = s0.evaluate("backend.getProgress('flavie')")
            check(p0["opened"] == [] and s0.evaluate("backend.getGameState(2, 'score:flavie')") is None,
                  "nouveau salon : aucune donnée d'exemple")
            check(s0.evaluate("backend.getPrepared(4, 'flavie')")["status"] == "empty", "nouveau salon : cases vides")
            check(s0.evaluate("backend.salons.lienInvitation()") == cree["lienInvitation"], "lien d'invitation stable")
            jeton = cree["lienInvitation"].split("invitation=")[1]
            nouveau = s0.evaluate("backend.salons.lienInvitation({ nouveau: true })")
            check(nouveau != cree["lienInvitation"], "nouveau lien fabriqué")
            check(s0.evaluate(f"backend.salons.lireInvitation('{jeton}')")["statut"] == "invalide", "ancien lien invalidé")
            jeton = nouveau.split("invitation=")[1]
            s0.evaluate("backend.markOpened(3)")

            # l'invité·e, dans un autre onglet, par le lien
            inv = open_page(ctx, f"invitation={jeton}&jour=12")
            info = inv.evaluate("backend.salons.lireInvitation()")
            check(info["statut"] == "valide" and info["joueurs"]["flavie"]["prenom"] == "Inès", "lireInvitation lit l'adresse")
            e = err(inv, f"backend.salons.accepterInvitation('{jeton}', 'abc')")
            check(e and e[0] == "MOT_DE_PASSE_FAIBLE", "invité·e : mot de passe trop court refusé")
            inv.evaluate(f"backend.salons.accepterInvitation('{jeton}', 'motdepasse')")
            check(inv.evaluate("backend.me()") == "flavie", "invité·e connecté·e (place flavie)")
            si = inv.evaluate("backend.salons.getSalon()")
            check(si["id"] == sid and si["inviteArrive"], "invité·e dans le bon salon")
            check(si["config"]["contenu"]["1"]["questions"][0]["q"] == "Notre film ?", "contenu des jeux lisible par l'invité·e")
            check(inv.evaluate("backend.getProgress('alexandre')")["opened"] == [3], "données partagées dans le salon")
            check(inv.evaluate(f"backend.salons.lireInvitation('{jeton}')")["statut"] == "utilisee", "jeton consommé")
            e = err(inv, f"backend.salons.accepterInvitation('{jeton}', 'autre123')")
            check(e and e[0] == "INVITATION_UTILISEE", "jeton à usage unique")
            e = err(inv, "backend.salons.lienInvitation()")
            check(e and e[0] == "NON_AUTORISE", "seul le créateur invite")
            e = err(s0, "backend.salons.lienInvitation()")
            check(e and e[0] == "INVITATION_UTILISEE", "plus d'invitation une fois l'invité·e arrivé·e")

            # modification de la config, vue par l'autre
            seen = inv.evaluate("""() => new Promise((res) => {
                const off = backend.salons.onSalonChange((s) => { off(); res(s.config.joueurs.flavie.prenom); });
                backend.salons.modifierSalon({ ...%s, joueurs: { ...%s.joueurs, flavie: { prenom: 'Inès-Marie',
                  couleurs: { coat: 5, hat: 6, pompom: 7, hair: 8, longHair: true } } } });
            })""" % (cfg, cfg))
            check(seen == "Inès-Marie", "modifierSalon prévient onSalonChange")
            check(s0.evaluate("backend.salons.getSalon()")["config"]["joueurs"]["flavie"]["prenom"] == "Inès-Marie",
                  "modification lue par l'autre membre")

            # connexion par lien sur un « autre appareil » (onglet sans session) : mot de passe vérifié
            ln = open_page(ctx, f"salon={sid}&jour=12")
            check(ln.evaluate("backend.salons.getSalon()")["id"] == sid, "?salon= ouvre ce salon")
            # la session « rester » du créateur est retrouvée (même navigateur) : on la ferme pour tester
            ln.evaluate("backend.signOut()")
            check(ln.evaluate("backend.me()") is None, "déconnecté du salon")
            check(ln.evaluate("backend.salons.getSalon()")["config"]["contenu"] == {}, "contenu caché si non connecté")
            e = err(ln, "backend.signIn('alexandre', 'mauvais')")
            check(e and "incorrect" in e[1], "mauvais mot de passe refusé")
            ln.evaluate("backend.signIn('alexandre', 'secret1')")
            check(ln.evaluate("backend.me()") == "alexandre", "bon mot de passe accepté")

            # retour au salon démo : inchangé, et isolé du nouveau salon
            s0.evaluate("backend.setGameState(5, 'isole', 42)")
            sw = ln.evaluate("backend.salons.ouvrirSalon('demo')")
            check(sw["demo"] and ln.evaluate("backend.me()") is None, "ouvrirSalon : pas de session dans le salon démo")
            ln.evaluate("backend.signIn('alexandre', 'nimporte')")
            check(ln.evaluate("backend.getPrepared(4, 'flavie')")["status"] == "ready", "salon démo intact (exemples)")
            check(ln.evaluate("backend.getGameState(5, 'isole')") is None
                  and s0.evaluate("backend.getGameState(5, 'isole')") == 42, "données des salons isolées")
            e = err(ln, "backend.salons.ouvrirSalon('nexistepas')")
            check(e and e[0] == "SALON_INCONNU", "salon inconnu refusé")
            e = err(ln, "backend.salons.lireInvitation('nimportequoi').then((r) => { if (r.statut !== 'invalide') throw 0; })")
            check(e is None, "jeton inconnu → invalide")

            # limite de création par heure
            for _ in range(4):
                s0.evaluate("backend.salons.creerSalon({ config: " + cfg + ", motDePasse: 'secret1' })")
            e = err(s0, "backend.salons.creerSalon({ config: " + cfg + ", motDePasse: 'secret1' })")
            check(e and e[0] == "LIMITE_CREATION", "6e salon dans l'heure refusé")
            for p_ in (s0, inv, ln):
                p_.close()

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
