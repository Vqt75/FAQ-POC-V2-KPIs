'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildPublicationCandidate } = require('../publication-candidate');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks += 1; }

check(html.includes('STUDIO V2 — 8C / SITE STRUCTURE'), 'marqueur 8C présent dans le Studio');
check(html.includes('data-studio-route="structure"'), 'route Structure présente');
check(html.includes('id="adminPanelStructure"'), 'panel Structure présent');
check(html.includes('id="studioStructureSave"'), 'bouton Enregistrer unique présent');
check(html.includes('Toujours visible'), 'Accueil verrouillé');
check(html.includes('Masquer une rubrique ne supprime pas son contenu'), 'doctrine non destructive visible');
check(html.includes('Le site public ne change qu’au prochain « Publier »'), 'Save != Publish explicite');
check(html.includes('data-structure-toggle='), 'template de switch Structure présent');
check(html.includes("structure:'studioStructureSave'"), 'Save Confidence connaît Structure');
check(html.includes('siteStructure: studioNormalizeSiteStructure(data.siteStructure, data.team)'), 'chargement siteStructure');
check(html.includes('siteStructure: studioNormalizeSiteStructure(content.siteStructure, content.team)'), 'sauvegarde siteStructure');

check(server.includes('STUDIO V2 — 8C / SITE STRUCTURE'), 'marqueur 8C présent serveur');
check(server.includes('function normalizeSiteStructure(raw, team)'), 'normalisation serveur présente');
check(server.includes('siteStructure: normalizeSiteStructure(parsed.siteStructure, parsed.team)'), 'lecture serveur whitelistée');
check(server.includes('siteStructure: normalizeSiteStructure(contentState.siteStructure, contentState.team)'), 'écriture serveur whitelistée');
check(server.includes('siteStructure: parsed.siteStructure'), 'route POST transmet siteStructure');

const base = {
  branding:{}, project:{}, publicContent:{}, milestones:[], articles:[], spaces:[{id:'s1'}], plans:[],
  ambassadorsContent:{}, ambassadors:[{id:'a1'}], teamContent:{}, team:[{id:'t1'}], faqEntries:[{id:'q1'}]
};
const candidate = buildPublicationCandidate({
  ...base,
  siteStructure:{ home:false, timeline:false, news:true, spaces:false, questions:true, ambassadors:false, team:false }
});
check(candidate.modules.home === true, 'Accueil reste toujours actif');
check(candidate.modules.timeline === false, 'Le projet peut être masqué');
check(candidate.modules.news === true, 'Actualités peut rester visible');
check(candidate.modules.spaces === false, 'Espaces peut être masqué');
check(candidate.modules.questions === true, 'Questions peut rester visible');
check(candidate.modules.ambassadors === false, 'Ambassadeurs peut être masqué');
check(candidate.modules.team === false, 'Équipe projet peut être masquée');
check(candidate.navigation.every(entry => candidate.modules[entry.module] === true), 'navigation cohérente avec modules');
check(!candidate.navigation.some(entry => entry.module === 'spaces'), 'module masqué absent de navigation');
check(Array.isArray(candidate.team) && candidate.team.length === 1, 'masquer ne détruit pas le contenu éditorial équipe du candidate');

const legacyEmpty = buildPublicationCandidate({ ...base, team:[] });
check(legacyEmpty.modules.home === true && legacyEmpty.modules.timeline === true, 'fallback legacy conserve les modules historiques');
check(legacyEmpty.modules.team === false, 'fallback legacy conserve la règle équipe vide');

console.log(`OK — Studio Structure du site 8C : ${checks} vérifications validées.`);
