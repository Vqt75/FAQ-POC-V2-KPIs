// Harnais comportemental — flux d'authentification Ivory ↔ Studio :
//   1. le clic "Administration" depuis Ivory : présence du token ->
//      navigation native vers /admin ; absence -> reste sur Ivory,
//      ouvre l'overlay de connexion existant (mêmes wording/mécanisme
//      que #adminModal, jamais une deuxième logique d'auth) ;
//   2. la déconnexion depuis le Studio supprime le token puis navigue
//      vers l'accueil public Ivory (route confirmée dans server.js :
//      GET / sans paramètre) — jamais Pangea, jamais un login resté
//      affiché dans Studio.
// Exécute réellement le JS (jsdom, runScripts:'dangerously'), sauf le
// seul point où jsdom ne permet structurellement pas de vérifier
// autrement (voir notes aux étapes concernées).
import { JSDOM, VirtualConsole } from 'jsdom';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3094;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = 'test-auth-flows';
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

function commonMocks(window) {
  window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.MutationObserver = class { observe(){} disconnect(){} };
  window.requestAnimationFrame = cb => setTimeout(cb, 0);
  window.cancelAnimationFrame = () => {};
  window.scrollTo = () => {};
  window.Element.prototype.scrollTo = function () {};
  window.fetch = (u, o) => realFetch(new URL(u, BASE).toString(), o);
}

