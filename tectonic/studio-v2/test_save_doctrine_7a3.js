const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../tectonic/studio.html'), 'utf8') + fs.readFileSync(path.join(__dirname, '../../tectonic/studio.js'), 'utf8');
const checks = [
  ['autosave debounce', html.includes("setTimeout(() => studioRunSave('auto'), 900)")],
  ['manual ctrl s', html.includes("String(e.key).toLowerCase() !== 's'") && html.includes("studioRunSave('manual')")],
  ['save states', ['Enregistrement…','Enregistrement impossible','Modifications en cours','Tout est enregistré'].every(x => html.includes(x))],
  ['saving state css', html.includes('.studio-save-state.is-saving')],
  ['error state css', html.includes('.studio-save-state.is-error')],
  ['context save dock', html.includes('studioContextSaveDock') && html.includes('studioContextSaveBtn')],
  ['hero intersection observer', html.includes('new IntersectionObserver') && html.includes('studioSaveObserver.observe(heroButton)')],
  ['identity save in hero', html.includes('studio-identity-domain-head') && html.includes('id="saveIdentityBtn">Enregistrer les réglages</button>')],
  ['identity floating bar removed', !html.includes('<div class="studio-identity-savebar">')],
  ['save publish separation', html.includes('studio-topbar-actions') && !/studio-topbar-actions[\s\S]{0,900}saveIdentityBtn/.test(html)],
  ['autosave silent success', html.includes("if (!isAuto) showToast(successMessage)")],
  ['autosave source propagated', html.includes("saveSource = document.body.dataset.studioSaveSource || 'manual'")],
  ['autosave avoids project rerender', html.includes("if (result.saveSource !== 'auto') render();")],
  ['publish blocked while saving/dirty', html.includes('studioPublishBtn.disabled = !ui.canPublish || studioSaveDirty')],
  ['domain save map', ['identity','project','news','spaces','questions','ambassadors'].every(x => html.includes(`${x}:`))],
  ['dock transition fast', html.includes('transition:grid-template-rows .15s')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('ÉCHEC — Studio Save Doctrine 7A.3');
  failed.forEach(([name]) => console.error(' -', name));
  process.exit(1);
}
console.log(`OK — Studio Save Doctrine 7A.3 : ${checks.length} vérifications validées.`);
