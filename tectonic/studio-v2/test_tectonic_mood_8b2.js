const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const engineSource = read('public/mood-engine.js');
const renderer = read('public/renderers/ivory.js');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

ok(engineSource.includes('let pageFocused'), 'focus state is tracked explicitly');
ok(engineSource.includes("win.addEventListener('focus', onWindowFocus)"), 'window focus resumes attention');
ok(engineSource.includes("win.addEventListener('blur', onWindowBlur)"), 'window blur pauses attention');
ok(engineSource.includes('const noteInteraction = () => { pageFocused = true;'), 'real interaction repairs stale focus state');
ok(engineSource.indexOf('onNudge({ reducedMotion') < engineSource.indexOf('markNudgedToday();'), 'nudge is rendered before being persisted');
ok(engineSource.includes('if (!shown) return;'), 'failed visual nudge is not consumed');
ok(renderer.includes('.tct-mood-fab.is-wave{animation:tctMoodFabNudge'), 'pulse animates the button itself');
ok(renderer.includes('@keyframes tctMoodFabNudge'), 'visible external halo animation exists');
ok(!renderer.includes('.tct-mood-fab.is-wave::before'), 'pulse is not clipped by FAB overflow');
ok(renderer.includes("return true;\n    }\n  });\n  engine.start();"), 'renderer confirms visible nudge to engine');
ok(renderer.includes('.tct-mood-fab.is-introduced{max-width:184px'), 'label expansion remains visible');
ok(renderer.includes('.tct-mood-fab.is-wave{animation:none!important}'), 'reduced motion disables pulse');

class Store {
  constructor(){ this.map = new Map(); }
  getItem(k){ return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v){ this.map.set(k,String(v)); }
}
class EventHub {
  constructor(){ this.listeners = new Map(); }
  addEventListener(type, fn){ if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn){ this.listeners.get(type)?.delete(fn); }
  emit(type, event={}){ for(const fn of this.listeners.get(type)||[]) fn(event); }
}

(async () => {
  const mod = await import(pathToFileURL(path.join(ROOT,'public','mood-engine.js')).href + `?v=${Date.now()}`);
  ok(typeof mod.createMoodSolicitationEngine === 'function', 'engine imports');

  const winHub = new EventHub();
  const docHub = new EventHub();
  const storage = new Store();
  const sessionStorage = new Store();
  let focus = false;
  const doc = Object.assign(docHub, {
    visibilityState: 'visible',
    hasFocus: () => focus,
    body: { classList: { contains: () => false } },
    activeElement: null,
    querySelector: () => null
  });
  const win = Object.assign(winHub, {
    document: doc,
    localStorage: storage,
    sessionStorage,
    scrollY: 0,
    innerHeight: 800,
    performance,
    setInterval,
    clearInterval,
    setTimeout,
    matchMedia: () => ({ matches:false })
  });
  doc.defaultView = win;
  let nudges = 0;
  const mood = mod.createMoodSolicitationEngine({
    window: win, document: doc, storage, sessionStorage,
    config: { minActiveMs: 10, maxActiveMs: 10, quietMs: 0, fallbackExposureMs: 0, tickMs: 5, introMs: 5 },
    onNudge: () => { nudges += 1; return true; }
  });
  mood.start();
  await new Promise(r => setTimeout(r, 25));
  ok(nudges === 0, 'unfocused visible page does not accumulate attention');
  focus = true;
  docHub.emit('click', { target: { closest: () => null } });
  await new Promise(r => setTimeout(r, 35));
  ok(nudges === 1, 'real interaction resumes attention and produces one nudge');
  ok(storage.getItem('storm_mood_nudge_shown') !== null, 'successful nudge is persisted');
  mood.stop();

  console.log(`OK — Tectonic Mood Nudge 8B.2 : ${checks} vérifications validées.`);
})().catch(err => { console.error(err); process.exit(1); });