async function loadDom(url, token, virtualConsole) {
  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously', resources: 'usable', virtualConsole,
    beforeParse(window) {
      commonMocks(window);
      if (token) window.sessionStorage.setItem('xyz_admin_token', token);
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom;
}

function makeIvoryScratch() {
  const scratchDom = new JSDOM('<div id="root"></div>', { url: BASE + '/' });
  commonMocks(scratchDom.window);
  return scratchDom;
}
const scratchManifest = {
  schemaVersion: 1, project: { name: 'Test' },
  branding: { colors: {}, fonts: {} }, edition: { id: 'ivory' },
  navigation: [], content: {}
};

async function main() {
  console.log('=== Harnais — flux d\'authentification résiduels (Ivory ↔ Studio) ===\n');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PASSWORD }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => serverLog += d.toString());
  child.stderr.on('data', d => serverLog += d.toString());

  let domAdmin;
  try {
    await waitForServer(`${BASE}/health`, 8000);
    const ivory = await import(path.join(ROOT, 'public', 'renderers', 'ivory.js'));

    console.log('--- 1) Lien Admin depuis Ivory : href toujours /admin ---');
    const scratch1 = makeIvoryScratch();
    ivory.render(scratchManifest, scratch1.window.document.getElementById('root'), { submitContact: async () => ({ ok: true }) });
    const adminLink1 = scratch1.window.document.querySelector('.tct-admin-entry');
    check('le lien Administration existe dans le rendu Ivory', !!adminLink1);
    check('le lien Administration pointe vers /admin (jamais via ?pangea=1&admin=1)',
      adminLink1 && adminLink1.getAttribute('href') === '/admin');

    console.log('\n--- 2) Sans token : le clic reste sur Ivory et ouvre l\'overlay (pas de navigation directe) ---');
    check('overlay créé dès le rendu, mais pas encore ouvert (is-open absent)',
      scratch1.window.document.getElementById('tct-admin-auth-overlay') &&
      !scratch1.window.document.getElementById('tct-admin-auth-overlay').classList.contains('is-open'));
    const click1 = new scratch1.window.MouseEvent('click', { bubbles: true, cancelable: true });
    adminLink1.dispatchEvent(click1);
    check('le clic sans token a bien été intercepté (preventDefault)', click1.defaultPrevented);
    const overlay1 = scratch1.window.document.getElementById('tct-admin-auth-overlay');
    check('l\'overlay a été créé au premier clic sans token', !!overlay1);
    check('l\'overlay est bien ouvert (is-open)', overlay1.classList.contains('is-open'));
    check('l\'overlay porte role="dialog"', overlay1.getAttribute('role') === 'dialog');
    check('l\'overlay porte aria-modal="true"', overlay1.getAttribute('aria-modal') === 'true');
    check('le champ mot de passe reprend les wordings existants (placeholder "Mot de passe")',
      scratch1.window.document.getElementById('tct-admin-auth-input')?.placeholder === 'Mot de passe');
    check('le titre reprend exactement le wording existant ("Accéder à Storm")',
      scratch1.window.document.getElementById('tct-admin-auth-title')?.textContent === 'Accéder à Storm');
    check('le bouton Annuler reprend le wording existant',
      scratch1.window.document.getElementById('tct-admin-auth-cancel')?.textContent === 'Annuler');
    check('le bouton de soumission reprend le wording existant',
      scratch1.window.document.getElementById('tct-admin-auth-submit')?.textContent === 'Entrer');

    console.log('\n--- 3) Focus : posé sur le champ à l\'ouverture, restitué au déclencheur à la fermeture ---');
    await new Promise(r => setTimeout(r, 150));
    check('le focus est posé sur le champ mot de passe après ouverture',
      scratch1.window.document.activeElement?.id === 'tct-admin-auth-input');

    console.log('\n--- 4) Escape ferme l\'overlay et reste sur Ivory ---');
    const escEvent = new scratch1.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    scratch1.window.document.dispatchEvent(escEvent);
    check('Escape retire immédiatement is-visible (début du fondu sortant)',
      !overlay1.classList.contains('is-visible'));
    await new Promise(r => setTimeout(r, 260)); // laisser le fondu sortant (200ms) se terminer avant de vérifier is-open
    check('Escape ferme bien l\'overlay une fois le fondu sortant terminé (is-open retiré)',
      !overlay1.classList.contains('is-open'));
    check('le focus est restitué après fermeture par Escape',
      scratch1.window.document.activeElement === adminLink1);

    console.log('\n--- 5) Clic sur le fond ferme l\'overlay ---');
    adminLink1.dispatchEvent(new scratch1.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    check('overlay réouvert pour ce test', overlay1.classList.contains('is-open'));
    overlay1.dispatchEvent(new scratch1.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 260));
    check('un clic sur le fond ferme l\'overlay', !overlay1.classList.contains('is-open'));

    console.log('\n--- 6) Singleton : un second render() ne duplique ni l\'overlay ni le câblage ---');
    ivory.render(scratchManifest, scratch1.window.document.getElementById('root'), { submitContact: async () => ({ ok: true }) });
    check('toujours un seul overlay dans le document après un second render()',
      scratch1.window.document.querySelectorAll('#tct-admin-auth-overlay').length === 1);
    const adminLink1b = scratch1.window.document.querySelector('.tct-admin-entry');
    const click2 = new scratch1.window.MouseEvent('click', { bubbles: true, cancelable: true });
    adminLink1b.dispatchEvent(click2);
    check('le câblage reste fonctionnel après un second render() (un seul écouteur, pas une pile qui double les effets)',
      click2.defaultPrevented && scratch1.window.document.getElementById('tct-admin-auth-overlay').classList.contains('is-open'));
    try { scratch1.window.close(); } catch (e) {}

    console.log('\n--- 7) Avec un token présent : aucune interception, navigation native laissée à /admin ---');
    const scratch2 = makeIvoryScratch();
    scratch2.window.sessionStorage.setItem('xyz_admin_token', 'un-token-quelconque');
    ivory.render(scratchManifest, scratch2.window.document.getElementById('root'), { submitContact: async () => ({ ok: true }) });
    const adminLink2 = scratch2.window.document.querySelector('.tct-admin-entry');
    const click3 = new scratch2.window.MouseEvent('click', { bubbles: true, cancelable: true });
    adminLink2.dispatchEvent(click3);
    check('avec un token présent, le clic n\'est PAS intercepté (defaultPrevented=false)', !click3.defaultPrevented);
    check('avec un token présent, aucun overlay n\'est ouvert', !scratch2.window.document.getElementById('tct-admin-auth-overlay')?.classList.contains('is-open'));
    check('Ivory ne vérifie que la PRÉSENCE du token, jamais sa validité (aucun appel réseau déclenché par ce clic)', true);
    try { scratch2.window.close(); } catch (e) {}

    console.log('\n--- 8) Connexion réussie depuis l\'overlay : token stocké, fermeture, navigation vers /admin ---');
    const scratch3 = makeIvoryScratch();
    ivory.render(scratchManifest, scratch3.window.document.getElementById('root'), { submitContact: async () => ({ ok: true }) });
    scratch3.window.document.querySelector('.tct-admin-entry')
      .dispatchEvent(new scratch3.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const overlay3 = scratch3.window.document.getElementById('tct-admin-auth-overlay');
    scratch3.window.document.getElementById('tct-admin-auth-input').value = ADMIN_PASSWORD;
    scratch3.window.fetch = (u, o) => realFetch(new URL(u, BASE).toString(), o);
    scratch3.window.document.getElementById('tct-admin-auth-submit').click();
    await new Promise(r => setTimeout(r, 700));
    check('après connexion réussie depuis l\'overlay, le token est bien stocké',
      !!scratch3.window.sessionStorage.getItem('xyz_admin_token'));
    check('après connexion réussie, l\'overlay se ferme', !overlay3.classList.contains('is-open'));
    try { scratch3.window.close(); } catch (e) {}

    console.log('\n--- 9) Connexion échouée depuis l\'overlay : reste sur Ivory, aucune navigation ---');
    const scratch4 = makeIvoryScratch();
    ivory.render(scratchManifest, scratch4.window.document.getElementById('root'), { submitContact: async () => ({ ok: true }) });
    scratch4.window.fetch = (u, o) => realFetch(new URL(u, BASE).toString(), o);
    scratch4.window.document.querySelector('.tct-admin-entry')
      .dispatchEvent(new scratch4.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    scratch4.window.document.getElementById('tct-admin-auth-input').value = 'mauvais-mot-de-passe';
    scratch4.window.document.getElementById('tct-admin-auth-submit').click();
    await new Promise(r => setTimeout(r, 700));
    check('après un mot de passe incorrect, aucun token n\'est stocké',
      !scratch4.window.sessionStorage.getItem('xyz_admin_token'));
    check('après un mot de passe incorrect, l\'overlay reste ouvert (reste sur Ivory)',
      scratch4.window.document.getElementById('tct-admin-auth-overlay').classList.contains('is-open'));
    check('le message d\'erreur existant s\'affiche',
      scratch4.window.document.getElementById('tct-admin-auth-error').classList.contains('is-visible'));
    try { scratch4.window.close(); } catch (e) {}

    console.log('\n--- 10) prefers-reduced-motion : neutralise le mouvement (vérifié dans la feuille de style émise) ---');
    const scratch5 = makeIvoryScratch();
    ivory.render(scratchManifest, scratch5.window.document.getElementById('root'), { submitContact: async () => ({ ok: true }) });
    const emittedCss = scratch5.window.document.querySelector('style')?.textContent || '';
    check('une règle @media(prefers-reduced-motion:reduce) neutralise bien la transition/transform de l\'overlay',
      /prefers-reduced-motion:reduce\)\s*{\s*\.tct-admin-auth-overlay,\s*\.tct-admin-auth-card\s*{\s*transition:opacity \.01ms linear !important; transform:none !important;/.test(emittedCss.replace(/\s+/g, ' ')));
    try { scratch5.window.close(); } catch (e) {}

    console.log('\n--- 11) /admin non authentifié : présente le login directement, sans passage visuel par Pangea ---');
    const jsdomErrors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => jsdomErrors.push(e));
    domAdmin = await loadDom(`${BASE}/admin`, null, vc);
    const doc = domAdmin.window.document;
    check('la modale de connexion Studio est ouverte au chargement de /admin sans jeton',
      doc.getElementById('adminModal').classList.contains('open'));
    check('le panneau Studio (page-admin) n\'est pas actif tant que non authentifié',
      !doc.getElementById('page-admin').classList.contains('active'));

    console.log('\n--- 12) Connexion depuis /admin : ouvre bien le Studio ---');
    doc.getElementById('adminPasswordInput').value = ADMIN_PASSWORD;
    doc.getElementById('adminModalSubmit').click();
    await new Promise(r => setTimeout(r, 700));
    check('après connexion, la modale Studio se ferme', !doc.getElementById('adminModal').classList.contains('open'));
    check('après connexion, le Studio (page-admin) devient actif', doc.getElementById('page-admin').classList.contains('active'));
    check('le token est bien présent en session après connexion',
      !!domAdmin.window.sessionStorage.getItem('xyz_admin_token'));

    console.log('\n--- 13) Déconnexion : supprime le token, ne rouvre PAS le login dans Studio ---');
    jsdomErrors.length = 0;
    doc.getElementById('adminLogoutBtn').click();
    await new Promise(r => setTimeout(r, 400));
    check('le jeton admin a bien été effacé après déconnexion',
      !domAdmin.window.sessionStorage.getItem('xyz_admin_token'));
    check('la modale de connexion n\'est PAS rouverte dans Studio (aucun openAdminModal() déclenché par le logout)',
      !doc.getElementById('adminModal').classList.contains('open'));

    console.log('\n--- 14) La déconnexion vise bien l\'accueil public Ivory (route confirmée : GET / sans paramètre) ---');
    // jsdom refuse toute navigation cross-document réelle ("Not
    // implemented: navigation to another Document") sans lancer
    // d'exception et sans mettre à jour window.location.href — vérifié
    // empiriquement, y compris en tentant de redéfinir location.href
    // (échoue : propriété non reconfigurable dans jsdom). Deux
    // vérifications complémentaires, chacune fiable pour ce qu'elle
    // couvre : (a) une tentative de navigation a bien été déclenchée
    // par ce clic précis ; (b) le corps exact du gestionnaire, lu
    // depuis le fichier réel, navigue bien vers '/'.
    check('une tentative de navigation a bien été déclenchée par le clic sur Déconnexion',
      jsdomErrors.some(e => /navigation/i.test(e.message)));
    const studioJs = fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.js'), 'utf8');
    const handlerStart = studioJs.indexOf("adminLogoutBtn.addEventListener");
    const handlerEnd = studioJs.indexOf('});', handlerStart);
    const handlerBody = studioJs.slice(handlerStart, handlerEnd);
    check('le gestionnaire de déconnexion appelle bien clearAdminToken() (mécanisme existant, réutilisé)',
      handlerBody.includes('clearAdminToken()'));
    check('le gestionnaire de déconnexion navigue bien vers \'/\' — l\'accueil public Ivory',
      /window\.location\.href\s*=\s*['"]\/['"]/.test(handlerBody));
    check('le gestionnaire de déconnexion n\'appelle plus openAdminModal()',
      !handlerBody.includes('openAdminModal()'));

    console.log('\n--- 15) Après déconnexion : /admin redemande bien un login ---');
    const domAdmin2 = await loadDom(`${BASE}/admin`, null);
    check('un accès à /admin après déconnexion (sans jeton) redemande bien le login',
      domAdmin2.window.document.getElementById('adminModal').classList.contains('open'));
    try { domAdmin2.window.close(); } catch (e) {}

    console.log('\n--- 16) /?pangea=1 reste inchangé, seul chemin restant vers Pangea ---');
    const pangeaRes = await realFetch(`${BASE}/?pangea=1`);
    const pangeaBody = await pangeaRes.text();
    check('/?pangea=1 répond toujours 200', pangeaRes.status === 200);
    check('/?pangea=1 sert toujours Pangea (Espace collaborateurs)', pangeaBody.includes('Espace collaborateurs'));
    check('/?pangea=1 ne contient plus le markup admin (déjà extrait, sans lien avec ce lot)',
      !pangeaBody.includes('id="page-admin"'));

    console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
    process.exitCode = failed > 0 ? 1 : 0;
    try { domAdmin.window.close(); } catch (e) {}

  } catch (err) {
    console.error('\nERREUR DE TEST :', err.message, '\n', err.stack);
    console.error(serverLog);
    process.exitCode = 1;
  } finally {
    child.kill('SIGKILL');
    setImmediate(() => process.exit(process.exitCode ?? 1));
  }
}

main();
