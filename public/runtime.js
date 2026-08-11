// TECTONIC — Public Runtime (Phase 5)
//
// Contrat strict, vérifié par les tests :
//   - lit UNIQUEMENT /api/manifest (jamais /api/content, jamais
//     faqDrafts/KPI/télémétrie/contacts/auth — ces données ne sont de
//     toute façon jamais présentes dans le Manifest, voir les
//     documents gelés) ;
//   - refuse proprement un schemaVersion inconnu ;
//   - route vers le renderer indiqué par manifest.edition.id ;
//   - une édition inconnue ou non supportée produit une erreur
//     explicite, JAMAIS un repli silencieux vers Ivory.
//
// Aucune logique éditoriale ici — ce fichier ne fait que charger,
// distribuer, et fournir le "Public Core" partagé (actions
// d'interaction telles que l'envoi d'un contact). Le rendu lui-même
// vit dans /public/renderers/*.js, qui ne connaît jamais d'endpoint
// ni de mécanisme de stockage — seulement des actions qu'on lui
// fournit à appeler.

const SUPPORTED_SCHEMA_VERSIONS = [1];
const RENDERERS = {
  ivory: '/public/renderers/ivory.js'
  // rainbow-glass, midnight-frost : hors périmètre Phase 5, volontairement absents
};

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFatalError(message) {
  const root = document.getElementById('tectonic-root') || document.body;
  // Le message est toujours échappé — une fonction d'erreur publique
  // ne doit jamais injecter du texte brut via innerHTML, même si les
  // messages actuels sont tous contrôlés par ce fichier lui-même.
  root.innerHTML = `
    <div style="max-width:640px;margin:80px auto;padding:32px;font-family:system-ui,sans-serif;
                border:1px solid #e2e2e2;border-radius:8px;background:#fff;color:#1a1a1a;">
      <h1 style="font-size:1.1rem;margin:0 0 12px;">Impossible d'afficher ce site</h1>
      <p style="margin:0;color:#555;line-height:1.5;">${esc(message)}</p>
    </div>`;
}

async function loadManifest() {
  const res = await fetch('/api/manifest');
  if (res.status === 404) {
    throw new Error("Aucune publication n'existe encore pour ce projet (data/manifest.json absent).");
  }
  if (!res.ok) {
    throw new Error(`Le Manifest n'a pas pu être chargé (HTTP ${res.status}).`);
  }
  return res.json();
}

function validateSchemaVersion(manifest) {
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(manifest.schemaVersion)) {
    throw new Error(
      `Version de Manifest non reconnue (schemaVersion=${JSON.stringify(manifest.schemaVersion)}). ` +
      `Ce Runtime ne devine jamais une version — il refuse de rendre plutôt que d'improviser.`
    );
  }
}

async function loadRenderer(editionId) {
  const rendererPath = RENDERERS[editionId];
  if (!rendererPath) {
    // Jamais de repli silencieux vers Ivory — une édition inconnue ou
    // pas encore migrée est une erreur explicite, pas une supposition.
    throw new Error(
      `Édition "${editionId}" non supportée par ce Runtime (Phase 5 : seul "ivory" l'est). ` +
      `Aucun repli automatique n'est appliqué.`
    );
  }
  const module = await import(rendererPath);
  if (typeof module.render !== 'function') {
    throw new Error(`Le renderer "${editionId}" ne fournit pas de fonction render() exploitable.`);
  }
  return module.render;
}

// ─────────────────────────────────────────────────────────────────
// Public Core : actions d'interaction fournies aux renderers.
// Un renderer rend l'UI et appelle ces fonctions ; il ne connaît
// jamais l'URL d'un endpoint, ni la façon dont la donnée est stockée.
// Aujourd'hui : escalade de contact + baromètre météo anonyme.
// Le renderer exprime une intention ; le Runtime reste propriétaire de
// l'endpoint et du payload. Le reste du tracking demeure hors renderer.
// ─────────────────────────────────────────────────────────────────
function buildPublicCoreActions() {
  return {
    async submitContact({ name, email, message }) {
      try {
        const res = await fetch('/api/public/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { ok: true };
        return { ok: false, error: data.error || 'Envoi impossible.' };
      } catch (e) {
        return { ok: false, error: 'Connexion au serveur impossible.' };
      }
    },

    async submitMood({ value }) {
      const numericValue = Math.round(Number(value));
      if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 5) {
        return { ok: false, error: 'Ressenti invalide.' };
      }
      try {
        const res = await fetch('/api/kpi/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Le serveur horodate si ts est absent. Aucune identité ni session.
          body: JSON.stringify({ type: 'mood', value: numericValue })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { ok: true };
        return { ok: false, error: data.error || 'Enregistrement impossible.' };
      } catch (e) {
        return { ok: false, error: 'Connexion au serveur impossible.' };
      }
    }
  };
}

async function boot() {
  let manifest;
  try {
    manifest = await loadManifest();
    validateSchemaVersion(manifest);
  } catch (err) {
    renderFatalError(err.message);
    return;
  }

  let render;
  try {
    render = await loadRenderer(manifest.edition.id);
  } catch (err) {
    renderFatalError(err.message);
    return;
  }

  const root = document.getElementById('tectonic-root') || document.body;
  const actions = buildPublicCoreActions();

  // Une erreur DANS le rendu (bug du renderer, donnée inattendue) ne
  // doit jamais produire une exception JS non gérée côté visiteur —
  // elle doit produire le même état fatal propre que les autres échecs.
  try {
    render(manifest, root, actions);
  } catch (err) {
    renderFatalError(`Le rendu a échoué : ${err.message}`);
  }
}

boot();

// Exports pour les tests unitaires (Node importe ce module directement
// via son vrai chargeur ES — contrairement à jsdom, qui n'exécute pas
// les scripts type="module" et ne peut donc pas servir à tester ce
// fichier via un chargement de page simulé).
export { loadManifest, validateSchemaVersion, loadRenderer, buildPublicCoreActions, renderFatalError, SUPPORTED_SCHEMA_VERSIONS, RENDERERS };
