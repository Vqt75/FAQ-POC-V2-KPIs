const SPACE_STATUS = {
  designing: {
    label: 'En cours de conception',
    body: 'Cet espace est encore en cours de conception. Son organisation et certains détails peuvent évoluer.'
  },
  approved: {
    label: 'Validé',
    body: 'Les grands principes de cet espace sont validés. Les ajustements restants portent sur des détails de mise au point.'
  },
  delivered: {
    label: 'Livré',
    body: 'Cet espace est livré et peut désormais être découvert tel qu’il sera utilisé au quotidien.'
  }
};

const DEFAULT_USAGES = [
  'Se concentrer',
  'Collaborer',
  'Se réunir',
  'Échanger de façon informelle',
  'Faire une pause',
  'Travailler autrement',
  'Accueillir'
];

function uid(prefix, index) {
  return `${prefix}-${Date.now()}-${index}`;
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.slice(0, 6000) : fallback;
}

function normalizeStatus(value) {
  return Object.prototype.hasOwnProperty.call(SPACE_STATUS, value) ? value : 'designing';
}

function normalizeUsageList(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(value => cleanString(value).trim()).filter(Boolean))].slice(0, 12);
}

function inferMediaKind(raw) {
  const explicit = raw && ['view', 'plan', 'document'].includes(raw.kind) ? raw.kind : '';
  if (explicit) return explicit;
  const url = cleanString(raw?.url || raw?.imageUrl).toLowerCase();
  const text = `${cleanString(raw?.label)} ${cleanString(raw?.alt)} ${url}`;
  if (/\.pdf(?:$|\?)/.test(url)) return /plan|zoning|implantation|niveau|étage|etage/.test(text) ? 'plan' : 'document';
  if (/plan|zoning|implantation|niveau|étage|etage/.test(text)) return 'plan';
  return 'view';
}

function normalizeMedia(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const url = cleanString(raw.url || raw.imageUrl).trim();
  if (!url) return null;
  return {
    id: cleanString(raw.id).trim() || uid('space-media', index),
    kind: inferMediaKind(raw),
    url,
    label: cleanString(raw.label || raw.title).trim(),
    alt: cleanString(raw.alt).trim()
  };
}

function normalizeSpace(raw, index = 0) {
  const status = normalizeStatus(raw?.status);
  const mediaRaw = Array.isArray(raw?.media)
    ? raw.media
    : (raw?.imageUrl ? [{ url: raw.imageUrl, label: raw.title, kind: inferMediaKind(raw) }] : []);
  const media = mediaRaw.map((item, mediaIndex) => normalizeMedia(item, mediaIndex)).filter(Boolean);
  const usages = normalizeUsageList(raw?.usages || raw?.usageTags);
  return {
    id: cleanString(raw?.id).trim() || uid('space', index),
    name: cleanString(raw?.name || raw?.title).trim() || `Espace ${index + 1}`,
    location: cleanString(raw?.location).trim(),
    status,
    description: cleanString(raw?.description || raw?.comment).trim(),
    usages,
    media
  };
}

function semanticPresetForLegacyPlan(plan, index) {
  const title = cleanString(plan?.title).trim();
  const comment = cleanString(plan?.comment).trim();
  const semantic = `${title} ${cleanString(plan?.tags)} ${cleanString(plan?.type)}`.toLowerCase();
  const base = {
    id: cleanString(plan?.id).trim() || `space-${index + 1}`,
    name: title || `Espace ${index + 1}`,
    location: '',
    status: 'designing',
    description: comment,
    usages: ['Travailler autrement'],
    media: plan?.imageUrl ? [{
      id: `legacy-media-${index + 1}`,
      kind: inferMediaKind({ url: plan.imageUrl, label: `${plan.type || ''} ${plan.tags || ''} ${title}` }),
      url: plan.imageUrl,
      label: title,
      alt: title
    }] : []
  };

  if (/convivial|work.?caf|caf[eé]|restauration/.test(semantic)) {
    return { ...base, name: 'Work-café', location: 'Cœur du site', usages: ['Faire une pause', 'Échanger de façon informelle', 'Travailler autrement'] };
  }
  if (/concentration|focus|calme|cabine|phonique/.test(semantic)) {
    return { ...base, name: 'Espaces de concentration', location: 'À proximité des plateaux de travail', usages: ['Se concentrer', 'Travailler autrement'] };
  }
  if (/finance|micro.?zoning|plateau|poste/.test(semantic)) {
    return { ...base, name: 'Plateau de travail', location: 'Niveau R+1', usages: ['Se concentrer', 'Collaborer', 'Travailler autrement'] };
  }
  if (/hall|entr[ée]e/.test(semantic)) {
    return { ...base, name: 'Hall d’entrée', location: 'Rez-de-chaussée', usages: ['Accueillir', 'Échanger de façon informelle'] };
  }
  if (/rez.de.chauss|rdc|accueil|services/.test(semantic)) {
    return { ...base, name: 'Accueil & services', location: 'Rez-de-chaussée', usages: ['Accueillir', 'Échanger de façon informelle', 'Faire une pause'] };
  }
  if (/macro.?zoning|vue g[ée]n[ée]rale|ensemble/.test(semantic)) {
    return { ...base, name: 'Vue d’ensemble du futur site', location: 'Niveau R+1', usages: ['Travailler autrement', 'Collaborer', 'Se concentrer'] };
  }
  return base;
}

