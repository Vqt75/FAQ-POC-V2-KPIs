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
const { normalizeNewsBlocks, newsBlocksToPlainText } = require('./news-content');
const { SPACE_STATUS, normalizeSpaces } = require('./spaces-content');

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
    if (f && f.source === 'upload') {
      const assetUrl = typeof f.assetUrl === 'string' ? f.assetUrl.trim() : '';
      if (!assetUrl || !assetUrl.startsWith('/uploads/')) {
        throw new CompilerBlockingError(
          `Police "${family}" (${slotName}) marquée comme uploadée, mais aucun asset ` +
          `servable n'est disponible. Réimportez la police dans Identité & apparence ` +
          `avant de publier.`
        );
      }
      return { family, asset: wrapAsset(assetUrl, '') };
    }
    return { family, asset: null };
  }

  const primaryFont = compileFont(fontsArr[0], 'Roboto', 'primary');

  return {
    logo: wrapAsset(branding.logoUrl, logoAlt),
    colors: {
      primary: colorsArr[0] || '#1E1D1E',
      // Une seule couleur explicitement fournie reste une seule identité :
      // on ne fabrique jamais un beige de secours qui n'appartient pas à la marque.
      secondary: colorsArr.length > 1
        ? colorsArr[1]
        : (colorsArr.length === 1 ? colorsArr[0] : '#C2AF7E')
    },
    fonts: {
      primary: primaryFont,
      // La police secondaire est facultative (décision produit) : si elle
      // est absente ou supprimée, tout ce qui l'aurait utilisée retombe
      // sur la police primaire réellement sélectionnée — jamais sur une
      // police codée en dur qui n'appartiendrait pas à ce projet précis.
      secondary: compileFont(fontsArr[1], primaryFont.family, 'secondary')
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
// content.project — structure éditoriale sémantique de « Le projet ».
// Aucun champ de layout n'est accepté ici : uniquement la nature et
// le contenu des sections. timeline / team restent des références vers
// leurs collections compilées séparément.
// ─────────────────────────────────────────────────────────────────
function compileProjectContent(candidate) {
  const source = candidate?.project && typeof candidate.project === 'object' ? candidate.project : {};
  const intro = source.intro && typeof source.intro === 'object' ? source.intro : {};
  const sections = Array.isArray(source.sections) ? source.sections.filter(section => section && section.enabled !== false) : [];

  function compileAsset(asset) {
    if (!asset || !asset.url) return null;
    return wrapAsset(asset.url, asset.alt || '');
  }

  function compileSection(section) {
    if (!section || !section.type) return null;
    const id = section.id || '';
    const type = String(section.type);
    const base = { id, type };

    if (type === 'focus' || type === 'text') {
      return { ...base, title: section.title || '', body: section.body || '' };
    }
    if (type === 'quote') {
      return { ...base, quote: section.quote || '', attribution: section.attribution || '' };
    }
    if (type === 'keyFigures') {
      return {
        ...base,
        title: section.title || '',
        items: (Array.isArray(section.items) ? section.items : []).map(item => ({
          value: item?.value || '',
          label: item?.label || ''
        }))
      };
    }
    if (type === 'choices') {
      return {
        ...base,
        title: section.title || '',
        items: (Array.isArray(section.items) ? section.items : []).map(item => ({
          title: item?.title || '',
          body: item?.body || ''
        }))
      };
    }
    if (type === 'image') {
      return { ...base, asset: compileAsset(section.asset), caption: section.caption || '' };
    }
    if (type === 'gallery') {
      return {
        ...base,
        title: section.title || '',
        items: (Array.isArray(section.items) ? section.items : []).map(compileAsset).filter(Boolean)
      };
    }
    if (type === 'timeline' || type === 'team') return base;
    return null;
  }

  return {
    intro: {
      title: intro.title || '',
      body: intro.body || intro.description || ''
    },
    sections: sections.map(compileSection).filter(Boolean)
  };
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
  const spaces = normalizeSpaces(candidate?.spaces, candidate?.plans);
  return {
    intro: {
      eyebrow: scope.eyebrow || '',
      title: [scope.titleLine1, scope.titleAccent].filter(Boolean).join(' '),
      description: scope.desc || ''
    },
    items: spaces.map(space => {
      const status = SPACE_STATUS[space.status] || SPACE_STATUS.designing;
      const media = (space.media || []).map(asset => ({
        url: asset.url,
        alt: asset.alt || asset.label || space.name || '',
        label: asset.label || '',
        kind: asset.kind || 'view'
      }));
      return {
        id: space.id,
        type: 'Espace',
        title: space.name || '',
        location: space.location || '',
        comment: space.description || '',
        status: status.label,
        statusBody: status.body,
        usageTags: Array.isArray(space.usages) ? space.usages : [],
        usages: Array.isArray(space.usages) ? space.usages : [],
        media,
        asset: media[0] || null
      };
    })
  };
}

// ─────────────────────────────────────────────────────────────────
// content.news
// ─────────────────────────────────────────────────────────────────
function estimateReadingMinutes(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function compileNews(candidate) {
  const scope = candidate?.publicContent?.actu || {};
  const articles = Array.isArray(candidate?.articles) ? candidate.articles : [];
  const orderedArticles = articles
    .map((article, index) => ({ article, index }))
    .sort((left, right) => {
      const a = String(left.article?.publishedAt || '');
      const b = String(right.article?.publishedAt || '');
      if (a && b && a !== b) return b.localeCompare(a);
      if (a && !b) return -1;
      if (!a && b) return 1;
      return left.index - right.index;
    })
    .map(entry => entry.article);
  return {
    intro: {
      eyebrow: scope.eyebrow || '',
      title: [scope.titleLine1, scope.titleAccent].filter(Boolean).join(' '),
      description: scope.desc || ''
    },
    items: orderedArticles.map(a => {
      const blocks = normalizeNewsBlocks(a.contentBlocks, a.body || '');
      return {
        id: a.id,
        tag: a.tag || '',
        date: a.date || '',
        publishedAt: a.publishedAt || '',
        readingMinutes: estimateReadingMinutes(newsBlocksToPlainText(blocks)),
        title: a.title || '',
        summary: a.chapeau || '',
        body: a.body || '',
        blocks,
        asset: a.asset && a.asset.url ? {
          url: a.asset.url,
          alt: a.asset.alt || a.title || ''
        } : null
      };
    })
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
function ambassadorContactHref(person) {
  const channel = ['email','teams','link'].includes(person?.contactChannel) ? person.contactChannel : 'email';
  const raw = String(person?.contactValue || '').trim();
  if (!raw) return '';

  if (channel === 'email') {
    const email = raw.replace(/^mailto:/i, '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '';
  }

  if (channel === 'teams') {
    return /^(https?:\/\/|msteams:)/i.test(raw) ? raw : '';
  }

  return /^https?:\/\//i.test(raw) ? raw : '';
}

function ambassadorContactLabel(name) {
  const firstName = String(name || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  return firstName ? `Contacter ${firstName}` : 'Contacter';
}

function compileAmbassadors(candidate) {
  const c = candidate?.ambassadorsContent || {};
  const roster = Array.isArray(candidate?.ambassadors) ? candidate.ambassadors : [];
  const joinEnabled = c.joinEnabled === true;
  return {
    intro: {
      title: c.introTitle || '',
      body: c.introBody || '',
      rosterLabel: c.rosterLabel || ''
    },
    contact: {
      // The network switch gates contact globally. Destinations remain individual.
      enabled: c.contactEnabled === true,
      defaultHref: '',
      label: 'Contacter'
    },
    join: {
      enabled: joinEnabled,
      mode: c.joinMode === 'link' ? 'link' : 'inline',
      title: c.joinTitle || c.ctaTitle || '',
      body: c.joinBody || c.ctaBody || '',
      label: c.joinLabel || 'Devenir ambassadeur',
      href: c.joinMode === 'link' ? (c.joinHref || '') : ''
    },
    cta: {
      enabled: joinEnabled,
      title: c.joinTitle || c.ctaTitle || '',
      body: c.joinBody || c.ctaBody || ''
    },
    roster: roster.map(p => ({
      id: p.id,
      name: p.name || '',
      role: p.role || '',
      tag: p.tag || '',
      contactable: p.contactable !== false,
      contactHref: p.contactable === false ? '' : ambassadorContactHref(p),
      contactLabel: ambassadorContactLabel(p.name),
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
  if (modules.timeline) {
    content.timeline = compileTimeline(candidate);
    content.project = compileProjectContent(candidate);
  }
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
