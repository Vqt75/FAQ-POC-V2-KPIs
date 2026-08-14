// Storm Tectonic — Télémétrie Pilotage V1
//
// Fonctions pures uniquement. Aucun accès disque, aucune horloge système
// lue directement (le "maintenant" est toujours un paramètre) — condition
// nécessaire pour que ce module soit testable en isolation complète, sans
// DOM ni serveur, et pour que "reconstructible depuis le brut" soit une
// propriété vérifiée du code, pas seulement une intention de doctrine.
//
// Contrat V1 (voir orogeny-backlog.md pour l'historique de conception) :
//   - événements : page_view (aucun champ métier), match_result (outcome),
//     mood_feedback (value: positive|neutral|negative)
//   - aucun verbatim, aucun identifiant utilisateur, aucune segmentation
//   - météo agrégée par semaine ISO, semaine courante distincte de
//     l'historique (semaines closes uniquement)
//   - k=5 : garde-fou d'affichage sur les ventilations interprétées
//     (météo, taux Match) — jamais sur les compteurs globaux neutres
//   - la semaine ISO est dérivée de la date à la lecture, jamais stockée
//     en double dans l'événement brut

const MOOD_VALUES = new Set(['positive', 'neutral', 'negative']);
const MATCH_OUTCOMES = new Set(['matched', 'disambiguated', 'abstained']);
const EVENT_TYPES = new Set(['page_view', 'match_result', 'mood_feedback']);
const DEFAULT_THRESHOLD = 5;
const RAW_RETENTION_DAYS = 30;

function isValidEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const keys = Object.keys(payload);

  if (payload.event === 'page_view') {
    // Aucun champ métier attendu — un page_view "actif" ne veut rien dire
    // de plus que "une page Ivory a été activée".
    return keys.length === 1;
  }
  if (payload.event === 'match_result') {
    return keys.length === 2 && MATCH_OUTCOMES.has(payload.outcome);
  }
  if (payload.event === 'mood_feedback') {
    if (keys.length !== 2) return false;
    const v = payload.value;
    return Number.isInteger(v) && v >= 1 && v <= 5;
  }
  return false;
}

function bucketMoodValue(value) {
  if (value <= 2) return 'negative';
  if (value === 3) return 'neutral';
  return 'positive';
}

// Construit l'événement brut à écrire (append-only), avec la date déjà
// attribuée par l'appelant (le serveur — jamais le client, voir server.js).
// Minimisation stricte : aucun champ au-delà de ce que ce contrat V1
// définit explicitement.
//
// Frontière explicite pour mood_feedback : le PAYLOAD RÉSEAU reçu
// d'Ivory reste value:1..5 (le widget existant n'est pas modifié, pour
// ne rien changer côté client) — mais l'ÉVÉNEMENT PERSISTÉ ne contient
// JAMAIS cette valeur brute. bucketMoodValue() s'applique ici, avant
// toute écriture sur disque. Le JSONL ne connaît qu'une seule
// représentation canonique (positive|neutral|negative) — jamais un
// mélange de formats selon l'origine de l'événement.
function buildRawEvent(payload, dateStr) {
  if (payload.event === 'page_view') {
    return { event: 'page_view', date: dateStr };
  }
  if (payload.event === 'match_result') {
    return { event: 'match_result', date: dateStr, outcome: payload.outcome };
  }
  if (payload.event === 'mood_feedback') {
    return { event: 'mood_feedback', date: dateStr, value: bucketMoodValue(payload.value) };
  }
  return null;
}

// Semaine ISO (lundi->dimanche), algorithme standard basé sur le jeudi de
// la semaine — gère correctement les cas limites qui adorent attendre
// janvier pour sortir du placard : une date de fin décembre peut
// appartenir à la semaine 1 de l'année suivante, et inversement le début
// janvier peut appartenir à la dernière semaine de l'année précédente.
function getISOWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7; // lundi=0 .. dimanche=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de cette semaine
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

// Comparaison lexicographique valide car le format est toujours
// YYYY-Www avec zéro-padding — jamais besoin de parser pour comparer.
function compareISOWeeks(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function isWeekClosed(week, nowWeek) {
  return compareISOWeeks(week, nowWeek) < 0;
}

// Agrège une liste d'événements bruts. nowDateStr est un paramètre
// explicite (jamais lu depuis l'horloge système ici) précisément pour
// que ce calcul soit reproductible dans un test sans dépendre du jour
// réel d'exécution.
function aggregateEvents(events, nowDateStr) {
  const nowWeek = getISOWeek(nowDateStr);
  const result = {
    pageViews: 0,
    match: { matched: 0, disambiguated: 0, abstained: 0, total: 0 },
    weeklyMood: {}, // { "2026-W33": { positive, neutral, negative, total } }
    currentWeek: nowWeek
  };

  for (const ev of events) {
    if (ev.event === 'page_view') {
      result.pageViews += 1;
    } else if (ev.event === 'match_result' && MATCH_OUTCOMES.has(ev.outcome)) {
      result.match[ev.outcome] += 1;
      result.match.total += 1;
    } else if (ev.event === 'mood_feedback' && MOOD_VALUES.has(ev.value)) {
      const week = getISOWeek(ev.date);
      if (!result.weeklyMood[week]) {
        result.weeklyMood[week] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }
      result.weeklyMood[week][ev.value] += 1;
      result.weeklyMood[week].total += 1;
    }
  }

  return result;
}

// Garde-fou d'affichage — PAS une preuve d'anonymisation (un agrégat de 5
// peut très bien provenir d'une seule personne). Sépare uniquement les
// ventilations interprétées (météo, taux) d'un volume trop faible pour
// être présenté de façon détaillée.
function applyThreshold(total, k = DEFAULT_THRESHOLD) {
  return total >= k;
}

function isRawFileExpired(fileDateStr, nowDateStr, retentionDays = RAW_RETENTION_DAYS) {
  const fileDate = new Date(fileDateStr + 'T00:00:00Z');
  const nowDate = new Date(nowDateStr + 'T00:00:00Z');
  const ageMs = nowDate - fileDate;
  return ageMs > retentionDays * 24 * 3600 * 1000;
}

module.exports = {
  MOOD_VALUES, MATCH_OUTCOMES, EVENT_TYPES, DEFAULT_THRESHOLD, RAW_RETENTION_DAYS,
  isValidEvent, bucketMoodValue, buildRawEvent,
  getISOWeek, compareISOWeeks, isWeekClosed,
  aggregateEvents, applyThreshold, isRawFileExpired
};
