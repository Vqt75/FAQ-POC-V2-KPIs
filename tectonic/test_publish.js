// Tests d'intégration de POST /api/admin/publish — Phase 4.
// Tests réels contre un vrai serveur HTTP démarré pour l'occasion.
// À exécuter uniquement sur une copie scratch, jamais sur le dépôt
// de travail (ce script écrit dans data/ et uploads/).
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 3098; // dédié, distinct de 3000 et du port 3099 du CLI Phase 3
const ADMIN_PASSWORD = 'test-phase4-' + crypto.randomBytes(8).toString('hex');
const BASE = `http://localhost:${PORT}`;
const MANIFEST_PATH = path.join(ROOT, 'data', 'manifest.json');

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

function tempFilesInDataDir() {
  const dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir).filter(f => f.startsWith('.manifest.tmp-'));
}

async function main() {
  console.log('=== Tests Phase 4 — POST /api/admin/publish ===\n');

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

    // ─── Authentification ───
    const loginRes = await fetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const { token } = await loginRes.json();

    console.log('--- 1) Endpoint sans jeton -> refus ---');
    const noAuthRes = await fetch(`${BASE}/api/admin/publish`, { method: 'POST' });
    check('POST /api/admin/publish sans jeton -> 401', noAuthRes.status === 401);
    check('aucun manifest.json créé par une tentative non authentifiée', !fs.existsSync(MANIFEST_PATH));

    console.log('\n--- 2) Save seul (sans Publier) ne modifie jamais le Manifest ---');
    const beforeAnyPublish = fs.existsSync(MANIFEST_PATH);
    const content1 = await (await fetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    content1.branding.projectName = 'Projet Test Save Seul';
    await fetch(`${BASE}/api/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(content1)
    });
    check('Enregistrer seul ne crée pas de manifest.json', fs.existsSync(MANIFEST_PATH) === beforeAnyPublish);

    console.log('\n--- 3) Première publication invalide -> aucun Manifest créé ---');
    // On corrompt volontairement l'état via l'API légitime : une police
    // marquée "upload" sans URL exploitable -> erreur bloquante réelle
    // du Compiler (voir TECTONIC_COMPILER_DESIGN.md §6).
    const corrupted = await (await fetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    corrupted.branding.fonts[0] = { name: 'Police Cassée', fileName: 'cassee.woff2', source: 'upload' };
    await fetch(`${BASE}/api/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(corrupted)
    });
    const firstPublishRes = await fetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
    const firstPublishBody = await firstPublishRes.json();
    check('première tentative de publication (état corrompu) -> 422', firstPublishRes.status === 422);
    check('le message d\'erreur ne contient aucune stack trace (pas de "at ", pas de chemin de fichier .js)',
      !firstPublishBody.error.includes(' at ') && !firstPublishBody.error.includes('.js:'));
    check('AUCUN manifest.json n\'existe après ce premier échec (aucune publication précédente)',
      !fs.existsSync(MANIFEST_PATH));
    check('aucun fichier temporaire ne traîne après cet échec', tempFilesInDataDir().length === 0);

    console.log('\n--- 4) Réparation puis publication valide -> manifest.json créé ---');
    const fixed = await (await fetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    fixed.branding.fonts[0] = { name: 'Roboto', fileName: '', source: 'system' };
    await fetch(`${BASE}/api/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(fixed)
    });
    const publish1Res = await fetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
    const publish1Body = await publish1Res.json();
    check('publication valide -> 200', publish1Res.status === 200 && publish1Body.ok === true);
    check('manifest.json existe maintenant', fs.existsSync(MANIFEST_PATH));
    check('aucun fichier temporaire ne traîne après ce succès', tempFilesInDataDir().length === 0);
    const manifest1 = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    check('le Manifest écrit correspond à la réponse (revision cohérente)',
      manifest1.meta.revision === publish1Body.revision);
    check('project.name reflète bien l\'état publié ("Projet Test Save Seul")',
      manifest1.project.name === 'Projet Test Save Seul');
    check('aucun préfixe "diag-" dans la revision (ceci est une vraie publication)',
      !manifest1.meta.revision.startsWith('diag-'));

    console.log('\n--- 5) Seconde publication valide -> remplace atomiquement, revision différente ---');
    await new Promise(r => setTimeout(r, 1100)); // garantir un instant différent
    const publish2Res = await fetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
    const publish2Body = await publish2Res.json();
    check('seconde publication -> 200', publish2Res.status === 200);
    check('revision a changé entre les deux publications', publish2Body.revision !== publish1Body.revision);
    check('generatedAt a changé entre les deux publications', publish2Body.generatedAt !== publish1Body.generatedAt);
    const manifest2 = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    check('le Manifest sur disque correspond bien à la seconde publication, pas la première',
      manifest2.meta.revision === publish2Body.revision);
    check('aucun fichier temporaire ne traîne après ce second succès', tempFilesInDataDir().length === 0);

    console.log('\n--- 6) Erreur bloquante APRÈS une publication existante -> Manifest inchangé byte-for-byte ---');
    const manifest2Raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const corrupted2 = await (await fetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    corrupted2.branding.fonts[1] = { name: 'Encore Cassée', fileName: 'x.woff2', source: 'upload' };
    await fetch(`${BASE}/api/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(corrupted2)
    });
    const failedPublishRes = await fetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
    check('publication avec état corrompu (police 2) -> 422', failedPublishRes.status === 422);
    const manifest2AfterFailure = fs.readFileSync(MANIFEST_PATH, 'utf8');
    check('le Manifest sur disque est BYTE-FOR-BYTE identique à avant cette tentative échouée',
      manifest2AfterFailure === manifest2Raw);
    check('aucun fichier temporaire ne traîne après cet échec avec publication préexistante',
      tempFilesInDataDir().length === 0);

    // Réparation pour ne pas polluer les vérifications suivantes.
    const reFixed = await (await fetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    reFixed.branding.fonts = [{ name: 'Roboto', fileName: '', source: 'system' }, { name: 'Italiana', fileName: '', source: 'system' }];
    await fetch(`${BASE}/api/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(reFixed)
    });

    console.log('\n--- 7) Le site public Pangea continue de fonctionner exactement comme avant ---');
    const publicContentRes = await fetch(`${BASE}/api/content`);
    check('GET /api/content (anonyme) -> 200, inchangé', publicContentRes.status === 200);
    const publicContentBody = await publicContentRes.json();
    check('faqDrafts toujours absent de la réponse publique (invariant pré-existant intact)',
      !('faqDrafts' in publicContentBody));
    const kpiAnonRes = await fetch(`${BASE}/api/kpi`);
    check('GET /api/kpi (anonyme) toujours -> 401 (invariant pré-existant intact)', kpiAnonRes.status === 401);

    console.log('\n--- 8) Aucune route publique ne lit data/manifest.json ---');
    const manifestPublicRes1 = await fetch(`${BASE}/data/manifest.json`);
    const manifestPublicRes2 = await fetch(`${BASE}/manifest.json`);
    check('GET /data/manifest.json (public) -> pas 200 (rien ne le sert)', manifestPublicRes1.status !== 200);
    check('GET /manifest.json (public) -> pas 200 (rien ne le sert)', manifestPublicRes2.status !== 200);

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    if (failed > 0) console.log('DES TESTS ONT ECHOUE.');
    else console.log('TOUS LES TESTS SONT PASSES.');
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
