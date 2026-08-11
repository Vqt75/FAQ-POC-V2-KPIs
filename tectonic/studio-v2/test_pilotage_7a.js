const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const checks = [
  ['hero partagé', html.includes('studio-domain-head studio-pilotage-head')],
  ['eyebrow Analyse', html.includes('<div class="admin-page-eyebrow">Analyse</div>')],
  ['titre Pilotage', html.includes('<h1>Pilotage.</h1>')],
  ['promesse écoute', html.includes('Écoutez ce que le site vous apprend')],
  ['note agrégée', html.includes('Données agrégées du site')],
  ['pas mesure individuelle', html.includes('pas à mesurer la performance individuelle')],
  ['question usage', html.includes('Le site est-il utilisé ?')],
  ['question information', html.includes('Les collaborateurs trouvent-ils ce dont ils ont besoin ?')],
  ['question attention', html.includes('Qu’est-ce qui attire l’attention ?')],
  ['question climat', html.includes('Comment le projet est-il vécu ?')],
  ['Storm Match visible', html.includes('studio-pilotage-product">Storm Match')],
  ['signal gaps', html.includes('Recherches sans réponse')],
  ['action éditoriale', html.includes('Créer une réponse →')],
  ['préremplissage question', html.includes("input.value = gap.label")],
  ['route Questions', html.includes("applyStudioRoute('questions')")],
  ['matchs regroupés entryId', html.includes('matchedCounts[id]')],
  ['gaps regroupés', html.includes('const gapMap = new Map()')],
  ['libellé Questions V2', html.includes("faq: 'Questions'")],
  ['libellé Espaces V2', html.includes("plans: 'Espaces'")],
  ['libellé Le projet V2', html.includes("equipe: 'Le projet'")],
  ['distribution climat', html.includes('Répartition des ressentis')],
  ['fenêtre 7 jours', html.includes('7 derniers jours') && html.includes('7*24*60*60*1000')],
  ['seuil 5 contributions', html.includes('recentMood.length >= 5')],
  ['explication seuil', html.includes('au moins 5 contributions')],
  ['pas de moyenne mood', !html.includes('moodAvg')],
  ['pas de note climat /5', !html.includes('Climat moyen du projet')],
  ['pas de causalité marketing', html.includes('sans transformer les contenus en compétition')],
  ['messages masqués si vides', html.includes('contactsSection.hidden = contacts.length === 0')],
  ['export renommé', html.includes('Exporter les données')],
  ['export nom projet', html.includes("currentAdminContent?.branding?.projectName")],
  ['export feuille climat', html.includes("book_append_sheet(wb, wsMood, 'Climat du projet')")],
  ['aucun bouton save Pilotage', !/adminPanelDashboard[\s\S]{0,1800}studio-domain-save/.test(html)],
  ['surface à propos POC', html.includes('À propos des données de ce POC')],
  ['responsive pilotage', html.includes('@media (max-width:900px)') && html.includes('.studio-pilotage-subgrid')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('ÉCHEC — Studio Pilotage 7A');
  for (const [label] of failed) console.error(' - ' + label);
  process.exit(1);
}
console.log(`OK — Studio Pilotage 7A : ${checks.length} vérifications validées.`);
