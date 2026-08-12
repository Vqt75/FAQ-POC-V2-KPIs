'use strict';

const fs = require('fs');
const path = require('path');
const { createDefaultProject, normalizeProject } = require('./project-schema');
const { buildPublicationCandidate } = require('../publication-candidate');
const { compile } = require('../compiler');

const ROOT = path.join(__dirname, '..', '..');
let passed = 0;
function check(label, condition) {
  if (!condition) {
    console.error(`ECHEC — ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`OK — ${label}`);
    passed += 1;
  }
}

console.log('\n=== Contrat sémantique Le projet 2A.2 ===');
const fallback = createDefaultProject();
check('une introduction pré-rédigée flex office existe', /flex office/i.test(fallback.intro.body));
check('les neuf typologies sont proposées dès le départ', fallback.sections.length === 9);
check('la structure proposée préactive les sections principales', fallback.sections.filter(s => s.enabled !== false).length === 7);
check('image et galerie sont proposées mais désactivées par défaut', ['image','gallery'].every(type => fallback.sections.find(s => s.type === type)?.enabled === false));
check('le fallback contient une trajectoire', fallback.sections.some(s => s.type === 'timeline'));
check('le fallback contient l’équipe projet', fallback.sections.some(s => s.type === 'team'));

const normalized = normalizeProject({
  intro: { title: 'Projet Quatro', body: 'Une transformation.' },
  sections: [
    { id:'a', type:'focus', enabled:true, title:'Pourquoi ?', body:'Parce que.' , columns: 7, background:'pink' },
    { id:'b', type:'timeline', enabled:false },
    { id:'c', type:'timeline' },
    { id:'d', type:'team' },
    { id:'e', type:'team' },
    { id:'f', type:'keyFigures', title:'Repères', items:[{ value:'90', label:'collaborateurs', color:'#f00' }] }
  ]
});
check('timeline est singleton', normalized.sections.filter(s => s.type === 'timeline').length === 1);
check('team est singleton', normalized.sections.filter(s => s.type === 'team').length === 1);
check('état activé/désactivé survit à la normalisation', normalized.sections.find(s => s.id === 'b')?.enabled === false);
check('les slots image et galerie sont ajoutés en migration 2A → 2A.1', ['image','gallery'].every(type => normalized.sections.some(s => s.type === type)));
check('les slots ajoutés restent désactivés', ['image','gallery'].every(type => normalized.sections.find(s => s.type === type)?.enabled === false));
check('aucun réglage de colonnes ne survit à la normalisation', !('columns' in normalized.sections[0]));
check('aucun réglage de background ne survit à la normalisation', !('background' in normalized.sections[0]));

const upgraded = normalizeProject({
  intro: {
    title:'Un nouvel environnement pour travailler autrement.',
    body:'Le projet rassemble les équipes dans de nouveaux espaces conçus pour mieux répondre aux différents usages de la journée.'
  },
  sections:[
    { id:'old-focus', type:'focus', title:'Un projet pensé à partir des usages.', body:'Les espaces sont conçus à partir des activités réellement réalisées au cours d’une journée : se concentrer, échanger, collaborer, se réunir ou simplement changer de rythme.' },
    { id:'old-kpi', type:'keyFigures', title:'Quelques repères', items:[{value:'1 200',label:'m² d’espaces'},{value:'90',label:'collaborateurs'},{value:'8',label:'espaces collaboratifs'}] },
    { id:'old-text', type:'text', title:'Des espaces pour plusieurs manières de travailler.', body:"L’objectif n’est pas d’imposer une seule façon de faire, mais d’offrir des environnements adaptés aux différents moments de la journée. Les choix d’aménagement cherchent à rendre ces possibilités immédiatement lisibles et faciles à utiliser." },
    { id:'old-timeline', type:'timeline' },
    { id:'old-quote', type:'quote', quote:'Nous voulons créer un lieu où chacun puisse trouver l’environnement adapté à ce qu’il a à faire.', attribution:'Équipe projet' },
    { id:'old-choices', type:'choices', title:'Ce qui guide les choix', items:[{title:'Partir des usages',body:'Observer le travail réel avant de figer les réponses spatiales.'}] },
    { id:'old-team', type:'team' }
  ]
});
check('les textes POC 2A non modifiés sont enrichis automatiquement', /flex office/i.test(upgraded.intro.body) && /quotidien/i.test(upgraded.sections.find(s => s.type === 'text')?.title || ''));

console.log('\n=== Candidate → Compiler → Manifest ===');
const snapshot = {
  branding: { projectName:'Projet Quatro', theme:'default', colors:['#1E1D1E','#C2AF7E'], fonts:[{name:'Roboto',source:'system'},{name:'Italiana',source:'system'}] },
  project: normalized,
  publicContent: { faq:{}, actu:{}, plans:{}, ambassadeurs:{}, equipe:{} },
  milestones: [{ id:'m1', status:'current', date:'Août 2026', label:'Conception', desc:'Les études avancent.' }],
  articles: [], plans: [], ambassadorsContent:{}, ambassadors:[], teamContent:{}, team:[], faqEntries:[]
};
const candidate = buildPublicationCandidate(snapshot);
check('project franchit explicitement la whitelist du Publication Candidate', candidate.project === normalized);
const manifest = compile(candidate, { generatedAt:'2026-08-10T16:00:00.000Z', revision:'test-project-2a1', supportedEditions:['ivory','rainbow-glass','midnight-frost'] });
check('content.project est compilé', manifest.content.project?.intro?.title === 'Projet Quatro');
check('une section désactivée ne part pas dans le Manifest', !manifest.content.project.sections.some(s => s.id === 'b'));
check('les sections actives conservent leur ordre sémantique', manifest.content.project.sections[0]?.type === 'focus');
check('timeline publique reste alimentée par milestones', manifest.content.timeline.milestones.length === 1);

console.log('\n=== Contrats Studio / serveur ===');
const index = fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.js'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'public', 'renderers', 'ivory.js'), 'utf8');
check('Le projet a son propre panel Studio V2', index.includes('id="adminPanelProject"') && index.includes('function renderProjectEditor(content)'));
check('la sidebar annonce une structure proposée', index.includes('Structure proposée') && index.includes('data-project-toggle'));
check('les poignées de réordonnancement sont présentes', index.includes('data-project-drag') && index.includes('Déplacer cette section'));
check('le wording rejeté a disparu', !index.includes('Vous choisissez ce qui est vrai et important'));
check('le nouveau wording éditorial est présent', index.includes('Rassemblez les éléments qui racontent le projet'));
check('le Studio possède un bootstrap client anti-page-blanche', index.includes('function hydrateProjectForStudio(rawProject)') && index.includes('studioDefaultProjectSeed()'));
check('un projet absent côté API utilise directement la structure proposée', index.includes("project: data.project && typeof data.project === 'object' ? data.project : studioDefaultProjectSeed()"));
check('un projet vide déclenche le bootstrap et marque le draft à enregistrer', index.includes('bootstrapped: !hasSections') && index.includes("studioSetSaveState('dirty')"));
check('le drag & drop photo équipe est explicitement proposé', index.includes('Déposez une image ici') && index.includes("zone.addEventListener('drop'"));
check('Node persiste project dans content.json', server.includes('project: normalizeProject(parsed.project)') && server.includes('project: normalizeProject(contentState.project)'));
check('Ivory sait rendre content.project explicite', renderer.includes('renderProject(manifest.content.project'));

console.log(`\nOK — Studio Project 2A.2 : ${passed} vérifications validées.`);
if (process.exitCode) process.exit(process.exitCode);
