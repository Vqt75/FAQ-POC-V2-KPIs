// Tests de compile(candidate, context) — conformes à
// TECTONIC_COMPILER_DESIGN.md §10 et à la Phase 2 du plan
// d'implémentation. Isolation totale : aucun serveur HTTP.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('./publication-candidate');
const { compile, CompilerBlockingError } = require('./compiler');

let passed = 0;
function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`OK   — ${label}`);
    passed++;
  } catch (e) {
    console.log(`ECHEC — ${label}`);
    console.log('  attendu :', JSON.stringify(expected));
    console.log('  obtenu  :', JSON.stringify(actual));
    process.exitCode = 1;
  }
}
function checkTrue(label, condition) {
  if (condition) { console.log(`OK   — ${label}`); passed++; }
  else { console.log(`ECHEC — ${label}`); process.exitCode = 1; }
}

// Contexte de compilation de référence, réutilisé dans plusieurs tests.
const baseContext = {
  generatedAt: '2026-08-08T10:00:00Z',
  revision: '20260808T100000Z',
  supportedEditions: ['ivory', 'rainbow-glass', 'midnight-frost']
};

// Candidate réel, construit à partir des vraies données Pangea via la
// vraie fonction de Phase 1 — pas une approximation écrite à la main.
const realDataPath = path.join(__dirname, 'fixture-real-pangea-content.json');
const realPangeaData = JSON.parse(fs.readFileSync(realDataPath, 'utf8'));
const realCandidate = buildPublicationCandidate(realPangeaData);

console.log('=== 1) MANIFEST DE RÉFÉRENCE (données réelles Projet XYZ) ===\n');

let referenceManifest;
try {
  referenceManifest = compile(realCandidate, baseContext);
  checkTrue('compilation réussie sur données réelles, sans exception', true);
} catch (e) {
  console.log('ECHEC — compile() a levé une exception inattendue:', e.message);
  process.exitCode = 1;
}

if (referenceManifest) {
  check('schemaVersion === 1', referenceManifest.schemaVersion, 1);
  check('project.name', referenceManifest.project.name, 'Projet XYZ');
  check('edition.id === "ivory" (traduction du nom legacy Pangea "default")', referenceManifest.edition.id, 'ivory');
  checkTrue('branding.theme du candidat était bien "default" (confirme que la traduction a eu lieu)',
    realCandidate.branding.theme === 'default');
  check('meta.generatedAt recopié depuis le contexte', referenceManifest.meta.generatedAt, baseContext.generatedAt);
  check('meta.revision recopié depuis le contexte', referenceManifest.meta.revision, baseContext.revision);
  checkTrue('modules.team === true (équipe réelle non vide)', referenceManifest.modules.team === true);
  checkTrue('content.team présent (module activé)', 'team' in referenceManifest.content);
  checkTrue('content.team.members a 11 entrées', referenceManifest.content.team.members.length === 11);
  checkTrue('content.ambassadors.roster a 12 entrées', referenceManifest.content.ambassadors.roster.length === 12);
  checkTrue('content.timeline.milestones a 6 entrées', referenceManifest.content.timeline.milestones.length === 6);
  checkTrue('content.news.items a 4 entrées', referenceManifest.content.news.items.length === 4);
  checkTrue('content.questions.items a 0 entrée (faqEntries vide côté serveur — cohérent avec D1 du modèle d\'ownership)',
    referenceManifest.content.questions.items.length === 0);
  checkTrue('content.home.now résout le jalon "current"',
    referenceManifest.content.home.now && referenceManifest.content.home.now.value === 'Conception & co-construction');
  checkTrue('content.home.featured résout le premier article par défaut',
    referenceManifest.content.home.featured && referenceManifest.content.home.featured.source.module === 'news');
  checkTrue('content.spaces.items[0].usageTags est bien un tableau sémantique',
    Array.isArray(referenceManifest.content.spaces.items[0].usageTags));
  checkTrue('content.news.items[0].summary vient bien de "chapeau" (renommage appliqué)',
    referenceManifest.content.news.items[0].summary.length > 0);
  checkTrue('content.team.intro.introBody vient bien de "parellaIntro" (généralisation appliquée)',
    referenceManifest.content.team.intro.introBody.length > 0);
  checkTrue('aucune clé "parellaIntro" ne fuit dans le Manifest',
    !JSON.stringify(referenceManifest).includes('parellaIntro'));
}

