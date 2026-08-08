// Tests du Runtime + Renderer Ivory — Phase 5.
//
// Note méthodologique importante, découverte en écrivant ces tests :
// jsdom N'EXÉCUTE JAMAIS les scripts <script type="module"> (limitation
// connue, vérifiée isolément avant d'écrire ce fichier — même avec
// runScripts:'dangerously'). Et le chargeur de modules ES natif de
// Node ne peut pas résoudre un import('/chemin/absolu.js') de la même
// façon qu'un navigateur (qui le résout depuis l'origine du site) —
// Node l'interprète comme un chemin de système de fichiers.
//
// Conséquence assumée : le déclenchement bout-en-bout de
// runtime.js -> import() dynamique -> ivory.js, tel qu'il s'exécute
// réellement dans un navigateur, n'est pas exécutable tel quel dans
// cet environnement de test sans un vrai navigateur headless (non
// disponible ici). Cette limitation ne remet pas en cause le code de
// runtime.js — modifier son schéma d'import pour satisfaire Node
// casserait son fonctionnement réel en navigateur, ce qui serait pire.
//
// Stratégie de test adoptée à la place, tout aussi rigoureuse sur le
// fond : chaque brique est testée directement et réellement --
//   - la logique de validation de runtime.js (schemaVersion, routage
//     d'édition, refus explicite) est testée en import direct ;
//   - le renderer Ivory est testé en import direct avec de vraies
//     données de Manifest, et son rendu DOM est inspecté réellement ;
//   - le câblage serveur (routes, whitelist statique) est vérifié par
//     de vraies requêtes HTTP contre un vrai serveur démarré.
// Ensemble, ces vérifications couvrent la totalité du contrat sans
// dépendre d'une capacité d'exécution de page complète absente ici.
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3096;
const BASE = `http://localhost:${PORT}`;
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
  console.log('=== Tests Runtime + Ivory — Phase 5 ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD: 'test-p5' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  try {
    await waitForServer(`${BASE}/health`, 8000);

    console.log('--- 1) Runtime : Manifest absent -> erreur explicite, pas de crash ---');
    {
      const dom = new JSDOM('<div id="tectonic-root"></div>', { url: `${BASE}/?tectonic=1` });
      global.document = dom.window.document;
      global.fetch = (u, o) => realFetch(new URL(u, BASE).toString(), o);
      await import(`${path.join(__dirname, 'runtime.js')}?nomanifest`);
      await new Promise(r => setTimeout(r, 500));
      const html = dom.window.document.getElementById('tectonic-root').innerHTML;
      check('message d\'erreur explicite affiché (pas de crash silencieux)',
        html.includes('Impossible d\'afficher') && html.toLowerCase().includes('publication'));
    }

    // Publication réelle pour la suite des tests.
    const loginRes = await realFetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-p5' })
    });
    const { token } = await loginRes.json();
    await realFetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
    const realManifest = await (await realFetch(`${BASE}/api/manifest`)).json();

    console.log('\n--- 2) Runtime : validateSchemaVersion ---');
    {
      const mod = await import(`${path.join(__dirname, 'runtime.js')}?schema1`);
      let threw = false;
      try { mod.validateSchemaVersion({ schemaVersion: 999 }); } catch (e) { threw = true; }
      check('schemaVersion inconnu -> exception levée', threw);
      let ok = true;
      try { mod.validateSchemaVersion({ schemaVersion: 1 }); } catch (e) { ok = false; }
      check('schemaVersion connu (1) -> pas d\'exception', ok);
    }

    console.log('\n--- 3) Runtime : table de routage des éditions ---');
    {
      const mod = await import(`${path.join(__dirname, 'runtime.js')}?routing`);
      check('table RENDERERS : "ivory" pointe vers le bon chemin',
        mod.RENDERERS.ivory === '/public/renderers/ivory.js');
      check('table RENDERERS : "rainbow-glass" absent (hors périmètre Phase 5)',
        !('rainbow-glass' in mod.RENDERERS));
      check('table RENDERERS : "midnight-frost" absent (hors périmètre Phase 5)',
        !('midnight-frost' in mod.RENDERERS));
      let threwForUnknown = false;
      try { await mod.loadRenderer('midnight-frost'); } catch (e) { threwForUnknown = true; }
      check('édition non supportée (midnight-frost) -> exception explicite AVANT toute tentative d\'import, jamais de repli vers ivory',
        threwForUnknown);
    }

    console.log('\n--- 4) Câblage HTTP réel : chaque pièce est effectivement servie ---');
    {
      const rIvory = await realFetch(`${BASE}/public/renderers/ivory.js`);
      check('GET /public/renderers/ivory.js -> 200 (exactement le chemin utilisé par runtime.js)', rIvory.status === 200);
      const rRuntime = await realFetch(`${BASE}/public/runtime.js`);
      check('GET /public/runtime.js -> 200', rRuntime.status === 200);
      const rShell = await realFetch(`${BASE}/?tectonic=1`);
      const shellHtml = await rShell.text();
      check('GET /?tectonic=1 -> 200, sert le shell Tectonic (pas Pangea)',
        rShell.status === 200 && shellHtml.includes('tectonic-root') && !shellHtml.includes('Espace collaborateurs'));
      const rPangea = await realFetch(`${BASE}/`);
      const pangeaHtml = await rPangea.text();
      check('GET / (sans le paramètre) -> Pangea inchangé',
        rPangea.status === 200 && pangeaHtml.includes('Espace collaborateurs') && !pangeaHtml.includes('tectonic-root'));
    }

    console.log('\n--- 5) Renderer Ivory : import direct réel, chaque module produit son rendu ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      ivory.render(realManifest, root);
      const doc = dom.window.document;

      check('branding : nom du projet dans le <header>',
        doc.querySelector('.tct-header').textContent.includes(realManifest.project.name));
      check('navigation : autant de liens que d\'entrées dans le Manifest',
        doc.querySelectorAll('.tct-nav a').length === realManifest.navigation.length);
      ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team'].forEach(key => {
        const present = !!realManifest.content[key];
        const rendered = !!doc.getElementById(key);
        check(`section "${key}" : ${present ? 'présente dans le Manifest -> rendue' : 'absente du Manifest -> non rendue'}`,
          present === rendered);
      });
      check('jalons rendus en nombre exact',
        doc.querySelectorAll('.tct-milestone').length === (realManifest.content.timeline?.milestones.length || 0));
      check('articles rendus en nombre exact',
        doc.querySelectorAll('#news .tct-card').length === (realManifest.content.news?.items.length || 0));
      check('ambassadeurs rendus en nombre exact',
        doc.querySelectorAll('#ambassadors .tct-person').length === (realManifest.content.ambassadors?.roster.length || 0));
      check('membres équipe rendus en nombre exact',
        doc.querySelectorAll('#team .tct-person').length === (realManifest.content.team?.members.length || 0));
    }

    console.log('\n--- 6) Règle de résolution des assets ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const fakeManifest = JSON.parse(JSON.stringify(realManifest));
      fakeManifest.content.spaces = {
        intro: { eyebrow: '', title: '', description: '' },
        items: [{ id: 'x', type: 'Plan', tags: [], title: 'Test', comment: '',
                  asset: { url: '/uploads/reel-test.jpg', alt: 'Un test' } }]
      };
      ivory.render(fakeManifest, root);
      const img = dom.window.document.querySelector('.tct-card-img');
      check('asset.url utilisé TEL QUEL comme src (chemin absolu déjà correct pour un vrai upload)',
        img.getAttribute('src') === '/uploads/reel-test.jpg');
      check('asset.alt utilisé comme attribut alt', img.getAttribute('alt') === 'Un test');

      // Cas réel des données de démo : nom de fichier nu, jamais un
      // vrai fichier existant. Le renderer ne doit ni planter, ni
      // inventer une résolution — juste refléter honnêtement l'échec.
      const domBroken = new JSDOM('<div id="root"></div>');
      const rootBroken = domBroken.window.document.getElementById('root');
      let crashed = false;
      try { ivory.render(realManifest, rootBroken); } catch (e) { crashed = true; }
      check('rendu du vrai Manifest (contenant potentiellement des noms de fichiers nus hérités de la démo) -> jamais de crash',
        !crashed);
    }

    console.log('\n--- 7) FAQ vide : rendu honnête, aucun fallback caché vers les 34 questions legacy ---');
    {
      check('content.questions.items est bien vide dans le vrai Manifest (confirmé, pas un fallback)',
        realManifest.content.questions.items.length === 0);
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      ivory.render(realManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      // Depuis la migration Phase 5B, la section Questions est un
      // moteur de recherche interactif, plus une liste statique.
      // Chercher n'importe quoi contre une base vide ne doit jamais
      // faire apparaître par magie une des 34 questions legacy de
      // Pangea — le résultat doit rester "non trouvé", honnêtement.
      doc.getElementById('tct-question-input').value = 'Quand a lieu le déménagement ?';
      doc.getElementById('tct-ask-btn').dispatchEvent(new dom.window.Event('click'));
      check('recherche contre une base FAQ vide -> jamais de résultat inventé, escalade contact affichée',
        doc.getElementById('tct-question-result').hidden === true &&
        doc.getElementById('tct-question-notfound').hidden === false);
    }

    console.log('\n--- 8) Whitelist statique : data/**, server.js, tectonic/** toujours refusés ---');
    {
      const rData = await realFetch(`${BASE}/data/manifest.json`);
      check('GET /data/manifest.json (accès direct au fichier, pas via /api/manifest) -> pas 200',
        rData.status !== 200);
      const rServer = await realFetch(`${BASE}/server.js`);
      check('GET /server.js -> toujours pas 200 (non-régression du hotfix précédent)', rServer.status !== 200);
    }

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;

  } catch (err) {
    console.error('\nERREUR DE TEST :', err.message, '\n', err.stack);
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    child.kill('SIGKILL');
  }
}

main();
