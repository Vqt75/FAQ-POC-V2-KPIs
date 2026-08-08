// TECTONIC — Publication orchestration (Phase 4)
//
// Transforme le pipeline diagnostic de Phase 3 en vraie transaction
// de publication. Garde server.js mince : toute la logique
// d'orchestration (snapshot -> candidate -> compile -> écriture
// atomique) vit ici, dans un module dédié — pas un service séparé,
// pas de dépendance supplémentaire.
//
// Différence volontaire avec le CLI de Phase 3 (tectonic/
// generate-manifest.js) : ce module ne fait AUCUN appel réseau. Il
// travaille directement depuis l'état autoritaire que server.js lui
// fournit déjà (via readContentState()) — pas d'auto-appel à
// /api/content. C'est une orchestration interne, pas un client HTTP
// de soi-même.

const fs = require('fs');
const path = require('path');
const { buildPublicationCandidate } = require('./publication-candidate');
const { compile, CompilerBlockingError } = require('./compiler');

const SUPPORTED_EDITIONS = ['ivory', 'rainbow-glass', 'midnight-frost'];

// Copie profonde JSON de l'état autoritaire, figée à l'instant T0 de
// l'appel (TECTONIC_PUBLICATION_CANDIDATE.md §4, Option A retenue).
// Toute modification sauvegardée après cet instant appartient à la
// publication suivante, jamais à celle en cours.
function createPublicationSnapshot(authoritativeState) {
  return JSON.parse(JSON.stringify(authoritativeState));
}

// CompilationContext construit une seule fois par tentative de
// publication, depuis un unique instant (jamais deux appels séparés
// à `new Date()`, qui pourraient diverger). Contrairement au CLI de
// diagnostic (Phase 3, préfixe "diag-"), cette revision représente
// une vraie publication — aucun préfixe.
function buildCompilationContext() {
  const instant = new Date();
  const generatedAt = instant.toISOString();
  const revision = generatedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return { generatedAt, revision, supportedEditions: SUPPORTED_EDITIONS };
}

// Écriture atomique. Séquence stricte :
//   1. écrire un fichier temporaire (nom unique, même répertoire que
//      la cible — le rename ne peut être atomique que sur le même
//      système de fichiers) ;
//   2. le relire et le reparser, jamais faire confiance aveuglément
//      à l'écriture ;
//   3. rename atomique vers la cible.
// Si l'étape 1 ou 2 échoue, la cible existante (s'il y en a une)
// n'est jamais touchée, et le temporaire est nettoyé dans tous les
// cas via `finally`.
function writeManifestAtomically(manifest, targetPath) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = path.join(dir, `.manifest.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  const serialized = JSON.stringify(manifest, null, 2);

  try {
    fs.writeFileSync(tmpPath, serialized, 'utf8');

    // Vérification post-écriture — pas une confiance aveugle dans
    // writeFileSync : on relit depuis le disque et on reparse.
    const reread = fs.readFileSync(tmpPath, 'utf8');
    const reparsed = JSON.parse(reread);
    if (reparsed.schemaVersion !== manifest.schemaVersion || reparsed.meta.revision !== manifest.meta.revision) {
      throw new Error('Vérification post-écriture échouée : contenu relu incohérent avec le Manifest compilé.');
    }

    fs.renameSync(tmpPath, targetPath); // atomique (même répertoire, même système de fichiers)
  } finally {
    // Nettoyage systématique du temporaire — no-op silencieux si le
    // rename a déjà réussi (le fichier n'existe plus à ce chemin).
    try { fs.unlinkSync(tmpPath); } catch (e) { /* déjà renommé, ou jamais créé */ }
  }
}

// Orchestration complète d'une tentative de publication : reçoit
// l'état autoritaire que server.js détient déjà, exécute tout le
// pipeline (Snapshot -> Candidate -> Compiler -> écriture atomique),
// et retourne {revision, generatedAt} en cas de succès.
//
// Ne masque jamais une erreur : une CompilerBlockingError remonte
// telle quelle (compilation refusée, rien écrit) ; toute autre erreur
// (échec d'écriture, par exemple) remonte aussi — à charge de
// l'appelant HTTP de la traduire en réponse appropriée, sans jamais
// exposer de détail interne (stack trace) au client.
function publishFromAuthoritativeState(authoritativeState, manifestPath) {
  const snapshot = createPublicationSnapshot(authoritativeState);
  const candidate = buildPublicationCandidate(snapshot);
  const context = buildCompilationContext();
  const manifest = compile(candidate, context); // peut lever CompilerBlockingError — rien n'est écrit dans ce cas

  writeManifestAtomically(manifest, manifestPath);

  return { revision: context.revision, generatedAt: context.generatedAt };
}

module.exports = {
  createPublicationSnapshot,
  buildCompilationContext,
  writeManifestAtomically,
  publishFromAuthoritativeState,
  CompilerBlockingError,
  SUPPORTED_EDITIONS
};
