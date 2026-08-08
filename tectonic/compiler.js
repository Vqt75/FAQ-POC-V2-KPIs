// TECTONIC — compile(candidate, context)
//
// Implémentation conforme à TECTONIC_COMPILER_DESIGN.md (gelé).
// Phase 2 du plan d'implémentation : implémentée et testée en
// isolation — aucun branchement dans server.js, aucun endpoint,
// aucun manifest.json de production à ce stade.
//
// Signature gelée (§1, corrigée) :
//   compile( PublicationCandidate, CompilationContext ) → Site Manifest
//
// CompilationContext = { generatedAt, revision, supportedEditions }

// ─────────────────────────────────────────────────────────────────
// Erreurs bloquantes (§6bis) — une classe dédiée pour que les
// appelants (et les tests) distinguent une erreur bloquante attendue
// d'un bug JS ordinaire.
// ─────────────────────────────────────────────────────────────────
class CompilerBlockingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CompilerBlockingError';
  }
}

// ─────────────────────────────────────────────────────────────────
// Defaults `alt`, tranchés dans TECTONIC_COMPILER_DESIGN.md §6 —
// implémentés tels quels, aucune interprétation nouvelle ici.
// ─────────────────────────────────────────────────────────────────
function wrapAsset(url, altDefault) {
  if (!url) return null;
  return { url, alt: typeof altDefault === 'string' ? altDefault : '' };
}

function personAltDefault(name, roleOrTitle) {
  if (roleOrTitle && String(roleOrTitle).trim()) {
    return `${name} — ${roleOrTitle}`;
  }
  return name || '';
}

// ─────────────────────────────────────────────────────────────────
// project / branding / edition
// ─────────────────────────────────────────────────────────────────
function compileProject(candidate) {
  const name = candidate?.branding?.projectName;
  if (typeof name !== 'string' || !name.trim()) {
    throw new CompilerBlockingError(
      'project.name manquant ou vide — précondition structurelle non satisfaite.'
    );
  }
  return { name };
}

function compileBranding(candidate) {
  const branding = candidate?.branding || {};
  const logoAlt = ''; // logo : décoratif par défaut (§6 du Compiler Design)
  const colorsArr = Array.isArray(branding.colors) ? branding.colors : [];
  const fontsArr = Array.isArray(branding.fonts) ? branding.fonts : [];

  function compileFont(f, fallbackFamily, slotName) {
    const family = (f && typeof f.name === 'string' && f.name.trim()) ? f.name : fallbackFamily;
    // La vraie normalizeBrandFont() de Pangea ne stocke qu'un
    // `fileName` (simple nom de fichier), jamais une URL servable —
    // aucune convention d'URL n'existe pour les polices uploadées.
    // Construire une URL inventée (ex. `/uploads/${fileName}`)
    // produirait un Manifest qui affirme "utilise Client Sans" sans
    // donner au Runtime le moyen réel de la charger — un Manifest
    // formellement valide mais fonctionnellement mensonger. Plus sûr :
    // refuser explicitement la publication plutôt que de la laisser
    // passer avec une identité typographique cassée. Tant que Pangea
    // n'a aucune police réellement marquée "upload" (le cas aujourd'hui,
    // vérifié sur les vraies données), ceci ne bloque rien en pratique.
    if (f && f.source === 'upload') {
      throw new CompilerBlockingError(
        `Police "${family}" (${slotName}) marquée comme uploadée, mais aucune URL ` +
        `exploitable n'est disponible (stratégie d'URL des assets encore ouverte — ` +
        `voir TECTONIC_SITE_MANIFEST.md §12). Publication refusée plutôt que de ` +
        `produire un Manifest qui prétend charger une police inaccessible.`
      );
    }
    return { family, asset: null };
  }

  return {
    logo: wrapAsset(branding.logoUrl, logoAlt),
    colors: {
      primary: colorsArr[0] || '#1E1D1E',
      secondary: colorsArr[1] || '#C2AF7E'
    },
    fonts: {
      primary: compileFont(fontsArr[0], 'Roboto', 'primary'),
      secondary: compileFont(fontsArr[1], 'Italiana', 'secondary')
    }
  };
}

