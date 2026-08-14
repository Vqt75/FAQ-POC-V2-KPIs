// Test comportemental — Storm Match, repli générique cantonné à un mode
// démo/dev explicite (dernier volet du freeze gate Tectonic).
//
// Principe vérifié : en fonctionnement normal, aucune connaissance
// projet publiée = Storm Match s'abstient proprement (état déjà
// existant, déjà product-compatible — showUnknown()), jamais une
// réponse générique silencieuse. Le repli ne doit répondre QUE si
// STORM_MATCH_DEMO_FALLBACK=1 est explicitement positionné côté
// serveur (jamais togglable par un visiteur, jamais activé par défaut).
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const realFetch = globalThis.fetch;

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`OK    — ${label}`); passed++; }
  else { console.log(`ECHEC — ${label}`); failed++; }
}

function waitForServer(base, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      realFetch(`${base}/health`).then(res => res.ok ? resolve() : retry()).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout démarrage serveur.'));
        else setTimeout(attempt, 200);
      }
    })();
  });
}

function startServer(port, extraEnv) {
  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(port), ADMIN_PASSWORD: 'test-match-fallback' }, extraEnv || {}),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', d => log += d.toString());
  child.stderr.on('data', d => log += d.toString());
  return { child, getLog: () => log };
}

function commonMocks(window, base) {
  window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.MutationObserver = class { observe(){} disconnect(){} };
  window.requestAnimationFrame = cb => setTimeout(cb, 0);
  window.cancelAnimationFrame = () => {};
  window.scrollTo = () => {};
  window.Element.prototype.scrollTo = function () {};
  window.fetch = (u, o) => realFetch(new URL(u, base).toString(), o);
}

// jsdom n'exécute jamais les scripts type="module" — /public/runtime.js
// ne se déclenchera donc jamais via JSDOM.fromURL(). Comme le reste des
// tests de ce projet (overlay d'auth, lightbox), on importe ivory.js
// directement et on appelle render() à la main, avec le vrai Manifest
// récupéré via un vrai fetch.
async function renderIvoryFromServer(base) {
  const manifest = await (await realFetch(`${base}/api/manifest`)).json();
  const dom = new JSDOM('<div id="root"></div>', { url: `${base}/` });
  commonMocks(dom.window, base);
  const ivory = await import(path.join(ROOT, 'public', 'renderers', 'ivory.js'));
  const root = dom.window.document.getElementById('root');
  ivory.render(manifest, root, {
    submitContact: async () => ({ ok: true }),
    submitMood: async () => ({ ok: true }),
    trackPageView() {},
    trackMatchResult() {}
  });
  return { dom, manifest };
}

async function publishWithoutFaq(base, token) {
  const content = await (await realFetch(`${base}/api/content`, { headers: { 'x-admin-token': token } })).json();
  content.faqEntries = [];
  await realFetch(`${base}/api/content`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(content)
  });
  await realFetch(`${base}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
}

async function publishWithRealFaq(base, token) {
  const content = await (await realFetch(`${base}/api/content`, { headers: { 'x-admin-token': token } })).json();
  content.faqEntries = [{
    id: 'q-real-test',
    title: 'Est-ce que le parking sera toujours disponible ?',
    answer: 'Oui, le parking reste disponible sans changement après le déménagement.',
    status: 'confirmed', statusLabel: 'Confirmé', category: 'Logistique',
    keywords: ['parking', 'stationnement', 'voiture'],
    phrases: [], intentSignals: [], emotionSignals: [], negativeSignals: [], priority: 5
  }];
  await realFetch(`${base}/api/content`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(content)
  });
  await realFetch(`${base}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
}

async function askQuestion(dom, question) {
  const doc = dom.window.document;
  const input = doc.getElementById('tct-question-input');
  if (!input) throw new Error('Champ de question introuvable dans le rendu.');
  input.value = question;
  doc.getElementById('tct-ask-btn').click();
  await new Promise(r => setTimeout(r, 400));
  return doc.getElementById('tct-question-result');
}

