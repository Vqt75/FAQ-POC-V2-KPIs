// Test de normalizeFaqEntry() / normalizeFaqEntries() sur des cas
// malformés — exécuté en isolation, sans jamais toucher au serveur
// HTTP ni au disque réel (require direct des fonctions).
const assert = require('assert');

// On extrait uniquement les définitions dont on a besoin (pas tout
// server.js, qui démarre un vrai serveur HTTP et référence __dirname)
// — isolation complète, aucun effet de bord possible.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/server.js', 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Fonction ${name} introuvable dans server.js`);
  let depth = 0, started = false, end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}

const code = [
  "const FAQ_STATUS_LABELS = { confirmed: 'Réponse confirmée', partial: 'Réponse partielle', waiting: 'En attente de décision' };",
  extractFunction('normalizeStringArray'),
  extractFunction('normalizeFaqEntry'),
  extractFunction('normalizeFaqEntries'),
  'module.exports = { normalizeFaqEntry, normalizeFaqEntries };'
].join('\n\n');

const Module = require('module');
const m = new Module(__dirname + '/_faq_normalize_extracted.js');
m._compile(code, __dirname + '/_faq_normalize_extracted.js');
const { normalizeFaqEntry, normalizeFaqEntries } = m.exports;

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

console.log('=== 1) keywords en chaîne au lieu de tableau -> [] (jamais de crash) ===');
check('keywords string -> []', normalizeFaqEntry({ id: 'x', keywords: 'open space' }, 0).keywords, []);

console.log('\n=== 2) priority en chaîne numérique -> conversion en nombre réel ===');
check('priority "3" -> 3 (nombre)', normalizeFaqEntry({ id: 'x', priority: '3' }, 0).priority, 3);
check('priority "abc" -> 0 (repli)', normalizeFaqEntry({ id: 'x', priority: 'abc' }, 0).priority, 0);
check('priority absent -> 0', normalizeFaqEntry({ id: 'x' }, 0).priority, 0);

console.log('\n=== 3) phrases = null -> [] ===');
check('phrases null -> []', normalizeFaqEntry({ id: 'x', phrases: null }, 0).phrases, []);

console.log('\n=== 4) title absent -> "" ===');
check('title absent -> ""', normalizeFaqEntry({ id: 'x' }, 0).title, '');

console.log('\n=== 5) entrée complètement invalide -> objet sûr, jamais de crash ===');
let crashed = false;
let resultNull, resultUndefined, resultString, resultNumber;
try {
  resultNull = normalizeFaqEntry(null, 0);
  resultUndefined = normalizeFaqEntry(undefined, 1);
  resultString = normalizeFaqEntry('ceci n\'est pas un objet', 2);
  resultNumber = normalizeFaqEntry(42, 3);
} catch (e) {
  crashed = true;
  console.log('ECHEC — normalizeFaqEntry a levé une exception:', e.message);
  process.exitCode = 1;
}
if (!crashed) {
  console.log('OK   — aucun crash sur null/undefined/string/number en entrée');
  passed++;
  check('entrée null -> statut par défaut waiting', resultNull.status, 'waiting');
  check('entrée null -> id généré (non vide)', typeof resultNull.id === 'string' && resultNull.id.length > 0, true);
}

console.log('\n=== 6) status invalide -> repli sur "waiting" + statusLabel cohérent (pas de contradiction) ===');
const badStatus = normalizeFaqEntry({ id: 'x', status: 'n-importe-quoi', statusLabel: 'Réponse confirmée' }, 0);
check('status invalide -> waiting', badStatus.status, 'waiting');
check('statusLabel recalculé pour rester cohérent avec le nouveau status', badStatus.statusLabel, 'En attente de décision');

console.log('\n=== 7) status valide + statusLabel déjà présent -> préservé tel quel (pas de changement de comportement) ===');
const goodStatus = normalizeFaqEntry({ id: 'x', status: 'confirmed', statusLabel: 'Réponse confirmée' }, 0);
check('statusLabel préservé si status déjà valide', goodStatus.statusLabel, 'Réponse confirmée');

console.log('\n=== 8) tableau non-array pour faqEntries/faqDrafts -> [] (comportement identique à avant) ===');
check('normalizeFaqEntries(undefined) -> []', normalizeFaqEntries(undefined), []);
check('normalizeFaqEntries(null) -> []', normalizeFaqEntries(null), []);
check('normalizeFaqEntries("x") -> []', normalizeFaqEntries('x'), []);

console.log('\n=== 9) entrée complète et valide -> tous les champs préservés à l\'identique ===');
const fullValid = {
  id: 'apprehension', category: 'accompagnement', title: 'Appréhension face au changement',
  status: 'confirmed', statusLabel: 'Réponse confirmée',
  answer: 'Ce que vous ressentez est normal.', note: 'Note test.',
  keywords: ['peur', 'stress'], phrases: ['j ai peur du changement'],
  intentSignals: ['peur', 'stress'], emotionSignals: ['peur'],
  negativeSignals: ['parking'], priority: 9
};
const normalized = normalizeFaqEntry(fullValid, 0);
check('entrée valide complète -> aucune altération', normalized, fullValid);

console.log(`\n${passed} vérifications passées.`);
if (process.exitCode) {
  console.log('DES TESTS ONT ECHOUE.');
} else {
  console.log('TOUS LES TESTS SONT PASSES.');
}
