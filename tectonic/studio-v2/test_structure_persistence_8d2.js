'use strict';

const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
}

check(index.includes('STUDIO V2 — 8D.2 / STRUCTURE PERSISTENCE HARDENING'), 'marqueur 8D.2 frontend présent');
check(server.includes('STUDIO V2 — 8D.2 / STRUCTURE PERSISTENCE HARDENING'), 'marqueur 8D.2 backend présent');

check(index.includes('const liveStructure = contentState?.siteStructure || currentAdminContent?.siteStructure;'),
  'saveContent récupère la structure depuis le payload ou l’état Studio vivant');
check(index.includes('siteStructure: studioNormalizeSiteStructure(liveStructure, liveTeam)'),
  'saveContent normalise la structure avant envoi');
check(index.includes('body: JSON.stringify(stateToSave)'),
  'POST /api/content utilise le payload durci');

check(server.includes('const existingContent = readContentState();'),
  'serveur lit l’état existant avant une sauvegarde partielle');
check(server.includes('siteStructure: parsed.siteStructure ?? existingContent.siteStructure,'),
  'serveur préserve siteStructure si le payload l’omet');

check(server.includes('siteStructure: normalizeSiteStructure(contentState.siteStructure, contentState.team)'),
  'writeContentState continue de normaliser la valeur finale');
check(server.includes('fs.writeFileSync(CONTENT_FILE, JSON.stringify(safe, null, 2)'),
  'writeContentState écrit toujours content.json');

console.log(`OK — Studio Structure Persistence 8D.2 : ${checks} vérifications validées.`);
