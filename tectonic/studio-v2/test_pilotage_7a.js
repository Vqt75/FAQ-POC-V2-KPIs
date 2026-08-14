const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tectonic', 'studio.js'), 'utf8');

const checks = [
  // Structure et wording — inchangés depuis la Phase 7A d'origine.
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
  ['signal gaps toujours affiché', html.includes('Recherches sans réponse')],
  ['route Questions toujours utilisée par le renvoi Overview', html.includes("route:'questions'")],
  ['libellé Questions V2', html.includes("faq: 'Questions'")],
  ['libellé Espaces V2', html.includes("plans: 'Espaces'")],
  ['libellé Le projet V2', html.includes("equipe: 'Le projet'")],
  ['distribution climat', html.includes('Répartition des ressentis')],
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

  // Nouveaux invariants — voie canonique de télémétrie (voir
  // tectonic/telemetry.js et le lot de convergence Pilotage V1). Ces
  // vérifications remplacent celles qui affirmaient l'ancienne
  // implémentation (matchedCounts/gapMap/fenêtre 7 jours sur
  // kpi.moodEntries) — ce comportement a été délibérément retiré, pas
  // cassé accidentellement.
  ['aucun rendu de faqAsked/verbatim legacy dans Pilotage',
    !/faqAsked\.filter\(item => !item\.matched && String\(item\.q/.test(html)],
  ['groupedGaps est gelé à vide, jamais reconstruit depuis faqAsked',
    html.includes('const groupedGaps = [];') || !/const groupedGaps = \[\.\.\.gapMap/.test(html)],
  ['plus de gapMap (regroupement par verbatim) dans le code source', !html.includes('const gapMap = new Map()')],
  ['plus de matchedCounts (regroupement par entryId legacy) dans le code source', !html.includes('matchedCounts[id]')],
  ['aucun bouton "Créer une réponse" pré-rempli depuis un verbatim legacy',
    !html.includes('input.value = gap.label')],
  ['kpiGaps affiche systématiquement son état vide honnête (source legacy gelée)',
    html.includes("gapsContainer.innerHTML = `<div class=\"kpi-empty\">Storm Match n’a détecté aucune information manquante")],
  ['Pilotage s’appuie sur le résumé de télémétrie (fonction dédiée présente)',
    html.includes('function renderTelemetryPilotage(summary)')],
  ['renderTelemetryPilotage est bien appelée au rafraîchissement de Studio',
    html.includes('renderTelemetryPilotage(telemetrySummary)')],
  ['le résumé de télémétrie est bien chargé via le nouvel endpoint dédié',
    html.includes("fetch('/api/telemetry/summary'")],
  ['seuil k=5 appliqué aux ventilations interprétées (taux Match, météo)',
    html.includes('const K = 5')],
  ['état honnête si aucune donnée d’usage réelle', html.includes("Aucune donnée pour l'instant")],
  ['état honnête si le volume est sous le seuil d’affichage', html.includes('Données insuffisantes')],
  ['"Recherches sans réponse" (Vue d’ensemble) lit désormais le signal canonique match_result:abstained',
    html.includes('telemetrySummary?.match?.abstained')],
  ['Vue d’ensemble ne lit plus jamais kpi.faqAsked pour ce signal',
    !/const (gaps|abstainedCount) = \(kpi\?\.\s*faqAsked/.test(html)],
  ['le libellé de la semaine météo en cours reflète la vraie sémantique (pas "7 derniers jours")',
    html.includes('<strong>Cette semaine</strong>') && !html.includes('<strong>7 derniers jours</strong>')],
  ['export XLSX ne contient plus de feuille de questions en texte brut',
    !html.includes("book_append_sheet(wb, wsQ, 'Questions posées')") && !html.includes("book_append_sheet(wb, wsGaps, 'Trous FAQ')")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('ÉCHEC — Studio Pilotage 7A (mis à jour pour la convergence télémétrie)');
  for (const [label] of failed) console.error(' - ' + label);
  process.exit(1);
}
console.log(`OK — Studio Pilotage 7A : ${checks.length} vérifications validées.`);
