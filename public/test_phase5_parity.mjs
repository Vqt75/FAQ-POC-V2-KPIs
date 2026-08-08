// Tests de la migration de parité Phase 5.
// Isolation : import direct des vrais modules ES + un vrai serveur
// HTTP pour les endpoints réseau (contact, whitelist statique).
import { JSDOM } from 'jsdom';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3095;
const BASE = `http://localhost:${PORT}`;
const realFetch = globalThis.fetch;

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`OK    — ${label}`); passed++; }
  else { console.log(`ECHEC — ${label}`); failed++; }
}

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      realFetch(url).then(res => res.ok ? resolve() : retry()).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout démarrage serveur.'));
        else setTimeout(attempt, 200);
      }
    })();
  });
}

// Extraction de la VRAIE fonction matchFaq de Pangea (index.html),
// évaluée isolément — même technique que la comparaison de progress
// en Phase 2, pas une confiance aveugle dans le portage.
function extractRealFaqEngine() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  function extractFunctionBlock(startMarker) {
    const start = html.indexOf(startMarker);
    const braceStart = html.indexOf('{', start);
    let depth = 0, end = braceStart;
    for (let i = braceStart; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    return html.slice(start, end);
  }
  function extractStatement(startMarker) {
    const start = html.indexOf(startMarker);
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
  const code = [
    extractStatement('const stopWords = new Set(['),
    extractStatement('const synonymMap = {'),
    extractFunctionBlock('function normalize(text = "")'),
    extractFunctionBlock('function tokenize(text = "")'),
    extractFunctionBlock('function scoreEntry(question, entry)'),
    'let faqData = [];',
    extractFunctionBlock('function matchFaq(question)'),
    'module.exports = { matchFaq: (q, items) => { faqData = items; return matchFaq(q); } };'
  ].join('\n\n');
  const Module = require('module');
  const m = new Module(path.join(__dirname, '_real_faq_extracted.js'));
  m._compile(code, path.join(__dirname, '_real_faq_extracted.js'));
  return m.exports.matchFaq;
}

async function main() {
  console.log('=== Tests de migration de parité — Phase 5 ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD: 'test-p5b' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  try {
    await waitForServer(`${BASE}/health`, 8000);
    const loginRes = await realFetch(`${BASE}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-p5b' })
    });
    const { token } = await loginRes.json();

    // Injecter de vraies entrées FAQ avec signaux de scoring, pour
    // avoir un jeu de données comparable non vide (le Manifest réel
    // actuel a questions.items = [] côté serveur).
    const content = await (await realFetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
    content.faqEntries = [
      { id: 'f1', title: 'Date déménagement', answer: 'En octobre.', status: 'confirmed', statusLabel: 'Confirmée',
        category: 'calendrier', note: '', keywords: ['date', 'demenagement'], phrases: ['quand demenage t on'],
        intentSignals: ['demenagement'], emotionSignals: [], negativeSignals: [], priority: 9 },
      { id: 'f2', title: 'Vélo', answer: 'Local vélo au sous-sol.', status: 'confirmed', statusLabel: 'Confirmée',
        category: 'mobilite', note: '', keywords: ['velo'], phrases: [], intentSignals: ['mobilite'],
        emotionSignals: [], negativeSignals: [], priority: 5 },
      { id: 'f3', title: 'Appréhension', answer: 'Un accompagnement est prévu.', status: 'partial', statusLabel: 'Partielle',
        category: 'accompagnement', note: '', keywords: ['peur', 'stress'], phrases: ['j ai peur du changement'],
        intentSignals: ['peur'], emotionSignals: ['peur'], negativeSignals: ['parking'], priority: 7 }
    ];
    await realFetch(`${BASE}/api/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(content)
    });
    await realFetch(`${BASE}/api/admin/publish`, { method: 'POST', headers: { 'x-admin-token': token } });
    const manifest = await (await realFetch(`${BASE}/api/manifest`)).json();

    console.log('--- 1) Moteur FAQ : comparaison directe avec le vrai moteur Pangea ---');
    {
      const { matchFaq } = await import(`${path.join(__dirname, 'faq-engine.js')}`);
      const realMatchFaq = extractRealFaqEngine();
      const items = manifest.content.questions.items;
      const testQuestions = [
        'Quand a lieu le déménagement ?',
        'Comment venir à vélo ?',
        'J\'ai peur du changement',
        'Question complètement absurde sans rapport zzzqxwv',
        'Où est le parking ?'
      ];
      testQuestions.forEach(q => {
        const portedResult = matchFaq(q, items);
        const realResult = realMatchFaq(q, items);
        const portedId = portedResult ? portedResult.id : null;
        const realId = realResult ? realResult.id : null;
        check(`même résultat pour "${q}" (porté: ${portedId}, réel: ${realId})`, portedId === realId);
      });
    }

    console.log('\n--- 2) Renderer : moteur FAQ branché, résultat affiché ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const dummyActions = { submitContact: async () => ({ ok: true }) };
      ivory.render(manifest, root, dummyActions);
      const doc = dom.window.document;
      doc.getElementById('tct-question-input').value = 'Quand a lieu le déménagement ?';
      doc.getElementById('tct-ask-btn').dispatchEvent(new dom.window.Event('click'));
      check('résultat FAQ affiché pour une question qui matche',
        !doc.getElementById('tct-question-result').hidden &&
        doc.getElementById('tct-question-result').textContent.includes('Date déménagement'));

      doc.getElementById('tct-question-input').value = 'zzzqxwv absurde';
      doc.getElementById('tct-ask-btn').dispatchEvent(new dom.window.Event('click'));
      check('escalade contact affichée pour une question sans match',
        !doc.getElementById('tct-question-notfound').hidden);
    }

    console.log('\n--- 3) Escalade contact : le Renderer délègue, ne connaît pas l\'endpoint ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      let capturedPayload = null;
      const trackingActions = {
        submitContact: async (payload) => { capturedPayload = payload; return { ok: true }; }
      };
      ivory.render(manifest, root, trackingActions);
      const doc = dom.window.document;
      doc.getElementById('tct-question-input').value = 'question sans reponse zzz';
      doc.getElementById('tct-ask-btn').dispatchEvent(new dom.window.Event('click'));
      const form = doc.getElementById('tct-contact-form');
      form.querySelector('[name="name"]').value = 'Alice';
      form.querySelector('[name="email"]').value = 'alice@test.fr';
      form.querySelector('[name="message"]').value = 'Ma question';
      await new Promise(resolve => {
        form.addEventListener('submit', () => setTimeout(resolve, 50));
        form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      });
      check('le renderer a appelé actions.submitContact avec le bon contenu (pas de fetch direct)',
        capturedPayload && capturedPayload.name === 'Alice' && capturedPayload.email === 'alice@test.fr');
    }

    console.log('\n--- 4) Vrai endpoint /api/public/contact : validation serveur ---');
    {
      const rBad = await realFetch(`${BASE}/api/public/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email: 'pas-un-email', message: '' })
      });
      check('payload invalide -> 400', rBad.status === 400);

      const rGood = await realFetch(`${BASE}/api/public/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob', email: 'bob@test.fr', message: 'Une vraie question' })
      });
      const bodyGood = await rGood.json();
      check('payload valide -> 200', rGood.status === 200 && bodyGood.ok === true);

      check('contact-submissions.json existe et contient la soumission',
        (() => {
          const p = path.join(ROOT, 'data', 'contact-submissions.json');
          if (!fs.existsSync(p)) return false;
          const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
          return arr.some(s => s.email === 'bob@test.fr');
        })());

      check('contact-submissions.json n\'est PAS dans kpis.json (séparation réelle, pas juste sémantique)',
        (() => {
          const kpiRaw = fs.readFileSync(path.join(ROOT, 'data', 'kpis.json'), 'utf8');
          return !kpiRaw.includes('bob@test.fr');
        })());

      const rDirect = await realFetch(`${BASE}/data/contact-submissions.json`);
      check('data/contact-submissions.json inaccessible en lecture directe (whitelist statique)',
        rDirect.status !== 200);

      console.log('-- 4b. email trop long -> 400 --');
      const rLongEmail = await realFetch(`${BASE}/api/public/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X', email: 'a'.repeat(260) + '@test.fr', message: 'msg' })
      });
      check('email de plus de 254 caractères -> 400', rLongEmail.status === 400);

      console.log('-- 4c. payload trop volumineux -> 413, jamais accumulé en entier --');
      const hugeMessage = 'x'.repeat(3 * 1024 * 1024); // 3 Mo, au-delà de la limite de 2 Mo
      const rHuge = await realFetch(`${BASE}/api/public/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X', email: 'x@test.fr', message: hugeMessage })
      });
      check('payload de 3 Mo -> 413 (jamais accepté silencieusement)', rHuge.status === 413);

      console.log('-- 4d. fichier existant corrompu -> 500, jamais un écrasement silencieux vers [] --');
      const submissionsPath = path.join(ROOT, 'data', 'contact-submissions.json');
      const validBackup = fs.readFileSync(submissionsPath, 'utf8');
      fs.writeFileSync(submissionsPath, '{ceci n\'est pas du JSON valide', 'utf8');
      const rCorrupted = await realFetch(`${BASE}/api/public/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nouvelle Personne', email: 'nouvelle@test.fr', message: 'Un nouveau message' })
      });
      check('fichier corrompu -> 500 (pas 400, pas 200)', rCorrupted.status === 500);
      const afterCorruptedAttempt = fs.readFileSync(submissionsPath, 'utf8');
      check('le fichier corrompu n\'a PAS été silencieusement remplacé par [] ou par une nouvelle donnée',
        afterCorruptedAttempt === '{ceci n\'est pas du JSON valide');
      // Restauration pour ne pas polluer la suite.
      fs.writeFileSync(submissionsPath, validBackup, 'utf8');

      console.log('-- 4e. écriture atomique : aucun fichier temporaire résiduel après un succès --');
      await realFetch(`${BASE}/api/public/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Claire', email: 'claire@test.fr', message: 'Question test atomicité' })
      });
      const dataDirFiles = fs.readdirSync(path.join(ROOT, 'data'));
      check('aucun fichier .contact-submissions.tmp-* résiduel après un succès',
        !dataDirFiles.some(f => f.startsWith('.contact-submissions.tmp-')));
    }

    console.log('\n--- 4quater) readBody() non borné par défaut -- comportement historique préservé ---');
    console.log('Reproduit le dernier reliquat trouvé en revue : MAX_BODY_BYTES=2Mo par défaut');
    console.log('changeait silencieusement le comportement historique de /api/content, alors que');
    console.log('le but du correctif était de borner le contact et de préserver l\'upload.\n');
    {
      // Body /api/content > 2 Mo, authentifié et par ailleurs valide,
      // ne doit plus être rejeté à cause d'un plafond introduit par erreur.
      const bigContent = await (await realFetch(`${BASE}/api/content`, { headers: { 'x-admin-token': token } })).json();
      // On gonfle un champ texte légitime pour dépasser 2 Mo au total,
      // sans changer la structure attendue par le serveur.
      bigContent.publicContent = bigContent.publicContent || {};
      bigContent.publicContent.faq = bigContent.publicContent.faq || {};
      bigContent.publicContent.faq.desc = 'A'.repeat(3 * 1024 * 1024); // 3 Mo à lui seul
      const rBigContent = await realFetch(`${BASE}/api/content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(bigContent)
      });
      check('POST /api/content avec un body > 2 Mo (authentifié, valide) -> 200, plus de plafond introduit par erreur',
        rBigContent.status === 200);
      // Remise en état immédiate, pour ne pas polluer les tests suivants
      // ni gonfler durablement l'état du serveur de test.
      bigContent.publicContent.faq.desc = '';
      await realFetch(`${BASE}/api/content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(bigContent)
      });

      // Un upload qui dépasse réellement MAX_UPLOAD_BODY_BYTES doit
      // répondre 413 (sémantique "trop volumineux"), jamais retomber
      // dans le 400 générique du catch.
      const tooBig = Buffer.alloc(11 * 1024 * 1024, 1); // dépasse la limite calculée pour 8 Mo réels encodés
      const rTooBig = await realFetch(`${BASE}/api/admin/upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: tooBig.toString('base64') })
      });
      check('upload dont le body dépasse réellement la limite -> 413 (pas le 400 générique)',
        rTooBig.status === 413);
    }

    console.log('\n--- 4ter) Non-régression : upload admin dont le body JSON dépasse 2 Mo ---');
    console.log('Reproduit précisément la régression trouvée en revue : un fichier de quelques');
    console.log('Mo, une fois encodé en Base64 dans son enveloppe JSON, dépassait l\'ancienne');
    console.log('limite globale de 2 Mo AVANT même d\'atteindre le contrôle des 8 Mo autorisés.\n');
    {
      // ~3 Mo de données brutes -> body JSON encodé nettement > 2 Mo,
      // mais très en-dessous des 8 Mo autorisés pour un upload réel.
      const rawBytes = Buffer.alloc(3 * 1024 * 1024, 1);
      const dataBase64 = rawBytes.toString('base64');
      const uploadRes = await realFetch(`${BASE}/api/admin/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ mimeType: 'image/png', dataBase64 })
      });
      const uploadBody = await uploadRes.json().catch(() => ({}));
      check('upload de ~3 Mo (body JSON encodé > 2 Mo) -> 200, accepté (plus de régression)',
        uploadRes.status === 200 && uploadBody.ok === true);

      // Nettoyage du fichier créé par ce test.
      if (uploadBody.url) {
        const uploadedPath = path.join(ROOT, uploadBody.url.replace(/^\//, ''));
        if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      }
    }


    console.log('\n--- 4bis) MIME réel d\'un PDF servi par la whitelist statique ---');
    {
      const uploadsDir = path.join(ROOT, 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const testPdfPath = path.join(uploadsDir, 'test-phase5-parity.pdf');
      fs.writeFileSync(testPdfPath, '%PDF-1.4 contenu factice pour le test', 'utf8');
      try {
        const rPdf = await realFetch(`${BASE}/uploads/test-phase5-parity.pdf`);
        check('GET /uploads/*.pdf -> 200', rPdf.status === 200);
        check('Content-Type réel = application/pdf (pas text/plain)',
          (rPdf.headers.get('content-type') || '').includes('application/pdf'));
      } finally {
        fs.unlinkSync(testPdfPath);
      }
    }

    console.log('\n--- 5) Assets : PDF vs image ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const fakeManifest = JSON.parse(JSON.stringify(manifest));
      fakeManifest.content.spaces = {
        intro: { eyebrow: '', title: '', description: '' },
        items: [
          { id: 'p1', type: 'Plan', tags: ['Zoning'], title: 'Un plan PDF', comment: '', asset: { url: '/uploads/plan.pdf', alt: 'Plan' } },
          { id: 'p2', type: '3D', tags: ['Ambiance'], title: 'Une vue image', comment: '', asset: { url: '/uploads/vue.jpg', alt: 'Vue' } }
        ]
      };
      ivory.render(fakeManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      check('PDF rendu comme lien (pas une balise <img> cassée)',
        !!doc.querySelector('.tct-pdf-chip') && doc.querySelector('.tct-pdf-chip').tagName === 'A');
      check('image rendue comme <img>', !!doc.querySelector('img.tct-card-img'));
      check('visuel Plans & 3D -> lightbox bien activée (c\'est le périmètre exact de l\'audit)',
        doc.querySelector('img.tct-card-img').classList.contains('tct-lightbox-trigger'));
    }

    console.log('\n--- 5bis) Lightbox : zoom et déplacement réels, pas une simple image agrandie ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
      global.document = dom.window.document; // ivory.js utilise document.createElement() pour la lightbox
      global.window = dom.window; // ivory.js utilise window.addEventListener() pour le glisser-déposer
      const root = dom.window.document.getElementById('root');
      const fakeManifest = JSON.parse(JSON.stringify(manifest));
      fakeManifest.content.spaces = {
        intro: { eyebrow: '', title: '', description: '' },
        items: [{ id: 'p1', type: 'Plan', tags: [], title: 'Plan test', comment: '',
                  asset: { url: '/uploads/plan.jpg', alt: 'Plan' } }]
      };
      ivory.render(fakeManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      const trigger = doc.querySelector('.tct-lightbox-trigger');
      trigger.dispatchEvent(new dom.window.Event('click'));
      const overlay = doc.querySelector('.tct-lightbox-overlay');
      check('la lightbox s\'ouvre bien au clic', !!overlay);
      const lbImg = doc.querySelector('.tct-lightbox-img');
      const stage = doc.querySelector('.tct-lightbox-stage');

      const wheelEvent = new dom.window.WheelEvent('wheel', { deltaY: -100, cancelable: true });
      stage.dispatchEvent(wheelEvent);
      check('la molette modifie bien l\'échelle de l\'image (zoom réel, pas juste "plus grand")',
        /scale\(([\d.]+)\)/.exec(lbImg.style.transform) && parseFloat(/scale\(([\d.]+)\)/.exec(lbImg.style.transform)[1]) > 1);

      const md = new dom.window.MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      stage.dispatchEvent(md);
      const mm = new dom.window.MouseEvent('mousemove', { clientX: 150, clientY: 130 });
      dom.window.dispatchEvent(mm);
      check('le glisser-déposer modifie bien la translation de l\'image (pan réel)',
        /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.test(lbImg.style.transform) &&
        lbImg.style.transform.includes('translate(50px, 30px)'));
      dom.window.dispatchEvent(new dom.window.MouseEvent('mouseup'));

      doc.querySelector('.tct-lightbox-close').dispatchEvent(new dom.window.Event('click'));
      check('la lightbox se ferme bien via le bouton dédié', !doc.querySelector('.tct-lightbox-overlay'));
    }

    console.log('\n--- 6) Filtres Plans & 3D ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const fakeManifest = JSON.parse(JSON.stringify(manifest));
      fakeManifest.content.spaces = {
        intro: { eyebrow: '', title: '', description: '' },
        items: [
          { id: 'p1', type: 'Plan', tags: ['Zoning'], title: 'A', comment: '', asset: null },
          { id: 'p2', type: '3D', tags: ['Ambiance'], title: 'B', comment: '', asset: null },
          // Tag multi-mots — reproduit exactement le bug trouvé en revue :
          // join(' ')/split(' ') cassait "Espace collaboratif" en deux
          // tokens, empêchant toute correspondance avec le filtre.
          { id: 'p3', type: 'Plan', tags: ['Espace collaboratif'], title: 'C', comment: '', asset: null }
        ]
      };
      ivory.render(fakeManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      const zoningBtn = [...doc.querySelectorAll('.tct-filter-pill')].find(b => b.dataset.filter === 'Zoning');
      zoningBtn.dispatchEvent(new dom.window.Event('click'));
      const cards = doc.querySelectorAll('#tct-spaces-grid > li');
      check('filtre "Zoning" masque les cartes qui ne correspondent pas',
        cards[0].style.display !== 'none' && cards[1].style.display === 'none' && cards[2].style.display === 'none');

      const multiWordBtn = [...doc.querySelectorAll('.tct-filter-pill')].find(b => b.dataset.filter === 'Espace collaboratif');
      check('le bouton de filtre pour un tag multi-mots existe bien', !!multiWordBtn);
      multiWordBtn.dispatchEvent(new dom.window.Event('click'));
      check('filtre "Espace collaboratif" (tag multi-mots) trouve bien sa carte -- bug corrigé',
        cards[2].style.display !== 'none' && cards[0].style.display === 'none' && cards[1].style.display === 'none');
    }

    console.log('\n--- 7) Roster label, CTA, groupes équipe, logo ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const fakeManifest = JSON.parse(JSON.stringify(manifest));
      fakeManifest.branding.logo = { url: '/assets/storm-logo.png', alt: 'Logo' };
      fakeManifest.content.ambassadors = {
        intro: { title: 'T', body: 'B', rosterLabel: 'toutes directions' },
        cta: { title: 'Devenir ambassadeur', body: 'Contactez-nous' },
        roster: [{ id: 'a1', name: 'X', role: 'Y', tag: 'Z', photo: { url: '/uploads/ambassadeur.jpg', alt: 'X' } }]
      };
      fakeManifest.content.team = {
        intro: { introBody: 'Intro Parella' },
        cta: { title: 'CTA équipe', body: 'Corps CTA' },
        members: [
          { id: 't1', name: 'Interne', title: 'Poste', group: '', photo: { url: '/uploads/interne.jpg', alt: 'Interne' } },
          { id: 't2', name: 'Consultant', title: 'Poste', group: 'Parella', photo: { url: '/uploads/consultant.jpg', alt: 'Consultant' } }
        ]
      };
      ivory.render(fakeManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      check('logo rendu dans le header', !!doc.querySelector('.tct-header img'));
      check('libellé roster ambassadeurs affiché avec le bon texte',
        doc.querySelector('.tct-roster-label').textContent.includes('toutes directions'));
      check('CTA ambassadeurs affiché', doc.querySelector('#ambassadors .tct-cta').textContent.includes('Devenir ambassadeur'));
      check('CTA équipe affiché', doc.querySelector('#team .tct-cta').textContent.includes('CTA équipe'));
      check('groupe Parella séparé visuellement du groupe interne',
        !!doc.querySelector('.tct-team-parella') && doc.querySelector('.tct-team-parella').textContent.includes('Consultant'));
      check('membre interne PAS dans le bloc Parella',
        !doc.querySelector('.tct-team-parella').textContent.includes('Interne'));

      // Écart de périmètre trouvé en revue : la lightbox (zoom/pan) est
      // réservée aux visuels Plans & 3D par l'audit de parité — jamais
      // aux portraits d'ambassadeurs/équipe.
      check('photo ambassadeur -> PAS de lightbox (hors périmètre de l\'audit)',
        !doc.querySelector('#ambassadors .tct-person-photo').classList.contains('tct-lightbox-trigger'));
      check('photo membre équipe -> PAS de lightbox (hors périmètre de l\'audit)',
        !doc.querySelector('#team .tct-person-photo').classList.contains('tct-lightbox-trigger'));
    }

    console.log('\n--- 8) Lecture complète d\'un article ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const fakeManifest = JSON.parse(JSON.stringify(manifest));
      fakeManifest.content.news = {
        intro: { eyebrow: '', title: '', description: '' },
        items: [{ id: 'a1', tag: 'Info', date: '1 jan', title: 'Titre', summary: 'Résumé court', body: 'Corps complet de l\'article.' }]
      };
      ivory.render(fakeManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      const body = doc.querySelector('.tct-article-body');
      check('corps de l\'article présent mais masqué avant clic', body.hidden === true && body.textContent.includes('Corps complet'));
      doc.querySelector('.tct-article-toggle').dispatchEvent(new dom.window.Event('click'));
      check('corps de l\'article visible après clic', body.hidden === false);
    }

    console.log('\n--- 9) Absence de content.X (module désactivé côté Compiler) -> aucune section rendue ---');
    console.log('Note : ce test vérifie que le Renderer respecte l\'absence de content.X.');
    console.log('C\'est le Compiler qui garantit modules.X=false <=> content.X absent (invariant');
    console.log('déjà vérifié en Phase 2) — le Renderer n\'a jamais à consulter modules.X lui-même.\n');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      const syntheticManifest = {
        schemaVersion: 1,
        meta: { generatedAt: 'x', revision: 'y' },
        project: { name: 'Test' },
        branding: { logo: null, colors: { primary: '#000', secondary: '#fff' }, fonts: {} },
        edition: { id: 'ivory' },
        modules: { home: true, timeline: false, spaces: false, news: false, questions: false, ambassadors: false, team: false },
        navigation: [],
        content: { home: { message: null, askPrompt: 'Test ?', now: null, next: null, featured: null } }
      };
      ivory.render(syntheticManifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      check('content.team absent du Manifest -> aucune section #team rendue', !doc.getElementById('team'));
      check('content.timeline absent du Manifest -> aucune section #timeline rendue', !doc.getElementById('timeline'));
      check('content.home présent -> section #home bien rendue', !!doc.getElementById('home'));
    }

    console.log('\n--- 10) Navigation : ordre, libellés et cibles exacts (pas juste le compte) ---');
    {
      const ivory = await import(`${path.join(__dirname, 'renderers', 'ivory.js')}`);
      const dom = new JSDOM('<div id="root"></div>');
      const root = dom.window.document.getElementById('root');
      ivory.render(manifest, root, { submitContact: async () => ({ ok: true }) });
      const doc = dom.window.document;
      const links = [...doc.querySelectorAll('.tct-nav a')];
      const actual = links.map(a => ({ href: a.getAttribute('href'), label: a.textContent }));
      const expected = manifest.navigation.map(n => ({ href: `#${n.module}`, label: n.label }));
      check('ordre + libellés + cibles (href) strictement identiques au Manifest',
        JSON.stringify(actual) === JSON.stringify(expected));
    }

    console.log('\n--- 11) Robustesse Runtime : échappement + gestion d\'erreur de rendu ---');
    {
      const runtimeSrc = fs.readFileSync(path.join(ROOT, 'public', 'runtime.js'), 'utf8');
      check('render(manifest, root, actions) est entouré d\'un try/catch dans le code source',
        /try\s*{\s*render\(manifest, root, actions\);\s*}\s*catch/.test(runtimeSrc));
      check('le catch appelle bien renderFatalError avec le message de l\'erreur de rendu',
        /catch\s*\(err\)\s*{\s*renderFatalError\(`Le rendu a échoué/.test(runtimeSrc));

      // Note méthodologique : exercer littéralement boot() -> loadRenderer()
      // -> import('/public/renderers/ivory.js') -> render() qui plante n'est
      // pas exécutable dans cet environnement, pour la même raison déjà
      // documentée en tête de fichier (Node ne résout pas un import()
      // absolu comme un navigateur). Test honnête à la place : on appelle
      // la VRAIE fonction renderFatalError() exportée, avec exactement le
      // message que boot() construirait dans son catch
      // (`Le rendu a échoué : ${err.message}`) — on vérifie le comportement
      // réel de cette fonction dans ce scénario précis, pas une simulation
      // qui ne l'appelle jamais.
      const dom = new JSDOM('<div id="tectonic-root"></div>');
      global.document = dom.window.document;
      const mod = await import(`${path.join(ROOT, 'public', 'runtime.js')}?fataltest`);
      const simulatedRenderError = new Error('Crash réel simulé du renderer <script>alert(1)</script>');
      mod.renderFatalError(`Le rendu a échoué : ${simulatedRenderError.message}`);
      const html = dom.window.document.getElementById('tectonic-root').innerHTML;
      check('renderFatalError produit l\'état fatal avec le message du crash de rendu',
        html.includes("Impossible d'afficher") && html.includes('Le rendu a échoué'));
      check('renderFatalError échappe le message -- aucune balise <script> injectée telle quelle',
        !html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;'));
    }

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;

  } catch (err) {
    console.error('\nERREUR DE TEST :', err.message, '\n', err.stack);
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    child.kill('SIGKILL');
  }
}

main();
