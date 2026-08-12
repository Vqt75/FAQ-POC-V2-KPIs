'use strict';
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('tectonic/studio.html', 'utf8') + fs.readFileSync('tectonic/studio.js', 'utf8');
let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks += 1; }

check(html.includes('STUDIO V2 — 8C.2 / SHARED DOMAIN SHELL'), 'marqueur 8C.2 présent');
check(html.includes('studio-structure-head studio-domain-head'), 'Structure réutilise le hero commun');
check(html.includes('studio-structure-head-copy studio-domain-head-copy'), 'Structure réutilise la largeur de copy commune');
check(html.includes('<div class="admin-page-eyebrow">Administration</div>'), 'eyebrow commun utilisé');
check(html.includes('<h1 class="studio-structure-title">Structure du site.</h1>'), 'titre en h1 comme les autres domaines');
check(!html.includes('<h2 class="studio-structure-title">Structure du site.</h2>'), 'ancien titre h2 supprimé');
check(html.includes("font-size:clamp(2.6rem,4.3vw,4.4rem)"), 'échelle du hero commun reprise');
check(html.includes("font-family:'Italiana',serif"), 'Italiana explicite');
check(html.includes('max-width:none;'), 'Structure ne conserve plus son canvas 980px isolé');
check(html.includes('border-radius:20px'), 'surface alignée sur les panneaux Studio');
check(html.includes('background:rgba(255,255,255,.42)'), 'matière de panneau alignée sur Identité');
check(html.includes('id="studioStructureSave"'), 'sauvegarde 8C préservée');
check(html.includes('data-structure-toggle='), 'toggles 8C préservés');
check(html.includes('Le site public ne change qu’au prochain « Publier »'), 'doctrine Save ≠ Publish préservée');

console.log(`OK — Studio Structure 8C.2 Shell : ${checks} vérifications validées.`);
