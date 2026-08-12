const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('../publication-candidate');
const { compile } = require('../compiler');
const {
  normalizeNewsBlocks,
  splitRunsAtOffset,
  newsBlocksToPlainText,
  newsBlocksToLegacyBody
} = require('../news-content');

const ROOT = path.resolve(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const compilerJs = fs.readFileSync(path.join(ROOT, 'tectonic/compiler.js'), 'utf8');
const ivoryJs = fs.readFileSync(path.join(ROOT, 'public/renderers/ivory.js'), 'utf8');

let checks = 0;
function ok(condition, label) {
  if (!condition) {
    console.error(`ECHEC — ${label}`);
    process.exitCode = 1;
    return;
  }
  checks += 1;
  console.log(`OK — ${label}`);
}

console.log('\n=== Studio Actualités 3A.2 — sélection, curseur exact et reader PDF ===');
ok(indexHtml.includes('id="adminPanelNews"'), 'Actualités possède son propre panel Studio V2');
ok(indexHtml.includes('function renderNewsEditor(content)'), 'un éditeur Actualités dédié est rendu');
ok(indexHtml.includes('data-news-format="bold"'), 'le gras est disponible');
ok(indexHtml.includes('data-news-format="italic"'), 'l’italique est disponible');
ok(indexHtml.includes('data-news-format="highlight"'), 'la mise en évidence sémantique est disponible');
ok(indexHtml.includes('data-news-format="link"'), 'les liens sont disponibles');
ok(indexHtml.includes('data-news-structure="heading"'), 'les intertitres sont disponibles sans Markdown visible');
ok(indexHtml.includes('data-news-structure="bulletList"'), 'les listes à puces sont disponibles');
ok(indexHtml.includes('data-news-structure="orderedList"'), 'les listes numérotées sont disponibles');
ok(indexHtml.includes('id="studioNewsToggleMedia"'), 'le média inline est accessible depuis la barre de rédaction');
ok(indexHtml.includes('data-news-inline-media="image"'), 'un média inline peut être une image');
ok(indexHtml.includes('data-news-inline-media="gallery"'), 'un média inline peut être une galerie');
ok(indexHtml.includes('data-news-inline-media="document"'), 'un média inline peut être un document');
ok(indexHtml.includes('Déposez aussi vos fichiers ici'), 'le multimédia inline accepte aussi le drag & drop');
ok(indexHtml.includes('Les couleurs, polices, tailles et styles restent sous le contrôle de l’édition Storm.'), 'la doctrine anti-carnaval est explicitée');
ok(!indexHtml.includes('type="color" data-news'), 'aucun sélecteur de couleur n’est exposé dans l’éditeur d’articles');
ok(!indexHtml.includes('studioNewsBody'), 'le vieux textarea Markdown du corps d’article a disparu');
ok(indexHtml.includes("replace(/\\s*\\n+\\s*/g,' ')"), 'le collage est neutralisé en texte simple pour éviter les styles Word entrants');
ok(indexHtml.includes("const mark=document.createElement('mark')"), 'le surlignage produit un mark sémantique, pas une couleur libre');
ok(indexHtml.includes("document.execCommand('createLink'"), 'le lien est appliqué au texte sélectionné');
ok(indexHtml.includes("if (e.key === 'Enter')"), 'la touche Entrée est gérée par la structure éditoriale');
ok(indexHtml.includes("block.type === 'bulletList' || block.type === 'orderedList'"), 'les listes utilisent des blocs sémantiques, pas des puces décoratives');
ok(indexHtml.includes("selection.isCollapsed"), 'gras, italique et surlignage exigent une sélection réelle');
ok(indexHtml.includes('Sélectionnez précisément le texte à mettre en forme.'), 'une action de format sans sélection est explicitement refusée');
ok(indexHtml.includes('function insertBlockAtPoint(article, block, point)'), 'les médias possèdent une insertion sémantique au point du curseur');
ok(indexHtml.includes('function selectionOffsetWithin(editable, range)'), 'la position exacte du curseur est mémorisée dans le bloc texte');
ok(indexHtml.includes('article.contentBlocks.splice(index+1,0,block,after)'), 'un paragraphe peut être scindé autour du média');
ok(indexHtml.includes('Le média sera placé exactement à l’emplacement du curseur.'), 'l’interface explique le placement du média sans jargon technique');
ok(indexHtml.includes('data-news-document-description'), 'un document peut recevoir une description courte');
ok(indexHtml.includes('fileSize:Number(file.size || 0)'), 'le Studio conserve le poids du PDF pour l’affichage public');

console.log('\n=== Modèle de contenu sémantique ===');
const blocks = normalizeNewsBlocks([
  { id:'p1', type:'paragraph', runs:[{text:'Une phrase '},{text:'importante',bold:true,highlight:true},{text:' et un lien',href:'https://example.com'}] },
  { id:'l1', type:'bulletList', items:[{runs:[{text:'Premier point'}]},{runs:[{text:'Deuxième point',italic:true}]}] },
  { id:'o1', type:'orderedList', items:[{runs:[{text:'Étape un'}]},{runs:[{text:'Étape deux'}]}] },
  { id:'i1', type:'image', asset:{url:'/uploads/a.jpg',alt:'Vue du work-café',caption:'Projection'} },
  { id:'g1', type:'gallery', items:[{url:'/uploads/a.jpg',alt:'Vue A'},{url:'/uploads/b.jpg',alt:'Vue B'}], caption:'Deux variantes' },
  { id:'d1', type:'document', asset:{url:'/uploads/plan.pdf'}, title:'Kit de déménagement', description:'Toutes les informations pratiques pour préparer votre arrivée.', fileName:'kit-demenagement.pdf', fileSize:2516582 }
]);
ok(blocks.length === 6, 'les six types de blocs testés survivent à la normalisation');
const split = splitRunsAtOffset([{text:'Avant ',bold:true},{text:'après',italic:true}], 4);
ok(split.before.map(run => run.text).join('') === 'Avan' && split.after.map(run => run.text).join('') === 't après', 'un curseur peut scinder le texte exactement à son offset');
ok(split.before[0].bold === true && split.after[0].bold === true && split.after[1].italic === true, 'la scission conserve les emphases de part et d’autre du média');
ok(blocks[0].runs[1].bold === true && blocks[0].runs[1].highlight === true, 'les emphases sont stockées comme attributs de run');
ok(blocks[0].runs[2].href === 'https://example.com', 'les liens sûrs sont conservés');
const unsafe = normalizeNewsBlocks([{id:'p',type:'paragraph',runs:[{text:'x',href:'javascript:alert(1)'}]}]);
ok(!unsafe[0].runs[0].href, 'un href javascript est supprimé');
ok(newsBlocksToPlainText(blocks).includes('Premier point'), 'le calcul de lecture peut extraire le texte des listes');
ok(newsBlocksToLegacyBody(blocks).includes('- Premier point'), 'le fallback Pangea reçoit encore une représentation texte des puces');
ok(newsBlocksToLegacyBody(blocks).includes('1. Étape un'), 'le fallback Pangea reçoit encore une représentation texte des listes numérotées');
const migrated = normalizeNewsBlocks(null, 'Intro\n\n## Intertitre\n\n- A\n- B\n\n1. Un\n2. Deux');
ok(migrated.some(block => block.type === 'heading'), 'un article legacy est migré vers un intertitre sémantique');
ok(migrated.some(block => block.type === 'bulletList'), 'les puces legacy sont reconnues à la migration');
ok(migrated.some(block => block.type === 'orderedList'), 'les listes numérotées legacy sont reconnues à la migration');

console.log('\n=== Node / Candidate / Compiler / Ivory ===');
ok(serverJs.includes('contentBlocks'), 'Node persiste le contenu riche structuré');
ok(serverJs.includes('newsBlocksToLegacyBody'), 'Node maintient le body legacy pendant la coexistence Pangea');
ok(compilerJs.includes('blocks,'), 'le Compiler transporte les blocs dans le Manifest');
ok(compilerJs.includes('newsBlocksToPlainText(blocks)'), 'le temps de lecture repose sur le contenu sémantique');

const source = {
  branding:{ projectName:'Projet test', logoUrl:'', theme:'default', colors:['#1E1D1E'], fonts:[{name:'Roboto',source:'system'}] },
  publicContent:{ actu:{ eyebrow:'Actualités', titleLine1:'Le projet', titleAccent:'avance.', desc:'Suivez le projet.' } },
  faqEntries:[], milestones:[], plans:[], ambassadorsContent:{}, ambassadors:[], teamContent:{}, team:[],
  articles:[{
    id:'rich', title:'Une actualité riche', publishedAt:'2026-08-10', tag:'Espaces', chapeau:'Résumé',
    body:'fallback',
    contentBlocks:blocks,
    asset:{url:'/uploads/cover.jpg',alt:'Image de couverture'}
  }]
};
const candidate = buildPublicationCandidate(source);
const manifest = compile(candidate,{generatedAt:'2026-08-10T18:00:00.000Z',revision:'news-3a1-test',supportedEditions:['ivory','rainbow-glass','midnight-frost']});
const item = manifest.content.news.items[0];
ok(Array.isArray(item.blocks) && item.blocks.length === 6, 'les blocs franchissent réellement Candidate → Compiler → Manifest');
ok(item.blocks[3].asset.url === '/uploads/a.jpg', 'le média inline franchit le Manifest');
ok(item.blocks[5].title === 'Kit de déménagement', 'le document conserve son libellé public');
ok(item.blocks[5].description.includes('informations pratiques'), 'la description du document franchit le Manifest');
ok(item.blocks[5].fileSize === 2516582, 'le poids du PDF franchit le Manifest');
ok(Number.isInteger(item.readingMinutes) && item.readingMinutes >= 1, 'le temps de lecture reste calculé automatiquement');
ok(ivoryJs.includes('function renderNewsRuns(runs)'), 'Ivory rend les runs d’emphase sémantique');
ok(ivoryJs.includes("block.type === 'bulletList' || block.type === 'orderedList'"), 'Ivory rend les deux types de listes');
ok(ivoryJs.includes("block.type === 'gallery'"), 'Ivory rend les galeries inline');
ok(ivoryJs.includes("block.type === 'document'"), 'Ivory rend les documents inline');
ok(ivoryJs.includes('data-tct-pdf-reader'), 'un document ouvre le reader Storm au lieu d’un simple nouvel onglet');
ok(ivoryJs.includes('Retour à l’article'), 'le reader conserve une sortie explicite vers le contexte éditorial');
ok(ivoryJs.includes('toolbar=0&navpanes=0'), 'le PDF est présenté sous le chrome Storm plutôt que sous une barre technique permanente');
ok(ivoryJs.includes('data-pdf-fullscreen'), 'le reader peut passer en plein écran sans imposer ce mode');
ok(ivoryJs.includes('tct-news-document-download'), 'le téléchargement reste disponible comme action secondaire');
ok(ivoryJs.includes('.tct-news-article-reading mark'), 'Ivory décide lui-même de l’apparence du surlignage');
ok(!ivoryJs.includes('background:#FFFF00'), 'aucun jaune de surlignage codé en dur façon traitement de texte');

if (process.exitCode) {
  console.error(`\n${checks} vérifications passées avant échec.`);
  process.exit(process.exitCode);
}
console.log(`\nOK — Studio Actualités 3A.2 : ${checks} vérifications validées.`);
