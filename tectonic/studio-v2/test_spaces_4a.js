const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('../publication-candidate');
const { compile } = require('../compiler');
const {
  SPACE_STATUS,
  createDefaultSpaces,
  normalizeSpaces,
  bootstrapSpaces,
  migrateLegacyPlansToSpaces,
  spacesToLegacyPlans
} = require('../spaces-content');

const ROOT = path.resolve(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const compilerJs = fs.readFileSync(path.join(ROOT, 'tectonic/compiler.js'), 'utf8');
const candidateJs = fs.readFileSync(path.join(ROOT, 'tectonic/publication-candidate.js'), 'utf8');
const ivoryJs = fs.readFileSync(path.join(ROOT, 'public/renderers/ivory.js'), 'utf8');
const editorStart = indexHtml.indexOf('function renderVisualsEditor(content)');
const editorEnd = indexHtml.indexOf('async function parseDocxToFaqEntries', editorStart);
const editor = indexHtml.slice(editorStart, editorEnd);

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

console.log('\n=== Studio Espaces 4A.1 — UX sémantique + bootstrap robuste ===');
ok(editorStart >= 0, 'l’onglet Espaces possède un éditeur dédié');
ok(editor.includes('<h1>Espaces.</h1>'), 'l’éditeur se présente comme Espaces, plus Plans & 3D');
ok(!editor.includes('Plans &amp; 3D.'), 'le vieux paradigme Plans & 3D a disparu de la surface Studio');
ok(editor.includes('Nom de l’espace'), 'le lieu est d’abord identifié par son nom');
ok(editor.includes('Où se trouve-t-il ?'), 'la localisation facultative est disponible');
ok(editor.includes('Où en est cet espace ?'), 'l’état du lieu est explicite');
ok(editor.includes('En cours de conception'), 'l’état conception est disponible');
ok(editor.includes("Validé"), 'l’état validé est disponible');
ok(editor.includes('Livré'), 'l’état livré est disponible');
ok(editor.includes('À quoi sert-il ?'), 'les usages humains structurent l’espace');
ok(editor.includes('Se concentrer'), 'la concentration est un usage proposé');
ok(editor.includes('Collaborer'), 'la collaboration est un usage proposé');
ok(editor.includes('Faire une pause'), 'la pause est un usage proposé');
ok(editor.includes('Pas de tags techniques'), 'l’interface explicite l’abandon des tags techniques');
ok(editor.includes('Une vue de l’espace'), 'un média peut être une vue');
ok(editor.includes('Un plan à explorer'), 'un média peut être un plan inspectable');
ok(editor.includes('Un document à consulter'), 'un média peut être un document');
ok(editor.includes('Déposez vos visuels ou documents ici'), 'les médias acceptent le drag & drop');
ok(editor.includes('multiple hidden'), 'plusieurs médias peuvent être ajoutés en une fois');
ok(editor.includes('draggable="true"'), 'les espaces peuvent être réordonnés par glisser-déposer');
ok(editor.includes('Enregistrer les espaces'), 'un seul geste global de sauvegarde reste présent en attendant l’autosave');
ok(!editor.includes('Type de contenu'), 'aucun champ technique Type de contenu n’est demandé');
ok(!editor.includes('Filtres'), 'aucun champ libre de filtres techniques n’est demandé');

console.log('\n=== Contrat / migration ===');
const defaults = createDefaultSpaces();
ok(defaults.length >= 5, 'le POC démarre avec une collection d’espaces pré-rédigée');
ok(defaults.some(space => space.name === 'Work-café'), 'le POC inclut un Work-café pré-rédigé');
ok(defaults.some(space => space.name === 'Espaces de concentration'), 'le POC inclut les espaces de concentration');
ok(defaults.every(space => Array.isArray(space.usages)), 'chaque espace porte une liste d’usages');
ok(defaults.every(space => Array.isArray(space.media)), 'chaque espace porte sa propre collection de médias');

const legacy = [{
  id:'legacy-1', type:'3D', tags:'Ambiance', title:'Vue 3D — espace de convivialité central',
  imageUrl:'/uploads/workcafe.jpg', comment:'Le cœur du site.'
}];
const migrated = migrateLegacyPlansToSpaces(legacy);
ok(migrated[0].name === 'Work-café', 'un visuel legacy connu est migré vers un espace compréhensible');
ok(migrated[0].media[0].url === '/uploads/workcafe.jpg', 'la migration conserve le média legacy');
ok(migrated[0].description === 'Le cœur du site.', 'la migration conserve le texte d’accompagnement');
const normalizedEmpty = normalizeSpaces([], legacy);
ok(normalizedEmpty.length === 0, 'le normaliseur pur respecte toujours une collection explicitement vide');
const fallbackMigrated = normalizeSpaces(undefined, legacy);
ok(fallbackMigrated.length === 1, 'l’absence de spaces déclenche la migration depuis plans');
const bootstrapLegacyEmpty = bootstrapSpaces([], legacy, false);
ok(bootstrapLegacyEmpty.length === 1 && bootstrapLegacyEmpty[0].name === 'Work-café', 'un ancien spaces vide migre malgré tout les plans legacy');
const bootstrapPocEmpty = bootstrapSpaces([], [], false);
ok(bootstrapPocEmpty.length >= 5 && bootstrapPocEmpty.some(space => space.name === 'Work-café'), 'un ancien état totalement vide amorce le POC pré-rédigé');
const deliberateEmpty = bootstrapSpaces([], [], true);
ok(deliberateEmpty.length === 0, 'après initialisation 4A, supprimer volontairement tous les espaces reste possible');
const backToLegacy = spacesToLegacyPlans([{ id:'s', name:'Work-café', status:'approved', description:'Lieu central', usages:['Faire une pause'], media:[{id:'m',kind:'view',url:'/uploads/a.jpg',label:'Vue'}] }]);
ok(backToLegacy.length === 1 && backToLegacy[0].imageUrl === '/uploads/a.jpg', 'la projection de compatibilité Pangea conserve le fichier');
ok(backToLegacy[0].tags.includes('Faire une pause'), 'la projection Pangea reste dérivée des usages sémantiques');
ok(SPACE_STATUS.approved.label === 'Validé', 'le statut interne est traduit par le système, pas saisi librement');

console.log('\n=== Node / Candidate / Compiler / Ivory ===');
ok(serverJs.includes("require('./tectonic/spaces-content')"), 'Node partage le normaliseur d’espaces');
ok(serverJs.includes('spaces: bootstrapSpaces(parsed.spaces'), 'Node bootstrappe les anciens contenus à la lecture');
ok(serverJs.includes('spacesInitialized: true'), 'Node mémorise qu’une collection Espaces a été explicitement initialisée');
ok(editor.includes('studioDefaultSpacesSeed'), 'le navigateur garde un filet de sécurité POC si un ancien serveur renvoie encore une collection vide');
ok(serverJs.includes('safe.plans = spacesToLegacyPlans(safe.spaces)'), 'plans devient une projection de compatibilité à la sauvegarde');
ok(candidateJs.includes('spaces: snapshot.spaces'), 'Publication Candidate whitelist explicitement spaces');
ok(compilerJs.includes('normalizeSpaces(candidate?.spaces, candidate?.plans)'), 'le Compiler préfère le contrat Tectonic et garde un fallback legacy');
ok(compilerJs.includes('usageTags:'), 'les usages humains franchissent le Compiler');
ok(compilerJs.includes('location: space.location'), 'la localisation franchit le Compiler');
ok(compilerJs.includes('kind: asset.kind'), 'le rôle sémantique de chaque média franchit le Compiler');

const source = {
  branding:{ projectName:'Projet Quatro', logoUrl:'', theme:'default', colors:['#1E1D1E','#C2AF7E'], fonts:[{name:'Roboto',source:'system'},{name:'Italiana',source:'system'}] },
  project:{ intro:{title:'Projet',body:'Test'}, sections:[] },
  publicContent:{ faq:{}, actu:{}, plans:{ eyebrow:'Espaces', titleLine1:'Les espaces', titleAccent:'prennent forme.', desc:'Découvrir les lieux.' }, ambassadeurs:{}, equipe:{} },
  milestones:[], articles:[], plans:[], faqEntries:[], ambassadorsContent:{}, ambassadors:[], teamContent:{}, team:[],
  spaces:[{
    id:'workcafe', name:'Work-café', location:'Niveau 5', status:'approved', description:'Un lieu central.',
    usages:['Faire une pause','Collaborer'],
    media:[
      {id:'v',kind:'view',url:'/uploads/workcafe.jpg',label:'Vue du work-café',alt:'Work-café lumineux'},
      {id:'p',kind:'plan',url:'/uploads/niveau5.pdf',label:'Plan du niveau 5',alt:''}
    ]
  }]
};
const candidate = buildPublicationCandidate(source);
const manifest = compile(candidate,{ generatedAt:'2026-08-10T20:00:00.000Z', revision:'spaces-4a-test', supportedEditions:['ivory','rainbow-glass','midnight-frost'] });
const item = manifest.content.spaces.items[0];
ok(item.title === 'Work-café', 'le nom métier devient le titre public');
ok(item.location === 'Niveau 5', 'la localisation arrive dans le Manifest');
ok(item.status === 'Validé', 'le statut public est produit par Storm');
ok(item.usageTags.length === 2, 'les usages franchissent Candidate → Compiler → Manifest');
ok(item.media.length === 2, 'plusieurs médias restent attachés au même espace');
ok(item.media[1].kind === 'plan', 'un PDF peut rester sémantiquement un plan');
ok(item.asset.url === '/uploads/workcafe.jpg', 'le premier média reste disponible comme asset principal');
ok(ivoryJs.includes("return asset.kind === 'plan'"), 'Ivory inspecte un plan selon son rôle, pas seulement son extension');
ok(ivoryJs.includes('item && item.location'), 'Ivory tient compte de la localisation dans la sémantique de l’espace');
ok(ivoryJs.includes("asset.kind === 'plan' ? 'Explorer le plan' : 'Consulter le document'"), 'Ivory distingue plan et document dans son langage public');

if (process.exitCode) {
  console.error(`\n${checks} vérifications passées avant échec.`);
  process.exit(process.exitCode);
}
console.log(`\nOK — Studio Espaces 4A.1 : ${checks} vérifications validées.`);