// Pangea stocke 'default' comme valeur interne pour ce que l'admin
// affiche et prévisualise sous le nom "Ivory" (vérifié dans index.html :
// data-theme-value="default" est systématiquement associé à
// data-preview-theme="ivory"). Le Manifest Tectonic ne doit jamais
// propager ce nom legacy jusqu'au Runtime — toute l'architecture
// gelée parle d'Ivory comme édition de référence, et la Phase 5 du
// plan d'implémentation prévoit explicitement /public/renderers/ivory.js.
const LEGACY_THEME_TO_EDITION = { default: 'ivory' };

function compileEdition(candidate, context) {
  const rawTheme = candidate?.branding?.theme;
  const theme = LEGACY_THEME_TO_EDITION[rawTheme] || rawTheme;
  const supported = Array.isArray(context?.supportedEditions) ? context.supportedEditions : [];
  if (!supported.includes(theme)) {
    throw new CompilerBlockingError(
      `Édition inconnue : "${theme}" (depuis branding.theme="${rawTheme}") n'est pas dans ` +
      `context.supportedEditions [${supported.join(', ')}]. Compilation refusée — aucun ` +
      `repli silencieux (voir TECTONIC_COMPILER_DESIGN.md §6).`
    );
  }
  return { id: theme };
}

// ─────────────────────────────────────────────────────────────────
// navigation — le Compiler VALIDE, il ne répare jamais (voir §6 du
// document gelé, corrigé). buildPublicationCandidate() produit déjà
// modules/navigation effectifs ; si le candidate reçu est incohérent
// sur ce point, c'est un défaut structurel du candidate lui-même —
// une erreur bloquante, pas quelque chose que le Compiler nettoie
// discrètement en filtrant l'entrée fautive.
// ─────────────────────────────────────────────────────────────────
function compileNavigation(candidate) {
  const modules = candidate?.modules || {};
  if (!Array.isArray(candidate?.navigation)) {
    throw new CompilerBlockingError(
      `Candidate incohérent : navigation doit être un tableau, reçu ` +
      `${JSON.stringify(candidate?.navigation)}. Ce n'est pas au Compiler de réparer ` +
      `un candidate mal formé en le remplaçant silencieusement par [].`
    );
  }
  const navigation = candidate.navigation;
  navigation.forEach(entry => {
    if (modules[entry.module] !== true) {
      throw new CompilerBlockingError(
        `Candidate incohérent : navigation référence le module "${entry.module}", ` +
        `qui n'est pas activé dans modules. Ce n'est pas au Compiler de corriger ` +
        `un candidate mal formé — buildPublicationCandidate() doit produire une ` +
        `navigation déjà cohérente.`
      );
    }
  });
  return navigation;
}

// ─────────────────────────────────────────────────────────────────
// content.timeline
// ─────────────────────────────────────────────────────────────────
function computeProgressFromMilestones(milestones) {
  const items = Array.isArray(milestones) ? milestones : [];
  const total = items.length;
  if (!total) return { currentStepLabel: 'Étape 0', totalSteps: 0, percent: 0 };
  const doneCount = items.filter(m => m.status === 'done').length;
  const currentIndex = items.findIndex(m => m.status === 'current');
  const stepNumber = currentIndex >= 0 ? currentIndex + 1 : Math.min(doneCount + 1, total);
  const percent = Math.round(((doneCount + (currentIndex >= 0 ? 0.5 : 0)) / total) * 100);
  return {
    currentStepLabel: `Étape ${stepNumber}`,
    totalSteps: total,
    percent: Math.max(0, Math.min(100, percent))
  };
}