function migrateLegacyPlansToSpaces(plans) {
  if (!Array.isArray(plans)) return [];
  return plans.map((plan, index) => semanticPresetForLegacyPlan(plan, index));
}

function createDefaultSpaces() {
  return [
    {
      id: 'space-overview',
      name: 'Vue d’ensemble du futur site',
      location: 'Niveau R+1',
      status: 'designing',
      description: 'Une première lecture du futur environnement de travail : les différentes familles d’usages s’organisent autour d’une circulation centrale, avec des zones plus calmes et d’autres plus collaboratives.',
      usages: ['Travailler autrement', 'Collaborer', 'Se concentrer'],
      media: [{ id:'space-media-overview', kind:'plan', url:'Plan.jpg', label:'Plan macro-zoning — vue générale niveau R+1', alt:'Plan macro-zoning du niveau R+1' }]
    },
    {
      id: 'space-workcafe',
      name: 'Work-café',
      location: 'Cœur du site',
      status: 'approved',
      description: 'Un espace central, lumineux et polyvalent pour déjeuner, faire une pause, retrouver un collègue ou travailler ponctuellement dans un cadre plus informel.',
      usages: ['Faire une pause', 'Échanger de façon informelle', 'Travailler autrement'],
      media: [{ id:'space-media-workcafe', kind:'view', url:'Vue3D.jpg', label:'Projection du work-café', alt:'Vue 3D du futur work-café' }]
    },
    {
      id: 'space-workfloor',
      name: 'Plateau de travail',
      location: 'Niveau R+1',
      status: 'designing',
      description: 'Des postes partagés organisés en quartiers d’équipe, associés à des espaces de proximité pour alterner concentration, échanges rapides et travail collectif.',
      usages: ['Se concentrer', 'Collaborer', 'Travailler autrement'],
      media: []
    },
    {
      id: 'space-focus',
      name: 'Espaces de concentration',
      location: 'À proximité des plateaux de travail',
      status: 'approved',
      description: 'Des zones silencieuses et des cabines phoniques permettent de s’isoler pour une tâche exigeante, un appel ou une visioconférence sans gêner le collectif.',
      usages: ['Se concentrer', 'Travailler autrement'],
      media: []
    },
    {
      id: 'space-meeting',
      name: 'Salles de réunion',
      location: 'Réparties sur les niveaux de travail',
      status: 'designing',
      description: 'Plusieurs formats de salles accompagnent les réunions d’équipe, les ateliers et les échanges hybrides avec des participants à distance.',
      usages: ['Se réunir', 'Collaborer'],
      media: []
    },
    {
      id: 'space-services',
      name: 'Accueil & services',
      location: 'Rez-de-chaussée',
      status: 'designing',
      description: 'Le rez-de-chaussée rassemble l’accueil et les principaux services du quotidien afin de rendre l’arrivée sur site simple et lisible.',
      usages: ['Accueillir', 'Faire une pause', 'Échanger de façon informelle'],
      media: []
    }
  ].map(normalizeSpace);
}

function normalizeSpaces(raw, legacyPlans) {
  if (Array.isArray(raw)) return raw.map((space, index) => normalizeSpace(space, index));
  if (Array.isArray(legacyPlans) && legacyPlans.length) return migrateLegacyPlansToSpaces(legacyPlans).map((space, index) => normalizeSpace(space, index));
  return createDefaultSpaces();
}


function bootstrapSpaces(raw, legacyPlans, initialized = false) {
  // Lecture Studio : un ancien état peut contenir `spaces: []` simplement parce
  // que la clé a été introduite avant la migration 4A. Tant que la collection
  // n'a pas été explicitement initialisée/sauvegardée en 4A, une liste vide
  // signifie donc « à amorcer », pas « l'utilisateur a volontairement tout
  // supprimé ». Une fois `spacesInitialized` posé par Node, le vide redevient
  // un choix éditorial valide.
  if (Array.isArray(raw) && (raw.length > 0 || initialized)) {
    return raw.map((space, index) => normalizeSpace(space, index));
  }
  if (Array.isArray(legacyPlans) && legacyPlans.length) {
    return migrateLegacyPlansToSpaces(legacyPlans).map((space, index) => normalizeSpace(space, index));
  }
  return createDefaultSpaces();
}

function spacesToLegacyPlans(spaces) {
  const out = [];
  normalizeSpaces(spaces, []).forEach((space, spaceIndex) => {
    const media = space.media.length ? space.media : [null];
    media.forEach((asset, mediaIndex) => {
      const type = asset?.kind === 'plan' ? 'Plan' : (asset?.kind === 'document' ? 'Document' : '3D');
      out.push({
        id: media.length === 1 ? space.id : `${space.id}-${mediaIndex + 1}`,
        type,
        tags: space.usages.join(', '),
        title: asset?.label || space.name,
        imageUrl: asset?.url || '',
        comment: space.description
      });
    });
  });
  return out;
}

module.exports = {
  SPACE_STATUS,
  DEFAULT_USAGES,
  createDefaultSpaces,
  normalizeSpace,
  normalizeSpaces,
  bootstrapSpaces,
  migrateLegacyPlansToSpaces,
  spacesToLegacyPlans
};
