const fs = require('fs');
const path = require('path');
function read(p){return fs.readFileSync(path.join(__dirname,'../..',p),'utf8');}
function ok(cond,msg){if(!cond){console.error('FAIL — '+msg);process.exit(1);}}
const html=read('tectonic/studio.html')+read('tectonic/studio.js');
const server=read('server.js');
const compiler=read('tectonic/compiler.js');
const ivory=read('public/renderers/ivory.js');
const pkg=JSON.parse(read('package.json'));
const checks=[
  [html.includes('<h1>Ambassadeurs.</h1>'),'hero Ambassadeurs V2'],
  [html.includes('Enregistrer les ambassadeurs'),'save global Ambassadeurs'],
  [html.includes('background:var(--ink)'),'bouton save noir partagé'],
  [html.includes('Fonctionnement du réseau'),'configuration réseau'],
  [html.includes('Les ambassadeurs peuvent-ils être contactés directement ?'),'permission contact réseau'],
  [html.includes('Autoriser le contact direct'),'permission contact individuelle'],
  [html.includes('data-amb-contact-channel=\"email\"'),'canal email'],
  [html.includes('data-amb-contact-channel=\"teams\"'),'canal Teams'],
  [html.includes('data-amb-contact-channel=\"link\"'),'canal lien'],
  [html.includes('Contacter ${escapeHtml'),'CTA prénom généré dans le Studio'],
  [html.includes('Des relais au plus près du terrain.'),'wording aligné sur Ivory'],
  [html.includes('studio-amb-network-title'),'classe typo réseau dédiée'],
  [html.includes("font-family:'Italiana',serif"),'Italiana explicite'],
  [html.includes('Recrutement'),'recrutement optionnel'],
  [html.includes('Directement dans Storm'),'join inline'],
  [html.includes('Via un lien'),'join link'],
  [html.includes('Déposez une photo ici'),'drag & drop photo'],
  [html.includes('Équipe ou direction'),'champ équipe/direction'],
  [html.includes('studio-amb-switch'),'switch Cupertino'],
  [html.includes('draggable=\"true\"'),'réordonnancement drag'],
  [server.includes('contactChannel'),'normalisation canal serveur'],
  [server.includes('contactValue'),'normalisation coordonnée serveur'],
  [compiler.includes('function ambassadorContactHref'),'résolution contact Compiler'],
  [compiler.includes("enabled: c.contactEnabled === true"),'gate contact réseau dans Manifest'],
  [compiler.includes("defaultHref: ''"),'pas de destination collective par défaut'],
  [compiler.includes('contactHref: p.contactable === false'),'href individuel dans roster'],
  [compiler.includes('contactLabel: ambassadorContactLabel(p.name)'),'CTA individuel généré'],
  [compiler.includes('msteams:'),'deep link Teams accepté'],
  [ivory.includes('person.contactHref'),'Ivory consomme le contact individuel'],
  [ivory.includes('person.contactLabel'),'Ivory consomme le libellé individuel'],
  [pkg.scripts['test:studio-ambassadors']==='node tectonic/studio-v2/test_ambassadors_6a.js','script npm'],
];
checks.forEach(([c,m])=>ok(c,m));
console.log(`OK — Studio Ambassadeurs 6A.1 : ${checks.length} vérifications validées.`);
