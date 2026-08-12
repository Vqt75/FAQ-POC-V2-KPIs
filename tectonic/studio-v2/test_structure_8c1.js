'use strict';

const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('tectonic/studio.html', 'utf8') + fs.readFileSync('tectonic/studio.js', 'utf8');
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
}

check(html.includes('STUDIO V2 — 8C / SITE STRUCTURE'), '8C reste présent');
check(html.includes('STUDIO V2 — 8C.1 / STRUCTURE VISUAL CONVERGENCE'), 'marqueur 8C.1 présent');
check(html.includes("font-family:'Italiana', Georgia"), 'titre Structure utilise Italiana');
check(html.includes('padding-top:42px'), 'respiration haute restaurée');
check(html.includes('letter-spacing:.22em'), 'kicker Administration reprend la grammaire Studio');
check(html.includes('font-size:clamp(3.45rem,5.6vw,5.15rem)'), 'échelle éditoriale du titre restaurée');
check(html.includes('border-radius:28px'), 'surface principale plus généreuse');
check(html.includes('min-height:104px'), 'rythme vertical des lignes restauré');
check(html.includes('data-structure-toggle='), 'interaction 8C préservée');
check(html.includes('id="studioStructureSave"'), 'sauvegarde 8C préservée');

console.log(`OK — Studio Structure 8C.1 DA : ${checks} vérifications validées.`);
