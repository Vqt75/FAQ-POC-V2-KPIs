// Test ciblé — correctif "Relancer la création" (recâblage du composant
// démo/onboarding autonome, jamais reconnecté depuis l'extraction du
// Studio vers tectonic/studio.html).
//
// Volontairement léger : vérifie que le mécanisme de navigation réel
// fonctionne (une vraie transition de scène, ouverture/fermeture/
// réouverture), sans reproduire l'intégralité du parcours en 15 scènes
// du composant — ce composant existe déjà et n'est pas modifié par ce
// lot, seul son câblage l'était.
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3095;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-demo-relaunch';
const realFetch = globalThis.fetch;

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`OK    — ${label}`); passed++; }
  else { console.log(`ECHEC — ${label}`); failed++; }
}

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      realFetch(url).then(res => res.ok ? resolve() : retry()).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout démarrage serveur.'));
        else setTimeout(attempt, 200);
      }
    })();
  });
}

async function main() {
  console.log('=== Test ciblé — recâblage "Relancer la création" ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  let dom;
  try {
    await waitForServer(`${BASE}/health`, 8000);
    const loginRes = await realFetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const { token } = await loginRes.json();

    dom = await JSDOM.fromURL(`${BASE}/admin`, {
      runScripts: 'dangerously', resources: 'usable',
      beforeParse(window) {
        // prefers-reduced-motion:reduce -> le composant emprunte alors son
        // propre chemin de repli déjà existant (assignation directe des
        // styles finaux, sans jamais appeler Element.animate()) — API Web
        // Animations non implémentée par jsdom, limitation connue et
        // documentée de l'outil de test, pas du produit. Ce chemin reste
        // un vrai chemin du produit, pas un mock synthétique.
        window.matchMedia = (query) => ({
          matches: query.includes('prefers-reduced-motion'),
          addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}
        });
        window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
        window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
        window.MutationObserver = class { observe(){} disconnect(){} };
        window.requestAnimationFrame = cb => setTimeout(cb, 0);
        window.cancelAnimationFrame = () => {};
        window.scrollTo = () => {};
        window.Element.prototype.scrollTo = function () {};
        window.fetch = (u, o) => realFetch(new URL(u, BASE).toString(), o);
        window.sessionStorage.setItem('xyz_admin_token', token);
      }
    });
    await new Promise(r => setTimeout(r, 900));
    const doc = dom.window.document;

    check('window.StormShowcase est bien exposé', typeof dom.window.StormShowcase?.play === 'function');
    check('le bouton "Relancer la création" existe', !!doc.getElementById('stormDemoLaunchBtn'));

    console.log('\n--- Ouverture réelle ---');
    doc.getElementById('stormDemoLaunchBtn').click();
    check('la scène "intro" est active juste après le clic',
      doc.querySelector('[data-scene="intro"]') && !doc.querySelector('[data-scene="intro"]').hasAttribute('hidden'));
    await new Promise(r => setTimeout(r, 400));
    check('le conteneur de démonstration est créé', !!doc.getElementById('stormShowcaseRoot'));
    check('body porte la classe storm-demo-open', doc.body.classList.contains('storm-demo-open'));

    console.log('\n--- Une vraie transition (bouton Passer l\'intro) ---');
    doc.getElementById('stormIntroSkip').click();
    await new Promise(r => setTimeout(r, 500));
    const visibleScene = Array.from(doc.querySelectorAll('[data-scene]')).find(s => !s.hasAttribute('hidden'));
    check('une vraie transition de scène a eu lieu (plus sur "intro")',
      visibleScene && visibleScene.dataset.scene !== 'intro');

    console.log('\n--- Fermeture propre (Escape) ---');
    const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    doc.dispatchEvent(escEvent);
    await new Promise(r => setTimeout(r, 400));
    check('le conteneur est retiré du DOM après Escape', !doc.getElementById('stormShowcaseRoot'));
    check('body ne porte plus storm-demo-open', !doc.body.classList.contains('storm-demo-open'));

    console.log('\n--- Relance possible une seconde fois ---');
    doc.getElementById('stormDemoLaunchBtn').click();
    await new Promise(r => setTimeout(r, 400));
    check('le parcours se rouvre correctement une seconde fois', !!doc.getElementById('stormShowcaseRoot'));

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;
    try { dom.window.close(); } catch (e) {}

  } catch (err) {
    console.error('\nERREUR DE TEST :', err.message, '\n', err.stack);
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    child.kill('SIGKILL');
    setImmediate(() => process.exit(process.exitCode ?? 1));
  }
}

main();
