// Test serveur/intégration — télémétrie Pilotage V1.
//
// Contrairement à test_telemetry.js (fonctions pures), ce fichier vérifie
// des propriétés de PERSISTANCE réelle de server.js : la garantie
// "agrégat persisté avec succès -> seulement ensuite suppression du
// brut" n'est pas calculable en isolation, elle doit être prouvée en
// provoquant un vrai échec d'écriture et en constatant que le brut
// survit intact.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3096;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-telemetry-server';
const realFetch = globalThis.fetch;
const DATA_DIR = path.join(ROOT, 'data');
const TELEMETRY_DIR = path.join(DATA_DIR, 'telemetry');
const AGGREGATES_FILE = path.join(DATA_DIR, 'telemetry-aggregates.json');

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

function startServer() {
  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', d => log += d.toString());
  child.stderr.on('data', d => log += d.toString());
  return { child, getLog: () => log };
}

async function main() {
  console.log('=== Test serveur — télémétrie Pilotage V1 ===\n');

  let server = startServer();
  try {
    await waitForServer(`${BASE}/health`, 8000);
    const loginRes = await realFetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const { token } = await loginRes.json();

    console.log('--- 1) Validation stricte : payload invalide -> 400, jamais accepté silencieusement ---');
    const badPayloads = [
      { event: 'click' },
      { event: 'page_view', page: 'home' },
      { event: 'match_result', outcome: 'yes' },
      { event: 'match_result', outcome: 'matched', contentId: 'faq_1' },
      { event: 'mood_feedback', value: 9 },
      { event: 'mood_feedback', value: '3' },
      {}
    ];
    let allRejected = true;
    for (const payload of badPayloads) {
      const res = await realFetch(`${BASE}/api/telemetry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (res.status !== 400) { allRejected = false; console.log('  accepté à tort:', JSON.stringify(payload), res.status); }
      const body = await res.json();
      if (JSON.stringify(body).includes(JSON.stringify(payload))) { allRejected = false; console.log('  payload réinjecté dans la réponse (protocole non silencieux violé)'); }
    }
    check('tous les payloads invalides sont rejetés avec 400', allRejected);

    console.log('\n--- 2) Le client ne peut pas fournir sa propre date ---');
    const spoofRes = await realFetch(`${BASE}/api/telemetry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'page_view', date: '2000-01-01' })
    });
    // Le champ "date" en plus dans le payload page_view doit lui-même être
    // rejeté par la validation stricte (page_view n'accepte aucun champ) —
    // double garantie : la date ne peut être ni acceptée, ni utilisée.
    check('un page_view avec une date fournie par le client est rejeté (validation stricte)', spoofRes.status === 400);

    console.log('\n--- 3) Écriture réelle : un événement valide atterrit bien dans le fichier du jour, avec la date du serveur ---');
    const beforeCount = fs.existsSync(TELEMETRY_DIR) ? fs.readdirSync(TELEMETRY_DIR).length : 0;
    const okRes = await realFetch(`${BASE}/api/telemetry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'page_view' })
    });
    check('un événement valide est accepté (200)', okRes.status === 200);
    const afterCount = fs.existsSync(TELEMETRY_DIR) ? fs.readdirSync(TELEMETRY_DIR).length : 0;
    check('un nouveau fichier journalier de télémétrie est bien apparu après l\'écriture', afterCount > beforeCount);

    console.log('\n--- 4) Ordre de purge : échec d\'écriture de l\'agrégat -> le brut expiré doit rester intact ---');
    // Fabrique un fichier brut manifestement expiré (plus de 30 jours).
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    const oldDate = '2020-01-01';
    const oldFile = path.join(TELEMETRY_DIR, `${oldDate}.jsonl`);
    fs.writeFileSync(oldFile, JSON.stringify({ event: 'mood_feedback', date: oldDate, value: 'positive' }) + '\n', 'utf8');
    check('le fichier brut ancien a bien été créé pour ce test', fs.existsSync(oldFile));

    // Provoque un échec d'écriture de l'agrégat en remplaçant le CHEMIN
    // attendu par un répertoire : toute tentative de fs.writeFileSync sur
    // ce chemin lèvera EISDIR — un échec réel, pas simulé/mocké.
    if (fs.existsSync(AGGREGATES_FILE)) fs.rmSync(AGGREGATES_FILE, { recursive: true, force: true });
    fs.mkdirSync(AGGREGATES_FILE); // AGGREGATES_FILE est maintenant un répertoire, pas un fichier

    // Déclenche la purge via un vrai POST (materializeAndPurgeExpiredRaw
    // s'exécute après chaque écriture réussie).
    const triggerRes = await realFetch(`${BASE}/api/telemetry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'page_view' })
    });
    check('le POST déclencheur réussit malgré l\'échec de purge (la télémétrie reste utile)', triggerRes.status === 200);
    check('le brut ancien EXISTE TOUJOURS après l\'échec d\'écriture de l\'agrégat (ordre strict respecté)',
      fs.existsSync(oldFile));

    // Nettoyage : remettre un état sain, puis vérifier que la purge
    // fonctionne réellement une fois l'obstacle levé.
    fs.rmSync(AGGREGATES_FILE, { recursive: true, force: true });
    const triggerRes2 = await realFetch(`${BASE}/api/telemetry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'page_view' })
    });
    check('une fois l\'obstacle levé, le POST réussit toujours', triggerRes2.status === 200);
    check('le brut ancien est maintenant purgé (l\'agrégat a pu être persisté avec succès)',
      !fs.existsSync(oldFile));
    check('un fichier d\'agrégats valide (pas un répertoire) existe désormais',
      fs.existsSync(AGGREGATES_FILE) && fs.statSync(AGGREGATES_FILE).isFile());

    console.log('\n--- 5) Lecture Pilotage protégée par le token admin ---');
    const unauthRes = await realFetch(`${BASE}/api/telemetry/summary`);
    check('la lecture sans token est refusée (401)', unauthRes.status === 401);
    const authRes = await realFetch(`${BASE}/api/telemetry/summary`, { headers: { 'x-admin-token': token } });
    check('la lecture avec le bon token fonctionne (200)', authRes.status === 200);

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;

  } catch (err) {
    console.error('\nERREUR DE TEST :', err.message, '\n', err.stack);
    console.error(server.getLog());
    process.exitCode = 1;
  } finally {
    server.child.kill('SIGKILL');
    setImmediate(() => process.exit(process.exitCode ?? 1));
  }
}

main();