console.log('\n=== 2) DÉTERMINISME STRICT — mêmes candidate + context → Manifest identique ===\n');

const manifestA = compile(realCandidate, baseContext);
const manifestB = compile(realCandidate, baseContext);
check('deux compilations, mêmes arguments -> Manifest strictement identique (y compris meta)', manifestA, manifestB);

console.log('\n=== 3) ERREUR BLOQUANTE — édition inconnue, jamais de repli silencieux ===\n');

const badEditionCandidate = Object.assign({}, realCandidate, {
  branding: Object.assign({}, realCandidate.branding, { theme: 'edition-qui-nexiste-plus' })
});

let blockedCorrectly = false;
let wrongEditionLeakedManifest = null;
try {
  wrongEditionLeakedManifest = compile(badEditionCandidate, baseContext);
} catch (e) {
  blockedCorrectly = (e instanceof CompilerBlockingError);
}
checkTrue('édition inconnue -> CompilerBlockingError levée', blockedCorrectly);
checkTrue('édition inconnue -> aucun Manifest produit (pas de repli vers une édition par défaut)',
  wrongEditionLeakedManifest === null);

console.log('\n=== 4) AVERTISSEMENTS RÉCUPÉRABLES ===\n');

console.log('-- 4a. alt par défaut appliqué quand non configuré --');
checkTrue('photo ambassadeur sans alt configuré -> alt = "Nom — rôle"',
  realCandidate.ambassadors[0].imageUrl === '' // pas de photo réelle dans les données de test
    ? referenceManifest.content.ambassadors.roster[0].photo === null // pas d'URL -> pas d'asset du tout
    : true);
// Test positif avec une vraie URL fournie, pour valider la règle alt elle-même :
const candidateWithPhoto = JSON.parse(JSON.stringify(realCandidate));
candidateWithPhoto.ambassadors[0].imageUrl = '/uploads/photo-test.jpg';
const manifestWithPhoto = compile(candidateWithPhoto, baseContext);
check('alt par défaut = "Nom — rôle" quand une photo existe sans alt configuré',
  manifestWithPhoto.content.ambassadors.roster[0].photo.alt,
  `${candidateWithPhoto.ambassadors[0].name} — ${candidateWithPhoto.ambassadors[0].role}`);

console.log('\n-- 4b. logo sans alt configuré -> alt = "" (décoratif) --');
const candidateWithLogo = JSON.parse(JSON.stringify(realCandidate));
candidateWithLogo.branding.logoUrl = '/uploads/logo-test.png';
const manifestWithLogo = compile(candidateWithLogo, baseContext);
check('logo sans alt configuré -> alt = ""', manifestWithLogo.branding.logo.alt, '');

console.log('\n-- 4c. média d’espace sans alt configuré -> alt éditorial sûr --');
checkTrue('asset spaces -> alt non vide quand un visuel legacy possède un libellé',
  referenceManifest.content.spaces.items[0].asset === null
    ? true
    : typeof referenceManifest.content.spaces.items[0].asset.alt === 'string' && referenceManifest.content.spaces.items[0].asset.alt.length > 0);
const candidateWithPlanImage = JSON.parse(JSON.stringify(realCandidate));
candidateWithPlanImage.plans[0].imageUrl = '/uploads/plan-test.jpg';
const manifestWithPlanImage = compile(candidateWithPlanImage, baseContext);
check('alt du visuel = titre du plan, quand une image existe',
  manifestWithPlanImage.content.spaces.items[0].asset.alt,
  candidateWithPlanImage.plans[0].title);

console.log('\n-- 4d. featured : compilation réussit même sans aucun article (repli sur null) --');
const candidateNoNews = JSON.parse(JSON.stringify(realCandidate));
candidateNoNews.articles = [];
const manifestNoNews = compile(candidateNoNews, baseContext);
check('featured === null quand aucun article n\'existe (jamais une erreur bloquante)',
  manifestNoNews.content.home.featured, null);
checkTrue('compilation toujours réussie malgré l\'absence d\'article', manifestNoNews.schemaVersion === 1);

