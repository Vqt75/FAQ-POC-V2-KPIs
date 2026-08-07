// Snapshot comportemental du moteur de recherche FAQ, avant/après
// normalizeFaqEntry(). On extrait le VRAI moteur (scoreEntry,
// matchFaq, tokenize, normalize, synonymMap, stopWords) et les 34
// VRAIES entrées depuis index.html — pas une reconstruction à la
// main, pour éviter de tester un moteur qu'on aurait mal recopié.
const fs = require('fs');
const Module = require('module');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');

function extractStatement(startMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) throw new Error(`Marqueur introuvable: ${startMarker}`);
  let depth = 0, started = false, end = start;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === '{' || c === '[' || c === '(') { depth++; started = true; }
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (started && depth === 0) {
        let j = i + 1;
        while (j < html.length && html[j] !== ';' && html[j] !== '\n') j++;
        end = html[j] === ';' ? j + 1 : i + 1;
        break;
      }
    }
  }
  return html.slice(start, end);
}

function extractFunctionBlock(startMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) throw new Error(`Marqueur introuvable: ${startMarker}`);
  const braceStart = html.indexOf('{', start);
  let depth = 0, end = braceStart;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return html.slice(start, end);
}

// faqData : tableau brut, on isole juste "let faqData = [ ... ];"
const faqDataStart = html.indexOf('let faqData = [');
let depth = 0, started = false, faqDataEnd = faqDataStart;
for (let i = faqDataStart + 'let faqData = '.length; i < html.length; i++) {
  if (html[i] === '[') { depth++; started = true; }
  else if (html[i] === ']') { depth--; if (started && depth === 0) { faqDataEnd = i + 1; break; } }
}
const faqDataLiteral = html.slice(faqDataStart + 'let faqData = '.length, faqDataEnd);

const engineCode = [
  'let faqData = [];',
  extractStatement('const stopWords = new Set(['),
  extractStatement('const synonymMap = {'),
  extractFunctionBlock('function normalize(text = "")'),
  extractFunctionBlock('function tokenize(text = "")'),
  extractFunctionBlock('function scoreEntry(question, entry)'),
  extractFunctionBlock('function matchFaq(question)'),
  'module.exports = { matchFaq, setFaqData: d => { faqData = d; } };'
].join('\n\n');

const m = new Module(__dirname + '/_faq_engine_extracted.js');
m._compile(engineCode, __dirname + '/_faq_engine_extracted.js');
const { matchFaq, setFaqData } = m.exports;

// Le vrai jeu de données brut (avant normalisation)
const rawFaqData = eval(faqDataLiteral);

// Le même jeu de données, passé par normalizeFaqEntry (comme s'il
// venait d'un cycle sauvegarde/relecture serveur).
const serverSrc = fs.readFileSync(__dirname + '/server.js', 'utf8');
function extractServerFunction(name) {
  const marker = `function ${name}(`;
  const start = serverSrc.indexOf(marker);
  let d = 0, s = false, e = start;
  for (let i = start; i < serverSrc.length; i++) {
    if (serverSrc[i] === '{') { d++; s = true; }
    else if (serverSrc[i] === '}') { d--; if (s && d === 0) { e = i + 1; break; } }
  }
  return serverSrc.slice(start, e);
}
const normalizeCode = [
  "const FAQ_STATUS_LABELS = { confirmed: 'Réponse confirmée', partial: 'Réponse partielle', waiting: 'En attente de décision' };",
  extractServerFunction('normalizeStringArray'),
  extractServerFunction('normalizeFaqEntry'),
  extractServerFunction('normalizeFaqEntries'),
  'module.exports = { normalizeFaqEntries };'
].join('\n\n');
const m2 = new Module(__dirname + '/_normalize_extracted.js');
m2._compile(normalizeCode, __dirname + '/_normalize_extracted.js');
const normalizedFaqData = m2.exports.normalizeFaqEntries(rawFaqData);

// ─────────────────────────────────────────────────
// Questions de test — mélange d'entrées "simples" et des 6 entrées
// "riches" (celles qui utilisent phrases/intentSignals/priority),
// exactement là où une régression de scoring serait la plus probable.
// ─────────────────────────────────────────────────
const testQuestions = [
  'Quand a lieu le déménagement ?',
  'Comment venir à vélo ?',
  'Est-ce que je serai en flex office ?',
  'J\'ai peur du changement',
  'Combien de bulles phoniques y a-t-il ?',
  'Où est le nouveau site ?',
  'Comment obtenir une place de parking ?',
  'Question complètement absurde sans rapport zzzqxwv'
];

console.log('QUESTION'.padEnd(45), 'AVANT'.padEnd(22), 'APRÈS');
console.log('-'.repeat(90));

let allMatch = true;
testQuestions.forEach(q => {
  setFaqData(rawFaqData);
  const before = matchFaq(q);
  setFaqData(normalizedFaqData);
  const after = matchFaq(q);
  const beforeId = before ? before.id : 'no-match';
  const afterId = after ? after.id : 'no-match';
  const same = beforeId === afterId;
  if (!same) allMatch = false;
  console.log(
    q.slice(0, 43).padEnd(45),
    beforeId.padEnd(22),
    afterId,
    same ? '' : '   <<<< DIFFÉRENT'
  );
});

console.log('');
if (allMatch) {
  console.log('AUCUNE DÉRIVE COMPORTEMENTALE — les mêmes questions donnent les mêmes réponses avant/après.');
} else {
  console.log('DÉRIVE DÉTECTÉE — au moins une question change de réponse après normalisation.');
  process.exitCode = 1;
}
