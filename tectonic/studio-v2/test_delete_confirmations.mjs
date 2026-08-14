// Test comportemental — confirmation avant suppression (jalon de projet
// et membre d'équipe, via l'éditeur "Le projet"), micro-lot Maintenance
// suite à l'audit de suppression Studio.
//
// Contrat vérifié : un Cancel ne doit ni modifier les données, ni
// déclencher markDirty()/autosave. Un Confirm doit supprimer l'objet et
// déclencher le cycle de sauvegarde existant, exactement comme avant ce
// correctif — seule la présence de la boîte de confirmation change.
import { JSDOM, VirtualConsole } from 'jsdom';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-delete-confirm';
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
  console.log('=== Confirmation avant suppression — jalon et membre d\'équipe ===\n');

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

    const vc = new VirtualConsole();
    dom = await JSDOM.fromURL(`${BASE}/admin`, {
      runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
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
        window.sessionStorage.setItem('xyz_admin_token', token);
      }
    });
    await new Promise(r => setTimeout(r, 900));
    const doc = dom.window.document;

    doc.getElementById('adminPasswordInput') && (doc.getElementById('adminModal').classList.remove('open'));
    doc.querySelector('[data-studio-route="project"]')?.click();
    await new Promise(r => setTimeout(r, 500));

    console.log('--- Jalon depuis "Le projet" (section timeline) ---');
    doc.querySelector('[data-project-select="project-timeline"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    const milestoneRemoveBtn = doc.querySelector('[data-project-milestone-remove]');
    check('un bouton de retrait de jalon existe (données de démo réelles)', !!milestoneRemoveBtn);

    if (milestoneRemoveBtn) {
      const beforeCount = doc.querySelectorAll('[data-project-milestone-remove]').length;

      console.log('  Cancel :');
      dom.window.confirm = () => false;
      let saveStateBefore = doc.getElementById('studioSaveState')?.textContent?.trim();
      milestoneRemoveBtn.click();
      await new Promise(r => setTimeout(r, 200));
      const afterCancelCount = doc.querySelectorAll('[data-project-milestone-remove]').length;
      check('Cancel : le nombre de jalons ne change pas', afterCancelCount === beforeCount);
      check('Cancel : aucun passage à l\'état "Modifications en cours"',
        doc.getElementById('studioSaveState')?.textContent?.trim() === saveStateBefore);

      console.log('  Confirm :');
      dom.window.confirm = () => true;
      doc.querySelector('[data-project-milestone-remove]').click();
      await new Promise(r => setTimeout(r, 200));
      const afterConfirmCount = doc.querySelectorAll('[data-project-milestone-remove]').length;
      check('Confirm : un jalon est bien retiré', afterConfirmCount === beforeCount - 1);
      check('Confirm : le cycle de sauvegarde est bien déclenché ("Modifications en cours" ou déjà en cours d\'enregistrement)',
        /Modifications en cours|Enregistrement/.test(doc.getElementById('studioSaveState')?.textContent || ''));
    }

    console.log('\n--- Membre d\'équipe depuis "Le projet" (section team) ---');
    doc.querySelector('[data-project-select="project-team"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    const personRemoveBtn = doc.querySelector('[data-project-person-remove]');
    check('un bouton de retrait de membre d\'équipe existe (données de démo réelles)', !!personRemoveBtn);

    if (personRemoveBtn) {
      const beforeCount = doc.querySelectorAll('[data-project-person-remove]').length;

      console.log('  Cancel :');
      dom.window.confirm = () => false;
      personRemoveBtn.click();
      await new Promise(r => setTimeout(r, 200));
      const afterCancelCount = doc.querySelectorAll('[data-project-person-remove]').length;
      check('Cancel : le nombre de membres ne change pas', afterCancelCount === beforeCount);

      console.log('  Confirm :');
      dom.window.confirm = () => true;
      doc.querySelector('[data-project-person-remove]').click();
      await new Promise(r => setTimeout(r, 200));
      const afterConfirmCount = doc.querySelectorAll('[data-project-person-remove]').length;
      check('Confirm : un membre est bien retiré', afterConfirmCount === beforeCount - 1);
    }

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