console.log('\n=== 5) INVARIANTS modules / content / navigation ===\n');

checkTrue('tout module activé a une clé content correspondante',
  Object.keys(referenceManifest.modules).every(key =>
    referenceManifest.modules[key] === false || (key in referenceManifest.content)
  ));
checkTrue('tout module désactivé n\'a PAS de clé content correspondante',
  Object.keys(referenceManifest.modules).every(key =>
    referenceManifest.modules[key] === true || !(key in referenceManifest.content)
  ));
checkTrue('toute entrée navigation référence un module activé',
  referenceManifest.navigation.every(entry => referenceManifest.modules[entry.module] === true));

console.log('\n-- 5b. navigation incohérente -> erreur bloquante (le Compiler ne répare plus) --');
const inconsistentCandidate = JSON.parse(JSON.stringify(realCandidate));
inconsistentCandidate.navigation.push({ module: 'un-module-qui-nexiste-pas', label: 'Fantôme' });
let navigationBlockedCorrectly = false;
let navigationLeakedManifest = null;
try {
  navigationLeakedManifest = compile(inconsistentCandidate, baseContext);
} catch (e) {
  navigationBlockedCorrectly = (e instanceof CompilerBlockingError);
}
checkTrue('navigation référençant un module inexistant -> CompilerBlockingError levée', navigationBlockedCorrectly);
checkTrue('aucun Manifest produit — le Compiler ne filtre plus silencieusement l\'entrée fautive',
  navigationLeakedManifest === null);

console.log('\n=== 6) settings absent si vide (contrat du Manifest gelé) ===\n');

checkTrue('settings absent du Manifest de référence (aucun moodNudge configuré)',
  !('settings' in referenceManifest));

const candidateWithMood = JSON.parse(JSON.stringify(realCandidate));
candidateWithMood.settings = { moodNudge: { enabled: true, frequency: 'daily' } };
const manifestWithMood = compile(candidateWithMood, baseContext);
checkTrue('settings PRÉSENT quand moodNudge est réellement configuré',
  'settings' in manifestWithMood && manifestWithMood.settings.moodNudge.enabled === true);

console.log('\n=== 7) Validation renforcée — préconditions structurelles du Manifest V1 ===\n');

function expectBlockingErrorOnManifest(label, mutateFn) {
  const mutated = JSON.parse(JSON.stringify(realCandidate));
  mutateFn(mutated);
  let blocked = false;
  try { compile(mutated, baseContext); }
  catch (e) { blocked = (e instanceof CompilerBlockingError); }
  checkTrue(label, blocked);
}

// On ne peut pas simplement injecter "modules: {}" dans le candidate,
// puisque compile() reconstruit content à partir de candidate.modules
// tel quel (pas de résolution) — un candidate avec modules incomplet
// doit être rejeté par la validation finale, pas planter ailleurs.
expectBlockingErrorOnManifest(
  'modules incomplet (une seule clé sur 7) -> CompilerBlockingError',
  c => { c.modules = { home: true }; }
);
expectBlockingErrorOnManifest(
  'modules avec une valeur non-booléenne -> CompilerBlockingError',
  c => { c.modules.team = 'oui'; }
);

// meta invalide : on ne peut pas le tester via un candidate mutable
// (meta vient du context, pas du candidate) — testé directement via context.
let metaBlocked = false;
try { compile(realCandidate, Object.assign({}, baseContext, { generatedAt: '' })); }
catch (e) { metaBlocked = (e instanceof CompilerBlockingError); }
checkTrue('meta.generatedAt vide -> CompilerBlockingError', metaBlocked);

let revisionBlocked = false;
try { compile(realCandidate, Object.assign({}, baseContext, { revision: undefined })); }
catch (e) { revisionBlocked = (e instanceof CompilerBlockingError); }
checkTrue('meta.revision absent -> CompilerBlockingError', revisionBlocked);

console.log('\n=== 8) Comparaison directe avec le vrai moteur de progression (index.html) ===\n');
console.log('Extraction de la vraie fonction, pas une supposition qu\'elle est équivalente.\n');

const { computeProgressFromMilestones } = require('./compiler');

