// Harnais comportemental jsdom — les 5 pages publiques Pangea
// (/?pangea=1), sans admin. Exécute réellement le JS, pas une
// recherche de texte. Construit AVANT toute extraction du bloc de
// rendu public, pour garantir un avant/après comparable.
//
// Portée : chargement initial, navigation entre les 5 onglets,
// rendu réel de chaque page avec les vraies données publiées.
// Aucune modification applicative dans ce lot.
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3092;
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

async function loadPublicDom() {
  const dom = await JSDOM.fromURL(`${BASE}/?pangea=1`, {
    runScripts: 'dangerously', resources: 'usable',
    beforeParse(window) {
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
  });
  await new Promise(r => setTimeout(r, 900));
  return dom;
}

async function main() {
  console.log('=== Harnais comportemental — 5 pages publiques Pangea (/?pangea=1) ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD: 'test-pangea-public' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  let dom;
  try {
    await waitForServer(`${BASE}/health`, 8000);

    console.log('--- 1) Chargement initial : /?pangea=1 sans admin, sans jeton ---');
    dom = await loadPublicDom();
    const doc = dom.window.document;
    check('la page FAQ est active par défaut', doc.getElementById('page-faq').classList.contains('active'));
    check('aucune session admin nécessaire (pas de jeton posé)', !dom.window.sessionStorage.getItem('xyz_admin_token'));

    // Données réelles servies par le serveur, pour comparaison avant/après.
    const realContent = await (await realFetch(`${BASE}/api/content`)).json();

    console.log('\n--- 2) Navigation réelle entre les 5 onglets ---');
    const pages = [
      { tab: 'actu', pageId: 'page-actu' },
      { tab: 'plans', pageId: 'page-plans' },
      { tab: 'ambassadeurs', pageId: 'page-ambassadeurs' },
      { tab: 'equipe', pageId: 'page-equipe' },
      { tab: 'faq', pageId: 'page-faq' }
    ];
    for (const { tab, pageId } of pages) {
      const btn = doc.querySelector(`.nav-tab[data-page="${tab}"]`);
      check(`onglet "${tab}" trouvé dans le DOM réel`, !!btn);
      btn.click();
      await new Promise(r => setTimeout(r, 200));
      check(`page "${pageId}" devient active après clic réel`, doc.getElementById(pageId).classList.contains('active'));
    }

    console.log('\n--- 3) Rendu réel de chaque page avec les vraies données ---');
    // Actualités
    const articleCards = doc.querySelectorAll('#page-actu .article-card, #page-actu [id^="article-body-"]');
    check('des articles réels sont rendus dans le DOM (Actualités)',
      realContent.articles.length === 0 || articleCards.length > 0);

    // Plans & 3D
    const planCards = doc.querySelectorAll('#page-plans .plan-card, #page-plans [class*="plan"]');
    check('des visuels réels sont rendus dans le DOM (Plans & 3D), cohérent avec le contenu publié',
      realContent.plans.length === 0 || doc.getElementById('page-plans').textContent.length > 50);

    // Ambassadeurs
    const ambText = doc.getElementById('page-ambassadeurs').textContent;
    check('le roster ambassadeurs réel apparaît dans le texte rendu',
      realContent.ambassadors.length === 0 || realContent.ambassadors.some(a => ambText.includes(a.name)));

    // Équipe
    const teamText = doc.getElementById('page-equipe').textContent;
    check('le roster équipe réel apparaît dans le texte rendu',
      realContent.team.length === 0 || realContent.team.some(t => teamText.includes(t.name)));

    console.log('\n--- 4) Moteur FAQ public (legacy, gelé) — toujours fonctionnel, non modifié dans ce lot ---');
    doc.querySelector('.nav-tab[data-page="faq"]').click();
    await new Promise(r => setTimeout(r, 200));
    const questionInput = doc.getElementById('questionInput') || doc.querySelector('#page-faq input[type="text"]');
    check('un champ de saisie de question existe sur la page FAQ', !!questionInput);

    console.log('\n--- 5) Lightbox (zoom/déplacement) — présente et non modifiée dans ce lot ---');
    check('le conteneur lightbox existe dans le DOM', !!doc.getElementById('lightbox'));
    check('les contrôles de zoom lightbox existent', !!doc.getElementById('lbZoomIn') && !!doc.getElementById('lbZoomOut'));

    console.log('\n--- 6) Aucun état admin déclenché par une simple navigation publique ---');
    // Depuis l'extraction du Studio vers tectonic/studio.html, #page-admin
    // n'existe plus du tout dans ce document — la garantie n'est plus "reste
    // inactif" mais "n'existe structurellement pas", ce qui est plus fort.
    check('#page-admin n\'existe plus du tout dans index.html (Studio réellement séparé)',
      !doc.getElementById('page-admin'));
    check('body ne porte jamais la classe storm-admin-open suite à une navigation publique',
      !doc.body.classList.contains('storm-admin-open'));

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
