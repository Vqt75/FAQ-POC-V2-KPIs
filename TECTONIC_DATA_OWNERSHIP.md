# TECTONIC — Data Ownership Model

**Statut : document de conception. Aucun code, aucun schéma JSON
cible, aucune modification de `server.js`, aucune nouvelle route,
aucun dossier créé. À relire et valider avant de dessiner le Site
Manifest.**

Méthode suivie : pour chaque donnée réellement présente dans Storm
aujourd'hui, on a posé les questions d'ownership (qui la crée, qui la
modifie, qui en est la source de vérité, qui doit la lire, est-elle
nécessaire au rendu public, doit-elle survivre indépendamment d'une
publication, est-ce du contenu/de la configuration/de l'état
éditorial/de la télémétrie) — **avant** de décider dans quelle boîte
elle va. On n'a pas reproduit l'organisation actuelle de
`content.json` par défaut.

---

## A. Domain map

Les quatre domaines de départ sont challengés, pas simplement
adoptés. Voici où on aboutit, avec la justification à chaque fois.

```
┌─────────────────────────────────────────────────────────────┐
│ AUTHORITATIVE PROJECT STATE (état éditable, propriété du      │
│ Studio — pas "tout ce qui existe à propos du projet", juste   │
│ l'état de vérité autoritaire et modifiable)                   │
│                                                               │
│   ┌─────────────────────┐   ┌─────────────────────────────┐ │
│   │ PROJECT              │   │ PROJECT                     │ │
│   │ CONFIGURATION         │   │ CONTENT                     │ │
│   │ (comment le site se   │   │ (ce que le site dit)        │ │
│   │  présente)            │   │                              │ │
│   └─────────────────────┘   └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ EDITORIAL WORKING STATE                                       │
│ = mutations éditoriales non publiées                          │
│ = brouillons importés, MAIS AUSSI révisions en cours d'un      │
│   contenu déjà publié, état de mise en scène (staging)         │
│ (pas encore public, propriété Studio)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PUBLIC PROJECTION — artefact compilé et publiable, PAS un      │
│ magasin autoritaire (voir C1). Peut être persisté (release,    │
│ rollback, cache) sans jamais devenir source de vérité.         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNTIME-GENERATED DATA (produite par le Runtime, jamais       │
│ éditée directement — lue uniquement par le Studio)             │
│                                                               │
│   ┌─────────────────┐        ┌──────────────────────────┐   │
│   │ TELEMETRY         │      │ OPERATIONAL SUBMISSIONS    │  │
│   │ (visites, tabViews,│      │ (contactSubmissions — un   │  │
│   │  recherches, mood) │      │  message nominatif attend  │  │
│   │  — passif, anonyme  │      │  une réponse humaine, ce   │  │
│   │  ou presque         │      │  n'est pas de la           │  │
│   │                     │      │  télémétrie — voir C2)     │  │
│   └─────────────────┘        └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Écart avec l'hypothèse de départ, justifié par les faits (pas par
goût architectural) :**

1. **Le domaine racine est renommé "Authoritative Project State"**,
   pas "Project State" tout court — pour qu'il désigne clairement
   l'état éditable et autoritaire, jamais "tout ce qui existe à propos
   du projet" (ce qui inclurait par glissement la télémétrie ou les
   projections publiques plus tard).
2. **PUBLIC PROJECTION n'est pas retenue comme domaine autoritaire**,
   mais peut être persistée comme artefact publié (release, cache,
   rollback) — voir C1. Dérivé ne veut pas dire éphémère.
3. **AUTHORITATIVE PROJECT STATE se scinde en deux sous-domaines**
   (configuration / contenu), parce que la distinction a un impact
   réel et déjà visible sur le futur setup funnel (on configure
   d'abord — nom, thème, couleurs — puis on remplit le contenu — FAQ,
   actualités — et ce sont deux moments différents de l'expérience
   admin).
4. **EDITORIAL WORKING STATE est élargi** : pas seulement les
   brouillons importés (`faqDrafts`), mais tout contenu déjà publié
   qui aurait une révision en cours — voir C2bis.
5. **La télémétrie n'est plus le domaine racine de `contactSubmissions`.**
   Un parent plus neutre (`RUNTIME-GENERATED DATA`) accueille deux
   enfants de nature différente — télémétrie passive et soumissions
   opérationnelles — pour ne pas figer une mauvaise taxonomie.

---

## B. Field ownership matrix

*Colonnes : emplacement actuel · propriétaire autoritaire · producteur
· consommateurs · exposition publique · cycle de vie éditorial ·
persistance · notes.*

### PROJECT CONFIGURATION

| Champ | Emplacement actuel | Propriétaire | Producteur | Consommateurs | Exposition publique | Cycle éditorial | Persistance | Notes |
|---|---|---|---|---|---|---|---|---|
| `branding.projectName` | `content.json` | Studio | Admin (formulaire identité) | Runtime (nav, titre, footer) + Studio | Oui, directe | editable, live immédiatement (pas de brouillon) | `content.json` | — |
| `branding.logoUrl` | `content.json` | Studio | Admin (upload) | Runtime + Studio | Oui | editable, live | `content.json` + `uploads/` | Fichier physique séparé du champ qui le référence — deux données à faire vivre ensemble |
| `branding.theme` (édition) | `content.json` | Studio | Admin (sélecteur de thème) | **Runtime** (détermine le rendu entier) + Studio | Oui, structurellement critique | editable, live | `content.json` | C'est la donnée la plus proche de ce qui deviendra `edition.id` dans un futur Manifest |
| `branding.colors` / `branding.fonts` | `content.json` | Studio | Admin | Studio (aperçu) **et** Runtime (Midnight Frost lit les couleurs de marque via `window.__stormPublicContent.branding.colors` pour ajuster sa luminosité) | Oui, au moins pour un thème | editable, live | `content.json` | Trouvé en vérifiant le code, pas supposé : ce n'est pas un champ Studio-only, un thème public le lit déjà |
| **modules (activer/désactiver une rubrique)** | **n'existe pas encore** | — | — | — | — | — | — | Anticipé dans le cadrage Tectonic d'origine, mais absent du vrai modèle de données aujourd'hui — à ne pas inventer ici |
| **navigation (ordre/labels des onglets)** | **n'existe pas encore** | — | — | — | — | — | — | Idem — les 5 onglets sont actuellement codés en dur dans `index.html`, pas configurables |

### PROJECT CONTENT

| Champ | Emplacement actuel | Propriétaire | Producteur | Consommateurs | Exposition publique | Cycle éditorial | Persistance | Notes |
|---|---|---|---|---|---|---|---|---|
| `publicContent.*` (5 scopes hero) | `content.json` | Studio | Admin | Runtime + Studio | Oui, directe | editable, live | `content.json` | — |
| `faqEntries` | `content.json` **et** un jeu par défaut codé en dur dans `index.html` (`let faqData = [...]`) | **Ambigu — voir D1** | Admin, ou import Word promu depuis `faqDrafts` | Runtime (moteur de recherche) + Studio | Oui, c'est le cœur du produit | live dès la sauvegarde, pas de brouillon pour une entrée déjà publiée | `content.json`, sauf si vide → le front retombe sur son propre jeu par défaut | Voir D1 : la vraie source de vérité est actuellement partagée entre deux endroits |
| `milestones` | `content.json` | Studio | Admin | Runtime + Studio | Oui | live dès la sauvegarde, **aucun brouillon possible** | `content.json` | — |
| `progress` | `content.json` | **Devrait être calculé, pas stocké** — voir C1 | Admin (recalculé à chaque modification de `milestones`) | Runtime + Studio | Oui | dérivé de `milestones`, mais persisté séparément | `content.json` | Vérifié dans le code : `content.progress = computeProgressFromMilestones(content.milestones)` — stocké en doublon, jamais recalculé à la lecture. Risque de désynchronisation si jamais modifié hors de ce chemin. |
| `articles` | `content.json` | Studio | Admin | Runtime + Studio | Oui | live dès la sauvegarde, aucun brouillon | `content.json` | — |
| `ambassadorsContent` (intro/CTA) | `content.json` | Studio | Admin | Runtime + Studio | Oui | live | `content.json` | Contenu éditorial pur, pas de personne réelle |
| `ambassadors` (personnes) | `content.json` | Studio | Admin (saisie manuelle) | Runtime + Studio | Oui — **et ce sont de vraies personnes**, voir C3 | live | `content.json` + `uploads/` (photo) | Storm détient une représentation de ces personnes sans mécanisme de correction/consentement direct par elles |
| `teamContent` (intro/CTA) | `content.json` | Studio | Admin | Runtime + Studio | Oui | live | `content.json` | Contenu éditorial pur |
| `team` (personnes) | `content.json` | Studio | Admin | Runtime + Studio | Oui — mêmes réserves que `ambassadors` | live | `content.json` + `uploads/` | Idem C3 |
| `plans` | `content.json` | Studio | Admin (saisie + upload) | Runtime + Studio | Oui | live | `content.json` + `uploads/` | Aucune donnée personnelle |

### EDITORIAL WORKING STATE

| Champ | Emplacement actuel | Propriétaire | Producteur | Consommateurs | Exposition publique | Cycle éditorial | Persistance | Notes |
|---|---|---|---|---|---|---|---|---|
| `faqDrafts` | `content.json` | Studio, exclusivement | Import Word (`parseDocxToFaqEntries`) | **Studio uniquement** | **Non — corrigé en phase 2** (fuyait avant, corrigé) | draftable → publishable (action explicite "Publier"), jamais live tout seul | `content.json` | C'est le seul exemple actuel de ce domaine dans tout Storm — voir note générale ci-dessous |

**Note générale sur ce domaine** : `faqDrafts` est aujourd'hui le
*seul* exemple concret de ce domaine dans tout Storm, mais le concept
est volontairement plus large que "brouillon importé depuis Word".
Editorial Working State désigne toute **mutation éditoriale non
publiée** — ce qui inclut aussi bien un brouillon jamais publié qu'une
**révision en cours d'un contenu déjà publié** (par exemple, demain,
un article déjà en ligne dont une nouvelle version serait en cours de
préparation sans encore remplacer la version publique). Ne pas réduire
ce domaine à "objet jamais publié" — sinon on risque de devoir tout
reconstruire le jour où une révision de contenu existant apparaît.

Tout le reste du contenu éditorial (milestones, articles, plans,
ambassadeurs, équipe, hero texts) devient public **dès la
sauvegarde**, sans étape de validation intermédiaire. Ce n'est pas
une anomalie à corriger dans ce document — c'est un constat à
transmettre tel quel à la conception du Manifest, qui devra décider
si ce cycle brouillon/publication doit être généralisé à toutes les
catégories de contenu (voir D2+D3, où une position est prise).

### RUNTIME-GENERATED DATA

Produite par le Runtime à partir des interactions des visiteurs,
jamais éditée directement par le Studio (qui peut seulement la lire
ou la réinitialiser en bloc). Se divise en deux enfants de nature
différente — voir C2 pour la justification de ne pas les confondre.

#### Telemetry (passive, agrégée)

| Champ | Emplacement actuel | Propriétaire | Producteur | Consommateurs | Exposition publique | Cycle éditorial | Persistance | Notes |
|---|---|---|---|---|---|---|---|---|
| `faqAsked` | `kpis.json` | Runtime (auto-généré) | Visiteur anonyme (recherche FAQ) | Studio uniquement | Non (verrouillé en phase 2) | runtime-only, jamais édité, seulement lu ou réinitialisé en bloc | `kpis.json` | Contient le texte brut de la question posée — pas anonyme au sens strict si la question elle-même révèle une identité (rare mais possible) |
| `articleOpens`, `tabViews` | `kpis.json` | Runtime | Visiteur anonyme | Studio | Non | runtime-only | `kpis.json` | Compteurs agrégés, pas de contenu individuel |
| `visitSessions` | `kpis.json` | Runtime | Visiteur anonyme (identifiant généré côté navigateur) | Studio | Non | runtime-only | `kpis.json` | L'identifiant est un artefact local (`localStorage`), pas une identité réelle |
| `moodEntries` | `kpis.json` | Runtime | Visiteur anonyme | Studio | Non | runtime-only | `kpis.json` | Anonymat garanti par construction — aucun identifiant de session associé, contrairement aux autres champs de cette table |

#### Operational submissions (nominatif, attend un traitement humain)

| Champ | Emplacement actuel | Propriétaire | Producteur | Consommateurs | Exposition publique | Cycle éditorial | Persistance | Notes |
|---|---|---|---|---|---|---|---|---|
| `contactSubmissions` | `kpis.json`, techniquement rangé avec la télémétrie **par commodité actuelle, pas par nature** | Runtime en écriture, mais nature opérationnelle — voir C2 | Visiteur, avec identité explicitement donnée (nom + email) | Studio | Non | runtime-only aujourd'hui dans son *stockage*, mais conceptuellement appelle une action humaine (répondre), pas juste une lecture passive | `kpis.json` | Volontairement retiré du tableau Telemetry ci-dessus : un message nominatif qui attend une réponse n'a pas la même nature qu'un compteur de visite, même s'il transite aujourd'hui par le même endpoint technique |

---

## C. Points d'analyse demandés explicitement

### C1. Public Projection : artefact compilé, pas un domaine autoritaire

**Conclusion : Public Projection ne devrait pas être un 4ᵉ magasin de
données que le Studio édite directement. C'est une vue dérivée,
compilée au moment de la publication à partir de PROJECT STATE.**

Trois éléments de preuve, pas juste une préférence :

1. **Storm n'a jamais traité "l'état public" comme un état séparé et
   édité pour lui-même.** Il n'existe aujourd'hui aucun mécanisme qui
   écrit *vers* un objet public distinct — tout s'écrit dans le même
   `content.json` que le Studio lit et modifie. La seule différence
   entre "vue admin" et "vue publique" est un filtre appliqué *à la
   lecture* (`GET /api/content` retire `faqDrafts` si pas de jeton).
   Ce n'est pas une architecture à deux magasins, c'est un seul
   magasin avec un filtre — ce qui va déjà dans le sens "projection
   dérivée", pas "domaine séparé".

2. **Storm a déjà, à petite échelle, la mauvaise version de ce
   pattern** : `progress` est calculé à partir de `milestones` puis
   *stocké séparément*, plutôt que recalculé à chaque lecture. C'est
   exactement le risque qu'une architecture "Public Projection =
   artefact compilé" est censée éliminer — actuellement, si
   `milestones` change sans repasser par le bon chemin de code,
   `progress` peut devenir silencieusement obsolète. Traiter la
   Public Projection comme quelque chose qu'on *compile* à chaque
   publication (plutôt que quelque chose qu'on maintient à la main)
   réglerait cette classe de bug une fois pour toutes, pas seulement
   pour `progress`.

3. **Le bug `faqDrafts` qu'on a corrigé en phase 2 est directement
   explicable par l'absence de cette séparation.** Si la Public
   Projection avait toujours été "compilée depuis l'état autoritaire,
   en excluant les brouillons et la télémétrie par construction",
   cette fuite aurait été structurellement impossible plutôt que
   quelque chose qu'il fallait remarquer et corriger champ par champ.
   Un Runtime qui consomme une projection compilée devient ce que
   l'audit avait anticipé : *"un consommateur idiot et fiable,
   incapable par construction de voir les drafts ou les KPI."*

**Conséquence pour plus tard (pas tranchée ici)** : le futur Site
Manifest serait donc le résultat d'une fonction de compilation
`compile(AUTHORITATIVE PROJECT STATE) → PUBLIC PROJECTION`, pas un
objet que le Studio édite en tant que tel.

**Nuance importante, à ne pas perdre en généralisant ceci en
invariant** : dérivé ne veut pas dire éphémère. Rien n'empêche de
*persister* une Public Projection compilée — pour avoir une notion de
version publiée stable, un mécanisme de retour en arrière (rollback),
ou simplement un cache — sans que ça en fasse pour autant une source
de vérité. La règle n'est pas "la Public Projection ne doit jamais
toucher le disque", c'est "la Public Projection n'est jamais éditée
directement, et n'est jamais l'endroit où on va chercher la vérité en
cas de conflit avec l'état autoritaire". Un futur
`published-manifest.json` (ou équivalent) resterait cohérent avec
cette doctrine, tant qu'il n'est produit que par compilation et jamais
modifié à la main.

### C2. Contact : une nature différente de la télémétrie passive

**Constat, sans construire de solution.** Aujourd'hui,
`contactSubmissions` vit dans `kpis.json`, au même endroit que
`visitSessions` ou `tabViews`, pour une raison purement historique
(le même endpoint `/api/kpi/track` gère les deux). Mais la nature de
la donnée est très différente :

- Un `tabView` ou une `visite` sont des **traces passives** —
  personne n'attend de réponse, l'anonymat est total ou presque, la
  donnée n'a de valeur qu'agrégée.
- Un `contactSubmissions` est **une sollicitation active, nominative,
  avec une attente implicite de réponse humaine**. La personne a
  donné son nom et son email précisément parce qu'elle veut qu'on la
  recontacte. La traiter comme un simple compteur d'événement sous-
  estime sa vraie nature.

Ça ressemble davantage à une **donnée opérationnelle** (quelque chose
qu'un humain doit traiter) qu'à de la télémétrie au sens propre. Ce
document en tire une conséquence de taxonomie, même minime : dans le
domain map (section A), `contactSubmissions` n'est plus rangé sous
`TELEMETRY` — un parent plus neutre, `RUNTIME-GENERATED DATA`,
accueille deux enfants : `TELEMETRY` (passive) et `OPERATIONAL
SUBMISSIONS` (nominatif). Le garder sous `TELEMETRY`, même avec une
note, risquait de figer une mauvaise taxonomie dans tout ce qui serait
construit dessus plus tard.

**Aucun système de traitement n'est construit ici.** Cette
distinction aura probablement des conséquences réelles plus tard :
politique de conservation différente, granularité d'accès différente,
peut-être un jour un statut ("traité"/"non traité") — mais rien de
tout ça n'est proposé dans ce document.

### C2bis. Editorial Working State : plus large qu'un simple import

Le tableau B ne montre aujourd'hui qu'un seul exemple concret de ce
domaine (`faqDrafts`), et il serait tentant de définir ce domaine
comme "les brouillons qui viennent d'un import externe". C'est trop
étroit. La bonne définition est :

```
Editorial Working State
  = mutations éditoriales non publiées
  = brouillons importés, révisions en cours, état de mise en scène