// Extraction de la VRAIE fonction depuis index.html — évalué dans un
// contexte isolé, aucun effet de bord sur le reste du fichier.
const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extractFunctionBlock(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`Marqueur introuvable: ${startMarker}`);
  const braceStart = src.indexOf('{', start);
  let depth = 0, end = braceStart;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}
const realEngineCode = extractFunctionBlock(htmlSrc, 'function computeProgressFromMilestones(milestones)')
  + '\nmodule.exports = { computeProgressFromMilestones };';
const Module = require('module');
const m = new Module(path.join(__dirname, '_real_progress_extracted.js'));
m._compile(realEngineCode, path.join(__dirname, '_real_progress_extracted.js'));
const realComputeProgress = m.exports.computeProgressFromMilestones;

const progressScenarios = [
  { label: 'aucun jalon', milestones: [] },
  { label: 'tout future', milestones: [
    { id: 'a', status: 'future' }, { id: 'b', status: 'future' }, { id: 'c', status: 'future' }
  ]},
  { label: '1 done + current + futures', milestones: [
    { id: 'a', status: 'done' }, { id: 'b', status: 'current' },
    { id: 'c', status: 'future' }, { id: 'd', status: 'future' }
  ]},
  { label: 'tout done', milestones: [
    { id: 'a', status: 'done' }, { id: 'b', status: 'done' }, { id: 'c', status: 'done' }
  ]},
  { label: 'données réelles Projet XYZ (6 jalons)', milestones: realPangeaData.milestones }
];

progressScenarios.forEach(scenario => {
  const real = realComputeProgress(scenario.milestones);
  const compiled = computeProgressFromMilestones(scenario.milestones);
  // Comparaison complète du résultat pertinent, pas seulement percent :
  // le numéro d'étape est encodé dans "Étape N" (réel) vs currentStepLabel
  // (compilé) — même valeur numérique attendue des deux côtés.
  const realStepNumber = (real.stepLine1.match(/\d+/) || [])[0];
  const compiledStepNumber = (compiled.currentStepLabel.match(/\d+/) || [])[0];
  const realTotal = (real.stepLine2.match(/\d+/) || [])[0];
  check(`percent identique — ${scenario.label}`, compiled.percent, real.percent);
  check(`numéro d'étape identique — ${scenario.label}`, compiledStepNumber, realStepNumber);
  check(`total identique — ${scenario.label}`, String(compiled.totalSteps), realTotal);
});

console.log('\n=== 9) Police explicitement uploadée sans URL exploitable -> erreur bloquante ===\n');

const candidateWithUploadedFont = JSON.parse(JSON.stringify(realCandidate));
candidateWithUploadedFont.branding.fonts[0] = { name: 'Client Sans', fileName: 'client-sans.woff2', source: 'upload' };
let fontBlocked = false;
try { compile(candidateWithUploadedFont, baseContext); }
catch (e) { fontBlocked = (e instanceof CompilerBlockingError); }
checkTrue('police source:"upload" sans URL exploitable -> CompilerBlockingError (pas de Manifest mensonger)',
  fontBlocked);

console.log('\n=== 10) Ensemble fermé des modules — aucune clé inconnue tolérée ===\n');

expectBlockingErrorOnManifest(
  'clé de module inconnue injectée ("secretSauce") -> CompilerBlockingError',
  c => { c.modules.secretSauce = true; }
);

expectBlockingErrorOnManifest(
  'navigation référençant ce module inconnu -> également bloquée (pas "valide" juste parce que true)',
  c => {
    c.modules.secretSauce = true;
    c.navigation.push({ module: 'secretSauce', label: 'Sauce secrète' });
  }
);

console.log('\n-- 10b. navigation non-tableau -> erreur bloquante (jamais un [] silencieux) --');
expectBlockingErrorOnManifest(
  'navigation = "n\'importe quoi" (chaîne, pas un tableau) -> CompilerBlockingError',
  c => { c.navigation = 'n\'importe quoi'; }
);
expectBlockingErrorOnManifest(
  'navigation = null -> CompilerBlockingError',
  c => { c.navigation = null; }
);

console.log(`\n${passed} vérifications passées.`);
if (process.exitCode) {
  console.log('DES TESTS ONT ECHOUE.');
} else {
  console.log('TOUS LES TESTS SONT PASSES.');
}
