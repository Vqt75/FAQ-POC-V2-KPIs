const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

ok(html.includes('MOOD SOLICITATION ENGINE'), 'mood engine marker');
ok(html.includes('minActiveMs: 25000'), 'minimum active attention');
ok(html.includes('maxActiveMs: 40000'), 'maximum active attention threshold');
ok(html.includes('fallbackExposureMs: 35000'), 'reading exposure fallback');
ok(html.includes('minScrollExposure: 0.55'), 'scroll exposure threshold');
ok(html.includes('quietMs: 1500'), 'calm moment delay');
ok(html.includes("document.visibilityState === 'visible'"), 'visibility attention guard');
ok(html.includes('document.hasFocus()'), 'focus attention guard');
ok(html.includes("!document.body.classList.contains('storm-admin-open')"), 'admin guard');
ok(html.includes('scrollExposurePx'), 'scroll exposure tracking');
ok(html.includes('meaningfulInteractions'), 'meaningful interaction tracking');
ok(html.includes('isCalmMoment'), 'calm moment gate');
ok(html.includes("input, textarea, select"), 'typing guard');
ok(html.includes("prefers-reduced-motion: reduce"), 'reduced motion support');
ok(html.includes("if (!reducedMotion) fab.classList.add('pulse')"), 'no pulse under reduced motion');
ok(html.includes('markMoodNudgedToday()'), 'one nudge per day marker');
ok(html.includes('hasNudgedMoodToday()'), 'daily nudge guard');
ok(html.includes('hasAnsweredMoodToday()'), 'daily answer guard');
ok(html.includes('initMoodSolicitationEngine();'), 'engine initialized');
ok(!html.includes('runMoodFabIntro();'), 'legacy timer intro removed');
ok(!html.includes('}, 1400);\n  }\n\n  initMoodWidget();\n  runMoodFabIntro();'), 'legacy 1.4s nudge removed');
ok(html.includes('Comment vous sentez-vous par rapport au projet aujourd’hui ?'), 'preferred question wording');
ok(html.includes('Merci — votre ressenti a bien été pris en compte.'), 'short acknowledgement');
ok(html.includes('setTimeout(closeMoodPopover, 1000)'), 'popover closes after acknowledgement');
ok(html.includes('Anonyme, agrégé uniquement — jamais individuel.'), 'privacy microcopy');
ok(html.includes("fab.addEventListener('click'"), 'manual explicit opening retained');
ok(!html.includes("openMoodPopover();\n      nudged"), 'engine does not auto-open popover');

console.log(`OK — Mood Solicitation Engine 8B : ${checks} vérifications validées.`);
