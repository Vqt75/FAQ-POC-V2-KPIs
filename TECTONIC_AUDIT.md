# TECTONIC — Audit du modèle de données (Phase 2, lot 2)

**Statut : audit uniquement. Aucun refactor structurel, aucune
redéfinition d'endpoint, aucune implémentation de manifest dans ce
document. À relire avant toute décision structurante.**

Portée : les 8 endpoints du contrat API actuel, tracés depuis leur
définition serveur (`server.js`) jusqu'à chaque producteur et
consommateur côté front (`index.html`).

---

## 1. Carte producteur/consommateur, par endpoint

### `GET /health`
- **Producteur** : aucun (statique).
- **Consommateur** : aucun côté front actuellement (route de sonde,
  jamais appelée depuis `index.html`).

### `GET /api/content`
- **Producteur** : `readContentState()` — lit `data/content.json`,
  passe chaque bloc à sa fonction `normalize*()` dédiée.
- **Consommateurs** : `loadContent()` (unique point d'entrée front),
  appelé par :
  - le chargement initial du site public (`DOMContentLoaded`)
  - `refreshAdminPage()` (dashboard admin)
- **Depuis la phase 2, lot 1** : réponse conditionnelle selon jeton
  (`faqDrafts` omis si non authentifié).

### `POST /api/content`
- **Producteur** : `buildSavePayload(content)` — un seul point
  d'assemblage, utilisé par les 5 boutons "Enregistrer" de l'admin
  (Contenu public, Planning, Ambassadeurs & Équipe, Plans & 3D, FAQ).
  Chaque bouton sauvegarde donc **l'intégralité** de `content`, pas
  seulement la section visible à l'écran.
- **Consommateur serveur** : `writeContentState()` — repasse chaque
  bloc par son `normalize*()` avant écriture disque.

### `GET /api/kpi`
- **Producteur** : `readKpiState()`.
- **Consommateurs** : `loadKpi()`, appelé par `refreshAdminPage()` et
  `exportKpiToExcel()`.
- **Depuis la phase 2, lot 1** : jeton admin obligatoire (401 sinon).

### `POST /api/kpi/track`
- **Producteurs** (tous publics, sans authentification — voir
  `PANGEA.md` section 3 pour la justification) :
  - `trackVisit()`, `trackTabView()`, `trackFaqQuestion()`,
    `trackArticleOpen()`, `trackContactSubmission()`, `trackMood()`
- **Consommateur serveur** : un `switch` sur `parsed.type`
  (`faq | article | tab | visit | contact | mood`) — chaque type
  construit son objet explicitement à partir d'une whitelist de
  champs, avant de le pousser dans le tableau correspondant.
  *(Correction : `POST /api/content` normalise lui aussi à l'écriture,
  via `writeContentState()` qui repasse chaque bloc dans son
  `normalize*()` — ce n'est donc pas le seul endroit qui valide à
  l'écriture. La vraie singularité de KPI est que ses événements sont
  construits depuis une whitelist explicite, alors que les FAQ sont
  la seule collection de **contenu** qui transite sans normalisation
  élément par élément — voir section 3.)*

### `POST /api/kpi/reset`
- **Producteur** : bouton "Réinitialiser les données" (admin
  uniquement).
- Remplace l'état KPI entier par `defaultState`. Pas de fusion
  partielle possible — c'est un reset complet, jamais un reset
  sélectif par catégorie.

### `POST /api/admin/login`
- **Producteur** : la modale de connexion admin (mot de passe).
- Retourne un jeton HMAC déterministe (n'expire jamais tant que
  `ADMIN_PASSWORD` ne change pas — noté dans `PANGEA.md`).

### `POST /api/admin/upload`
- **Producteurs** : tout composant utilisant `uploadFile()` — logo de
  marque, photos ambassadeurs/équipe, visuels Plans & 3D.
- **Validation serveur** : MIME whitelist (png/jpeg/pdf), 8 Mo max,
  nom de fichier régénéré côté serveur. Cette route est correctement
  et strictement validée.

---

## 2. Schéma actuel de `content.json`, avec statut de validation par champ

| Bloc | Fonction de normalisation | Validation par élément ? |
|---|---|---|
| `branding` | `normalizeBranding()` | ✅ Oui — chaque champ typé et vérifié (`projectName`, `logoUrl`, `theme`, `colors`, `fonts`) |
| `publicContent` (5 scopes) | `normalizeScopeContent()` × 5 via `normalizePublicContent()` | ✅ Oui |
| `progress` | `normalizeProgress()` | ✅ Oui |
| `milestones` | `normalizeMilestone()` par élément | ✅ Oui |
| `articles` | `normalizeArticle()` par élément | ✅ Oui |
| `ambassadorsContent` | `normalizeAmbassadorsContent()` | ✅ Oui |
| `ambassadors` | `normalizeAmbassador()` par élément | ✅ Oui |
| `teamContent` | `normalizeTeamContent()` | ✅ Oui |
| `team` | `normalizeTeamMember()` par élément | ✅ Oui |
| `plans` | `normalizePlan()` par élément | ✅ Oui |
| **`faqEntries`** | **aucune** — `Array.isArray(...) ? ... : []` uniquement | ❌ **Non** |
| **`faqDrafts`** | **aucune** — même traitement que `faqEntries` | ❌ **Non** |

---

## 3. Inconsistance principale trouvée : les entrées FAQ échappent à toute validation

**Constat.** Onze catégories sur treize ont une fonction de
normalisation par élément qui type-check chaque champ et fournit une
valeur de repli. `faqEntries` et `faqDrafts` n'ont que la vérification
« est-ce un tableau ? » — le contenu de chaque entrée transite tel
quel, sans aucune garantie de forme.

**Pourquoi ça compte concrètement.** Une entrée FAQ réelle comporte au
minimum ces champs, tous utilisés soit par l'éditeur admin, soit par
le moteur de correspondance public (`scoreEntry()`) :

```
id, title, answer, status, statusLabel, category, note,
keywords[], phrases[], intentSignals[], emotionSignals[],
negativeSignals[], priority
```

Si une de ces entrées arrive mal formée (par exemple `keywords` en
chaîne de caractères au lieu d'un tableau, suite à un import Word
imparfait ou une future intégration externe), le serveur l'accepte et
l'écrit sans broncher. C'est `scoreEntry()` côté public qui hérite du
problème — potentiellement un plantage silencieux du moteur de
recherche FAQ pour tout le monde, pas seulement pour l'entrée
fautive, selon la façon dont le `.forEach()` réagit à un type
inattendu.

**Ce que ça n'est pas.** Ce n'est pas (encore) un bug observé en
production — le flux actuel (saisie manuelle dans l'éditeur admin,
import Word avec structure contrôlée) ne génère pas naturellement de
champs malformés aujourd'hui. C'est une absence de garde-fou, pas une
défaillance active.

**Point de comparaison exact.** `POST /api/kpi/track` construit chaque
événement à partir d'une whitelist explicite de champs
(`String(parsed.question || '')`, etc.) avant de le stocker. Ce n'est
pas le seul endroit du modèle qui normalise à l'écriture — `branding`,
`milestones`, `articles`, etc. le sont aussi, via `writeContentState()`.
La vraie singularité est plus précise : **les FAQ sont la seule
collection de contenu qui transite sans normalisation élément par
élément** ; les événements KPI, eux, n'ont jamais eu ce problème car
ils sont construits champ par champ dès l'origine — un modèle qu'une
future `normalizeFaqEntry()` peut reprendre.

---

## 4. Autres observations

### Contrainte de conception à surveiller : écritures complètes (« full-state writes »)

**`POST /api/content` reçoit toujours le payload complet.** Les 5
boutons "Enregistrer" de l'admin envoient l'intégralité de `content`,
pas seulement la section modifiée.

C'est acceptable pour le POC actuel (un seul admin à la fois), mais
c'est un vrai risque de *lost update* dès qu'on imagine deux sessions
admin concurrentes :

```
Admin A charge la version 10
Admin B charge la version 10
A modifie les plans → sauvegarde version 11
B modifie la FAQ à partir de son ancien état
     → renvoie aussi les anciens plans
     → écrase potentiellement la version 11 de A
```

**Tectonic design constraint** : les écritures complètes (full-state
writes) sont acceptables pour le POC mono-admin actuel, mais devront
être reconsidérées avant toute édition concurrente. Ceci aura un
impact direct sur le futur contrat Studio/API — à traiter au moment
de la conception du data ownership model, pas maintenant.

### Catégories d'état qui commencent à émerger

Sans encore concevoir de Manifest, cet audit fait apparaître trois
natures d'état bien distinctes, actuellement mélangées dans un seul
`content.json` + `kpis.json` :

```
PROJECT CONTENT (ce dont le Public Runtime a besoin pour rendre le site)
  branding, publicContent, progress, milestones,
  articles, plans, ambassadors, team, faqEntries

EDITORIAL WORKING STATE (état de travail, jamais publié)
  faqDrafts — et probablement d'autres mécanismes de brouillon à venir

TELEMETRY (jamais nécessaire au rendu du site)
  KPI, mood, visites, recherches, contacts
```

Cette distinction suggère que le futur Site Manifest ne devrait
probablement **pas** contenir tout ce que Storm possède — seulement
ce dont le Public Runtime a besoin pour rendre un site, à l'exclusion
des brouillons, des KPI et de l'état interne de Studio. C'est noté ici
comme piste de réflexion pour la décision de data ownership model à
venir — **pas implémenté, pas tranché**.

### Autres points mineurs

- `GET /health` n'est jamais appelé par le front (normal, c'est une
  sonde de supervision).
