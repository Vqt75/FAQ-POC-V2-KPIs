const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'tectonic', 'studio.html'), 'utf8') + fs.readFileSync(path.join(root, 'tectonic', 'studio.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const routes = [
  ['overview', 'Vue d’ensemble'],
  ['project', 'Le projet'],
  ['news', 'Actualités'],
  ['spaces', 'Espaces'],
  ['questions', 'Questions'],
  ['ambassadors', 'Ambassadeurs'],
  ['identity', 'Identité &amp; apparence'],
  ['pilotage', 'Pilotage']
];

for (const [route, label] of routes) {
  assert(html.includes(`data-studio-route="${route}"`), `Route Studio manquante: ${route}`);
  assert(html.includes(label), `Libellé Studio manquant: ${label}`);
}

assert(html.includes('id="adminPanelOverview"'), 'Vue d’ensemble Studio absente');
assert(html.includes('id="studioSaveState"'), 'État de sauvegarde absent');
assert(html.includes('id="studioPublicationState"'), 'État de publication absent');
assert(html.includes('id="studioPreviewBtn"'), 'Bouton Aperçu absent');
assert(html.includes('id="studioPublishBtn"'), 'Bouton Publier absent');
assert(html.includes("'/api/admin/publication-status'"), 'Le shell ne lit pas publication-status');
assert(html.includes("'/api/admin/publish'"), 'Le shell ne déclenche pas Publish');
assert(html.includes('Modifications non publiées'), 'État produit "Modifications non publiées" absent');
assert(html.includes('Tout est publié'), 'État produit "Tout est publié" absent');


// Garde-fous d'état : une saisie locale bloque Publish, une sauvegarde réussie réarme l'état.
assert(html.includes("studioSetSaveState('dirty')"), 'Le shell ne détecte pas les modifications locales');
assert(html.includes("studioSetSaveState('saved')"), 'Le shell ne sait pas revenir à l’état enregistré');
assert(/if \(result\.ok\) \{\s+studioSetSaveState\('saved'\);/.test(html), 'Une sauvegarde réussie ne remet pas la topbar à jour');
assert(html.includes("studioPublishBtn.disabled = !ui.canPublish || studioSaveDirty"), 'Publish n’est pas protégé contre des modifications non enregistrées');
assert(html.includes("window.open('/?tectonic=1'"), 'Aperçu ne pointe pas vers l’expérience Tectonic publiée');
assert(html.includes("moodEntries: Array.isArray(data.moodEntries)"), 'Le passage de la météo vers Pilotage a régressé');

// Les éléments de démonstration explicitement gelés doivent survivre au shell.
assert(html.includes('id="stormDemoLaunchBtn"'), 'Raccourci de relance de création supprimé');
assert(html.includes('function wavestoneSamplerOptions()'), 'Sampler Wavestone supprimé');
assert(html.includes('#451DC6') && html.includes('#04EF6A'), 'Données de marque Wavestone supprimées');

// Le vieux bouton Publish autonome ne doit plus concurrencer la topbar Studio.
assert(!html.includes('id="adminPublishBtn"'), 'Ancien bouton Publish encore présent');
assert((html.match(/id="studioPublishBtn"/g) || []).length === 1, 'Bouton Publish Studio dupliqué');

// Ponts de migration : séparation mentale maintenant, réécriture métier plus tard.
assert(html.includes('studio-project-only'), 'Pont Le projet manquant');
assert(html.includes('studio-news-only'), 'Pont Actualités manquant');
assert(html.includes('studio-project-team-only'), 'Pont Ambassadeurs/équipe manquant');

console.log('OK — Studio shell 0B: navigation, topbar, publication et garde-fous validés.');
