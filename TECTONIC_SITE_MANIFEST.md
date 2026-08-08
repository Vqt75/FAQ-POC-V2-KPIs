# TECTONIC — Site Manifest Design

**Statut : document de conception. Pas de `server.js`, pas de
runtime, pas de nouvel endpoint, pas de migration, aucun commit
applicatif. À relire avant toute implémentation.**

Construit directement sur `TECTONIC_DATA_OWNERSHIP.md` (gelé). Le
Manifest **est** la Public Projection compilée — pas un miroir de
`content.json`, pas un objet édité dans le Studio, pas un déversement
de tout ce que Storm connaît.

---

## 1. Responsabilités du Manifest

Le Manifest a exactement quatre responsabilités, ni plus ni moins :

1. **Décrire l'identité et la configuration du projet** — assez pour
   qu'un renderer sache *qui* il rend et *comment* il doit se
   présenter (édition, marque).
2. **Décrire ce qui est activé** — quels modules existent pour ce
   projet, dans quel ordre les présenter.
3. **Porter le contenu publié de chaque module activé** — et
   uniquement celui-là.
4. **Être auto-suffisant.** Un renderer qui reçoit un Manifest valide
   ne doit jamais avoir besoin d'appeler autre chose pour rendre l'état
   publié actuel du site — aucun rappel à une API Storm, aucune
   dépendance à un état admin.