- Le jeton admin n'expire jamais (HMAC déterministe du mot de passe,
  pas une session à durée de vie) — déjà noté dans `PANGEA.md`.

---

## 5. Ce que cet audit ne couvre pas

- Le contenu détaillé de `themes/*.js` (Rainbow Glass, Midnight
  Frost) — hors périmètre du contrat de données, déjà traité dans le
  cadrage Tectonic section 12.
- Une proposition de schéma pour le futur Site Manifest — volontai-
  rement absente ici, comme demandé : ce document constate l'existant,
  il ne décide pas de la suite.

---

## 6. Phase 2 — lot 3 : FAQ contract hardening (terminé, en attente de relecture)

Strictement borné, comme convenu : aucun changement du moteur de
recherche, aucun nouveau schéma global, aucune nouvelle route, aucun
changement UX, aucun Manifest. Uniquement : garantir la forme de
`faqEntries` et `faqDrafts`.

### Vérification préalable au code (pas d'implémentation à l'aveugle)

Avant d'écrire `normalizeFaqEntry()`, vérification directe sur les
vraies données plutôt que sur une liste supposée :

- **Seules 6 des 34 entrées réelles** utilisent `priority`, `phrases`,
  `intentSignals`, `emotionSignals`, `negativeSignals` — ces 5 champs
  sont réellement optionnels dans les données de production, pas
  seulement en théorie.