```

Concrètement, le jour où Storm permettra de préparer une nouvelle
version d'un article déjà publié sans l'appliquer immédiatement, cette
version en préparation appartient au même domaine que `faqDrafts` —
même si elle ne vient d'aucun import, et même si elle concerne un
contenu qui a *déjà* été public par le passé. "Brouillon" ne veut pas
dire "objet jamais publié" ; ça veut dire "version non actuellement
publiée d'un contenu, publié ou non".

### C3. Données personnelles : ce que Storm possède ≠ ce que le Public Runtime a le droit de recevoir

Deux régimes très différents coexistent aujourd'hui, et ils
méritent d'être nommés séparément plutôt que traités comme un seul
bloc "données sensibles" :

**Régime 1 — exposition publique intentionnelle** (`ambassadors`,
`team`) : Storm détient nom, rôle, et parfois une photo de personnes
réelles, et les affiche *délibérément* sur le site public — c'est
littéralement la fonction de ces deux pages. "Storm possède cette
donnée" et "le Public Runtime a le droit de la recevoir" sont ici
alignés par construction. Le point d'attention n'est pas la fuite
mais l'absence de tout mécanisme permettant à la personne elle-même
de corriger ou retirer sa fiche — c'est l'admin qui saisit et modifie,
jamais la personne concernée.

**Régime 2 — exposition qui doit rester interne** (`contactSubmissions`,
`moodEntries` si jamais un identifiant leur était accolé un jour) :
Storm détient cette donnée uniquement pour un usage interne
(traitement par l'équipe projet, analyse agrégée), et le Public
Runtime **ne doit jamais** y avoir accès. C'est exactement le régime
qu'on vient de corriger et sécuriser en phase 2 pour `contactSubmissions`
(désormais accessible uniquement via jeton admin).

Le futur contrat de compilation devra porter cette distinction
explicitement : seules les données autorisées à l'exposition publique
peuvent entrer dans la Public Projection. Le Manifest résultant n'a
pas à connaître les données qui en ont été exclues — il n'a pas à
porter une métadonnée du type "ceci est public / ceci ne l'est pas",
puisqu'une donnée interdite au Runtime n'existe simplement pas dans le
Manifest.

---

## D. Ambiguïtés relevées à l'audit — positions prises à l'issue de la relecture

### D1. `faqEntries` a deux sources de vérité possibles — position prise

Le vrai jeu de FAQ vécu par un visiteur dépend d'un mécanisme en deux
étapes : le front-end embarque un jeu de 34 entrées codées en dur
(`let faqData = [...]` dans `index.html`), et **seulement si**
`content.faqEntries` contient au moins une entrée côté serveur, ce
jeu par défaut est remplacé (`if (content.faqEntries.length) faqData
= content.faqEntries;`).

**Position prise à l'issue de cette relecture** : pour Tectonic, ce
jeu de 34 entrées sort du front-end. Il peut survivre comme *seed* /
contenu de démonstration au moment du provisioning (futur setup
funnel), mais jamais comme seconde source de vérité consultée au
runtime. Un renderer ne doit pas porter ses propres données métier
cachées. Si un projet n'a pas encore de FAQ, la Public Projection doit
le dire explicitement (un état "pas encore de FAQ", pas un silence
comblé par des données que le renderer aurait planquées dans son
propre code), ou le provisioning doit avoir semé les exemples au
moment de la création du projet — pas le renderer à chaque affichage.

### D2 + D3. Draft/publish et l'absence d'une vraie action "publier" — position prise

Constaté en section B : `faqDrafts` est aujourd'hui le *seul* exemple
d'un vrai cycle éditorial (brouillon → publication) ; et il n'existe
aujourd'hui aucune action nommée "publier le site" — chaque
sauvegarde individuelle (identité, FAQ, planning...) est immédiatement
effective. Le mot "publication" employé dans ce document est donc un
concept *cible*, pas quelque chose qui existe déjà sous ce nom.

**Position prise à l'issue de cette relecture** : Tectonic doit
introduire une vraie séparation **Save ≠ Publish**, sans pour autant
construire un CMS de niveau entreprise. Concrètement : on modifie
plusieurs éléments dans le Studio, on prévisualise l'ensemble, puis on
publie un lot cohérent. C'est probablement l'une des meilleures
évolutions produit que Tectonic puisse apporter — et c'est
particulièrement important pour éviter qu'un collaborateur voie, par
exemple, un hero de page mis à jour alors que le planning associé ne
l'est pas encore. Rien de tout ça n'est implémenté dans ce document ;
c'est une direction, pas une spécification.

### D4. `branding.colors`/`branding.fonts` : configuration ou contenu de marque ? — position prise

Rangées dans "Project Configuration" par analogie avec `theme`, mais
elles ont un statut un peu hybride : elles ne changent pas *quoi* le
site affiche, mais elles ne sont pas non plus un simple bouton de
préférence — elles définissent l'identité visuelle propre du client.

**Position prise à l'issue de cette relecture** : elles restent
clairement dans Project Configuration. Ce sont des *brand tokens*, pas
du contenu éditorial — leur provenance est le client, mais leur rôle
système est de configurer le renderer, exactement comme `theme`. La
distinction contenu/configuration porte sur le rôle joué dans le
pipeline de rendu, pas sur qui a fourni la valeur.

---

## E. Invariants proposés

Ceux qui suivent sont justifiés directement par les constats ci-dessus
— aucun n'est ajouté par pure élégance architecturale.

1. **Le Public Runtime ne reçoit jamais de brouillon éditorial.**
   *(Déjà vrai en pratique depuis la correction de phase 2 pour
   `faqDrafts` — érigé ici en règle générale plutôt qu'en correctif
   ponctuel.)*

2. **La télémétrie n'appartient jamais au contrat de publication.**
   *(Déjà vrai en pratique depuis la correction de phase 2 pour
   `/api/kpi` — érigé ici en règle générale.)*

3. **La Public Projection peut être persistée comme artefact publié,
   mais n'est jamais autoritaire ni éditée directement.** *(Version
   affinée du constat de C1, après la nuance dérivé ≠ éphémère : rien
   n'interdit un futur `published-manifest.json` pour la notion de
   version publiée stable, de rollback ou de cache — l'invariant porte
   sur l'autorité et l'édition directe, pas sur la persistance en
   elle-même.)*

4. **Les renderers consomment une projection publiée, jamais l'état
   du Studio directement.** *(Découle directement de C1 — pas encore
   vrai techniquement aujourd'hui puisque `GET /api/content` sert
   presque le même objet aux deux, mais c'est la direction que
   l'analyse de C1 justifie. Distinct de l'invariant 7 ci-dessous : ici
   il s'agit de la *source* des données du renderer, pas de la
   *décision* qu'il pourrait prendre à leur sujet.)*

5. **Une donnée dérivée d'une autre donnée autoritaire ne doit jamais
   être stockée en doublon sans mécanisme de recompilation — elle doit
   être recalculée au moment de la compilation.** *(Découle directement
   du cas `progress`/`milestones` en C1 — c'est le seul endroit où
   Storm viole déjà cet invariant.)*

6. **Toute donnée nominative (personnes réelles) doit distinguer
   explicitement "Storm la possède" de "le Public Runtime peut la
   recevoir" — même quand les deux sont actuellement alignés.**
   *(Découle de C3 — vrai aujourd'hui pour `ambassadors`/`team`, mais
   la distinction doit être portée par le modèle, pas seulement par la
   convention actuelle.)*

7. **Le renderer ne décide jamais de la politique de publication.**
   Ivory, Rainbow Glass et Midnight Frost ne doivent jamais eux-mêmes
   décider "ce champ est un brouillon donc je ne l'affiche pas" — le
   renderer reçoit déjà une projection publiable propre, filtrée avant
   de lui parvenir. *(Sans cet invariant, on recréerait exactement le
   couplage entre édition et rendu que toute cette refonte cherche à
   défaire.)*

8. **La configuration et le contenu du projet peuvent évoluer
   indépendamment, mais sont compilés ensemble en une seule projection
   publiée.** *(Clarifie pourquoi couleurs/polices/thème sont séparés
   conceptuellement du contenu éditorial sans pour autant exiger deux
   pipelines de publication distincts — une seule compilation, deux
   sources en entrée.)*

---

## Ce que ce document ne fait pas, volontairement

Aucun schéma de Site Manifest, aucun JSON cible, aucune modification
de `server.js`, aucune nouvelle route, aucun dossier créé. Les quatre
points de la section D ont reçu une position claire à l'issue de la
relecture (sortir le fallback FAQ du front, séparer Save de Publish,
garder colors/fonts en configuration) — mais aucune de ces positions
n'est implémentée ici. Ce sont des directions pour la conception du
Manifest, pas des spécifications prêtes à coder.

**En attente de relecture avant de dessiner quoi que ce soit du Site
Manifest.**
