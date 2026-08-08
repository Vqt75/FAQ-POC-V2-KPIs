// Tests du cutover de routage — Phase 6.
// Tectonic devient le comportement public par défaut ; Pangea devient
// un fallback explicite via ?pangea=1. Aucun autre changement.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3094;
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
  console.log('=== Tests Phase 6 — cutover de routage ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD: 'test-p6' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  try {
    await waitForServer(`${BASE}/health`, 8000);

    async function bodyOf(pathname) {
      const res = await realFetch(`${BASE}${pathname}`);
      return { status: res.status, text: await res.text() };
    }

    console.log('--- 1) Routage de base ---');
    {
      const root = await bodyOf('/');
      check('GET / -> 200, sert Tectonic (pas Pangea)',
        root.status === 200 && root.text.includes('tectonic-root') && !root.text.includes('Espace collaborateurs'));

      const pangea = await bodyOf('/?pangea=1');
      check('GET /?pangea=1 -> 200, sert exactement le vrai Pangea historique (pas une copie)',
        pangea.status === 200 && pangea.text.includes('Espace collaborateurs') && !pangea.text.includes('tectonic-root'));

      const tectonicOptIn = await bodyOf('/?tectonic=1');
      check('GET /?tectonic=1 -> continue de fonctionner (retombe naturellement sur Tectonic)',
        tectonicOptIn.status === 200 && tectonicOptIn.text.includes('tectonic-root'));

      const randomParam = await bodyOf('/?foo=bar');
      check('GET /?foo=bar (paramètre sans rapport) -> Tectonic, pas de bascule accidentelle',
        randomParam.status === 200 && randomParam.text.includes('tectonic-root'));
    }

    console.log('\n--- 2) Le fallback Pangea sert le VRAI index.html, pas une copie ---');
    {
      const realIndexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const pangea = await bodyOf('/?pangea=1');
      check('le corps servi par /?pangea=1 est OCTET POUR OCTET index.html', pangea.text === realIndexHtml);
    }

    console.log('\n--- 3) Le fallback Pangea n\'accède ni ne modifie le Manifest ---');
    {
      // Publier un Manifest connu, noter son état, visiter Pangea,
      // vérifier que rien n'a bougé.
      const loginRes = await realFetch(`${BASE}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-p6' })
      });
      const { token } = await loginRes.json();
      await realFetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
      const manifestBefore = await (await realFetch(`${BASE}/api/manifest`)).text();

      await realFetch(`${BASE}/?pangea=1`); // simple visite

      const manifestAfter = await (await realFetch(`${BASE}/api/manifest`)).text();
      check('le Manifest est strictement inchangé après une visite de /?pangea=1',
        manifestBefore === manifestAfter);
    }

    console.log('\n--- 4) Tectonic ne lit toujours que /api/manifest (vérifié par de vrais appels, pas une recherche de texte) ---');
    {
      // Une simple recherche de sous-chaîne "/api/content" dans le
      // fichier trouverait le commentaire du contrat lui-même
      // ("jamais /api/content...") et donnerait un faux échec. On
      // trace donc les VRAIS appels réseau effectués pendant un
      // vrai boot(), comme en Phase 5.
      const { JSDOM } = await import('jsdom');
      const calledUrls = [];
      const dom = new JSDOM('<div id="tectonic-root"></div>', { url: `${BASE}/` });
      global.document = dom.window.document;
      global.fetch = (u, o) => { calledUrls.push(String(u)); return realFetch(new URL(u, BASE).toString(), o); };
      await import(`${path.join(ROOT, 'public', 'runtime.js')}?phase6check`);
      await new Promise(r => setTimeout(r, 800));
      check('aucun appel réseau à /api/content pendant le boot()', !calledUrls.some(u => u.includes('/api/content')));
      check('aucun appel réseau à une route /api/admin/* pendant le boot()', !calledUrls.some(u => u.includes('/api/admin')));
      check('/api/manifest a bien été appelé', calledUrls.some(u => u.includes('/api/manifest')));
    }

    console.log('\n--- 5) Manifest absent -> erreur Tectonic visible, JAMAIS un fallback automatique vers Pangea ---');
    {
      const manifestPath = path.join(ROOT, 'data', 'manifest.json');
      const backup = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : null;
      try {
        if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
        const rootWithoutManifest = await bodyOf('/');
        check('GET / sans Manifest publié -> 200 (le shell se charge), pas de redirection vers Pangea',
          rootWithoutManifest.status === 200 && rootWithoutManifest.text.includes('tectonic-root'));
        // La vraie vérification (le Runtime affiche l'erreur explicite)
        // ne peut être exécutée qu'en exécutant réellement runtime.js
        // dans un contexte de module ES — testé en Phase 5
        // (test_runtime_and_ivory.mjs, "Manifest absent -> erreur
        // explicite"). Ce test-ci vérifie la partie serveur : la
        // route racine sert TOUJOURS le shell Tectonic, jamais un
        // repli automatique côté serveur vers index.html.
      } finally {
        if (backup !== null) fs.writeFileSync(manifestPath, backup, 'utf8');
        else if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
      }
    }

    console.log('\n--- 6) Admin inchangé ---');
    {
      const loginRes = await realFetch(`${BASE}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-p6' })
      });
      check('POST /api/admin/login fonctionne toujours', loginRes.status === 200);
      const { token } = await loginRes.json();
      const contentRes = await realFetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } });
      check('GET /api/content authentifié fonctionne toujours', contentRes.status === 200);
      const noAuthRes = await realFetch(`${BASE}/api/kpi`);
      check('GET /api/kpi sans jeton -> toujours 401 (invariant sécurité intact)', noAuthRes.status === 401);
    }

    console.log('\n--- 7) Publication inchangée ---');
    {
      const loginRes = await realFetch(`${BASE}/api/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-p6' })
      });
      const { token } = await loginRes.json();
      const publishRes = await realFetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
      const publishBody = await publishRes.json();
      check('POST /api/admin/publish fonctionne toujours, renvoie revision/generatedAt',
        publishRes.status === 200 && !!publishBody.revision && !!publishBody.generatedAt);
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
