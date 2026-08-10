// Tests de buildPublicationCandidate() — 3 familles, conformes au
// document gelé TECTONIC_PUBLICATION_CANDIDATE.md §6.
// Isolation totale : aucun serveur HTTP, aucun accès disque hors
// lecture de la fixture, aucun effet de bord sur data/ ou uploads/.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('./publication-candidate');

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

console.log('=== FAMILLE 1 : whitelist "piégée" ===');
console.log('Un état autoritaire contenant délibérément des champs interdits');
console.log('doit produire un candidat qui ne les porte JAMAIS, même présents en entrée.\n');

const poisonedSnapshot = {
  branding: { projectName: 'Test', logoUrl: '', theme: 'default', colors: ['#111111', '#222222'], fonts: [] },
  publicContent: {},
  milestones: [],
  articles: [],
  plans: [],
  ambassadorsContent: {},
  ambassadors: [],
  teamContent: {},
  team: [],
  faqEntries: [],
  // Champs interdits, injectés volontairement dans la source :
  faqDrafts: [{ id: 'draft-secret', title: 'Ne doit jamais sortir' }],
  kpis: { contactSubmissions: [{ name: 'Personne', email: 'x@y.z' }] },
  adminToken: 'secret-token-ne-doit-jamais-fuiter',
  contactSubmissions: [{ name: 'Fuite potentielle', email: 'a@b.c', message: '...' }]
};

const poisonedCandidate = buildPublicationCandidate(poisonedSnapshot);

checkTrue('faqDrafts absent du candidat', !('faqDrafts' in poisonedCandidate));
checkTrue('kpis absent du candidat', !('kpis' in poisonedCandidate));
checkTrue('adminToken absent du candidat', !('adminToken' in poisonedCandidate));
checkTrue('contactSubmissions absent du candidat', !('contactSubmissions' in poisonedCandidate));
checkTrue('branding (champ légitime) toujours présent', 'branding' in poisonedCandidate);
checkTrue('milestones (champ légitime) toujours présent', 'milestones' in poisonedCandidate);

console.log('\n=== FAMILLE 2 : règle transitoire modules/navigation ===');

console.log('\n-- 2a. team vide -> modules.team = false, absent de navigation --');
const noTeamSnapshot = { team: [] };
const noTeamCandidate = buildPublicationCandidate(noTeamSnapshot);
check('modules.team === false (équipe vide)', noTeamCandidate.modules.team, false);
checkTrue('navigation ne référence pas team',
  !noTeamCandidate.navigation.some(n => n.module === 'team'));

console.log('\n-- 2b. team non vide -> modules.team = true, présent en navigation --');
const withTeamSnapshot = { team: [{ id: 't1', name: 'Quelqu\'un' }] };
const withTeamCandidate = buildPublicationCandidate(withTeamSnapshot);
check('modules.team === true (équipe non vide)', withTeamCandidate.modules.team, true);
checkTrue('navigation référence team',
  withTeamCandidate.navigation.some(n => n.module === 'team' && n.label === 'Équipe projet'));

console.log('\n-- 2c. modules toujours activés, même vides --');
const emptySnapshot = {};
const emptyCandidate = buildPublicationCandidate(emptySnapshot);
['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors'].forEach(key => {
  check(`modules.${key} === true même sans contenu`, emptyCandidate.modules[key], true);
});
check('modules.team === false par défaut (aucune donnée)', emptyCandidate.modules.team, false);

console.log('\n-- 2d. invariant : navigation ne référence jamais un module désactivé --');
checkTrue('aucune entrée navigation ne référence un module absent des modules activés',
  emptyCandidate.navigation.every(n => emptyCandidate.modules[n.module] === true));

console.log('\n=== FAMILLE 3 : vraies données Pangea (Projet XYZ) ===');
console.log('Données récupérées depuis un vrai serveur Storm, pas une approximation écrite à la main.\n');

const realDataPath = path.join(__dirname, 'fixture-real-pangea-content.json');
const realPangeaData = JSON.parse(fs.readFileSync(realDataPath, 'utf8'));

console.log('Contenu réel chargé : ',
  realPangeaData.ambassadors.length, 'ambassadeurs,',
  realPangeaData.team.length, 'membres d\'équipe,',
  realPangeaData.milestones.length, 'jalons,',
  realPangeaData.articles.length, 'articles.');
checkTrue('la fixture contient bien faqDrafts (donnée réelle, pour prouver le filtrage)',
  'faqDrafts' in realPangeaData);

let realCandidate;
let crashed = false;
try {
  realCandidate = buildPublicationCandidate(realPangeaData);
} catch (e) {
  crashed = true;
  console.log('ECHEC — buildPublicationCandidate a levé une exception sur données réelles:', e.message);
  process.exitCode = 1;
}

if (!crashed) {
  checkTrue('aucun crash sur les vraies données Pangea', true);
  checkTrue('faqDrafts absent du candidat (même si présent dans la vraie source)',
    !('faqDrafts' in realCandidate));
  check('ambassadors préservés tels quels (12 attendus)', realCandidate.ambassadors.length, 12);
  check('team préservée telle quelle (11 attendus)', realCandidate.team.length, 11);
  check('modules.team === true (l\'équipe réelle n\'est pas vide)', realCandidate.modules.team, true);
  checkTrue('navigation contient bien 5 entrées (questions, news, spaces, ambassadors, team)',
    realCandidate.navigation.length === 5);
  checkTrue('branding réel préservé (projectName cohérent)',
    typeof realCandidate.branding.projectName === 'string' && realCandidate.branding.projectName.length > 0);
}

console.log('\n=== FAMILLE 4 : contrat positif — ensemble exact des clés top-level ===');
console.log('Ne teste plus seulement l\'absence des 4 champs interdits déjà vérifiés :');
console.log('vérifie que l\'ENSEMBLE des clés produites correspond exactement à ce que');
console.log('le document gelé autorise — ni une clé manquante, ni une clé imprévue.\n');

// Liste fermée, exactement les clés listées dans le whitelist de
// publication-candidate.js — toute clé absente de cette liste ou toute
// clé produite en trop fait échouer ce test, quelle qu'elle soit.
const EXPECTED_TOP_LEVEL_KEYS = [
  'branding', 'project', 'publicContent', 'milestones', 'articles', 'spaces', 'plans',
  'ambassadorsContent', 'ambassadors', 'teamContent', 'team',
  'faqEntries', 'modules', 'navigation'
].sort();

function checkExactKeys(label, candidate) {
  const actualKeys = Object.keys(candidate).sort();
  check(label, actualKeys, EXPECTED_TOP_LEVEL_KEYS);
}

checkExactKeys('candidat "piégé" (famille 1) — clés exactes, rien de plus', poisonedCandidate);
checkExactKeys('candidat vide (famille 2c) — clés exactes, rien de plus', emptyCandidate);
checkExactKeys('candidat sur vraies données (famille 3) — clés exactes, rien de plus', realCandidate);

console.log(`\n${passed} vérifications passées.`);
if (process.exitCode) {
  console.log('DES TESTS ONT ECHOUE.');
} else {
  console.log('TOUS LES TESTS SONT PASSES.');
}
