#!/usr/bin/env node
// TECTONIC — generate-manifest.js
//
// Outil CLI de DIAGNOSTIC. Phase 3 du plan d'implémentation.
//
// Ce script n'est PAS un endpoint, PAS un service, PAS branché à
// server.js. Il démarre temporairement une instance de Pangea réelle
// sur un port dédié (jamais 3000), avec un mot de passe admin
// temporaire généré pour l'occasion — ce script ne connaît ni le mot
// de passe par défaut de Pangea ni son algorithme interne de jeton :
// il s'authentifie via le vrai endpoint /api/admin/login, comme
// n'importe quel client légitime. Il lit l'état réel, exécute le
// pipeline Tectonic complet (Snapshot -> Candidate -> Compiler),
// écrit le résultat dans un fichier de diagnostic strictement HORS
// DÉPÔT (vérifié, pas seulement documenté), et s'arrête. Rien n'est
// jamais écrit dans data/manifest.json.
//
// Usage : node tectonic/generate-manifest.js
// Variables d'environnement optionnelles :
//   TECTONIC_DIAG_PORT   (défaut 3099)
//   TECTONIC_DIAG_OUTPUT (défaut /tmp/storm-manifest-debug.json —
//                          doit obligatoirement résoudre hors du dépôt,
//                          sinon le script refuse de démarrer)

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('./publication-candidate');
const { compile, CompilerBlockingError } = require('./compiler');

const ROOT = path.resolve(path.join(__dirname, '..'));
const PORT = process.env.TECTONIC_DIAG_PORT || '3099';
if (String(PORT) === '3000') {
  throw new Error(
    'TECTONIC_DIAG_PORT ne peut pas être 3000 : ce port est réservé au serveur de ' +
    'développement Pangea. Ce script promet de ne jamais l\'utiliser — la promesse ' +
    'doit être appliquée, pas seulement documentée.'
  );
}
const OUTPUT_PATH = path.resolve(process.env.TECTONIC_DIAG_OUTPUT || '/tmp/storm-manifest-debug.json');

// ─────────────────────────────────────────────────────────────────
// Garde-fou réel, pas seulement documenté : le chemin de sortie doit
// résoudre STRICTEMENT en dehors du dépôt. On compare des chemins
// absolus normalisés, pas une simple sous-chaîne (qui accepterait à
// tort un dossier comme /home/claude/finalX en le confondant avec un
// préfixe de /home/claude/final).
// ─────────────────────────────────────────────────────────────────
function assertOutsideRepo(outputPath, root) {
  const rel = path.relative(root, outputPath);
  const isInside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  if (isInside) {
    throw new Error(
      `TECTONIC_DIAG_OUTPUT résout à l'intérieur du dépôt (${outputPath}, sous ${root}). ` +
      `Refusé : un artefact de diagnostic ne doit jamais pouvoir polluer le working tree ` +
      `ou finir committé par erreur. Utilise /tmp ou un chemin hors dépôt.`
    );
  }
}

// Mot de passe temporaire, généré pour cette seule exécution — jamais
// le mot de passe par défaut de Pangea, jamais stocké nulle part.
function generateTempPassword() {
  return crypto.randomBytes(24).toString('hex');
}

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      fetch(url).then(res => {
        if (res.ok) return resolve();
        retry();
      }).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Le serveur de diagnostic n\'a pas démarré à temps.'));
        } else {
          setTimeout(attempt, 200);
        }
      }
    })();
  });
}

// ─────────────────────────────────────────────────────────────────
// Détection de fuite structurelle — parcourt récursivement TOUTES les
// clés d'un objet (tableaux inclus), sans jamais chercher un mot dans
// une chaîne de texte. Un article client qui contiendrait littéralement
// le mot "KPI" dans sa prose ne doit jamais faire échouer ce contrôle ;
// inversement, une clé interdite cachée profondément dans l'arbre doit
// être détectée, pas seulement en surface.
// ─────────────────────────────────────────────────────────────────
function collectKeysDeep(value, found) {
  found = found || new Set();
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach(item => collectKeysDeep(item, found));
    } else {
      Object.keys(value).forEach(key => {
        found.add(key);
        collectKeysDeep(value[key], found);
      });
    }
  }
  return found;
}

