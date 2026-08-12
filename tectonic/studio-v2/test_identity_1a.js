const fs = require('fs');
const path = require('path');
const assert = require('assert');
const BrandEngine = require('../../public/brand-engine.js');
const { buildPublicationCandidate } = require('../publication-candidate');
const { compile, CompilerBlockingError } = require('../compiler');

const ROOT = path.join(__dirname, '..', '..');
let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`OK — ${message}`);
}

function baseCandidate() {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tectonic', 'fixture-real-pangea-content.json'), 'utf8'));
  return buildPublicationCandidate(fixture);
}

const context = { generatedAt:'2026-08-10T16:00:00.000Z', revision:'identity-1a', supportedEditions:['ivory','rainbow-glass','midnight-frost'] };

console.log('\n=== Brand Engine ===');
const parella = BrandEngine.resolve(['#1E1D1E', '#C2AF7E']);
ok(parella.roles.accent === '#C2AF7E', 'Parella : primaire neutre + secondaire exploitable -> accent secondaire brut');
ok(parella.raw[1] === '#C2AF7E', 'les couleurs brutes ne sont jamais corrigées');
const wavestone = BrandEngine.resolve(['#451DC6', '#04EF6A']);
ok(wavestone.roles.accent === '#451DC6', 'Wavestone : primaire chromatique exploitable -> accent primaire');
const mono = BrandEngine.resolve(['#111111']);
ok(mono.roles.accent === '#1E1D1E', 'palette monochrome neutre -> repli ink, sans beige inventé');
ok(['MONO_ACCENT','TONAL_ACCENT','DUAL_ACCENT'].includes(wavestone.mode), 'le moteur retourne une classe de palette bornée');

console.log('\n=== Compiler / polices ===');
const withFont = baseCandidate();
withFont.branding.fonts[0] = { name:'Client Sans', fileName:'client-sans.woff2', source:'upload', assetUrl:'/uploads/abc123.woff2' };
const manifestWithFont = compile(withFont, context);
ok(manifestWithFont.branding.fonts.primary.family === 'Client Sans', 'la famille uploadée est conservée dans le Manifest');
ok(manifestWithFont.branding.fonts.primary.asset.url === '/uploads/abc123.woff2', 'l’asset de police servable entre dans le Manifest');

const brokenFont = baseCandidate();
brokenFont.branding.fonts[0] = { name:'Broken Sans', fileName:'broken.woff2', source:'upload', assetUrl:'' };
let blocked = false;
try { compile(brokenFont, context); } catch (error) { blocked = error instanceof CompilerBlockingError; }
ok(blocked, 'une police marquée upload sans asset servable bloque toujours la publication');

console.log('\n=== Couleur unique ===');
const singleColor = baseCandidate();
singleColor.branding.colors = ['#451DC6'];
const singleManifest = compile(singleColor, context);
ok(singleManifest.branding.colors.primary === '#451DC6', 'couleur unique : primaire conservée');
ok(singleManifest.branding.colors.secondary === '#451DC6', 'couleur unique : aucun beige secondaire n’est inventé');

console.log('\n=== Contrats UI / serveur / renderer ===');
const index = fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.js'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const ivory = fs.readFileSync(path.join(ROOT, 'public', 'renderers', 'ivory.js'), 'utf8');
const tectonicHtml = fs.readFileSync(path.join(ROOT, 'public', 'tectonic.html'), 'utf8');
ok(index.includes('Identité &amp; apparence.') && index.includes('Édition Storm'), 'Studio expose le domaine Identité & apparence et l’Édition Storm');
ok(index.includes('Voir la démo Wavestone') && index.includes('Wavestone dans Storm.'), 'la démo Wavestone est conservée');
ok(index.includes('id="saveIdentityBtn"') && !index.includes('<div class="kpi-section-title">Textes du site</div>'), 'Identité ne contient plus l’ancien éditeur de textes du site');
ok(index.includes('./public/brand-engine.js'), 'le Studio charge le Brand Engine partagé');
ok(server.includes("'font/woff2': '.woff2'") && server.includes('assetUrl:'), 'Node accepte les polices et persiste leur assetUrl borné à /uploads/');
ok(server.includes("'.woff2', '.woff', '.ttf', '.otf'"), 'les fichiers de police uploadés sont aussi servis par la whitelist statique');
ok(ivory.includes('fontFaceCss') && ivory.includes('fontAssetsCss'), 'Ivory charge les assets typographiques déclarés dans le Manifest');
ok(tectonicHtml.includes('/public/brand-engine.js') && ivory.includes('StormBrandEngine'), 'Ivory et le Studio partagent le même Brand Engine quand Tectonic est servi');

console.log(`\nOK — Studio Identity 1A : ${checks} vérifications validées.`);
