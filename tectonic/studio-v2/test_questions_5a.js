const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('../publication-candidate');
const { compile } = require('../compiler');

const ROOT = path.resolve(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const compilerJs = fs.readFileSync(path.join(ROOT, 'tectonic/compiler.js'), 'utf8');
const ivoryJs = fs.readFileSync(path.join(ROOT, 'public/renderers/ivory.js'), 'utf8');
const start = indexHtml.indexOf('function renderFaqEditor(content)');
const end = indexHtml.indexOf('async function exportKpiToExcel()', start);
const editor = indexHtml.slice(start, end);

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

console.log('\n=== Studio Questions 5A.2 — vérité métier + Storm Match ===');
ok(start >= 0, 'Questions possède un éditeur Studio V2 dédié');
ok(editor.includes('<h1>Questions.</h1>'), 'le domaine est nommé Questions');
ok(editor.includes('Enregistrer les questions'), 'la sauvegarde reste globale pour le domaine');
ok(editor.includes('Questions du projet'), 'la liste est centrée sur les questions du projet');
ok(editor.includes('Rechercher une question…'), 'la liste peut être recherchée sans exposer le moteur');
ok(editor.includes('Confirmées'), 'un filtre Confirmées est disponible');
ok(editor.includes('À préciser'), 'un filtre À préciser est disponible');
ok(editor.includes('En définition'), 'un filtre En définition est disponible');
ok(editor.includes('Que peut-on répondre ?'), 'la réponse est formulée comme une information métier');
ok(editor.includes('Cette information est…'), 'la fiabilité porte sur l’information et non sur la qualité rédactionnelle');
ok(editor.includes('Encore susceptible d’évoluer'), 'le statut intermédiaire est formulé sans jargon CMS');
ok(editor.includes('En cours de définition'), 'le statut non stabilisé reste honnête');
ok(editor.includes('Autres façons de poser cette question'), 'les variantes de langage sont éditables');
ok(editor.includes('entry.phrases'), 'les formulations humaines alimentent phrases[]');
ok(!editor.includes('Mots-clés'), 'les mots-clés techniques ne sont plus exposés');
ok(!editor.includes('data-faq-editor-field="status"'), 'l’ancien select de statut générique a disparu');
ok(!editor.includes('Réponse partielle'), 'l’ancien libellé Réponse partielle a disparu de l’éditeur V2');
ok(editor.includes('Thématique'), 'le classement thématique reste disponible en second plan');
ok(editor.includes('Précision complémentaire'), 'la note historique reste éditable en divulgation progressive');
ok(editor.includes('Importer depuis Word'), 'l’import Word utile au métier est conservé');
ok(editor.includes('Question importée · à vérifier'), 'les imports sont clairement distingués');
ok(editor.includes('Ajouter aux questions du projet'), 'un import est intégré au corpus sans faux geste de publication');
ok(!editor.includes('Publier dans la FAQ'), 'aucune publication locale ne concurrence le bouton Publier global');
ok(editor.includes('Elle ne devient pas publique tant que vous n’utilisez pas le bouton global « Publier »'), 'la séparation Save / Publish est explicitée sur les imports');
ok(editor.includes('studioQuestionAdd'), 'l’ajout d’une question est une action de premier rang');
ok(indexHtml.includes("shortcut.dataset.studioGo === 'questions'"), 'le raccourci Vue d’ensemble ouvre réellement une nouvelle question');

console.log('\n=== Hero de domaine commun ===');
ok(indexHtml.includes('.studio-domain-head {'), 'un composant de hero commun existe pour les domaines Studio V2');
ok(indexHtml.includes('.studio-domain-head h1 {'), 'le titre de domaine possède une règle typographique commune');
ok(indexHtml.includes('.studio-domain-head p {'), 'la phrase d’introduction possède une règle commune et secondaire');
ok(indexHtml.includes('studio-project-head studio-domain-head'), 'Le projet réutilise le hero commun');
ok(indexHtml.includes('studio-news-head studio-domain-head'), 'Actualités réutilise le hero commun');
ok(indexHtml.includes('studio-spaces-head studio-domain-head'), 'Espaces réutilise le hero commun');
ok(editor.includes('studio-questions-head studio-domain-head'), 'Questions réutilise exactement le même hero commun');
ok(editor.includes('Renseignez les réponses utiles au projet.'), 'l’introduction Questions est raccourcie et reste orientée tâche');
ok(indexHtml.indexOf('.studio-domain-head {') > indexHtml.indexOf('.studio-questions-head p {'), 'la règle commune est placée après les styles historiques et les normalise réellement');

console.log('\n=== Storm Match — information produit ===');
ok(editor.includes('Introducing'), 'Questions présente Storm Match comme une capacité produit discrète');
ok(editor.includes('<strong>Storm Match</strong>'), 'le nom Storm Match est visible dans le back-office');
ok(editor.includes('Les collaborateurs n’ont pas besoin d’employer les mêmes mots.'), 'la note explique le bénéfice utilisateur plutôt que la plomberie technique');
ok(indexHtml.includes('.studio-product-note {'), 'la note Storm Match possède un composant d’information produit réutilisable');
ok(indexHtml.includes('.studio-match-note'), 'Storm Match utilise la variante dédiée du composant produit');
ok(!editor.includes('fuzzy matching') && !editor.includes('lemmatisation') && !editor.includes('keywords pondérés'), 'aucun jargon du moteur n’est exposé dans la note produit');

console.log('\n=== Données / compatibilité moteur ===');
ok(serverJs.includes("confirmed: 'Information confirmée'"), 'Node dérive le nouveau libellé confirmed');
ok(serverJs.includes("partial: 'Information susceptible d’évoluer'"), 'Node dérive le nouveau libellé partial');
ok(serverJs.includes("waiting: 'Information en cours de définition'"), 'Node dérive le nouveau libellé waiting');
ok(serverJs.includes('const statusLabel = FAQ_STATUS_LABELS[status]'), 'le libellé de statut n’est plus une copy libre héritée');
ok(serverJs.includes('keywords: normalizeStringArray(raw?.keywords)'), 'les signaux keywords historiques sont préservés');
ok(serverJs.includes('phrases: normalizeStringArray(raw?.phrases)'), 'les formulations alternatives sont normalisées');
ok(serverJs.includes('intentSignals: normalizeStringArray(raw?.intentSignals)'), 'les intentSignals du moteur restent préservés');
ok(serverJs.includes('negativeSignals: normalizeStringArray(raw?.negativeSignals)'), 'les negativeSignals restent préservés');
ok(indexHtml.includes('(entry.phrases || []).forEach(phrase =>'), 'le moteur Pangea continue de scorer phrases[] fortement');
ok(indexHtml.includes('if (np && normQ.includes(np)) score += 10'), 'le poids historique des formulations alternatives est intact');
ok(compilerJs.includes('phrases: Array.isArray(e.phrases) ? e.phrases : []'), 'le Compiler transporte phrases[]');
ok(compilerJs.includes('intentSignals: Array.isArray(e.intentSignals)'), 'le Compiler transporte toujours les signaux du moteur');

console.log('\n=== Candidate → Compiler → Manifest → Ivory ===');
const source = {
  branding:{ projectName:'Projet Quatro', logoUrl:'', theme:'default', colors:['#1E1D1E','#C2AF7E'], fonts:[{name:'Roboto',source:'system'},{name:'Italiana',source:'system'}] },
  project:{ intro:{title:'Projet',body:'Test'}, sections:[] },
  publicContent:{ faq:{ eyebrow:'Questions', titleLine1:'Vos questions', titleAccent:'comptent.', desc:'Des réponses fiables.' }, actu:{}, plans:{}, ambassadeurs:{}, equipe:{} },
  milestones:[], articles:[], plans:[], spaces:[], ambassadorsContent:{}, ambassadors:[], teamContent:{}, team:[],
  faqEntries:[{
    id:'flex', title:'Postes attribués ou flex office', answer:'Les postes ne seront pas attribués individuellement.',
    status:'partial', statusLabel:'Information susceptible d’évoluer', category:'espaces', note:'Les règles seront précisées.',
    keywords:['poste','bureau','flex'], phrases:['Est-ce que j’aurai un bureau attitré ?'], intentSignals:['poste'], emotionSignals:[], negativeSignals:[], priority:7
  }]
};
const candidate = buildPublicationCandidate(source);
const manifest = compile(candidate,{ generatedAt:'2026-08-10T21:00:00.000Z', revision:'questions-5a-test', supportedEditions:['ivory','rainbow-glass','midnight-frost'] });
const item = manifest.content.questions.items[0];
ok(item.title === 'Postes attribués ou flex office', 'la question canonique franchit le pipeline');
ok(item.answer.includes('postes'), 'la réponse franchit le pipeline');
ok(item.status === 'partial', 'le niveau de stabilisation franchit le pipeline');
ok(item.phrases[0] === 'Est-ce que j’aurai un bureau attitré ?', 'la formulation alternative franchit le pipeline');
ok(item.keywords.includes('flex'), 'les signaux historiques restent disponibles au moteur public');
ok(item.priority === 7, 'la priorité moteur reste intacte');
ok(ivoryJs.includes("if (entry.status === 'partial') return 'Susceptible d’évoluer'"), 'Ivory traduit le statut intermédiaire avec le nouveau langage');
ok(ivoryJs.includes("if (entry.status === 'confirmed') return 'Information confirmée'"), 'Ivory traduit confirmed sans jargon de réponse');
ok(ivoryJs.includes('matchFaq(question, items)'), 'Ivory conserve le moteur FAQ existant');
ok(ivoryJs.includes('No confidence percentages'), 'Ivory continue de ne pas exposer de score de confiance');

if (process.exitCode) {
  console.error(`\n${checks} vérifications passées avant échec.`);
  process.exit(process.exitCode);
}
console.log(`\nOK — Studio Questions 5A.2 : ${checks} vérifications validées.`);