const FORBIDDEN_KEYS = [
  'faqDrafts', 'kpis', 'contactSubmissions', 'moodEntries',
  'visitSessions', 'faqAsked', 'articleOpens', 'tabViews',
  'adminToken', 'adminPassword'
];

// Auto-test de collectScalarValues() — exécuté à chaque lancement du
// script, avant tout le reste. Si cette fonction régresse un jour
// (le bug corrigé ici en était la preuve : un index local qui pouvait
// écraser des valeurs ajoutées par une récursion), aucun contrôle de
// secret en aval ne serait fiable — mieux vaut le détecter ici,
// systématiquement, que de le redécouvrir un jour dans un audit.
function selfTestCollectScalarValues() {
  const deeplyNested = {
    a: 1,
    b: { c: 2, d: { e: 3, f: [4, 5, { g: 6, h: 7 }] } },
    i: [8, [9, 10], { j: 11 }]
  };
  const values = collectScalarValues(deeplyNested);
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const ok = values.length === expected.length && expected.every(v => values.includes(v));
  if (!ok) {
    throw new Error(
      `Auto-test de collectScalarValues() échoué — attendu ${JSON.stringify(expected)}, ` +
      `obtenu ${JSON.stringify(values)}. Ce script refuse de continuer : si cette fonction ` +
      `est cassée, aucun contrôle de secret en aval ne serait fiable.`
    );
  }
}

