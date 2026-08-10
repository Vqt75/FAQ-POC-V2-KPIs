// TECTONIC — buildPublicationCandidate()
//
// Implémentation conforme à TECTONIC_PUBLICATION_CANDIDATE.md.
// Phase 1 du plan d'implémentation : cette fonction est implémentée et
// testée en isolation — elle n'est encore importée ni appelée nulle
// part dans server.js (aucun branchement avant la Phase 4).
//
// Signature gelée (§1) :
//   buildPublicationCandidate( Publication Snapshot ) → Publication Candidate
//
// Le "Publication Snapshot" est supposé déjà être une copie isolée de
// l'état autoritaire (responsabilité de createPublicationSnapshot(),
// non implémentée à ce stade — voir §4 du document gelé). Cette
// fonction ne clone donc pas à nouveau en profondeur ; elle sélectionne
// et assemble, elle ne duplique pas une deuxième fois ce qui l'est déjà.

// ─────────────────────────────────────────────────────────────────
// Règle de construction (§2 du document gelé) : whitelist explicite,
// jamais clone-then-delete. Chaque champ autorisé est nommé
// individuellement ci-dessous — aucun spread de l'objet source entier.
// faqDrafts, tout kpis.json, les jetons/mots de passe ne sont jamais
// mentionnés ici : ils ne peuvent donc jamais se retrouver dans le
// candidat produit, quelle que soit la richesse du snapshot fourni.
// ─────────────────────────────────────────────────────────────────

// Modules dont Pangea affiche déjà la section inconditionnellement
// aujourd'hui — activés par défaut, même si leur contenu est vide.
const ALWAYS_ENABLED_MODULES = ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors'];

// Libellés de navigation par défaut. Note d'implémentation : `home` et
// `timeline` sont volontairement absents de la navigation dérivée —
// dans Pangea aujourd'hui, aucun des deux n'a d'onglet dédié (la home
// n'existe pas encore, le contenu de `timeline` vit à l'intérieur de
// la page Actualités). Ce choix n'est pas imposé par le document gelé
// (qui laisse la question ouverte) — c'est une décision d'implémentation
// prise ici pour rester cohérente avec le comportement public actuel de
// Pangea ; à confirmer ou ajuster explicitement si elle ne convient pas.
const NAV_LABELS = {
  questions: 'Questions',
  news: 'Actualités',
  spaces: 'Espaces',
  ambassadors: 'Ambassadeurs',
  team: 'Équipe projet'
};
const NAV_ORDER = ['questions', 'news', 'spaces', 'ambassadors', 'team'];

// Règle transitoire d'activation des modules (§3 du document gelé).
// Aucune configuration `modules` réelle n'existe encore côté Studio —
// cette fonction la calcule à la place, jusqu'à ce qu'elle existe.
function computeModules(snapshot) {
  const teamCount = Array.isArray(snapshot && snapshot.team) ? snapshot.team.length : 0;
  const modules = { team: teamCount > 0 };
  ALWAYS_ENABLED_MODULES.forEach(key => { modules[key] = true; });
  return modules;
}

// navigation dérivée de la liste des modules activés — un module
// activé n'implique pas nécessairement une entrée de navigation
// (invariant 9 du Manifest : la relation est asymétrique, jamais une
// bijection).
function computeNavigation(modules) {
  return NAV_ORDER
    .filter(key => modules[key])
    .map(key => ({ module: key, label: NAV_LABELS[key] }));
}

function buildPublicationCandidate(publicationSnapshot) {
  const snapshot = publicationSnapshot || {};

  const modules = computeModules(snapshot);
  const navigation = computeNavigation(modules);

  // Whitelist explicite — voir note en tête de fichier. Chaque ligne
  // ci-dessous est une décision positive d'inclusion, jamais une
  // omission par oubli.
  return {
    branding: snapshot.branding,
    project: snapshot.project,
    publicContent: snapshot.publicContent,
    milestones: snapshot.milestones,
    articles: snapshot.articles,
    plans: snapshot.plans,
    ambassadorsContent: snapshot.ambassadorsContent,
    ambassadors: snapshot.ambassadors,
    teamContent: snapshot.teamContent,
    team: snapshot.team,
    faqEntries: snapshot.faqEntries,
    modules,
    navigation
  };
}

module.exports = { buildPublicationCandidate };
