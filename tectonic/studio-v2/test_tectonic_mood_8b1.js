const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const engine = read('public/mood-engine.js');
const runtime = read('public/runtime.js');
const renderer = read('public/renderers/ivory.js');
const server = read('server.js');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

// Moteur de sollicitation — comportement inchangé par ce lot.
ok(engine.includes('minActiveMs: 25000'), '25s minimum active attention');
ok(engine.includes('maxActiveMs: 40000'), '40s maximum randomized threshold');
ok(engine.includes('quietMs: 1500'), '1.5s calm moment');
ok(engine.includes('fallbackExposureMs: 35000'), 'long-read exposure fallback');
ok(engine.includes('minScrollExposure: 0.55'), 'meaningful scroll exposure');
ok(engine.includes("doc.visibilityState === 'visible'"), 'hidden tabs do not count');
ok(engine.includes('doc.hasFocus()'), 'unfocused pages do not count');
ok(engine.includes('prefers-reduced-motion: reduce'), 'reduced motion respected');
ok(engine.includes('markNudgedToday'), 'one nudge per day persistence');
ok(!engine.includes('openMoodPopover') && !engine.includes('.click()'), 'engine never opens questionnaire');

// Interface publique — wording et comportement UI inchangés par ce lot.
ok(renderer.includes("from '../mood-engine.js'"), 'Ivory imports shared mood engine');
ok(renderer.includes('data-tct-mood-fab'), 'Ivory exposes manual mood control');
ok(renderer.includes('Météo du projet'), 'public label retained');
ok(renderer.includes('Comment vous sentez-vous par rapport au projet aujourd’hui ?'), 'preferred wording');
ok(renderer.includes("1: 'Orageux'"), 'Orageux');
ok(renderer.includes("2: 'Nuageux'"), 'Nuageux');
ok(renderer.includes("3: 'Couvert'"), 'Couvert');
ok(renderer.includes("4: 'Éclairci'"), 'Éclairci');
ok(renderer.includes("5: 'Ensoleillé'"), 'Ensoleillé');
ok(renderer.includes('Anonyme, agrégé uniquement — jamais individuel.'), 'privacy copy');
ok(renderer.includes('Merci — votre ressenti a bien été pris en compte.'), 'acknowledgement');
ok(renderer.includes('createMoodSolicitationEngine({'), 'Ivory starts engine');
ok(renderer.includes('isBusy: () => !panel.hidden'), 'open panel blocks nudge');
ok(renderer.includes("fab.addEventListener('click'"), 'opening stays manual');
ok(renderer.includes('@media(prefers-reduced-motion:reduce)'), 'wave removed under reduced motion');
ok(!renderer.includes('\\nfunction'), 'literal backslash-n boot regression absent');

// Voie canonique de télémétrie — voir tectonic/telemetry.js et le lot de
// convergence Pilotage V1. Ivory doit désormais utiliser /api/telemetry
// pour la météo, jamais l'ancien /api/kpi/track — ces vérifications
// remplacent celles qui affirmaient l'ancien chemin (délibérément
// retiré, pas cassé accidentellement).
ok(runtime.includes('async submitMood({ value })'), 'Runtime owns mood submission');
ok(runtime.includes("fetch('/api/telemetry'"), 'Ivory uses the canonical telemetry endpoint for mood');
ok(!/submitMood[\s\S]{0,400}fetch\('\/api\/kpi\/track'/.test(runtime), 'submitMood no longer calls the legacy KPI endpoint');
ok(runtime.includes("event: 'mood_feedback'"), 'mood event uses the new canonical event name');
ok(runtime.includes('value: numericValue'), 'bounded value sent (1-5, bucketed server-side)');
ok(!runtime.includes('sessionId: numericValue'), 'no session id');
ok(runtime.includes('trackPageView()'), 'Runtime exposes page_view telemetry');
ok(runtime.includes('trackMatchResult(outcome)'), 'Runtime exposes match_result telemetry');

// L'ancien endpoint doit rester disponible — réservé à Pangea, jamais
// supprimé ni modifié par ce lot.
ok(server.includes("url.pathname === '/api/kpi/track'"), 'legacy KPI endpoint still exists (reserved for Pangea)');
ok(server.includes("url.pathname === '/api/telemetry'") && !/url\.pathname === '\/api\/telemetry'[\s\S]{0,50}\/api\/kpi\/track/.test(server),
  'the new canonical endpoint is genuinely distinct from the legacy one');

const imported = spawnSync(process.execPath, ['-e', "import('./public/renderers/ivory.js').then(()=>process.stdout.write('OK')).catch(e=>{console.error(e);process.exit(1)})"], { cwd: ROOT, encoding: 'utf8' });
ok(imported.status === 0 && imported.stdout.includes('OK'), `Ivory module graph imports cleanly: ${imported.stderr}`);

console.log(`OK — Tectonic Mood Bridge 8B.1 (voie canonique télémétrie) : ${checks} vérifications validées.`);