- **`faqDrafts` (import Word) n'a jamais ces 5 champs non plus** —
  même forme de base que `faqEntries` ; pas de traitement séparé
  nécessaire.
- **`status` n'a que 3 valeurs réelles** : `confirmed`, `partial`,
  `waiting`.
- **`statusLabel` est lu directement côté public** (`resultStatus.
  textContent = entry.statusLabel`), jamais recalculé à l'affichage —
  contrairement à ce qu'on aurait pu supposer. Il n'est recalculé que
  côté admin, au changement de statut. Risque identifié : corriger un
  `status` invalide sans corriger `statusLabel` en même temps produit
  une pastille et un texte contradictoires.
- **`priority` doit être un nombre réel**, pas une chaîne : confirmé
  qu'une chaîne comme `"3"` provoque une concaténation silencieuse
  (`score += "3"` → `"03"`) qui casse le classement des réponses,
  pas juste un problème cosmétique.

### Contrat implémenté (`normalizeFaqEntry()` / `normalizeFaqEntries()`)

**`normalizeFaqEntry()` garantit le shape et la compatibilité du
moteur ; ce n'est pas une couche de correction métier ni de migration
sémantique.** Un champ tableau mal typé (`keywords` en chaîne au lieu
d'un tableau, par exemple) tombe systématiquement sur `[]` — jamais de
tentative de découper la chaîne ou de deviner l'intention derrière une
valeur malformée. Normaliser garantit une forme ; ça ne réinterprète
jamais une donnée.

```
id             string, généré si absent (faq-{timestamp}-{index})
title          string, '' par défaut
answer         string, '' par défaut
status         'confirmed' | 'partial' | 'waiting', repli sur 'waiting'
statusLabel    string — préservé si status déjà valide, recalculé
               (cohérent avec status) si status était invalide
category       string, '' par défaut
note           string, '' par défaut
keywords       string[], filtré, [] par défaut
phrases        string[], filtré, [] par défaut
intentSignals  string[], filtré, [] par défaut
emotionSignals string[], filtré, [] par défaut
negativeSignals string[], filtré, [] par défaut
priority       number, Number() puis repli sur 0 si non-finite
```

### Tests exécutés (3 niveaux, tous verts)

1. **`test_faq_normalize.js`** — 16 vérifications unitaires isolées :
   `keywords` en chaîne → `[]`, `priority` en chaîne numérique → nombre
   converti, `priority` invalide → `0`, `phrases: null` → `[]`, `title`
   absent → `''`, entrée `null`/`undefined`/chaîne/nombre en entrée →
   jamais de crash, `status` invalide → `statusLabel` recalculé en
   cohérence, `status` déjà valide → `statusLabel` préservé tel quel,
   entrée déjà valide et complète → **aucune altération** d'un seul
   champ.
2. **Test d'intégration réel** (serveur HTTP réellement démarré, sur
   une copie temporaire isolée — jamais sur le dépôt Git) : une entrée
   volontairement malformée envoyée via `POST /api/content`, sauvegarde
   acceptée sans crash, relecture confirmant l'assainissement exact de
   chaque champ.