function compileTimeline(candidate) {
  const scope = candidate?.publicContent?.actu || {};
  const milestones = Array.isArray(candidate?.milestones) ? candidate.milestones : [];
  return {
    intro: {
      eyebrow: scope.eyebrow || '',
      title: [scope.titleLine1, scope.titleAccent].filter(Boolean).join(' '),
      description: scope.desc || ''
    },
    progress: computeProgressFromMilestones(milestones),
    milestones: milestones.map(m => ({
      id: m.id,
      status: m.status,
      date: m.date || '',
      label: m.label || '',
      description: m.desc || ''
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.spaces
// ─────────────────────────────────────────────────────────────────
function compileSpaces(candidate) {
  const scope = candidate?.publicContent?.plans || {};
  const plans = Array.isArray(candidate?.plans) ? candidate.plans : [];
  return {
    intro: {
      eyebrow: scope.eyebrow || '',
      title: [scope.titleLine1, scope.titleAccent].filter(Boolean).join(' '),
      description: scope.desc || ''
    },
    items: plans.map(p => ({
      id: p.id,
      type: p.type || '',
      tags: typeof p.tags === 'string'
        ? p.tags.split(',').map(t => t.trim()).filter(Boolean)
        : (Array.isArray(p.tags) ? p.tags : []),
      title: p.title || '',
      comment: p.comment || '',
      asset: wrapAsset(p.imageUrl, p.title || '')
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.news
// ─────────────────────────────────────────────────────────────────
function compileNews(candidate) {
  const scope = candidate?.publicContent?.actu || {};
  const articles = Array.isArray(candidate?.articles) ? candidate.articles : [];
  return {
    intro: {
      eyebrow: scope.eyebrow || '',
      title: [scope.titleLine1, scope.titleAccent].filter(Boolean).join(' '),
      description: scope.desc || ''
    },
    items: articles.map(a => ({
      id: a.id,
      tag: a.tag || '',
      date: a.date || '',
      title: a.title || '',
      summary: a.chapeau || '',
      body: a.body || ''
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.questions — conserve les signaux de scoring tels quels
// (décision déjà prise dans le Manifest gelé, §4/§12).
// ─────────────────────────────────────────────────────────────────
function compileQuestions(candidate) {
  const scope = candidate?.publicContent?.faq || {};
  const entries = Array.isArray(candidate?.faqEntries) ? candidate.faqEntries : [];
  return {
    intro: {
      eyebrow: scope.eyebrow || '',
      title: [scope.titleLine1, scope.titleAccent].filter(Boolean).join(' '),
      description: scope.desc || ''
    },
    items: entries.map(e => ({
      id: e.id,
      title: e.title || '',
      answer: e.answer || '',
      status: e.status,
      statusLabel: e.statusLabel || '',
      category: e.category || '',
      note: e.note || '',
      keywords: Array.isArray(e.keywords) ? e.keywords : [],
      phrases: Array.isArray(e.phrases) ? e.phrases : [],
      intentSignals: Array.isArray(e.intentSignals) ? e.intentSignals : [],
      emotionSignals: Array.isArray(e.emotionSignals) ? e.emotionSignals : [],
      negativeSignals: Array.isArray(e.negativeSignals) ? e.negativeSignals : [],
      priority: typeof e.priority === 'number' ? e.priority : 0
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.ambassadors
// ─────────────────────────────────────────────────────────────────
function compileAmbassadors(candidate) {
  const c = candidate?.ambassadorsContent || {};
  const roster = Array.isArray(candidate?.ambassadors) ? candidate.ambassadors : [];
  return {
    intro: {
      title: c.introTitle || '',
      body: c.introBody || '',
      rosterLabel: c.rosterLabel || ''
    },
    cta: {
      title: c.ctaTitle || '',
      body: c.ctaBody || ''
    },
    roster: roster.map(p => ({
      id: p.id,
      name: p.name || '',
      role: p.role || '',
      tag: p.tag || '',
      photo: wrapAsset(p.imageUrl, personAltDefault(p.name, p.role))
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.team — compilé uniquement si modules.team === true
// (appelant responsable de ne pas invoquer cette fonction sinon).
// team.intro.introBody généralise team.intro.parellaIntro (décision
// prise dans le Manifest gelé, §12 point 7).
// ─────────────────────────────────────────────────────────────────
function compileTeam(candidate) {
  const c = candidate?.teamContent || {};
  const members = Array.isArray(candidate?.team) ? candidate.team : [];
  return {
    intro: { introBody: c.parellaIntro || '' },
    cta: {
      title: c.ctaTitle || '',
      body: c.ctaBody || ''
    },
    members: members.map(m => ({
      id: m.id,
      name: m.name || '',
      title: m.title || '',
      group: m.badge || '',
      photo: wrapAsset(m.imageUrl, personAltDefault(m.name, m.title))
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.home — distinction stricte config éditoriale / dérivé
// (§9 du document gelé). Le candidate actuel ne porte aucun champ
// home-spécifique (message/askPrompt/référence épinglée) : Pangea ne
// les produit pas encore en amont. Tant que ce n'est pas le cas,
// message reste null et askPrompt reste sur sa valeur par défaut —
// pas une invention, une conséquence directe de ce que le candidate
// contient réellement aujourd'hui.
// ─────────────────────────────────────────────────────────────────
const DEFAULT_ASK_PROMPT = 'Une question sur le projet ?';

function compileHome(candidate, compiledTimeline, compiledNews) {
  const currentMilestone = (compiledTimeline.milestones || []).find(m => m.status === 'current');
  const nextMilestone = (compiledTimeline.milestones || []).find(m => m.status === 'future');
  const firstArticle = (compiledNews.items || [])[0];

  return {
    message: candidate?.home?.message ?? null,
    askPrompt: (candidate?.home?.askPrompt && String(candidate.home.askPrompt).trim())
      ? candidate.home.askPrompt
      : DEFAULT_ASK_PROMPT,
    now: currentMilestone ? { label: 'Étape actuelle', value: currentMilestone.label } : null,
    next: nextMilestone ? { label: 'Prochaine échéance', date: nextMilestone.date } : null,
    // Pas de mécanisme d'épinglage dans le candidate aujourd'hui —
    // repli systématique sur le premier article (avertissement
    // récupérable si absent : featured devient simplement null).
    featured: firstArticle
      ? { source: { module: 'news', id: firstArticle.id }, title: firstArticle.title, summary: firstArticle.summary }
      : null
  };
}

// ─────────────────────────────────────────────────────────────────
// settings — moodNudge n'a aucune source dans le candidate
// aujourd'hui (aucune configuration équivalente dans Pangea) : le
// bloc settings reste vide, jamais un objet inventé.
// ─────────────────────────────────────────────────────────────────
function compileSettings(candidate) {
  const settings = {};
  if (candidate?.settings?.moodNudge) {
    settings.moodNudge = candidate.settings.moodNudge;
  }
  return settings;
}

// ─────────────────────────────────────────────────────────────────
// Validation finale (invariant 9 du Manifest / invariant 6 du
// Compiler) — vérifiée sur la sortie assemblée, pas juste espérée
// en écrivant le code de compilation.
// ─────────────────────────────────────────────────────────────────
const REQUIRED_MODULE_KEYS = ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team'];

function validateManifestInvariants(manifest) {
  const modules = manifest.modules;

  // Les 7 clés de modules doivent exister et être des booléens —
  // pas seulement cohérentes entre elles si elles existent.
  REQUIRED_MODULE_KEYS.forEach(key => {
    if (typeof modules[key] !== 'boolean') {
      throw new CompilerBlockingError(
        `Invariant violé : modules.${key} doit être un booléen, reçu ${JSON.stringify(modules[key])}.`
      );
    }
  });
  // L'ensemble des modules V1 est fermé — aucune clé supplémentaire
  // n'est tolérée. Sans cette vérification, un module inconnu injecté
  // dans le candidate (ex. "secretSauce: true") passerait la
  // validation ci-dessus (les 7 requises sont bien là) tout en restant
  // présent dans le Manifest, et une entrée navigation pourrait même
  // le référencer puisque modules.secretSauce === true suffirait à
  // la rendre "valide" selon la seule vérification navigation ↔ modules.
  const actualModuleKeys = Object.keys(modules).sort();
  const expectedModuleKeys = REQUIRED_MODULE_KEYS.slice().sort();
  if (actualModuleKeys.length !== expectedModuleKeys.length ||
      !actualModuleKeys.every((k, i) => k === expectedModuleKeys[i])) {
    throw new CompilerBlockingError(
      `Invariant violé : modules doit contenir exactement [${expectedModuleKeys.join(', ')}], ` +
      `reçu [${actualModuleKeys.join(', ')}].`
    );
  }

  // navigation doit être un tableau.
  if (!Array.isArray(manifest.navigation)) {
    throw new CompilerBlockingError('Invariant violé : navigation doit être un tableau.');
  }

  // meta.generatedAt et meta.revision doivent être des chaînes non vides.
  if (typeof manifest.meta.generatedAt !== 'string' || !manifest.meta.generatedAt.trim()) {
    throw new CompilerBlockingError('Invariant violé : meta.generatedAt doit être une chaîne non vide.');
  }
  if (typeof manifest.meta.revision !== 'string' || !manifest.meta.revision.trim()) {
    throw new CompilerBlockingError('Invariant violé : meta.revision doit être une chaîne non vide.');
  }

  // Cohérence modules ↔ content, dans les deux sens.
  REQUIRED_MODULE_KEYS.forEach(key => {
    const hasContent = Object.prototype.hasOwnProperty.call(manifest.content, key);
    if (modules[key] === true && !hasContent) {
      throw new CompilerBlockingError(
        `Invariant violé : modules.${key} est activé mais content.${key} est absent.`
      );
    }
    if (modules[key] === false && hasContent) {
      throw new CompilerBlockingError(
        `Invariant violé : modules.${key} est désactivé mais content.${key} est présent.`
      );
    }
  });

  // navigation ne référence que des modules activés.
  manifest.navigation.forEach(entry => {
    if (modules[entry.module] !== true) {
      throw new CompilerBlockingError(
        `Invariant violé : navigation référence le module "${entry.module}", désactivé.`
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// Pipeline principal — voir TECTONIC_COMPILER_DESIGN.md §5 (corrigé).
// ─────────────────────────────────────────────────────────────────
function compile(candidate, context) {
  // Étape 2 — préconditions minimales du candidate.
  if (!candidate || typeof candidate !== 'object') {
    throw new CompilerBlockingError('Publication Candidate absent ou invalide.');
  }

  // Étape 4 — socle : project, branding, edition (edition peut lever
  // une erreur bloquante — jamais de repli silencieux, voir §6).
  const project = compileProject(candidate);
  const branding = compileBranding(candidate);
  const edition = compileEdition(candidate, context);

  // Étape 3/5 — modules déjà résolus en amont (buildPublicationCandidate) ;
  // le Compiler valide, il ne recalcule ni ne répare.
  const modules = candidate.modules || {};
  const navigation = compileNavigation(candidate);

  // Étape 6 — content, module par module activé. L'ordre est
  // contraint : timeline et news doivent être compilés avant home.
  const content = {};
  if (modules.timeline) content.timeline = compileTimeline(candidate);
  if (modules.spaces) content.spaces = compileSpaces(candidate);
  if (modules.news) content.news = compileNews(candidate);
  if (modules.questions) content.questions = compileQuestions(candidate);
  if (modules.ambassadors) content.ambassadors = compileAmbassadors(candidate);
  if (modules.team) content.team = compileTeam(candidate);
  if (modules.home) {
    content.home = compileHome(
      candidate,
      content.timeline || { milestones: [] },
      content.news || { items: [] }
    );
  }

  // Étape 7 — settings.
  const settings = compileSettings(candidate);

  // Étape 8 — meta depuis CompilationContext, jamais généré ici.
  const meta = {
    generatedAt: context?.generatedAt,
    revision: context?.revision
  };

  const manifest = {
    schemaVersion: 1,
    meta,
    project,
    branding,
    edition,
    modules,
    navigation,
    content
  };
  // settings absent si vide — jamais `settings: {}` (contrat du Manifest gelé).
  if (Object.keys(settings).length > 0) {
    manifest.settings = settings;
  }

  // Étape 9 — validation finale, avant de retourner quoi que ce soit.
  validateManifestInvariants(manifest);

  return manifest;
}

module.exports = { compile, CompilerBlockingError, computeProgressFromMilestones };