Ce qu'il n'est **pas**, pour éviter toute dérive plus tard :
- pas une source de vérité (l'état autoritaire reste dans Storm/Studio) ;
- pas un espace de travail éditorial (aucun brouillon, jamais) ;
- pas un canal de télémétrie (aucune écriture ne part du Runtime vers
  le Manifest — le Manifest est un artefact de lecture, produit par
  compilation, jamais modifié par les interactions publiques) ;
- pas spécifique à une édition (Ivory/Rainbow Glass/Midnight Frost
  doivent pouvoir consommer exactement le même Manifest).

---

## 2. Invariants

Repris et affinés depuis `TECTONIC_DATA_OWNERSHIP.md`, appliqués
spécifiquement au Manifest :

1. **Aucun brouillon n'entre jamais dans le Manifest.** Pas de champ
   `faqDrafts`, pas de version "en préparation" d'un contenu déjà
   publié — le Manifest ne représente qu'un seul état : le dernier
   publié.
2. **Aucune télémétrie, aucune soumission opérationnelle
   (`contactSubmissions`), aucun état admin (jetons, mots de passe,
   mécanismes d'auth) ne peut apparaître dans le Manifest, sous
   aucune forme.**
3. **Seules les données autorisées à l'exposition publique peuvent
   entrer dans le Manifest — la décision se prend à la compilation,
   jamais par le renderer.** Une donnée interdite n'existe simplement
   pas dans l'objet ; le renderer ne reçoit jamais de champ
   "confidentiel: true" à respecter de bonne foi.
4. **Le renderer ne décide jamais de la politique de publication.**
   S'il reçoit un module dans le Manifest, c'est qu'il a le droit de
   le montrer intégralement — jamais de filtrage supplémentaire côté
   renderer sur la base d'un statut éditorial.
5. **Aucune donnée dérivée n'est stockée en doublon si elle peut être
   recalculée proprement à la compilation.** `progress` en est
   l'exemple concret : jamais persisté comme champ séparé, toujours
   recalculé depuis `milestones` au moment de compiler le Manifest.
6. **Le Manifest est versionné (`schemaVersion`) et opaque au-delà de
   sa version.** Un Runtime qui ne reconnaît pas une version doit
   refuser de rendre plutôt que deviner.
7. **Un module désactivé n'a pas de clé de contenu dans le Manifest.**
   Pas de `content.team: null` ni `content.team: {}` — l'absence de la
   clé *est* le signal, pas une valeur à l'intérieur.
8. **Le Manifest peut être persisté comme artefact publié, mais n'est
   jamais édité directement.** Toute modification repasse par l'état
   autoritaire, jamais par une édition du Manifest lui-même.
9. **`modules.X`, `content.X` et `navigation` obéissent à une règle
   asymétrique, pas à une correspondance bijective.**
   - `modules.X === true` → `content.X` **doit** exister.
   - `modules.X === false` → `content.X` **ne doit pas** exister, et
     aucune entrée de `navigation` ne **peut** référencer `X`.
   - `navigation` peut référencer uniquement des modules activés —
     mais l'inverse n'est pas vrai : **un module activé n'a pas
     obligatoirement d'entrée dans `navigation`.** Exemple concret :
     `modules.home === true` ne veut pas dire que `navigation` doit
     contenir `{module:"home", label:"Accueil"}` — le logo peut très
     bien ramener à l'accueil sans que la home soit un onglet à part
     entière. Même chose pour un futur module qui existerait dans
     l'expérience sans mériter une destination de premier niveau.

   C'est une responsabilité du compilateur, jamais quelque chose que
   le Runtime doit détecter ou corriger de lui-même — un Manifest qui
   viole la partie obligatoire de cette règle est un Manifest invalide,
   pas un cas à gérer gracieusement.

---

## 3. Structure de premier niveau (proposée)

```
{
  schemaVersion,
  meta,        // métadonnées de compilation — voir section 6
  project,     // identité minimale, jamais un module qu'on active/désactive
  branding,    // brand tokens
  edition,     // sélection de l'édition/renderer
  modules,     // quels modules sont activés
  navigation,  // configuration éditable — ordre + libellés, PAS dérivée de modules (voir §12, décision prise)
  content: {
    home,        // présent seulement si modules.home
    timeline,    // présent seulement si modules.timeline — voir note nommage en §12
    spaces,      // présent seulement si modules.spaces
    news,        // présent seulement si modules.news
    questions,   // présent seulement si modules.questions
    ambassadors, // présent seulement si modules.ambassadors
    team         // présent seulement si modules.team
  },
  settings: {
    moodNudge    // absent si la fonctionnalité n'est pas activée
  }
}
```

`project`, `branding`, `edition`, `modules`, `navigation` forment le
« socle » — toujours présents, jamais togglables (un projet a
toujours une identité, une marque, une édition). Tout ce qui est sous
`content` est togglable module par module.

---

## 4. Schéma conceptuel de chaque bloc

### `project` (identité — pas un module)
```
project: {
  name: string
}
```
Volontairement minimal. `id` et `status` sont discutés en ouverture
(§12) — non retenus ici par manque de besoin actuel démontré (voir
principe "ne pas ajouter par utilité future supposée").

### `branding` (brand tokens)
```
branding: {
  logo: { url, alt } | null,  // alt peut être "" si l'image est décorative/redondante — voir note
  colors: { primary: '#hex', secondary: '#hex' },
  fonts: {
    primary: { family: string, asset: { url } | null },
    secondary: { family: string, asset: { url } | null }
  }
}
```
Toujours présent avec des valeurs — Storm fournit déjà des valeurs par
défaut (Roboto/Italiana, `#1E1D1E`/`#C2AF7E`) même si le client n'a
rien personnalisé ; le Manifest compile ces valeurs par défaut, il ne
laisse jamais le champ absent.

**Corrigé** : `fonts.primary`/`fonts.secondary` ne sont plus de
simples chaînes. Storm prévoit déjà l'upload de polices client dans
son parcours de configuration — transmettre seulement `"Client Sans"`
ne donne au Runtime aucun moyen de charger cette police si elle
n'existe pas déjà sur le poste du visiteur. `asset: null` couvre le cas
d'une police système standard (Roboto, Italiana...) ; `asset: {url}`
porte le fichier réellement uploadé. Pas de gestion des graisses,
italiques ou variable fonts à ce stade — juste assez de structure pour
ne pas geler un Manifest incapable de représenter une fonctionnalité
déjà prévue par ailleurs dans Storm.

**Sur `alt` pour le logo** : contrairement aux images de contenu
(spaces, ambassadeurs, équipe) où un texte alternatif a toujours du
sens, un logo affiché juste à côté du nom du projet en toutes lettres
peut légitimement avoir `alt: ""` — répéter le nom du projet une
seconde fois pour un lecteur d'écran n'aide pas, ça alourdit. `alt` est
une propriété éditoriale et contextuelle, pas une obligation de
remplir du texte partout où un champ existe.

### `edition`
```
edition: { id: string }
```
**Corrigé** : pas d'union fermée (`'ivory' | 'rainbow-glass' |
'midnight-frost'`) dans le contrat conceptuel. Une union figée voudrait
dire que l'ajout d'une quatrième édition nécessiterait une évolution
du schéma du Manifest, alors que sa *structure* n'aurait pas changé
d'un octet — ajouter une valeur supportée n'est pas un changement de
schéma. La validation (cette édition existe-t-elle vraiment ?) est une
responsabilité du **compilateur**, contre la liste des éditions
installées/supportées à ce moment-là — pas quelque chose que le
Manifest doit figer dans sa forme. Le Runtime, de son côté, applique
une règle simple : `edition.id` connu → renderer correspondant ;
`edition.id` inconnu → refus propre de rendu, jamais une tentative de
deviner.

### `modules`
```
modules: {
  home: boolean,
  timeline: boolean,
  spaces: boolean,
  news: boolean,
  questions: boolean,
  ambassadors: boolean,
  team: boolean
}
```
**N'existe pas du tout dans Pangea** (vérifié : zéro occurrence).
Champ Tectonic entièrement nouveau, requis par l'architecture déjà
validée dans le modèle d'ownership.

### `navigation`
```
navigation: [
  { module: 'questions', label: 'Questions' },
  { module: 'news', label: 'Actualités' },
  ...
]
```
**Décidé** (ancienne question ouverte §12, tranchée) : `navigation`
est une vraie donnée de configuration éditable — ordre et libellés —
pas un simple dérivé recalculé de `modules`. Raison : si elle était
purement dérivée, on transporterait deux fois la même information
(`modules.questions: true` puis `{module:"questions", label:
"Questions"}`) sans bénéfice réel, puisque l'instinct produit est
qu'on voudra personnaliser l'ordre et les libellés des onglets tôt ou
tard. Autant l'assumer comme configuration dès Tectonic plutôt que de
la retirer puis devoir l'y remettre.

Elle appartient donc à **Project Configuration**, pas à une simple
fonction de compilation. Contrainte de cohérence : le compilateur doit
garantir qu'aucune entrée de `navigation` ne référence un module
désactivé (voir invariant 9) — la configuration peut être éditée
librement, mais la compilation filtre toujours les entrées devenues
invalides avant de produire le Manifest.

### `content.home`
```
home: {
  message: string | null,               // note éditoriale courte, curatée — jamais dérivée
  askPrompt: string,                     // éditable, valeur par défaut fournie si non personnalisé
  now: { label: string, value: string } | null,      // dérivé de timeline
  next: { label: string, date: string } | null,       // dérivé de timeline
  featured: {
    source: { module: string, id: string },
    title: string,
    summary: string
  } | null
}
```
**Révisé** (voir §9 pour la doctrine complète) : `latest` devient
`featured`, et `showLatest` disparaît. Raison : `pinned` autorisait déjà
à épingler un contenu de *n'importe quel* module (une vue 3D, un
jalon...), mais le résultat compilé s'appelait encore `latest` — nom
qui n'a plus de sens dès qu'on épingle autre chose qu'un article
d'actualité. `featured` porte maintenant sa source explicitement
(`source.module` + `source.id`), et le compilateur décide seul du
résultat : si un contenu est épinglé dans le Studio, il résout cette
référence et construit `featured` ; sinon, il retombe par défaut sur
le dernier article ; si la mise en avant est désactivée, il livre
directement `featured: null` — le Manifest n'a pas besoin de savoir
*pourquoi* il n'y a rien à afficher, seulement qu'il n'y a rien.
`showLatest` devient donc inutile : `featured: null` porte déjà toute
l'information nécessaire au renderer.

`askPrompt` devient éditable, avec une valeur par défaut fournie
("Une question sur le projet ?") si le client ne la personnalise pas
— c'est du texte de marque (wording), pas un calcul, contrairement à
`now`/`next`/`featured`.

**N'existe pas du tout dans Pangea** — aucune page d'accueil distincte
de la FAQ aujourd'hui. Champ Tectonic entièrement nouveau.

### `content.timeline` (avancement du projet)
```
timeline: {
  intro: { eyebrow, title, description },
  progress: { currentStepLabel: string, totalSteps: number, percent: number },
  milestones: [
    { id, status: 'done'|'current'|'future', date, label, description }
  ]
}
```
`progress` est **toujours calculé à la compilation depuis
`milestones`**, jamais transporté comme un champ séparé persisté (voir
§9 — corrige directement la redondance identifiée dans le modèle
d'ownership).

### `content.spaces` (Plans & 3D)
```
spaces: {
  intro: { eyebrow, title, description },
  items: [
    { id, type: string, tags: string[], title, comment, asset: { url, alt } | null }
  ]
}
```

### `content.news` (Actualités)
```
news: {
  intro: { eyebrow, title, description },
  items: [
    { id, tag, date, title, summary, body }
  ]
}
```

### `content.questions` (FAQ)
```
questions: {
  intro: { eyebrow, title, description },
  items: [
    {
      id, title, answer, status, statusLabel, category, note,
      keywords: string[], phrases: string[], intentSignals: string[],
      emotionSignals: string[], negativeSignals: string[], priority: number
    }
  ]
}
```
**Décidé pour la V1** (ancienne question ouverte §12, tranchée) : tant
que le moteur de recherche tourne côté Runtime, `phrases`,
`intentSignals`, `emotionSignals`, `negativeSignals` et `priority`
doivent voyager dans le Manifest — ce n'est pas élégant, mais c'est
cohérent : le Runtime a besoin de ces métadonnées pour fonctionner, et
elles sont publiques par nature (pas confidentielles). Déplacer le
scoring côté serveur pour "nettoyer" le Manifest serait un chantier
séparé, pas une condition préalable à cette V1.

### `content.ambassadors`
```
ambassadors: {
  intro: { title, body, rosterLabel },
  cta: { title, body },
  roster: [ { id, name, role, tag, photo: { url, alt } | null } ]
}
```

### `content.team` (optionnel)
```
team: {
  intro: { introBody }, // généralisé — voir décision §12 (le nom d'un cabinet conseil ne doit pas apparaître dans un contrat générique)
  cta: { title, body },
  members: [ { id, name, title, group: string, photo: { url, alt } | null } ]
}
```
Présent uniquement si `modules.team === true`.

### `settings.moodNudge`
```
moodNudge: {
  enabled: true,
  frequency: 'daily' | 'weekly'
}
```
**N'existe pas du tout dans Pangea** en tant que configuration — le
nudge est aujourd'hui toujours actif, fréquence codée en dur
(quotidienne). Champ Tectonic nouveau, anticipé par le cadrage
d'origine ("revoir le rate limiting"), absent s'il n'est pas activé.

---

## 5. Champs obligatoires vs optionnels

| Bloc | Statut | Règle |
|---|---|---|
| `schemaVersion` | obligatoire | toujours présent |
| `project.name` | obligatoire | un projet a toujours un nom |
| `branding.*` | obligatoire | valeurs par défaut compilées si non personnalisées — jamais absent |
| `edition.id` | obligatoire | toujours une édition sélectionnée |
| `modules.*` | obligatoire | chaque clé est un booléen explicite, jamais absente |
| `navigation` | obligatoire | configuration éditable (ordre + libellés), toujours présente — peut être un tableau vide si tout est désactivé |
| `content.X` | **conditionnel** | présent **si et seulement si** `modules.X === true` — absent sinon, jamais `null`/`{}` |
| `settings.moodNudge` | optionnel | absent si la fonctionnalité n'est pas activée pour ce projet |
| `content.spaces.items[].asset` | optionnel par élément | `null` si aucun visuel n'a encore été ajouté à cette entrée |

---

## 6. Stratégie de version

```
schemaVersion: 1
meta: {
  generatedAt: <horodatage ISO de la compilation>,
  revision: <identifiant monotone ou basé sur un horodatage>
}
```

- `schemaVersion` est un entier, incrémenté uniquement en cas de
  changement de forme incompatible. Un Runtime qui reçoit une version
  qu'il ne connaît pas doit refuser de rendre plutôt que de deviner
  (invariant 6).
- **`meta.revision` est retenu dès la V1** (décidé, plus une question
  ouverte) : même sans mécanisme de rollback, publier sans identifiant
  de version rend le débogage pénible dès qu'un problème apparaît en
  production ("quelle publication est en ligne, là, maintenant ?").
  L'implémentation reste volontairement minimale — un identifiant
  monotone (compteur incrémenté à chaque compilation) ou un simple
  horodatage suffisent ; aucun système de versions/rollback sophistiqué
  n'est nécessaire pour que ce champ soit déjà utile.

---

## 7. Stratégie des assets

Pangea stocke aujourd'hui des chemins bruts type `/uploads/xyz.png`,
valides uniquement parce que le Runtime et le serveur qui héberge les
fichiers sont le même processus. Pour un Manifest pensé comme
renderer-agnostic, cette hypothèse ne peut pas être gardée telle
quelle — la résolution d'URL (relative vs absolue) reste une question
ouverte (§12), mais **la forme minimale de l'objet asset est tranchée
pour la V1** : `{ url, alt }`, jamais une chaîne nue ni `{ url }` seul.

Raison du choix : Pangea n'a aujourd'hui aucune métadonnée
d'accessibilité (aucun texte alternatif stocké nulle part) — c'est un
manque réel, déjà identifié. Ajouter `alt` maintenant coûte presque
rien ; l'ajouter plus tard obligerait à faire évoluer `schemaVersion`
pour un bénéfice qu'on connaît déjà être nécessaire. `width`/`height`
pourront s'ajouter plus tard de la même façon, sans urgence
équivalente.

---

## 8. Stratégie des modules optionnels

- Chaque module a un booléen dans `modules`, sans exception.
- Un module désactivé fait disparaître sa clé sous `content` —
  jamais une valeur vide à sa place (invariant 7).
- `home`, `spaces`, `news`, `questions`, `ambassadors`, `team` sont
  tous togglables en principe. En pratique, `questions` est le module
  fondateur de Storm — rien n'empêche techniquement de le désactiver,
  mais aucun projet réel n'a de raison de le faire aujourd'hui. Signalé
  pour mémoire, pas une règle spéciale codée pour lui.
- `timeline` suit la même règle que les autres (togglable), bien qu'il
  soit probablement activé par défaut sur tout projet de conduite du
  changement.

---

## 9. Gestion de l'état dérivé

Deux cas concrets dans le modèle actuel, traités selon le même
principe : **calculé à la compilation, jamais transporté comme un
second champ persisté quand ça peut être évité.**

- **`progress`** — recalculé depuis `milestones` à chaque compilation
  du Manifest. Corrige directement la redondance identifiée dans
  `TECTONIC_DATA_OWNERSHIP.md` (`content.progress` stocké séparément
  de `content.milestones` dans Pangea, avec un vrai risque de
  désynchronisation).

- **`content.home`** — n'est **plus** entièrement dérivé depuis la
  révision du §4. Il faut distinguer deux natures de champs, pas les
  traiter comme un bloc homogène :

  **Configuration éditoriale, autoritaire, jamais calculée :**
  ```
  message      — note courte écrite à la main, ou null
  askPrompt    — texte de marque éditable, valeur par défaut fournie
  ```
  Ces deux champs vivent dans l'état autoritaire du projet, au même
  titre que n'importe quel autre texte éditorial de Storm — le
  compilateur les recopie tels quels, il ne les invente jamais.

  **Champs dérivés, calculés à chaque compilation :**
  ```
  now       — dérivé de timeline.progress
  next      — dérivé de timeline.milestones
  featured  — résolu depuis une éventuelle référence épinglée dans le
              Studio (module + id), ou depuis news.items[0] par défaut,
              ou null si rien à mettre en avant
  ```
  Aucun de ces trois champs n'a de source d'édition indépendante — ils
  n'existent que comme résultat de compilation. `featured` en
  particulier illustre bien la doctrine Tectonic : **le Manifest décrit
  l'état public final, pas les commandes utilisées dans le Studio pour
  le produire.** Le Studio manipule une commande interne ("épingle tel
  contenu à la home") ; le Manifest ne reçoit jamais cette commande
  elle-même, seulement son résultat déjà résolu et normalisé — jamais
  un booléen du genre `showFeatured` qui obligerait le renderer à
  comprendre *pourquoi* quelque chose est absent plutôt que
  simplement constater que `featured` vaut `null`.

  **Précision sur `featured.source`** : ce champ (`{module, id}`)
  n'est pas la commande brute du Studio évoquée ci-dessus — c'est une
  provenance publique, conservée dans le résultat compilé pour
  permettre éventuellement au renderer de construire un lien vers le
  contenu d'origine (par exemple, cliquer sur le teaser de la home pour
  ouvrir l'article complet dans le module Actualités). Si le Runtime
  n'a en réalité jamais besoin de cette provenance pour fonctionner,
  `source` pourrait être retiré sans rien perdre côté doctrine — ce
  n'est pas tranché ici : la conception du compilateur dira si cette
  provenance sert réellement le Runtime ou si elle ne fait
  qu'alourdir le contrat pour rien.

---

## 10. Exemple complet — proposition uniquement, rien d'implémenté

Construit à partir des vraies données par défaut de Pangea (Projet
XYZ), pour rester concret plutôt qu'abstrait.

```json
{
  "schemaVersion": 1,
  "meta": {
    "generatedAt": "2026-08-08T10:00:00Z",
    "revision": "r-2026-08-08-01"
  },
  "project": { "name": "Projet XYZ" },
  "branding": {
    "logo": null,
    "colors": { "primary": "#1E1D1E", "secondary": "#C2AF7E" },
    "fonts": {
      "primary": { "family": "Roboto", "asset": null },
      "secondary": { "family": "Italiana", "asset": null }
    }
  },
  "edition": { "id": "ivory" },
  "modules": {
    "home": true,
    "timeline": true,
    "spaces": true,
    "news": true,
    "questions": true,
    "ambassadors": true,
    "team": false
  },
  "navigation": [
    { "module": "questions", "label": "Questions" },
    { "module": "news", "label": "Actualités" },
    { "module": "spaces", "label": "Espaces" },
    { "module": "ambassadors", "label": "Ambassadeurs" }
  ],
  "content": {
    "home": {
      "message": null,
      "askPrompt": "Une question sur le projet ?",
      "now": { "label": "Étape actuelle", "value": "Conception & co-construction" },
      "next": { "label": "Prochaine échéance", "date": "Juil. 2026" },
      "featured": {
        "source": { "module": "news", "id": "1" },
        "title": "Le projet entre dans sa phase active",
        "summary": "…"
      }
    },
    "timeline": {
      "intro": { "eyebrow": "Projet XYZ — Actualités", "title": "Le fil du projet", "description": "…" },
      "progress": { "currentStepLabel": "Étape 3", "totalSteps": 6, "percent": 42 },
      "milestones": [
        { "id": "m1", "status": "done", "date": "Oct. 2025", "label": "Lancement du projet", "description": "…" }
      ]
    },
    "spaces": {
      "intro": { "eyebrow": "Projet XYZ — Documents visuels", "title": "Découvrez le futur site", "description": "…" },
      "items": [
        { "id": "plan-1", "type": "Plan", "tags": ["Macro-zoning"], "title": "Plan macro-zoning — niveau R+1", "comment": "…", "asset": { "url": "/uploads/plan-1.jpg", "alt": "Plan macro-zoning du niveau R+1" } }
      ]
    },
    "news": {
      "intro": { "eyebrow": "Projet XYZ — Actualités", "title": "Le fil du projet", "description": "…" },
      "items": [
        { "id": "1", "tag": "Calendrier", "date": "2 avril 2026", "title": "Le projet entre dans sa phase active", "summary": "…", "body": "…" }
      ]
    },
    "questions": {
      "intro": { "eyebrow": "Projet XYZ — Base de connaissance", "title": "Une réponse, chaque fois.", "description": "…" },
      "items": [
        {
          "id": "date-demenagement", "title": "Date du déménagement",
          "answer": "…", "status": "confirmed", "statusLabel": "Réponse confirmée",
          "category": "calendrier", "note": "…",
          "keywords": ["date", "quand", "demenagement"],
          "phrases": [], "intentSignals": [], "emotionSignals": [], "negativeSignals": [],
          "priority": 0
        }
      ]
    },
    "ambassadors": {
      "intro": { "title": "Quel est leur rôle exactement ?", "body": "…", "rosterLabel": "toutes directions" },
      "cta": { "title": "Vous souhaitez devenir ambassadeur ?", "body": "…" },
      "roster": [
        { "id": "amb-1", "name": "Sophie Lecomte", "role": "Responsable comptabilité clients", "tag": "Finance", "photo": null }
      ]
    }
  }
}
```

Notes sur cet exemple : `content.team` est absent (module désactivé).
`settings` est **entièrement absent** de cet exemple — décidé en §12 :
omis plutôt que transporté comme objet vide, puisqu'aucun réglage
optionnel (comme `moodNudge`) n'est activé pour ce projet.

---

## 11. Mapping Pangea → Manifest

| Champ Manifest | Source Pangea | Statut |
|---|---|---|
| `project.name` | `branding.projectName` | mapping direct |
| `branding.logo` | `branding.logoUrl` | mapping direct (chaîne → objet `{url}`) |
| `branding.colors` | `branding.colors[0]`/`[1]` | mapping direct (tableau → objet nommé) |
| `branding.fonts` | `branding.fonts[0].name`/`[1].name` | mapping avec changement de forme : `family` mappé directement, `asset` nouveau (aucun équivalent Pangea — l'upload de police n'est pas encore branché) |
| `edition.id` | `branding.theme` | **corrigé après Phase 2** — pas un mapping direct : Pangea stocke `'default'` en interne pour l'édition affichée et prévisualisée sous le nom "Ivory" (`data-theme-value="default"` associé à `data-preview-theme="ivory"` dans l'admin). Le Compiler traduit explicitement `'default'` → `'ivory'` avant validation contre `context.supportedEditions` — jamais le nom legacy propagé tel quel jusqu'au Runtime. Ce document de conception ne documentait pas encore ce cas particulier au moment du gel ; la traduction vit dans l'implémentation (`tectonic/compiler.js`, `LEGACY_THEME_TO_EDITION`), découverte et validée pendant la revue de Phase 2. |
| `modules.*` | — | **nouveau champ Tectonic**, aucun équivalent Pangea |
| `navigation` | — | **nouveau**, configuration éditable — pas un dérivé de `modules` |
| `content.home` | — | **nouveau**, aucune page d'accueil dans Pangea aujourd'hui |
| `content.timeline.progress` | `progress` | mapping avec changement de nature : recalculé, jamais copié tel quel |
| `content.timeline.milestones` | `milestones` | mapping direct |
| `content.spaces` | `plans` | mapping direct (renommage IA seulement) |
| `content.news` | `articles` | mapping direct (renommage IA seulement) |
| `content.questions` | `faqEntries` | mapping direct — **jamais** le jeu de 34 entrées codé en dur du front (voir décision D1 du modèle d'ownership) |
| `content.ambassadors` | `ambassadorsContent` + `ambassadors` | fusion de deux objets Pangea en un |
| `content.team` | `teamContent` + `team` | fusion, présent seulement si activé |
| `settings.moodNudge` | — | **nouveau**, aucune configuration équivalente dans Pangea (toujours actif, fréquence fixe) |
| *(rien)* | `faqDrafts` | **exclu explicitement, par construction** |
| *(rien)* | `kpis.json` (tout) | **exclu explicitement, par construction** |
| *(rien)* | jeton admin, mot de passe | **exclu explicitement, par construction** |

---

## 12. Décisions

### Tranchées à l'issue de cette relecture

1. **`navigation`** — vraie configuration éditable (ordre + libellés),
   pas un dérivé de `modules`. Vit dans Project Configuration. Voir §4.
2. **`home`** — pas 100% dérivée. Distinction stricte entre
   configuration éditoriale autoritaire (`message`, `askPrompt`) et
   champs calculés à la compilation (`now`, `next`, `featured`). Voir
   §4 et §9.
3. **Signaux de scoring FAQ** — restent dans le Manifest pour la V1,
   tant que le moteur de recherche tourne côté Runtime. Déplacer le
   scoring côté serveur est un chantier séparé, pas une condition
   préalable. Voir §4.
4. **Assets** — `{ url, alt }` dès la V1, pas seulement `{ url }`.
   `width`/`height` restent différés, pas ajoutés maintenant. `alt`
   peut être `""` pour une image décorative ou redondante (typiquement
   un logo affiché à côté du nom du projet en toutes lettres) — ce
   n'est pas une obligation de remplir du texte partout. Voir §4, §7.
5. **`meta.revision`** — retenu dès la V1 (identifiant monotone ou
   horodatage, rien de plus sophistiqué). Voir §6.
6. **Collision de nommage `project`** — confirmé : `timeline` est le
   nom retenu pour le module d'avancement, `project` reste réservé à
   l'identité globale. Plus une ambiguïté à trancher.
7. **`team.intro.parellaIntro` → `introBody`** — généralisé
   **directement dans ce document** (§4), pas seulement signalé comme
   à faire plus tard. Un contrat censé être générique pour n'importe
   quel client ne peut pas porter lui-même le nom d'un cabinet conseil
   dans son schéma, même à l'état de proposition.
8. **`settings` absent si vide** — préféré à `settings: {}`. Un bloc
   vide n'apporte aucune information qu'une absence totale ne donnerait
   déjà. L'exemple de §10 est corrigé en conséquence.
9. **Invariant de compilation `modules.X` / `content.X` /
   `navigation`, précisé comme une règle asymétrique, pas une
   bijection** — voir invariant 9 (§2). `modules.X === true` impose
   `content.X` ; `modules.X === false` interdit `content.X` et toute
   référence dans `navigation` ; mais un module activé n'a pas
   obligatoirement d'entrée dans `navigation` (un logo peut ramener à
   la home sans que la home soit un onglet).
10. **`latest` généralisé en `featured`** — `pinned` autorisait déjà à
    épingler un contenu de n'importe quel module, mais le résultat
    s'appelait encore `latest`, incohérent dès qu'on épingle autre
    chose qu'un article. `featured` porte sa source (`source.module` +
    `source.id`) et le compilateur livre déjà le teaser résolu et
    normalisé — jamais la référence brute. `showLatest` disparaît :
    `featured: null` porte à lui seul toute l'information nécessaire.
    Illustre la doctrine : le Manifest décrit l'état public final, pas
    les commandes utilisées dans le Studio pour le produire. Voir §4, §9.
11. **`askPrompt` devient éditable**, avec une valeur par défaut
    fournie si non personnalisé — c'est du texte de marque, pas un
    calcul. Voir §4.
12. **`branding.fonts` restructuré pour supporter les polices
    uploadées** — `{ family, asset: {url} | null }` par police plutôt
    qu'une simple chaîne. Une police client uploadée (ex. `ClientSans-
    Regular.woff2`) ne peut pas être chargée par le Runtime si le
    Manifest ne transporte que son nom. Voir §4.
13. **`edition.id` devient une chaîne libre (`string`), pas une union
    fermée** — ajouter une édition ne doit pas obliger à faire évoluer
    le schéma du Manifest, puisque sa structure ne change pas. La
    validation (cette édition existe-t-elle vraiment ?) est une
    responsabilité du compilateur contre la liste des éditions
    installées, pas quelque chose que le contrat doit figer dans sa
    forme. Voir §4.

### Encore ouvertes

1. **`project.id`/`project.status`** — non retenus, par manque de
   besoin démontré tant que Storm reste mono-projet côté instance. À
   revoir si le Studio gère un jour plusieurs projets.
2. **Stratégie d'URL des assets** — chemins relatifs (`/uploads/...`)
   supposent que le Runtime et le serveur qui sert les fichiers sont
   le même processus. Un Manifest vraiment renderer-agnostic devrait
   probablement porter des URLs absolues ou résolues à la compilation
   — pas tranché ici.
3. **Métadonnées d'accessibilité au-delà de `alt`** — `width`/`height`
   restent différés (voir décision 4 ci-dessus). Pas un manque
   bloquant, juste pas encore nécessaire.
4. **`featured.source` est-il réellement utile au Runtime ?** Conservé
   comme provenance publique (voir §9), potentiellement pour permettre
   un lien vers le contenu d'origine — mais si le Runtime n'en a
   jamais l'usage, il pourrait être retiré sans rien perdre côté
   doctrine. Tranché par la conception du compilateur, pas ici.

---

## Ce que ce document ne fait pas, volontairement

Aucune modification de `server.js`, aucun nouveau endpoint, aucune
migration de `content.json`, aucun runtime, aucun dossier créé. Sur
les 16 points remontés en section 12, 13 ont reçu une position claire
à l'issue des relectures successives (navigation, home/featured/
askPrompt, scoring FAQ, assets et `alt:""`, `meta.revision`, nommage
`timeline`, généralisation `parellaIntro` → `introBody`, `settings` omis si vide,
invariant de cohérence asymétrique, polices uploadées, `edition.id`
en chaîne libre) ; les 3 qui restent (`project.id`/`status`, stratégie
d'URL des assets, métadonnées d'accessibilité au-delà de `alt`) sont
volontairement laissés ouverts, pas comblés par une décision inventée
pour boucler le document.

**En attente de relecture avant toute implémentation.**

*(4 points restent ouverts en section 12 : `project.id`/`status`,
stratégie d'URL des assets, accessibilité au-delà de `alt`, utilité
réelle de `featured.source` — tous volontairement renvoyés à une
étape ultérieure, pas comblés ici.)*