3. **Snapshot comportemental du moteur de recherche** — extraction du
   *vrai* moteur (`scoreEntry`, `matchFaq`, `tokenize`, `synonymMap`)
   et des *vraies* 34 entrées depuis `index.html`, exécution de 8
   questions tests (dont 2 ciblant spécifiquement les entrées "riches"
   à champs étendus — `apprehension`, `bulles-definition`) avant et
   après normalisation :

   | Question | Avant | Après |
   |---|---|---|
   | Quand a lieu le déménagement ? | `date-demenagement` | `date-demenagement` |
   | Comment venir à vélo ? | `velo` | `velo` |
   | Est-ce que je serai en flex office ? | `no-match` | `no-match` |
   | J'ai peur du changement | `apprehension` | `apprehension` |
   | Combien de bulles phoniques y a-t-il ? | `bulles-definition` | `bulles-definition` |
   | Où est le nouveau site ? | `adresse-site` | `adresse-site` |
   | Comment obtenir une place de parking ? | `parking-attribution` | `parking-attribution` |
   | Question absurde sans rapport | `no-match` | `no-match` |

   **Aucune dérive** — les 8 questions sélectionnent exactement la
   même réponse avant et après. La normalisation garantit la forme
   sans changer un seul résultat de recherche.

### Ce qui n'a pas été fait, volontairement

Aucun changement à `scoreEntry()`/`matchFaq()` eux-mêmes, aucune
nouvelle route, aucun schéma de Manifest. Rien poussé sur Git — en
attente de relecture avant tout commit, comme demandé.
