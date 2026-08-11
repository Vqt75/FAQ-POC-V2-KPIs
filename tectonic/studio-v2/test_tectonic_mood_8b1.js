const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const engine = read('public/mood-engine.js');
const runtime = read('public/runtime.js');
const renderer = read('public/renderers/ivory.js');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

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

ok(runtime.includes('async submitMood({ value })'), 'Runtime owns mood submission');
ok(runtime.includes("fetch('/api/kpi/track'"), 'existing KPI endpoint reused');
ok(runtime.includes("type: 'mood'"), 'mood event type');
ok(runtime.includes('value: numericValue'), 'bounded value sent');
ok(!runtime.includes('sessionId: numericValue'), 'no session id');

const imported = spawnSync(process.execPath, ['-e', "import('./public/renderers/ivory.js').then(()=>process.stdout.write('OK')).catch(e=>{console.error(e);process.exit(1)})"], { cwd: ROOT, encoding: 'utf8' });
ok(imported.status === 0 && imported.stdout.includes('OK'), `Ivory module graph imports cleanly: ${imported.stderr}`);

console.log(`OK — Tectonic Mood Bridge 8B.1 : ${checks} vérifications validées.`);
