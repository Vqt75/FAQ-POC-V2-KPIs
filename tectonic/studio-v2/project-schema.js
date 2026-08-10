'use strict';

// Tectonic Studio V2 — contrat sémantique de la page « Le projet ».
// 2A.1 : structure proposée plutôt que page blanche. Toutes les sections
// restent des objets de contenu ; `enabled` dit seulement si une section
// participe à la publication. Aucun choix de layout n'entre ici.

const PROJECT_SECTION_TYPES = [
  'focus',
  'keyFigures',
  'text',
  'image',
  'gallery',
  'timeline',
  'quote',
  'choices',
  'team'
];

function createDefaultProject() {
  return {
    intro: {
      title: 'Un nouveau lieu de travail, pensé pour nos usages.',
      body: "Le projet accompagne le regroupement des équipes dans un environnement en flex office. Les futurs espaces sont conçus pour offrir davantage de choix au fil de la journée : se concentrer, échanger, collaborer, se réunir ou faire une pause, selon l’activité du moment."
    },
    sections: [
      {
        id: 'project-focus-usages',
        type: 'focus',
        enabled: true,
        title: 'Pourquoi faire évoluer nos espaces ?',
        body: "Nos façons de travailler ont changé : davantage de travail hybride, plus de projets transverses et des besoins très différents au cours d’une même journée. Le projet vise à mieux faire correspondre les espaces à ces usages, plutôt qu’à reproduire partout le même poste de travail."
      },
      {
        id: 'project-key-figures',
        type: 'keyFigures',
        enabled: true,
        title: 'Quelques repères',
        items: [
          { value: '8/10', label: 'postes de travail pour 10 collaborateurs' },
          { value: '6', label: 'grandes typologies d’espaces' },
          { value: '1', label: 'casier individuel par collaborateur' },
          { value: '2026', label: 'année d’installation cible' }
        ]
      },
      {
        id: 'project-text-daily-life',
        type: 'text',
        enabled: true,
        title: 'Ce qui changera au quotidien.',
        body: "Dans les zones en flex office, les postes ne seront plus attribués individuellement. Chacun pourra choisir son environnement en fonction de son activité : poste standard, espace calme, cabine pour un appel, salle de réunion ou zone collaborative. Des casiers personnels et des repères simples accompagneront cette nouvelle organisation."
      },
      {
        id: 'project-image',
        type: 'image',
        enabled: false,
        asset: null,
        caption: ''
      },
      {
        id: 'project-gallery',
        type: 'gallery',
        enabled: false,
        title: 'Se projeter dans les futurs espaces',
        items: []
      },
      { id: 'project-timeline', type: 'timeline', enabled: true },
      {
        id: 'project-quote',
        type: 'quote',
        enabled: true,
        quote: "Le flex office n’est pas une fin en soi : l’enjeu est que chacun trouve plus facilement l’espace adapté à ce qu’il a besoin de faire.",
        attribution: 'Équipe projet'
      },
      {
        id: 'project-choices',
        type: 'choices',
        enabled: true,
        title: 'Ce qui guide les choix',
        items: [
          { title: 'Donner du choix', body: 'Proposer plusieurs environnements plutôt qu’un poste unique pour toutes les activités.' },
          { title: 'Préserver la concentration', body: 'Identifier clairement les zones calmes et multiplier les solutions pour les appels et les tâches de focus.' },
          { title: 'Faciliter les échanges', body: 'Créer davantage de lieux pour collaborer, se réunir et partager de manière informelle.' },
          { title: 'Rester ajustable', body: 'Observer les usages après l’installation et faire évoluer les espaces lorsque cela est utile.' }
        ]
      },
      { id: 'project-team', type: 'team', enabled: true }
    ]
  };
}

function text(value, max = 12000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function normalizeAsset(raw) {
  const url = text(raw && raw.url, 2048).trim();
  if (!url) return null;
  return { url, alt: text(raw && raw.alt, 500) };
}

function normalizePairItems(raw, valueKey, labelKey, maxItems = 12) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, maxItems).map(item => ({
    [valueKey]: text(item && item[valueKey], 1000),
    [labelKey]: text(item && item[labelKey], 4000)
  }));
}

function normalizeSection(raw, index) {
  const type = PROJECT_SECTION_TYPES.includes(raw && raw.type) ? raw.type : 'text';
  const id = text(raw && raw.id, 160).trim() || `project-section-${index + 1}`;
  const enabled = raw && raw.enabled === false ? false : true;
  const base = { id, type, enabled };

  if (type === 'focus' || type === 'text') {
    return { ...base, title: text(raw && raw.title, 500), body: text(raw && raw.body) };
  }
  if (type === 'quote') {
    return { ...base, quote: text(raw && raw.quote, 4000), attribution: text(raw && raw.attribution, 500) };
  }
  if (type === 'keyFigures') {
    return {
      ...base,
      title: text(raw && raw.title, 500),
      items: normalizePairItems(raw && raw.items, 'value', 'label', 8)
    };
  }
  if (type === 'choices') {
    return {
      ...base,
      title: text(raw && raw.title, 500),
      items: normalizePairItems(raw && raw.items, 'title', 'body', 8)
    };
  }
  if (type === 'image') {
    return {
      ...base,
      asset: normalizeAsset(raw && (raw.asset || raw.image)),
      caption: text(raw && raw.caption, 1000)
    };
  }
  if (type === 'gallery') {
    const source = Array.isArray(raw && raw.items) ? raw.items : (Array.isArray(raw && raw.assets) ? raw.assets : []);
    return {
      ...base,
      title: text(raw && raw.title, 500),
      items: source.slice(0, 12).map(normalizeAsset).filter(Boolean)
    };
  }
  // timeline / team sont des marqueurs sémantiques. Leur contenu vit
  // dans les collections autoritaires milestones / team, pour éviter
  // toute duplication et divergence entre deux écrans Studio.
  return base;
}

