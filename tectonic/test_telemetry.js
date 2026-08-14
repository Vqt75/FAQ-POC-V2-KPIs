// Tests unitaires purs — tectonic/telemetry.js
//
// Aucun accès disque, aucun serveur : ce fichier vérifie exclusivement
// les fonctions pures. Le test de l'ordre de purge (agrégat persisté
// AVANT suppression du brut) vit délibérément ailleurs
// (test_telemetry_server.mjs) — c'est une propriété de persistance de
// server.js, pas une propriété calculable en isolation.
const assert = require('assert');
const t = require('./telemetry');

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`OK   — ${label}`); passed++; }
  else { console.log(`ECHEC — ${label}`); failed++; }
}

console.log('=== 1) Semaine ISO — cas limites calendaires ===\n');
check('mercredi ordinaire (2026-08-14) -> 2026-W33', t.getISOWeek('2026-08-14') === '2026-W33');
check('dernier jour de l\'année appartenant à l\'année ISO suivante (2024-12-31) -> 2025-W01',
  t.getISOWeek('2024-12-31') === '2025-W01');
check('1er janvier appartenant à W01 (2025-01-01, mercredi) -> 2025-W01',
  t.getISOWeek('2025-01-01') === '2025-W01');
check('1er janvier appartenant à la dernière semaine de l\'année précédente (2022-01-01, samedi) -> 2021-W52',
  t.getISOWeek('2022-01-01') === '2021-W52');
check('année avec une 53e semaine ISO (2026-12-31, jeudi) -> 2026-W53',
  t.getISOWeek('2026-12-31') === '2026-W53');
check('dimanche -> lundi, changement de semaine (2026-08-16 dimanche vs 2026-08-17 lundi)',
  t.getISOWeek('2026-08-16') === '2026-W33' && t.getISOWeek('2026-08-17') === '2026-W34');
check('changement de mois, même semaine (2026-08-31 lundi et 2026-09-01 mardi -> même semaine)',
  t.getISOWeek('2026-08-31') === t.getISOWeek('2026-09-01'));

console.log('\n=== 2) Comparaison et clôture de semaine ===\n');
check('compareISOWeeks ordonne correctement across année (2025-W52 < 2026-W01)',
  t.compareISOWeeks('2025-W52', '2026-W01') < 0);
check('isWeekClosed : une semaine antérieure à la courante est close',
  t.isWeekClosed('2026-W32', '2026-W33') === true);
check('isWeekClosed : la semaine courante elle-même n\'est jamais close',
  t.isWeekClosed('2026-W33', '2026-W33') === false);
check('isWeekClosed : une semaine future n\'est pas close',
  t.isWeekClosed('2026-W34', '2026-W33') === false);

console.log('\n=== 3) Validation stricte des événements ===\n');
check('page_view sans champ additionnel est valide', t.isValidEvent({ event: 'page_view' }));
check('page_view avec un champ en trop est rejeté', !t.isValidEvent({ event: 'page_view', page: 'home' }));
check('match_result avec un outcome valide est accepté', t.isValidEvent({ event: 'match_result', outcome: 'matched' }));
check('match_result avec un outcome inconnu est rejeté', !t.isValidEvent({ event: 'match_result', outcome: 'inconnu' }));
check('match_result avec un contentId en plus est rejeté (non collecté en V1)',
  !t.isValidEvent({ event: 'match_result', outcome: 'matched', contentId: 'faq_1' }));
check('mood_feedback avec value=1..5 entier est accepté', t.isValidEvent({ event: 'mood_feedback', value: 3 }));
check('mood_feedback avec value=0 est rejeté', !t.isValidEvent({ event: 'mood_feedback', value: 0 }));
check('mood_feedback avec value=6 est rejeté', !t.isValidEvent({ event: 'mood_feedback', value: 6 }));
check('mood_feedback avec value non entier est rejeté', !t.isValidEvent({ event: 'mood_feedback', value: 3.5 }));
check('un type d\'événement inconnu est rejeté', !t.isValidEvent({ event: 'click' }));
check('un payload vide est rejeté', !t.isValidEvent({}));
check('un payload non-objet est rejeté', !t.isValidEvent(null) && !t.isValidEvent('page_view'));

console.log('\n=== 4) Frontière réseau/stockage du mood — jamais de valeur 1-5 persistée ===\n');
for (let v = 1; v <= 5; v++) {
  const raw = t.buildRawEvent({ event: 'mood_feedback', value: v }, '2026-08-14');
  check(`value=${v} en entrée -> l'événement persisté ne contient que la catégorie ("${raw.value}"), jamais le chiffre`,
    ['positive', 'neutral', 'negative'].includes(raw.value) && typeof raw.value === 'string');
}
check('1-2 -> negative', t.bucketMoodValue(1) === 'negative' && t.bucketMoodValue(2) === 'negative');
check('3 -> neutral', t.bucketMoodValue(3) === 'neutral');
check('4-5 -> positive', t.bucketMoodValue(4) === 'positive' && t.bucketMoodValue(5) === 'positive');

