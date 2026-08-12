// Harnais comportemental — les deux flux d'authentification résiduels
// identifiés après le cutover Studio :
//   1. le clic "Admin" depuis Ivory doit aller DIRECTEMENT vers /admin,
//      jamais via /?pangea=1&admin=1 (double passage par Pangea) ;
//   2. la déconnexion depuis le Studio doit rester sur /admin et
//      revenir à l'état non authentifié (modale de connexion), jamais
//      naviguer vers Pangea.
// Exécute réellement le JS (jsdom, runScripts:'dangerously'), pas une
// recherche de texte.
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3094;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-auth-flows';
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

function commonMocks(window) {
  window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.MutationObserver = class { observe(){} disconnect(){} };
  window.requestAnimationFrame = cb => setTimeout(cb, 0);
  window.cancelAnimationFrame = () => {};
  window.scrollTo = () => {};
  window.Element.prototype.scrollTo = function () {};
  window.fetch = (u, o) => realFetch(new URL(u, BASE).toString(), o);
}

async function loadDom(url, token) {
  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously', resources: 'usable',
    beforeParse(window) {
      commonMocks(window);
      if (token) window.sessionStorage.setItem('xyz_admin_token', token);
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom;
}

async function main() {
  console.log('=== Harnais — flux d\'authentification résiduels (Ivory ↔ Studio) ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  let domAdmin, domAdmin2;
  try {
    await waitForServer(`${BASE}/health`, 8000);
    const loginRes = await realFetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const { token } = await loginRes.json();

    console.log('--- 1) Lien Admin depuis Ivory : va directement vers /admin ---');
    // Vérification par import direct du module, pas par démarrage complet
    // de la page : confirmé précisément que jsdom ne termine jamais le
    // rendu de "/" dans cet environnement de test (bloqué sur "Chargement…"),
    // et que ce blocage existe identiquement avec la version d'ivory.js
    // d'AVANT ce changement — donc sans lien avec ce lot. Le même module
    // est déjà testé ainsi avec succès par test_runtime_and_ivory.mjs.
    const ivory = await import(path.join(ROOT, 'public', 'renderers', 'ivory.js'));
    const scratchDom = new JSDOM('<div id="root"></div>');
    const scratchRoot = scratchDom.window.document.getElementById('root');
    const scratchManifest = {
      schemaVersion: 1, project: { name: 'Test' },
      branding: { colors: {}, fonts: {} }, edition: { id: 'ivory' },
      navigation: [], content: {}
    };
    ivory.render(scratchManifest, scratchRoot, { submitContact: async () => ({ ok: true }) });
    const adminLink = scratchDom.window.document.querySelector('.tct-admin-entry');
    check('le lien Administration existe dans le rendu Ivory', !!adminLink);
    check('le lien Administration pointe directement vers /admin (jamais via ?pangea=1&admin=1)',
      adminLink && adminLink.getAttribute('href') === '/admin');
    try { scratchDom.window.close(); } catch (e) {}

    console.log('\n--- 2) /admin non authentifié : présente le login directement, sans passage visuel par Pangea ---');
    domAdmin = await loadDom(`${BASE}/admin`, null);
    const doc = domAdmin.window.document;
    check('la modale de connexion est ouverte au chargement de /admin sans jeton',
      doc.getElementById('adminModal').classList.contains('open'));
    check('le panneau Studio (page-admin) n\'est pas actif tant que non authentifié',
      !doc.getElementById('page-admin').classList.contains('active'));

    console.log('\n--- 3) Connexion depuis cette même page : ouvre bien le Studio, toujours sur /admin ---');
    doc.getElementById('adminPasswordInput').value = ADMIN_PASSWORD;
    doc.getElementById('adminModalSubmit').click();
    await new Promise(r => setTimeout(r, 700));
    check('après connexion, la modale se ferme', !doc.getElementById('adminModal').classList.contains('open'));
    check('après connexion, le Studio (page-admin) devient actif', doc.getElementById('page-admin').classList.contains('active'));

    console.log('\n--- 4) Déconnexion : reste sur /admin, revient à l\'état non authentifié (login), jamais Pangea ---');
    let navigatedAway = false;
    domAdmin.window.addEventListener('beforeunload', () => { navigatedAway = true; });
    doc.getElementById('adminLogoutBtn').click();
    await new Promise(r => setTimeout(r, 400));
    check('aucune navigation cross-page déclenchée par la déconnexion (pas de beforeunload)', !navigatedAway);
    check('la modale de connexion est réouverte après déconnexion', doc.getElementById('adminModal').classList.contains('open'));
    check('le jeton admin a bien été effacé', !domAdmin.window.sessionStorage.getItem('xyz_admin_token'));

    console.log('\n--- 5) Rechargement de /admin après déconnexion : toujours non authentifié ---');
    domAdmin2 = await loadDom(`${BASE}/admin`, null);
    const doc2 = domAdmin2.window.document;
    check('un rechargement de /admin après déconnexion présente à nouveau le login',
      doc2.getElementById('adminModal').classList.contains('open'));

    console.log('\n--- 6) /?pangea=1 reste inchangé ---');
    const pangeaRes = await realFetch(`${BASE}/?pangea=1`);
    const pangeaBody = await pangeaRes.text();
    check('/?pangea=1 répond toujours 200', pangeaRes.status === 200);
    check('/?pangea=1 sert toujours Pangea (Espace collaborateurs)', pangeaBody.includes('Espace collaborateurs'));
    check('/?pangea=1 ne contient plus le markup admin (déjà extrait, sans lien avec ce lot)',
      !pangeaBody.includes('id="page-admin"'));

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;
    try { domAdmin.window.close(); } catch (e) {}
    try { domAdmin2.window.close(); } catch (e) {}

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
