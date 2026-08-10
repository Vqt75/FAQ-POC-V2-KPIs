const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { publishFromAuthoritativeState } = require('../publish');
const { getPublicationStatus } = require('./publication-status');

function fixture() {
  return {
    branding: {
      projectName: 'Projet Foundation',
      logoUrl: '',
      theme: 'default',
      colors: ['#1E1D1E', '#C2AF7E'],
      fonts: [
        { name: 'Roboto', fileName: '', source: 'system' },
        { name: 'Italiana', fileName: '', source: 'system' }
      ]
    },
    publicContent: {
      faq: {}, actu: {}, plans: {}, ambassadeurs: {}, equipe: {}
    },
    milestones: [],
    articles: [],
    plans: [],
    ambassadorsContent: {},
    ambassadors: [],
    teamContent: {},
    team: [],
    faqEntries: [],
    faqDrafts: []
  };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storm-studio-foundation-'));
const manifestPath = path.join(dir, 'manifest.json');

try {
  const state = fixture();

  let status = getPublicationStatus(state, manifestPath);
  assert.strictEqual(status.published, false);
  assert.strictEqual(status.hasUnpublishedChanges, true);
  assert.strictEqual(status.publishable, true);

  publishFromAuthoritativeState(state, manifestPath);
  status = getPublicationStatus(state, manifestPath);
  assert.strictEqual(status.published, true);
  assert.strictEqual(status.hasUnpublishedChanges, false);
  assert.strictEqual(status.publishable, true);

  // Studio-only draft content is intentionally outside Publication Candidate.
  state.faqDrafts.push({ id: 'draft-1', title: 'Interne uniquement' });
  status = getPublicationStatus(state, manifestPath);
  assert.strictEqual(status.hasUnpublishedChanges, false);

  // A true public change must light up the pending-publication state.
  state.branding.projectName = 'Projet Foundation modifié';
  status = getPublicationStatus(state, manifestPath);
  assert.strictEqual(status.hasUnpublishedChanges, true);
  assert.strictEqual(status.publishable, true);

  // Reverting a public change removes the pending state.
  state.branding.projectName = 'Projet Foundation';
  status = getPublicationStatus(state, manifestPath);
  assert.strictEqual(status.hasUnpublishedChanges, false);

  // Saved draft can be invalid for publication; the last published Manifest
  // remains the source of truth and Studio must say publication is blocked.
  state.branding.fonts[0] = { name: 'Police inaccessible', fileName: 'x.woff2', source: 'upload' };
  status = getPublicationStatus(state, manifestPath);
  assert.strictEqual(status.hasUnpublishedChanges, true);
  assert.strictEqual(status.publishable, false);
  assert.ok(status.blockingError && status.blockingError.includes('Police'));

  console.log('OK — Studio publication status: 6 scénarios validés.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