async function main() {
  console.log('=== Storm Match — repli cantonné au mode démo/dev explicite ===\n');

  console.log('--- Scénario A : mode par défaut (aucune variable d\'environnement) ---');
  const portA = 3097;
  const baseA = `http://localhost:${portA}`;
  const serverA = startServer(portA, {});
  let domA;
  try {
    await waitForServer(baseA, 8000);
    const loginA = await (await realFetch(`${baseA}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-match-fallback' })
    })).json();
    await publishWithoutFaq(baseA, loginA.token);

    const manifestA = await (await realFetch(`${baseA}/api/manifest`)).json();
    check('meta.demoMode est bien false par défaut (aucune variable d\'environnement)', manifestA.meta.demoMode === false);

    domA = (await renderIvoryFromServer(baseA)).dom;

    const resultBox = await askQuestion(domA, 'Quand aura lieu le déménagement ?');
    check('aucune FAQ réelle + mode par défaut : la question qui aurait matché le repli fictif reçoit l\'abstention',
      resultBox.innerHTML.includes('tct-question-unknown'));
    check('la réponse fictive du repli n\'apparaît jamais ("Les modalités précises")',
      !resultBox.innerHTML.includes('Les modalités précises') && !domA.window.document.body.innerHTML.includes('date-demenagement'));

    const questionsListHtml = domA.window.document.getElementById('questions')?.innerHTML || '';
    check('la liste "Questions fréquentes" ne montre aucune question fictive (section absente ou vide)',
      !questionsListHtml.includes('tct-featured-questions'));

  } finally {
    try { domA?.window.close(); } catch (e) {}
    serverA.child.kill('SIGKILL');
  }

  console.log('\n--- Scénario B : mode démo/dev explicite (STORM_MATCH_DEMO_FALLBACK=1) ---');
  const portB = 3098;
  const baseB = `http://localhost:${portB}`;
  const serverB = startServer(portB, { STORM_MATCH_DEMO_FALLBACK: '1' });
  let domB;
  try {
    await waitForServer(baseB, 8000);
    const loginB = await (await realFetch(`${baseB}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-match-fallback' })
    })).json();
    await publishWithoutFaq(baseB, loginB.token);

    const manifestB = await (await realFetch(`${baseB}/api/manifest`)).json();
    check('meta.demoMode est bien true quand la variable d\'environnement est positionnée', manifestB.meta.demoMode === true);

    domB = (await renderIvoryFromServer(baseB)).dom;

    const resultBoxB = await askQuestion(domB, 'Quand aura lieu le déménagement ?');
    check('mode démo explicite : la même question retrouve bien le repli (comportement volontairement conservé)',
      resultBoxB.innerHTML.includes('date-demenagement') || /Les modalités/.test(resultBoxB.innerHTML) || resultBoxB.innerHTML.includes('déménagement'));
    check('mode démo explicite : ce n\'est PAS l\'état d\'abstention qui s\'affiche ici',
      !resultBoxB.innerHTML.includes('tct-question-unknown'));

  } finally {
    try { domB?.window.close(); } catch (e) {}
    serverB.child.kill('SIGKILL');
  }

  console.log('\n--- Scénario C : une vraie FAQ publiée est utilisée, indépendamment du mode démo ---');
  const portC = 3099;
  const baseC = `http://localhost:${portC}`;
  const serverC = startServer(portC, {});
  let domC;
  try {
    await waitForServer(baseC, 8000);
    const loginC = await (await realFetch(`${baseC}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-match-fallback' })
    })).json();
    await publishWithRealFaq(baseC, loginC.token);

    const manifestC = await (await realFetch(`${baseC}/api/manifest`)).json();
    check('une vraie FAQ publiée est bien présente dans le Manifest', manifestC.content.questions.items.length === 1);

    domC = (await renderIvoryFromServer(baseC)).dom;

    const resultBoxC = await askQuestion(domC, 'le parking sera toujours là ?');
    check('une vraie question trouve bien la vraie réponse publiée (mode démo désactivé)',
      resultBoxC.innerHTML.includes('parking reste disponible'));
    check('aucune trace du repli fictif quand une vraie FAQ existe',
      !resultBoxC.innerHTML.includes('date-demenagement'));

  } finally {
    try { domC?.window.close(); } catch (e) {}
    serverC.child.kill('SIGKILL');
  }

  console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
  process.exitCode = failed > 0 ? 1 : 0;
  process.exit(process.exitCode);
}

main().catch(err => {
  console.error('ERREUR DE TEST :', err.message, '\n', err.stack);
  process.exit(1);
});
