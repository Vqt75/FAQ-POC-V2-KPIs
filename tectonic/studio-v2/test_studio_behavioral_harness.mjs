// Harnais comportemental jsdom — Studio actuel (index.html), avant toute
// extraction. Exécute RÉELLEMENT le JavaScript du Studio (runScripts:
// 'dangerously'), pas une recherche de texte — c'est précisément ce qui
// manquait avant ce lot (confirmé par l'audit : aucun test existant
// n'exerçait le client Studio, seulement des string-matches sur le
// code source).
//
// Portée : chargement, routing entre panneaux, édition d'un champ réel,
// sauvegarde, état de publication, persistance après rechargement.
// Aucun changement UX/UI. Aucun refactor. Les doublons FAQ/Mood dans
// Pangea (legacy, gelés) ne sont pas concernés par ce harnais.
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3093;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-studio-harness';
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

async function loadAdminDom(token) {
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
  if (token) dom.window.sessionStorage.setItem('xyz_admin_token', token);
  await new Promise(r => setTimeout(r, 900));
  return dom;
}

function fireInput(el, value) {
  el.value = value;
  const event = new el.ownerDocument.defaultView.Event('input', { bubbles: true });
  el.dispatchEvent(event);
}

async function main() {
  console.log('=== Harnais comportemental Studio — exécution JS réelle ===\n');

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
    const loginRes = await realFetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    const { token } = await loginRes.json();

    console.log('--- 1) Chargement : ouverture réelle de l\'admin, exécution JS confirmée ---');
    let dom = await loadAdminDom(token);
    let doc = dom.window.document;
    doc.getElementById('adminLinkBtn').click();
    await new Promise(r => setTimeout(r, 900));
    check('page-admin devient active après clic (JS réellement exécuté, pas un texte statique)',
      doc.getElementById('page-admin').classList.contains('active'));
    check('le panneau Overview est visible par défaut',
      !doc.getElementById('adminPanelOverview').classList.contains('hidden'));

    console.log('\n--- 2) Routing : navigation réelle entre panneaux Studio ---');
    const identityNav = doc.querySelector('[data-studio-route="identity"]');
    check('bouton de navigation "identity" trouvé dans le DOM réel', !!identityNav);
    identityNav.click();
    await new Promise(r => setTimeout(r, 300));
    check('panneau Content (Identité) visible après clic sur sa route',
      !doc.getElementById('adminPanelContent').classList.contains('hidden'));
    check('panneau Overview masqué après avoir changé de route',
      doc.getElementById('adminPanelOverview').classList.contains('hidden'));

    const projectNav = doc.querySelector('[data-studio-route="project"]');
    projectNav.click();
    await new Promise(r => setTimeout(r, 300));
    check('routing fonctionne pour un second panneau ("Le projet")',
      !doc.getElementById('adminPanelProject').classList.contains('hidden') &&
      doc.getElementById('adminPanelContent').classList.contains('hidden'));

    // Retour sur Identité pour la suite du scénario (édition/save réels).
    identityNav.click();
    await new Promise(r => setTimeout(r, 300));

    console.log('\n--- 3) Édition réelle d\'un champ + 4) Sauvegarde réelle ---');
    const nameInput = doc.getElementById('brandingNameInput');
    check('champ nom de projet trouvé', !!nameInput);
    const newName = 'Projet Harnais Comportemental ' + Date.now();
    fireInput(nameInput, newName);
    await new Promise(r => setTimeout(r, 100));
    check('la barre de titre admin reflète la frappe en temps réel (état local mis à jour par le vrai JS)',
      doc.getElementById('adminProjectName')?.textContent === newName);

    const saveBtn = doc.getElementById('saveIdentityBtn');
    check('bouton "Enregistrer" du panneau Identité trouvé', !!saveBtn);
    saveBtn.click();
    await new Promise(r => setTimeout(r, 900));

    const savedContent = await (await realFetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    check('la sauvegarde a réellement persisté côté serveur (pas seulement en mémoire côté client)',
      savedContent.branding.projectName === newName);

    console.log('\n--- 5) État de publication : reflète correctement les modifications non publiées ---');
    await new Promise(r => setTimeout(r, 500));
    const stateEl = doc.getElementById('studioPublicationState');
    check('le statut affiche "modifications non publiées" après une sauvegarde sans publication',
      stateEl && stateEl.textContent.toLowerCase().includes('non publi'));

    const publishBtn = doc.getElementById('studioPublishBtn');
    check('bouton Publier trouvé et activé (les modifications sont enregistrées, donc publiables)',
      !!publishBtn && !publishBtn.disabled);
    publishBtn.click();
    await new Promise(r => setTimeout(r, 1200));
    const stateAfterPublish = doc.getElementById('studioPublicationState');
    check('le statut ne montre plus "modifications non publiées" après un vrai clic sur Publier',
      stateAfterPublish && !stateAfterPublish.textContent.toLowerCase().includes('non publi'));

    // Confirmation indépendante côté serveur que la publication a bien eu lieu.
    const manifestAfterPublish = await realFetch(`${BASE}/api/manifest`);
    check('data/manifest.json existe réellement après ce clic Publier (pas juste un changement visuel)',
      manifestAfterPublish.status === 200);
    const manifestBody = await manifestAfterPublish.json();
    check('le Manifest publié reflète bien le nouveau nom de projet',
      manifestBody.project.name === newName);

    console.log('\n--- 6) Persistance : un rechargement complet retrouve la même valeur ---');
    const dom2 = await loadAdminDom(token);
    const doc2 = dom2.window.document;
    doc2.getElementById('adminLinkBtn').click();
    await new Promise(r => setTimeout(r, 900));
    doc2.querySelector('[data-studio-route="identity"]').click();
    await new Promise(r => setTimeout(r, 400));
    const nameInputAfterReload = doc2.getElementById('brandingNameInput');
    check('après un rechargement complet de la page, le champ affiche bien la valeur sauvegardée',
      nameInputAfterReload && nameInputAfterReload.value === newName);

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;

    // Fermeture explicite des fenêtres jsdom — sans ça, un timer résiduel
    // côté Studio (autosave programmée, etc.) peut maintenir le
    // processus Node en vie indéfiniment malgré l'affectation de
    // process.exitCode.
    try { dom.window.close(); } catch (e) { /* déjà fermée ou jamais ouverte */ }
    try { dom2.window.close(); } catch (e) { /* déjà fermée ou jamais ouverte */ }

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