async function main() {
  selfTestCollectScalarValues();
  console.log('=== TECTONIC — génération de Manifest de diagnostic (Phase 3) ===\n');

  // Garde-fou de sortie vérifié AVANT de démarrer quoi que ce soit.
  assertOutsideRepo(OUTPUT_PATH, ROOT);

  const tempAdminPassword = generateTempPassword();
  console.log(`Démarrage temporaire de Pangea réel sur le port ${PORT} (dédié, jamais 3000),`);
  console.log('avec un mot de passe admin temporaire généré pour cette seule exécution...');

  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT, ADMIN_PASSWORD: tempAdminPassword }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', d => { serverLog += d.toString(); });
  child.stderr.on('data', d => { serverLog += d.toString(); });

  let exitCode = 0;
  try {
    await waitForServer(`http://localhost:${PORT}/health`, 8000);
    console.log('Serveur de diagnostic prêt.\n');

    // Authentification via le vrai endpoint public — ce script ignore
    // tout de l'algorithme interne de jeton de Pangea. S'il change un
    // jour, ce script n'a rien à savoir ni à corriger.
    const loginRes = await fetch(`http://localhost:${PORT}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: tempAdminPassword })
    });
    if (!loginRes.ok) throw new Error(`Authentification de diagnostic échouée : HTTP ${loginRes.status}`);
    const { token } = await loginRes.json();
    if (!token) throw new Error('Authentification de diagnostic : aucun jeton retourné.');

    // Lecture avec le jeton — inclut donc faqDrafts, volontairement,
    // pour tester la frontière de publication comme une vraie
    // frontière de sécurité, pas comme un simple convertisseur JSON.
    const res = await fetch(`http://localhost:${PORT}/api/content`, {
      headers: { 'x-admin-token': token }
    });
    if (!res.ok) throw new Error(`Lecture de l'état Pangea échouée : HTTP ${res.status}`);
    const authoritativeState = await res.json();

    console.log('État autoritaire Pangea lu (avec authentification admin).');
    console.log('Clés reçues :', Object.keys(authoritativeState).join(', '), '\n');

    // Publication Snapshot — copie profonde JSON. Réutilisée telle
    // quelle plus bas pour le test de déterminisme (même snapshot,
    // pas une nouvelle copie indépendante de la source).
    const publicationSnapshot = JSON.parse(JSON.stringify(authoritativeState));

    const candidate = buildPublicationCandidate(publicationSnapshot);

    // Un seul instant de génération, dont on dérive les deux champs —
    // jamais deux appels séparés à `new Date()` qui pourraient diverger
    // de quelques millisecondes. Revision explicitement préfixée
    // "diag-" : ceci est un diagnostic, jamais une vraie publication —
    // à ne surtout pas confondre avec une révision de release future.
    const generationInstant = new Date();
    const generatedAt = generationInstant.toISOString();
    const stamp = generatedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const context = {
      generatedAt,
      revision: `diag-${stamp}`,
      supportedEditions: ['ivory', 'rainbow-glass', 'midnight-frost']
    };
    console.log('CompilationContext construit par l\'orchestration :');
    console.log(JSON.stringify(context, null, 2), '\n');

    const manifest = compile(candidate, context);

    // ─── Vérifications automatiques — AVANT toute écriture sur disque ───
    // Corrigé : une version précédente écrivait le Manifest de
    // diagnostic avant de vérifier l'absence de secrets. Si une
    // régression avait précisément fait fuiter un jeton, le fichier
    // contenant ce jeton aurait déjà été écrit avant que le contrôle
    // ne le détecte. Même dans /tmp, ce n'est pas la bonne logique
    // pour ce qui doit devenir une vraie frontière de publication.
    console.log('=== Vérifications ===\n');
    let allOk = true;
    function check(label, condition) {
      console.log((condition ? 'OK    — ' : 'ECHEC — ') + label);
      if (!condition) allOk = false;
    }

    // Édition : teste la RÈGLE de traduction, pas une valeur figée —
    // ce diagnostic doit rester valide quelle que soit l'édition
    // réellement configurée sur le projet au moment de l'exécution.
    const expectedEdition = candidate.branding.theme === 'default' ? 'ivory' : candidate.branding.theme;
    check(`édition correctement traduite vers l'identifiant Tectonic (theme="${candidate.branding.theme}" -> "${expectedEdition}")`,
      manifest.edition.id === expectedEdition);

    // faqDrafts : démonstration explicite du passage source contaminée
    // -> Candidate nettoyé -> Manifest propre, pas une simple absence
    // supposée.
    check('faqDrafts effectivement présent dans l\'état admin source (le poison existe vraiment)',
      Object.prototype.hasOwnProperty.call(authoritativeState, 'faqDrafts'));
    check('faqDrafts absent du Publication Candidate (whitelist appliquée)',
      !Object.prototype.hasOwnProperty.call(candidate, 'faqDrafts'));

    // Détection structurelle, sur l'ARBRE COMPLET du Manifest — jamais
    // une recherche textuelle fragile.
    const manifestKeys = collectKeysDeep(manifest);
    FORBIDDEN_KEYS.forEach(key => {
      check(`clé interdite "${key}" absente de tout l'arbre du Manifest`, !manifestKeys.has(key));
    });

    // Jeton/mot de passe : vérification structurelle également (le
    // jeton et le mot de passe temporaire ne sont des propriétés
    // d'aucun objet du Manifest — pas une recherche de sous-chaîne).
    const manifestValues = collectScalarValues(manifest);
    check('le jeton admin de diagnostic n\'apparaît comme valeur nulle part dans le Manifest',
      !manifestValues.includes(token));
    check('le mot de passe admin temporaire n\'apparaît comme valeur nulle part dans le Manifest',
      !manifestValues.includes(tempAdminPassword));

    check('schemaVersion === 1', manifest.schemaVersion === 1);
    check('les 7 clés modules sont présentes, booléennes, et rien de plus',
      ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team']
        .every(k => typeof manifest.modules[k] === 'boolean') &&
      Object.keys(manifest.modules).length === 7);

    // Déterminisme : le second Candidate est reconstruit depuis une
    // copie du MÊME publicationSnapshot déjà utilisé plus haut — pas
    // une nouvelle copie indépendante de authoritativeState, pour que
    // le test corresponde exactement à son propre libellé.
    const candidate2 = buildPublicationCandidate(JSON.parse(JSON.stringify(publicationSnapshot)));
    const manifest2 = compile(candidate2, context);
    check('déterminisme strict : même snapshot + même contexte -> Manifest identique',
      JSON.stringify(manifest) === JSON.stringify(manifest2));

    console.log('\n' + (allOk ? 'TOUTES LES VÉRIFICATIONS SONT PASSÉES.' : 'DES VÉRIFICATIONS ONT ÉCHOUÉ.'));

    if (allOk) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`\nManifest de diagnostic écrit : ${OUTPUT_PATH}`);
    } else {
      console.log('\nAucun artefact écrit — au moins une vérification a échoué.');
    }

    console.log('\n=== Résumé structurel du Manifest ===');
    console.log('project.name        :', manifest.project.name);
    console.log('edition.id          :', manifest.edition.id, `(depuis theme="${candidate.branding.theme}")`);
    console.log('modules activés     :', Object.keys(manifest.modules).filter(k => manifest.modules[k]).join(', ') || '(aucun)');
    console.log('navigation          :', manifest.navigation.map(n => n.module).join(', ') || '(vide)');
    console.log('content.timeline    :', manifest.content.timeline ? manifest.content.timeline.milestones.length + ' jalons' : 'absent');
    console.log('content.news        :', manifest.content.news ? manifest.content.news.items.length + ' articles' : 'absent');
    console.log('content.spaces      :', manifest.content.spaces ? manifest.content.spaces.items.length + ' visuels' : 'absent');
    console.log('content.questions   :', manifest.content.questions ? manifest.content.questions.items.length + ' entrées FAQ' : 'absent');
    console.log('content.ambassadors :', manifest.content.ambassadors ? manifest.content.ambassadors.roster.length + ' ambassadeurs' : 'absent');
    console.log('content.team        :', manifest.content.team ? manifest.content.team.members.length + ' membres' : 'absent (module désactivé)');
    console.log('content.home        :', manifest.content.home ? 'présent (featured: ' + (manifest.content.home.featured ? manifest.content.home.featured.title : 'null') + ')' : 'absent');
    console.log('settings            :', ('settings' in manifest) ? JSON.stringify(manifest.settings) : 'absent (rien de configuré)');

    exitCode = allOk ? 0 : 1;

  } catch (err) {
    if (err instanceof CompilerBlockingError) {
      console.error('\n=== ERREUR BLOQUANTE DU COMPILER ===');
      console.error(err.message);
      console.error('\nCeci peut signaler une contradiction entre l\'état Pangea réel et les');
      console.error('contrats gelés (Manifest/Compiler/Publication Candidate) — à examiner');
      console.error('avant toute correction de Phase 1 ou Phase 2. Ne pas corriger en aveugle.');
    } else {
      console.error('\n=== ERREUR ===');
      console.error(err.message);
      if (serverLog) console.error('\nJournal du serveur de diagnostic :\n', serverLog);
    }
    exitCode = 1;
  } finally {
    child.kill('SIGKILL');
  }
  process.exitCode = exitCode;
}

// Aplati toutes les valeurs scalaires d'un objet (utilisé uniquement
// pour vérifier qu'aucun secret ne se retrouve comme VALEUR quelque
// part — distinct de collectKeysDeep, qui regarde les clés).
// Collecte récursive simple dans un tableau — corrige un bug réel de
// l'ancienne version (flattenValues utilisait un index local qui
// pouvait être écrasé après un appel récursif, rendant le contrôle de
// secrets potentiellement incomplet sans jamais le signaler).
function collectScalarValues(value, found) {
  found = found || [];
  if (value && typeof value === 'object') {
    const values = Array.isArray(value) ? value : Object.values(value);
    values.forEach(v => collectScalarValues(v, found));
  } else {
    found.push(value);
  }
  return found;
}

main();
