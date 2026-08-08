// Tests de régression du hotfix sécurité — whitelist explicite des
// fichiers statiques publics, remplaçant l'ancien catch-all dangereux
// qui servait n'importe quel fichier existant sous ROOT.
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 3097;
const ADMIN_PASSWORD = 'test-hotfix-' + crypto.randomBytes(8).toString('hex');
const BASE = `http://localhost:${PORT}`;

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`OK    — ${label}`); passed++; }
  else { console.log(`ECHEC — ${label}`); failed++; }
}

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      fetch(url).then(res => res.ok ? resolve() : retry()).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout démarrage serveur.'));
        else setTimeout(attempt, 200);
      }
    })();
  });
}

async function status(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return res.status;
}

async function main() {
  console.log('=== Tests de régression — whitelist des fichiers statiques ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  try {
    await waitForServer(`${BASE}/health`, 8000);

    // Déclenche la création réelle de data/content.json et data/kpis.json
    // (sinon le test "pas 200" serait trivialement vrai — le fichier
    // n'existerait simplement pas encore).
    await fetch(`${BASE}/api/content`);

    console.log('--- Fichiers qui NE DOIVENT JAMAIS être servis publiquement ---');
    check('GET /data/content.json -> pas 200', await status('/data/content.json') !== 200);
    check('GET /data/kpis.json -> pas 200', await status('/data/kpis.json') !== 200);
    check('GET /data/manifest.json -> pas 200', await status('/data/manifest.json') !== 200);
    check('GET /server.js -> pas 200', await status('/server.js') !== 200);
    check('GET /tectonic/compiler.js -> pas 200', await status('/tectonic/compiler.js') !== 200);
    check('GET /tectonic/publish.js -> pas 200', await status('/tectonic/publish.js') !== 200);
    check('GET /.gitignore -> pas 200', await status('/.gitignore') !== 200);
    check('GET /PANGEA.md -> pas 200', await status('/PANGEA.md') !== 200);
    check('GET /TECTONIC_COMPILER_DESIGN.md -> pas 200', await status('/TECTONIC_COMPILER_DESIGN.md') !== 200);
    check('GET /package.json -> pas 200', await status('/package.json') !== 200);
    check('tentative de remontée de chemin (/uploads/../server.js) -> pas 200',
      await status('/uploads/../server.js') !== 200);
    check('tentative de remontée de chemin (/assets/../../server.js) -> pas 200',
      await status('/assets/../../server.js') !== 200);

    console.log('\n--- Fichiers qui DOIVENT rester servis (site public réel) ---');
    check('GET / -> 200 (index.html)', await status('/') === 200);
    check('GET /assets/storm-logo.png -> 200', await status('/assets/storm-logo.png') === 200);
    check('GET /demo/storm-demo.css -> 200', await status('/demo/storm-demo.css') === 200);
    check('GET /demo/storm-demo.js -> 200', await status('/demo/storm-demo.js') === 200);
    check('GET /themes/midnight-frost.css -> 200', await status('/themes/midnight-frost.css') === 200);
    check('GET /themes/midnight-frost.js -> 200', await status('/themes/midnight-frost.js') === 200);
    check('GET /themes/rainbow-glass.css -> 200', await status('/themes/rainbow-glass.css') === 200);
    check('GET /themes/rainbow-glass.js -> 200', await status('/themes/rainbow-glass.js') === 200);

    console.log('\n--- Les routes API existantes ne sont pas cassées ---');
    check('GET /api/content (anonyme) -> 200', await status('/api/content') === 200);
    check('GET /api/kpi (anonyme) -> 401 (protégé, inchangé)', await status('/api/kpi') === 401);
    check('GET /health -> 200', await status('/health') === 200);

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;

  } catch (err) {
    console.error('\nERREUR DE TEST :', err.message);
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    child.kill('SIGKILL');
  }
}

main();
