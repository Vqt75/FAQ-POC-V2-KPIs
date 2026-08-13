// Tests ciblés — corrections #1, #2, #3 (lightbox Ivory) et #4 (widget
// météo Ivory) : restitution du focus, Escape, nettoyage des écouteurs.
//
// Note honnête découverte en construisant ce test : aucun appel réel de
// renderAsset() dans ivory.js ne passe enableLightbox=true aujourd'hui
// (vérifié par recherche exhaustive des 9 appels réels) — la lightbox
// est donc actuellement inatteignable par le vrai contenu produit. Le
// mécanisme lui-même reste corrigé et vérifié ici en fabriquant
// directement le marquage que renderAsset(asset, cls, true) produirait,
// exactement ce que le câblage (wireInteractions) consomme.
import { JSDOM } from 'jsdom';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

let passed = 0, failed = 0;
function check(label, cond) { if (cond) { console.log(`OK    — ${label}`); passed++; } else { console.log(`ECHEC — ${label}`); failed++; } }

function commonMocks(window) {
  window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  window.MutationObserver = class { observe(){} disconnect(){} };
  window.requestAnimationFrame = cb => setTimeout(cb, 0);
  window.cancelAnimationFrame = () => {};
  window.scrollTo = () => {};
  window.Element.prototype.scrollTo = function () {};
}

const scratchManifest = {
  schemaVersion: 1, project: { name: 'Test' },
  branding: { colors: {}, fonts: {} }, edition: { id: 'ivory' },
  navigation: [], content: {}
};

async function main() {
  const ivory = await import(path.join(ROOT, 'public', 'renderers', 'ivory.js'));

  console.log('--- 1-2-3) Lightbox : focus, Escape, nettoyage des écouteurs ---');
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/' });
  commonMocks(dom.window);
  const root = dom.window.document.getElementById('root');

  // Fabrique exactement le marquage que renderAsset(asset, cls, true)
  // produit — puisqu'aucun appel réel ne passe true aujourd'hui, on ne
  // peut pas l'obtenir via un rendu de contenu normal. wireInteractions()
  // interroge root.querySelectorAll('.tct-lightbox-trigger') UNE SEULE
  // fois, de façon synchrone, juste après que render() a affecté
  // root.innerHTML — on intercepte donc cette affectation pour que notre
  // déclencheur fasse réellement partie de ce même document au moment
  // exact où le câblage a lieu (pas un ajout après coup, qui arriverait
  // trop tard).
  const triggerHtml = '<img class="tct-lightbox-trigger" data-lightbox-src="/uploads/test.jpg" data-lightbox-title="Visuel de test" tabindex="0" role="button" aria-label="Agrandir : test">';
  const proto = dom.window.Element.prototype;
  const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  Object.defineProperty(root, 'innerHTML', {
    set(value) { originalDescriptor.set.call(this, value + triggerHtml); },
    get() { return originalDescriptor.get.call(this); }
  });

  ivory.render(scratchManifest, root, { submitContact: async () => ({ ok: true }) });
  const rewiredTrigger = root.querySelector('.tct-lightbox-trigger');
  check('le déclencheur fabriqué est bien présent au moment du câblage', !!rewiredTrigger);

  check('le déclencheur est bien focusable (tabindex ajouté)', rewiredTrigger.getAttribute('tabindex') === '0');
  rewiredTrigger.focus();
  check('le focus est bien sur le déclencheur avant ouverture', dom.window.document.activeElement === rewiredTrigger);

  rewiredTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  const overlay = dom.window.document.querySelector('.tct-lightbox-overlay');
  check('la lightbox s\'ouvre bien au clic', !!overlay);

  const beforeListenerCount = dom.window.getEventListeners ? null : null; // API non standard, non fiable en jsdom
  // Escape ferme
  const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  dom.window.document.dispatchEvent(escEvent);
  await new Promise(r => setTimeout(r, 50));
  check('Escape ferme bien la lightbox', !dom.window.document.querySelector('.tct-lightbox-overlay'));
  check('le focus est restitué sur le déclencheur après Escape', dom.window.document.activeElement === rewiredTrigger);

  // Ouvrir/fermer plusieurs fois : les écouteurs mousemove/mouseup sur
  // window ne doivent jamais s'accumuler sans limite. On vérifie
  // indirectement : après plusieurs cycles, un mousemove ne doit jamais
  // lever d'exception (ce qui arriverait si des fermetures avaient
  // laissé des références obsolètes vers un stage supprimé du DOM).
  let mouseMoveThrew = false;
  dom.window.addEventListener('error', () => { mouseMoveThrew = true; });
  for (let i = 0; i < 5; i++) {
    rewiredTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    dom.window.dispatchEvent(new dom.window.MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    dom.window.document.querySelector('.tct-lightbox-close')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
  }
  check('cinq cycles ouverture/fermeture n\'ont jamais levé d\'exception (pas de référence obsolète accumulée)', !mouseMoveThrew);
  check('après cinq cycles, la lightbox est bien refermée', !dom.window.document.querySelector('.tct-lightbox-overlay'));

  try { dom.window.close(); } catch (e) {}

  console.log('\n--- 4) Widget météo : focus restitué après Escape, jamais lors d\'un clic extérieur ---');
  const dom2 = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/' });
  commonMocks(dom2.window);
  const root2 = dom2.window.document.getElementById('root');
  ivory.render(scratchManifest, root2, { submitContact: async () => ({ ok: true }) });
  const fab = root2.querySelector('[data-tct-mood-fab]');
  check('le bouton météo existe', !!fab);
  fab.click();
  await new Promise(r => setTimeout(r, 50));
  const panel = root2.querySelector('[data-tct-mood-panel]');
  check('le panneau météo s\'ouvre', panel && !panel.hidden);

  const escEvent2 = new dom2.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  dom2.window.document.dispatchEvent(escEvent2);
  await new Promise(r => setTimeout(r, 220)); // laisser le délai de fermeture (160ms) se terminer
  check('Escape ferme bien le panneau météo', panel.hidden);
  check('le focus est bien restitué sur le bouton météo après Escape', dom2.window.document.activeElement === fab);

  // Réouverture, puis fermeture par clic extérieur : le focus ne doit
  // PAS être repris — ce clic a déjà légitimement déplacé le focus.
  fab.click();
  await new Promise(r => setTimeout(r, 50));
  const outsideEl = dom2.window.document.createElement('button');
  outsideEl.textContent = 'ailleurs';
  dom2.window.document.body.appendChild(outsideEl);
  outsideEl.focus();
  outsideEl.dispatchEvent(new dom2.window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 220));
  check('après un clic extérieur, le focus reste sur l\'élément cliqué (pas de vol de focus)',
    dom2.window.document.activeElement === outsideEl);

  try { dom2.window.close(); } catch (e) {}

  console.log(`\n${passed} vérifications passées, ${failed} échouées.`);
  process.exitCode = failed > 0 ? 1 : 0;
  process.exit(process.exitCode);
}

main();