function optionalTemplate(type) {
  const fallback = createDefaultProject().sections.find(section => section.type === type);
  return fallback ? structuredClone(fallback) : null;
}

function insertAtRecommendedPosition(sections, template) {
  const order = PROJECT_SECTION_TYPES;
  const wantedRank = order.indexOf(template.type);
  const nextIndex = sections.findIndex(section => {
    const rank = order.indexOf(section.type);
    return rank >= 0 && rank > wantedRank;
  });
  if (nextIndex === -1) sections.push(template);
  else sections.splice(nextIndex, 0, template);
}


function upgradePocDefaults(intro, sections) {
  // Migration éditoriale ciblée : uniquement les valeurs exactes du pack 2A
  // sont remplacées. Dès qu'un utilisateur a écrit quelque chose, on préserve
  // son texte et on ne "réécrit" jamais le projet à sa place.
  if (intro.title === 'Un nouvel environnement pour travailler autrement.') {
    intro.title = 'Un nouveau lieu de travail, pensé pour nos usages.';
  }
  if (intro.body === 'Le projet rassemble les équipes dans de nouveaux espaces conçus pour mieux répondre aux différents usages de la journée.') {
    intro.body = "Le projet accompagne le regroupement des équipes dans un environnement en flex office. Les futurs espaces sont conçus pour offrir davantage de choix au fil de la journée : se concentrer, échanger, collaborer, se réunir ou faire une pause, selon l’activité du moment.";
  }

  sections.forEach(section => {
    if (section.type === 'focus' && section.title === 'Un projet pensé à partir des usages.') {
      section.title = 'Pourquoi faire évoluer nos espaces ?';
      section.body = "Nos façons de travailler ont changé : davantage de travail hybride, plus de projets transverses et des besoins très différents au cours d’une même journée. Le projet vise à mieux faire correspondre les espaces à ces usages, plutôt qu’à reproduire partout le même poste de travail.";
    }
    if (section.type === 'text' && section.title === 'Des espaces pour plusieurs manières de travailler.') {
      section.title = 'Ce qui changera au quotidien.';
      section.body = "Dans les zones en flex office, les postes ne seront plus attribués individuellement. Chacun pourra choisir son environnement en fonction de son activité : poste standard, espace calme, cabine pour un appel, salle de réunion ou zone collaborative. Des casiers personnels et des repères simples accompagneront cette nouvelle organisation.";
    }
    if (section.type === 'quote' && section.quote === 'Nous voulons créer un lieu où chacun puisse trouver l’environnement adapté à ce qu’il a à faire.') {
      section.quote = "Le flex office n’est pas une fin en soi : l’enjeu est que chacun trouve plus facilement l’espace adapté à ce qu’il a besoin de faire.";
    }
    if (section.type === 'keyFigures') {
      const old = Array.isArray(section.items) && section.items.length === 3
        && section.items[0]?.value === '1 200' && section.items[1]?.value === '90' && section.items[2]?.value === '8';
      if (old) {
        section.items = [
          { value: '8/10', label: 'postes de travail pour 10 collaborateurs' },
          { value: '6', label: 'grandes typologies d’espaces' },
          { value: '1', label: 'casier individuel par collaborateur' },
          { value: '2026', label: 'année d’installation cible' }
        ];
      }
    }
    if (section.type === 'choices' && Array.isArray(section.items) && section.items[0]?.title === 'Partir des usages') {
      section.items = [
        { title: 'Donner du choix', body: 'Proposer plusieurs environnements plutôt qu’un poste unique pour toutes les activités.' },
        { title: 'Préserver la concentration', body: 'Identifier clairement les zones calmes et multiplier les solutions pour les appels et les tâches de focus.' },
        { title: 'Faciliter les échanges', body: 'Créer davantage de lieux pour collaborer, se réunir et partager de manière informelle.' },
        { title: 'Rester ajustable', body: 'Observer les usages après l’installation et faire évoluer les espaces lorsque cela est utile.' }
      ];
    }
  });
}

function normalizeProject(raw) {
  const fallback = createDefaultProject();
  if (!raw || typeof raw !== 'object') return fallback;

  const introRaw = raw.intro && typeof raw.intro === 'object' ? raw.intro : {};
  const intro = {
    title: text(introRaw.title, 700) || fallback.intro.title,
    body: text(introRaw.body || introRaw.description) || fallback.intro.body
  };

  // Une liste vide venant du premier prototype signifie « pas encore configuré ».
  // On amorce donc le POC avec la structure proposée plutôt qu'une page blanche.
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    return { intro, sections: fallback.sections };
  }

  const seenSingletons = new Set();
  const sections = [];
  raw.sections.slice(0, 24).forEach((section, index) => {
    const normalized = normalizeSection(section, index);
    if ((normalized.type === 'timeline' || normalized.type === 'team')) {
      if (seenSingletons.has(normalized.type)) return;
      seenSingletons.add(normalized.type);
    }
    sections.push(normalized);
  });

  // Migration douce 2A → 2A.1 : les anciens projets n'avaient pas les deux
  // emplacements visuels proposés. On les ajoute désactivés, sans modifier
  // l'ordre déjà choisi pour les sections existantes.
  upgradePocDefaults(intro, sections);

  ['image', 'gallery'].forEach(type => {
    if (!sections.some(section => section.type === type)) {
      const template = optionalTemplate(type);
      if (template) insertAtRecommendedPosition(sections, template);
    }
  });

  return { intro, sections };
}

module.exports = {
  PROJECT_SECTION_TYPES,
  createDefaultProject,
  normalizeProject,
  normalizeProjectSection: normalizeSection
};