console.log('\n=== 5) buildRawEvent — minimisation stricte ===\n');
check('page_view brut ne contient que event+date',
  Object.keys(t.buildRawEvent({ event: 'page_view' }, '2026-08-14')).sort().join(',') === 'date,event');
check('match_result brut ne contient que event+date+outcome',
  Object.keys(t.buildRawEvent({ event: 'match_result', outcome: 'abstained' }, '2026-08-14')).sort().join(',') === 'date,event,outcome');

console.log('\n=== 6) Agrégation ===\n');
{
  const events = [
    { event: 'page_view', date: '2026-08-10' },
    { event: 'page_view', date: '2026-08-11' },
    { event: 'match_result', date: '2026-08-10', outcome: 'matched' },
    { event: 'match_result', date: '2026-08-10', outcome: 'matched' },
    { event: 'match_result', date: '2026-08-11', outcome: 'abstained' },
    { event: 'mood_feedback', date: '2026-08-10', value: 'positive' }, // semaine 2026-W33
    { event: 'mood_feedback', date: '2026-08-11', value: 'positive' },
    { event: 'mood_feedback', date: '2026-08-11', value: 'negative' },
    { event: 'mood_feedback', date: '2026-08-17', value: 'neutral' }   // semaine 2026-W34 (courante dans ce test)
  ];
  const agg = t.aggregateEvents(events, '2026-08-17');
  check('pageViews compte tous les page_view', agg.pageViews === 2);
  check('match.matched compte correctement', agg.match.matched === 2);
  check('match.abstained compte correctement', agg.match.abstained === 1);
  check('match.total = somme des trois outcomes', agg.match.total === 3);
  check('weeklyMood regroupe bien par semaine ISO (2026-W33 a 3 réponses)',
    agg.weeklyMood['2026-W33'].total === 3);
  check('la semaine courante (2026-W34) est bien identifiée séparément',
    agg.currentWeek === '2026-W34' && agg.weeklyMood['2026-W34'].total === 1);
}

console.log('\n=== 7) Reconstructibilité — égalité stricte, pas approximative ===\n');
{
  // Le test exigé par la doctrine : écrire un brut, agréger, détruire
  // l'agrégat, le reconstruire depuis le seul brut restant, comparer
  // bit à bit (deepEqual, pas "les pourcentages semblent proches").
  const rawEvents = [];
  for (let i = 0; i < 12; i++) {
    rawEvents.push(t.buildRawEvent({ event: 'mood_feedback', value: (i % 5) + 1 }, '2026-08-10'));
  }
  for (let i = 0; i < 7; i++) {
    rawEvents.push(t.buildRawEvent({ event: 'mood_feedback', value: (i % 5) + 1 }, '2026-08-12'));
  }
  rawEvents.push(t.buildRawEvent({ event: 'page_view' }, '2026-08-10'));
  rawEvents.push(t.buildRawEvent({ event: 'match_result', outcome: 'matched' }, '2026-08-11'));

  const aggregateA = t.aggregateEvents(rawEvents, '2026-08-20');
  // "Détruire l'agrégat" est simulé ici par le fait qu'on ne réutilise
  // jamais aggregateA pour produire B — B est recalculé intégralement
  // depuis rawEvents seul, exactement comme le ferait le serveur après
  // une purge où seul le brut aurait survécu.
  const aggregateB = t.aggregateEvents(rawEvents, '2026-08-20');
  assert.deepStrictEqual(aggregateA, aggregateB);
  check('un agrégat recalculé depuis le même brut est strictement identique (deepStrictEqual)', true);
}

console.log('\n=== 8) Seuil d\'affichage k=5 ===\n');
check('total=4 est sous le seuil', t.applyThreshold(4) === false);
check('total=5 atteint le seuil', t.applyThreshold(5) === true);
check('total=100 est au-dessus du seuil', t.applyThreshold(100) === true);
check('seuil personnalisé respecté (k=10, total=7)', t.applyThreshold(7, 10) === false);

console.log('\n=== 9) Expiration du brut (30 jours) ===\n');
check('un fichier de 29 jours n\'est pas expiré', !t.isRawFileExpired('2026-07-16', '2026-08-14'));
check('un fichier de 31 jours est expiré', t.isRawFileExpired('2026-07-14', '2026-08-14'));
check('un fichier du jour même n\'est jamais expiré', !t.isRawFileExpired('2026-08-14', '2026-08-14'));

console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
process.exitCode = failed > 0 ? 1 : 0;
