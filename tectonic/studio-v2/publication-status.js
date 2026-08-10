// Storm Studio V2 — publication status foundation
//
// Answers a product question without exposing Manifest mechanics:
// "Does the currently SAVED authoritative state differ from what is
// currently published to collaborators, and can it be published?"
//
// Comparison is intentionally performed on the compiled public projection,
// never on raw content.json equality. Studio-only state such as faqDrafts
// must not create a false "modifications non publiées" signal.

const fs = require('fs');
const { buildPublicationCandidate } = require('../publication-candidate');
const { compile, CompilerBlockingError } = require('../compiler');
const { SUPPORTED_EDITIONS } = require('../publish');

function readPublishedManifest(manifestPath) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return null;
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function comparisonContext(publishedManifest) {
  // Reuse the last publication metadata so a deterministic compile of an
  // unchanged public state can be compared byte-for-structure with the
  // published Manifest. These values are comparison-only: nothing is written.
  if (publishedManifest && publishedManifest.meta) {
    return {
      generatedAt: publishedManifest.meta.generatedAt,
      revision: publishedManifest.meta.revision,
      supportedEditions: SUPPORTED_EDITIONS
    };
  }

  return {
    generatedAt: '1970-01-01T00:00:00.000Z',
    revision: 'studio-unpublished-comparison',
    supportedEditions: SUPPORTED_EDITIONS
  };
}

function compileCurrentPublicProjection(authoritativeState, publishedManifest) {
  const snapshot = JSON.parse(JSON.stringify(authoritativeState || {}));
  const candidate = buildPublicationCandidate(snapshot);
  return compile(candidate, comparisonContext(publishedManifest));
}

function sameProjection(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getPublicationStatus(authoritativeState, manifestPath) {
  let publishedManifest = null;

  try {
    publishedManifest = readPublishedManifest(manifestPath);
  } catch (error) {
    // A corrupt/unreadable published Manifest is an operational problem. The
    // Studio must not claim that everything is published. Keep the response
    // conservative and actionable without leaking filesystem internals.
    return {
      published: true,
      hasUnpublishedChanges: true,
      publishable: false,
      publishedRevision: null,
      publishedAt: null,
      blockingError: 'La version publiée ne peut pas être vérifiée.'
    };
  }

  try {
    const currentProjection = compileCurrentPublicProjection(authoritativeState, publishedManifest);

    if (!publishedManifest) {
      return {
        published: false,
        hasUnpublishedChanges: true,
        publishable: true,
        publishedRevision: null,
        publishedAt: null,
        blockingError: null
      };
    }

    return {
      published: true,
      hasUnpublishedChanges: !sameProjection(currentProjection, publishedManifest),
      publishable: true,
      publishedRevision: publishedManifest?.meta?.revision || null,
      publishedAt: publishedManifest?.meta?.generatedAt || null,
      blockingError: null
    };
  } catch (error) {
    if (error instanceof CompilerBlockingError) {
      return {
        published: Boolean(publishedManifest),
        hasUnpublishedChanges: true,
        publishable: false,
        publishedRevision: publishedManifest?.meta?.revision || null,
        publishedAt: publishedManifest?.meta?.generatedAt || null,
        blockingError: error.message
      };
    }
    throw error;
  }
}

module.exports = {
  readPublishedManifest,
  compileCurrentPublicProjection,
  getPublicationStatus
};
