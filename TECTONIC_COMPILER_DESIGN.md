# TECTONIC — Compiler Design

**Statut : document de conception. Pas de `server.js`, pas de
runtime, pas de nouvel endpoint, pas de migration, aucun commit
applicatif. À relire avant toute implémentation.**

Construit sur les deux documents gelés : `TECTONIC_DATA_OWNERSHIP.md`
et `TECTONIC_SITE_MANIFEST.md`. Le Compiler est la fonction qui
transforme un Publication Candidate déjà borné en Manifest — c'est la
pièce du système qui décide de la *forme* de la Public Projection,
pas de son *éligibilité* (cette décision appartient à
`buildPublicationCandidate()`, voir §3bis).

---

## 1. Responsabilité unique

```
compile( Publication Candidate, Compilation Context ) → Site Manifest
```

**Corrigé** : le Compiler ne compile jamais directement "l'état
autoritaire actuel du Studio". Deux notions distinctes s'intercalent,
nécessaires dès qu'on prend au sérieux la doctrine Save ≠ Publish déjà
actée dans `TECTONIC_DATA_OWNERSHIP.md` :

```
AUTHORITATIVE PROJECT STATE   (tout ce que le Studio connaît,
                                y compris ce qui vient d'être modifié
                                mais pas encore publié)
          │
          │  buildPublicationCandidate()  — voir §3bis
          ▼
PUBLICATION CANDIDATE          (l'état exact qu'on s'apprête à publier
                                maintenant — pas nécessairement le
                                dernier état sauvegardé)
          │
          │  compile(candidate, context)
          ▼
SITE MANIFEST                  (release publique, immuable)
```

Si le Compiler acceptait directement l'état autoritaire courant, une
modification simplement *sauvegardée* (mais pas encore publiée)
partirait en ligne à la prochaine compilation — ce qui annule
purement et simplement la distinction Save ≠ Publish. Le Compiler doit
donc recevoir un objet déjà préparé par une étape antérieure
(`buildPublicationCandidate()`), pas l'état vivant du Studio.

Le Compiler reçoit également un `Compilation Context` explicite
(`generatedAt`, `revision`) plutôt que de les générer lui-même — voir
§7 pour la justification complète.

Ce qu'il n'est **pas** :
- pas un endpoint — la question de *quand* `buildPublicationCandidate()`
  puis `compile()` sont déclenchés est une question d'orchestration,
  tranchée en §8 (ce n'est plus une question ouverte).
- pas un validateur de saisie — la validation défensive champ par
  champ (types, valeurs de repli) est déjà assurée par les fonctions
  `normalize*()` existantes de `server.js`. Le Compiler s'appuie
  dessus, il ne les réécrit pas.
- pas un moteur de rendu — il ne connaît aucune édition, aucun CSS,
  aucune mise en page. Ce qu'il produit est strictement les données du
  Manifest.
- **pas le gardien de la frontière de publication** — cette
  responsabilité appartient à `buildPublicationCandidate()`, une
  fonction distincte du Compiler (voir §3bis). Le Compiler travaille
  sur un objet déjà borné ; il n'est pas ce qui fait le tri.

---

## 2. Invariants spécifiques au Compiler

Hérités des deux documents gelés, précisés pour cette pièce
particulière :

1. **`buildPublicationCandidate()` décide quelles données sont
   éligibles à la compilation publique ; le Compiler est le seul
   endroit qui décide comment ces données déjà éligibles deviennent
   le Manifest.** Deux responsabilités distinctes, pas une seule :
   ```
   buildPublicationCandidate()  = frontière de publication (éligibilité)
   Compiler                     = transformation vers le contrat public (forme)
   ```
   **Corrigé** : une version précédente de cet invariant faisait du
   Compiler "le seul endroit qui décide ce qui a le droit d'entrer
   dans le Manifest" — ce qui contredisait directement §3bis, où c'est
   `buildPublicationCandidate()` qui porte cette décision. Le Compiler
   ne re-décide jamais de l'éligibilité d'une donnée qu'il reçoit ; il
   décide seulement de sa mise en forme dans le Manifest.
2. **`faqDrafts`, la télémétrie, les soumissions de contact et l'état
   admin ne sont pas des données que le Compiler choisit de ne pas
   lire — ce sont des données que `buildPublicationCandidate()` ne lui
   transmet jamais.** Nuance importante pour rester honnête sur
   l'environnement réel : Storm est écrit en JavaScript vanilla, pas
   en TypeScript — il n'existe aucun type compilé qui interdirait
   *magiquement* à un objet de porter une propriété `faqDrafts`. La
   garantie réelle, pour la V1, repose sur une règle de construction
   précise : `buildPublicationCandidate()` doit **construire un nouvel
   objet à partir d'une whitelist explicite de champs autorisés**,
   jamais cloner l'état complet puis supprimer les champs interdits.
   ```
   À ÉVITER :  const candidate = {...content}; delete candidate.faqDrafts;
   À FAIRE :   const candidate = { branding: ..., milestones: ..., ... };
               // seulement ce qui est explicitement autorisé, rien d'autre
   ```
   C'est le même réflexe que celui déjà appliqué à la construction des
   événements KPI (`server.js`, whitelist de champs plutôt que copie
   défensive) — pas un principe nouveau, juste appliqué ici aussi.
   Cette propriété devient alors vérifiable par un test (§10), pas
   seulement une intention.
3. **Le Compiler est une fonction pure au sens strict.** Mêmes
   arguments exacts (`candidate` + `context`) → Manifest strictement
   identique, sans exception. Ce n'est pas "déterministe sauf deux
   champs qui varient" — `generatedAt` et `revision` sont fournis par
   l'appelant via `context`, jamais générés à l'intérieur du Compiler.
   Voir §7.
4. **Une compilation qui échoue ne doit jamais retirer le dernier
   Manifest valide.** Si le Compiler rencontre une *erreur bloquante*
   (voir §6bis), la publication est refusée dans son ensemble et le
   Runtime continue de servir le dernier Manifest compilé avec succès
   — jamais un Manifest partiel, jamais un site vide.
5. **Toutes les erreurs ne sont pas de la même nature — le Compiler
   distingue explicitement erreurs bloquantes et avertissements
   récupérables.** Une édition inconnue ne se traite pas comme une
   référence épinglée disparue. Voir §6bis, politique d'erreurs
   formalisée.
6. **Le Compiler valide sa propre sortie avant de la considérer
   terminée.** La cohérence `modules.X`/`content.X`/`navigation`
   (invariant 9 du Manifest) n'est pas seulement une règle qu'on
   espère respecter en écrivant le code de compilation — c'est une
   assertion vérifiée après coup, sur le Manifest produit, avant de le
   livrer. Voir §6.

---

## 3. Entrées : la forme du Publication Candidate

Le Compiler ne prend jamais `content.json` en entrée directement. Son
seul type d'entrée valide est le **Publication Candidate** — un objet
qui, par construction, ne peut pas contenir autre chose que ce qui
suit :

```
branding
publicContent (5 scopes)
milestones
articles
plans
ambassadorsContent, ambassadors
teamContent, team
faqEntries
modules        (voir dépendance non satisfaite ci-dessous)
navigation     (voir dépendance non satisfaite ci-dessous)
```

**`faqDrafts`, `kpis.json` (tout), les jetons/mots de passe ne sont pas
des champs que ce type omet par discipline — ils n'existent pas dans
un Publication Candidate construit correctement.** Nuance nécessaire
dans un environnement JavaScript vanilla (pas de TypeScript, donc pas
de type compilé qui interdirait *magiquement* une propriété
supplémentaire) : cette garantie tient parce que
`buildPublicationCandidate()` **construit un nouvel objet par
whitelist explicite** plutôt que de cloner l'état complet puis
supprimer les champs interdits — voir invariant 2 pour le détail de
cette règle de construction.

**Dépendance non encore satisfaite, à noter clairement** : `modules`
et `navigation` n'existent aujourd'hui dans aucune configuration
Pangea. Tant que cette configuration n'est pas construite côté Studio,
`buildPublicationCandidate()` doit les calculer avec une règle
transitoire raisonnable (voir §6, "modules / navigation") plutôt que
de les recevoir tout faits.

---

## 3bis. `buildPublicationCandidate()` — la frontière de publication

**Nouvelle pièce, distincte du Compiler**, introduite par cette
révision. Elle se situe *avant* le Compiler dans le pipeline global :

```
Authoritative Project State (tout ce que le Studio connaît)
          │
          ▼
   buildPublicationCandidate()
          │   sélectionne, filtre, met en forme —
          │   c'est ICI que le tri se fait, pas dans le Compiler
          ▼
   Publication Candidate (construit par whitelist explicite, voir
                           invariant 2 — pas un type compilé)
          │
          ▼
   compile(candidate, context)
          │
          ▼
      Site Manifest
```

Cette fonction n'est **pas construite dans ce document** — signalée
comme pièce nécessaire, pas conçue en détail ici. Ce qui compte pour
le Compiler Design : la frontière de publication est *son* travail,
pas celui du Compiler. Le Compiler n'a pas à être prudent avec des
données dangereuses qu'il pourrait recevoir par erreur — il ne peut
simplement pas les recevoir, parce que `buildPublicationCandidate()`
ne les laisse jamais passer.

Cette séparation a une conséquence concrète sur *quel état* devient le
candidat : `buildPublicationCandidate()` ne prend pas nécessairement
le dernier état sauvegardé du Studio. Voir §8 — c'est précisément le
mécanisme qui rend Save ≠ Publish réel plutôt que théorique.

---

## 4. Sortie

Un objet conforme à `TECTONIC_SITE_MANIFEST.md`, rien de plus, rien de
moins. Le Compiler ne décide jamais d'ajouter un champ que le Manifest
gelé ne prévoit pas, même si cette information existe et semble utile
— toute extension repasse par une révision du document Manifest, pas
par une initiative du Compiler.

---

## 5. Pipeline de compilation

**Corrigé** : une version précédente de ce pipeline commençait par
"charger l'état autoritaire" et "normaliser chaque bloc" — deux étapes
qui n'appartiennent plus au Compiler depuis l'introduction de
`buildPublicationCandidate()` (§3bis). Le chargement, le filtrage et
la normalisation ont lieu *en amont*, dans la construction du
candidate — pas question de conceptualiser une frontière puis de la
traverser discrètement dans le pipeline qui suit.

Ordre proposé, chaque étape ne dépendant que des précédentes :

```
0. [EN AMONT, hors Compiler] buildPublicationCandidate() charge l'état
   autoritaire, normalise chaque bloc (réutilise normalize*()
   existants), et construit le candidate par whitelist explicite.

1. Recevoir PublicationCandidate + CompilationContext
2. Vérifier les préconditions du candidate (champs structurels
   indispensables présents — sinon erreur bloquante immédiate)
3. Valider la configuration effective modules/navigation reçue dans
   le candidate (le Compiler ne la résout jamais lui-même — voir §6)
4. Compiler le socle : project, branding, edition
     — edition.id validé contre context.supportedEditions (§7bis) ;
       inconnu → erreur bloquante, jamais un repli silencieux
5. Compiler navigation (à partir des modules activés)
6. Compiler chaque bloc de content, module par module activé
     6a. timeline   — recalculer progress depuis milestones
     6b. spaces      — mapping direct + wrapping asset {url, alt}
     6c. news        — mapping direct
     6d. questions   — mapping direct (garde les signaux de scoring)
     6e. ambassadors — fusion ambassadorsContent + ambassadors
     6f. team        — fusion teamContent + team, uniquement si activé
     6g. home        — fusionner curation éditoriale + champs dérivés
                        (dépend de 6a et 6c pour now/next/featured)
7. Compiler settings (moodNudge, si configuré)
8. Assembler meta depuis CompilationContext (generatedAt, revision)
9. Valider le Manifest assemblé contre les invariants (§6bis)
10. Retourner le Manifest, ou une erreur bloquante — jamais un objet partiel
```

L'étape 0 est explicitement **hors du Compiler** — elle appartient à
`buildPublicationCandidate()`. Elle figure ici uniquement pour montrer
où va le travail qui n'est plus dans le pipeline du Compiler
lui-même, pas pour la réintégrer dans sa responsabilité.

`home` dépend explicitement de `timeline` et `news` déjà compilés
(étape 6g après 6a/6c) — ce n'est pas un détail d'implémentation, c'est
une contrainte d'ordre réelle : on ne peut pas résoudre `featured` par
défaut sans déjà connaître le premier article compilé.

---

## 6. Règles de compilation, bloc par bloc

### `project`, `branding`
Mapping direct depuis `branding.projectName`/`logoUrl`/`colors`/
`fonts`, déjà normalisés côté serveur. Le logo reçoit un `alt` — voir
note ci-dessous, Pangea ne stocke aujourd'hui aucun texte alternatif.
Valeur par défaut désormais tranchée — voir "Defaults `alt`" plus loin
dans ce document : `alt: ""` pour un logo non configuré.

### `edition`
```
theme du candidat → traduit via la table des noms legacy Pangea, si
                     applicable (voir note ci-dessous) → présent dans
                     context.supportedEditions ?
  oui → edition.id = édition traduite
  non → ERREUR BLOQUANTE (voir §6bis) — compilation refusée dans son
        ensemble, dernier Manifest valide continue d'être servi
```
**Précision ajoutée après Phase 2**, alignant ce document avec la
décision validée pendant l'implémentation — pas une réouverture de la
conception : Pangea stocke `'default'` en interne pour l'édition que
l'admin affiche et prévisualise sous le nom "Ivory"
(`data-theme-value="default"` associé à `data-preview-theme="ivory"`
dans `index.html`). Ce document ne le mentionnait pas au moment du
gel — la traduction (`'default'` → `'ivory'`) est appliquée avant la
validation contre `context.supportedEditions`, jamais le nom legacy
propagé tel quel jusqu'au Runtime.

`context.supportedEditions` (voir §7bis) — jamais une liste consultée
ailleurs, au risque de casser la pureté stricte du Compiler.

**Corrigé — inversion complète par rapport à une version précédente de
ce document.** Un repli silencieux vers une édition par défaut (par
exemple Ivory) est techniquement résilient et produitement
catastrophique : un client configuré en Midnight Frost dont
l'édition deviendrait indisponible verrait son site entier changer
d'apparence sans le vouloir, sans le savoir, sans avoir rien demandé.
C'est exactement le cas d'usage de l'invariant "une compilation qui
échoue ne remplace jamais le dernier Manifest valide" — ici appliqué
pour de vrai plutôt que laissé abstrait. Le Studio doit recevoir un
message explicite du type *"Impossible de publier : l'édition
configurée n'est pas disponible"*, pas un site qui a changé de visage
tout seul.

### `modules` / `navigation`
**Corrigé** : une version précédente de ce document faisait porter au
*Compiler* la règle transitoire d'activation des modules — ce qui
contredisait directement §3 ("`buildPublicationCandidate()` doit les
calculer") et redonnait au Compiler une responsabilité d'éligibilité
qu'on venait précisément de lui retirer (invariant 1). Correction :

**Tant que Storm ne propose pas de vraie configuration `modules` côté
Studio, c'est `buildPublicationCandidate()` qui applique la règle
transitoire et construit `modules`/`navigation` avant de les inclure
dans le candidate** : un module est considéré activé s'il a du contenu
substantiel pour ce projet (ex. `team` activé seulement si `team`
contient au moins un membre), sinon désactivé par défaut — sauf
`questions`, `timeline`, `spaces`, `news`, `ambassadors`, `home`, qui
restent activés par défaut même vides, puisqu'ils correspondent aux
sections que Pangea affiche déjà inconditionnellement aujourd'hui.

**Le Compiler, lui, ne connaît pas le caractère transitoire ou
permanent de cette configuration : il reçoit `modules`/`navigation`
comme un résultat déjà effectif, et se contente d'en vérifier la
cohérence** (invariant 9 du Manifest — aucune entrée `navigation` ne
référence un module désactivé, etc.). Cette règle transitoire
disparaît le jour où le Studio expose un vrai réglage `modules` — mais
ce changement se fera entièrement dans `buildPublicationCandidate()`,
sans toucher au Compiler, précisément parce que la frontière est bien
posée.

### `content.timeline`
`progress` est recalculé par le Compiler à partir de `milestones`,
selon la même logique que `computeProgressFromMilestones()` — qui
n'existe aujourd'hui que côté client, dans l'admin (vérifié : absente
de `server.js`). **Cette logique doit être portée là où le Compiler
s'exécute**, pas simplement "réutilisée" telle quelle — c'est un vrai
travail de migration, pas un copier-coller.

### `content.spaces`, `content.news`, `content.questions`
Mapping direct depuis `plans`/`articles`/`faqEntries` déjà normalisés.
Chaque asset (`plans[].imageUrl`) est enveloppé en `{url, alt}` — voir
"Defaults `alt`" plus loin : le titre du contenu associé sert de
valeur par défaut pour un visuel de Plans & 3D.

`content.questions` conserve tous les champs de scoring (`keywords`,
`phrases`, `intentSignals`, `emotionSignals`, `negativeSignals`,
`priority`) tels que normalisés par `normalizeFaqEntry()` — décision
déjà prise dans le Manifest gelé, le Compiler ne fait qu'appliquer.

### `content.ambassadors`, `content.team`
Fusion de deux objets Pangea (`ambassadorsContent` + `ambassadors`,
`teamContent` + `team`) en un seul bloc Manifest. `team` n'est compilé
du tout que si le module est activé (voir règle transitoire
ci-dessus) — sinon la clé est absente du Manifest, jamais un objet
vide.

### `content.home`
```
message   ← recopié depuis le Publication Candidate (nouveau champ,
            n'existe pas encore dans Pangea en amont — vide par défaut)
askPrompt ← recopié depuis le Publication Candidate, ou valeur par
            défaut si jamais personnalisé
now       ← dérivé de timeline.progress (déjà compilé à l'étape 6a)
next      ← dérivé de timeline.milestones (déjà compilé à l'étape 6a)
featured  ← SI une référence est épinglée (module + id) ET que cette
              référence résout vers un contenu existant dans le
              Manifest déjà compilé → construire { source, title, summary }
            SINON SI news.items existe et n'est pas vide → utiliser
              news.items[0] par défaut
            SINON → featured: null
```
**Règle de résilience explicite** : si une référence épinglée ne
résout vers *rien* (contenu supprimé depuis, id invalide), c'est un
**avertissement récupérable** (voir §6bis), pas une erreur bloquante —
le Compiler retombe silencieusement sur le comportement par défaut
(dernier article, ou `null`), sans jamais faire échouer toute la
compilation pour ça. Épingler un contenu qui a disparu est une
situation normale de la vie d'un site.

### `settings.moodNudge`
Compilé uniquement si cette configuration est présente dans le
Publication Candidate — sa source autoritaire n'existe d'ailleurs pas
encore du tout dans Pangea aujourd'hui (le nudge est toujours actif,
fréquence fixe). Tant que ce réglage n'est pas construit côté Studio,
`settings.moodNudge` est simplement absent de tout Manifest compilé —
pas une valeur par défaut inventée.

### Defaults `alt`, tranchés pour ne rien laisser à l'implémentation

| Type d'asset | Défaut si `alt` non configuré |
|---|---|
| Logo de marque | `""` (décoratif par défaut — le nom du projet est déjà affiché en toutes lettres à côté) |
| Photo d'ambassadeur / membre d'équipe | `"<Nom> — <rôle ou fonction>"`, ou seulement `<Nom>` si aucun rôle renseigné |
| Visuel de contenu (Plans & 3D) | le titre du contenu associé (`items[].title`) |
| Police (`fonts.*.asset`) | non concerné — une police n'est pas une image |

Ces valeurs par défaut sont raisonnables sans être définitives : le
Studio pourra plus tard permettre de les éditer explicitement. Tranché
ici pour ne pas laisser une pseudo-question ouverte jusqu'à
l'implémentation.

---

## 6bis. Politique d'erreurs — deux classes, jamais confondues

Toutes les erreurs qu'un Compiler peut rencontrer ne se traitent pas
de la même façon. Cette distinction doit être explicite dans la
conception, pas laissée à l'appréciation de qui implémente.

### Erreurs bloquantes (`Blocking errors`)

La compilation entière échoue. Le dernier Manifest valide continue
d'être servi (invariant 4). Le Studio reçoit un message d'erreur
explicite et actionnable — jamais un échec silencieux.

Exemples :
- l'édition configurée n'existe pas parmi les éditions installées ;
- un module marqué activé n'a aucun contenu structurellement
  compilable (pas "vide", mais invalide au point de ne pas pouvoir
  produire un bloc `content.X` conforme) ;
- une donnée structurelle indispensable est absente (par exemple,
  `project.name` totalement vide) ;
- le Manifest assemblé ne passe pas sa propre validation finale
  (invariant 9 du Manifest violé, champ interdit présent).

### Avertissements récupérables (`Recoverable warnings`)

La compilation continue et produit un Manifest valide, avec un
comportement de repli documenté. Le problème peut être signalé (log,
notification future au Studio) mais **ne bloque jamais la
publication**.

Exemples :
- une référence `featured` épinglée ne résout plus vers rien (repli :
  dernier article, ou `null`) — voir règle `content.home` ci-dessus ;
- un `alt` non configuré (repli : valeurs par défaut ci-dessus) ;
- une entrée `navigation` devenue invalide après désactivation d'un
  module (repli : l'entrée est simplement filtrée avant assemblage,
  cohérent avec l'invariant 9 du Manifest — pas une raison d'échouer).

### Pourquoi cette distinction compte

Confondre les deux classes mène exactement à l'erreur qu'on vient de
corriger sur `edition` : traiter une édition manquante comme "juste un
autre cas à gérant avec un repli" aurait semblé raisonnable en
isolation, mais produit un résultat inacceptable pour l'utilisateur
final (un site qui change d'apparence sans qu'on l'ait demandé). La
règle générale : **si le repli change ce que l'utilisateur voit d'une
manière qu'il n'a pas choisie et ne peut pas anticiper, c'est
bloquant ; si le repli reste dans l'esprit de ce qui était configuré
(un article par défaut plutôt qu'aucun, un texte alternatif générique
plutôt qu'absent), c'est récupérable.**

---

## 7. Déterminisme réel via `Compilation Context`

**Corrigé** : la version précédente de ce document décrivait le
Compiler comme "déterministe sauf `generatedAt` et `revision`" — une
fonction pure avec deux exceptions est le genre de règle qui s'érode
vite. La correction : ces deux valeurs ne sont **jamais générées à
l'intérieur du Compiler**. Elles font partie de son second argument,
fourni par l'appelant :

```
compile( candidate: PublicationCandidate, context: CompilationContext ) → Manifest

CompilationContext = {
  generatedAt: <horodatage fourni par l'orchestrateur>,
  revision: <identifiant fourni par l'orchestrateur>,
  supportedEditions: <liste des éditions installées, voir §7bis>
}
```

Avec cette signature, la règle devient sans exception : **mêmes
arguments exacts → Manifest strictement identique, y compris
`meta.generatedAt` et `meta.revision`.** C'est l'orchestrateur de
publication (§8) qui construit le `context` — le Compiler se contente
de le recopier dans `meta`.

```
Publication orchestration
        │
        ├── génère revision
        ├── génère generatedAt
        ├── fournit supportedEditions
        ▼
   compile(candidate, context)
        │
        ▼
   Manifest exact, reproductible
```

### 7bis. Pourquoi `supportedEditions` doit être dans le contexte, pas deviné

La validation d'`edition.id` (§6) a besoin de savoir quelles éditions
sont réellement installées à ce moment-là. Sans cette liste explicite
dans `context`, le Compiler devrait consulter quelque chose *en
dehors* de ses deux arguments pour trancher — une bibliothèque
installée, une configuration globale, peu importe. Ça briserait la
pureté stricte affirmée par l'invariant 3 : `compile(candidate,
context)` pourrait produire un Manifest valide aujourd'hui, puis
échouer demain avec **exactement les mêmes arguments**, simplement
parce qu'une édition a été retirée du système ailleurs. Une fonction
"pure" qui dépend silencieusement de son environnement n'est pas pure,
elle le paraît juste tant que personne ne change l'environnement.

En listant `supportedEditions` explicitement dans `CompilationContext`,
toute dépendance de la compilation redevient un argument visible,
testable, et figé au moment de l'appel — plus rien d'implicite. Pas de
paramètre supplémentaire pour autant (`compile(candidate, context,
capabilities)` aurait été une option, écartée pour ne pas multiplier
les signatures sans bénéfice net pour ce POC).

**Précision Identity 1A** : pour Tectonic V1, les assets gérés par
Storm utilisent le contrat relatif `/uploads/...` sur la même origine.
Le Compiler accepte donc une police `source: "upload"` uniquement si
son `assetUrl` est un chemin servable sous `/uploads/`; sinon il bloque
la publication. Un éventuel `assetBaseUrl` reste une possibilité pour
un futur déploiement multi-origine, sans être nécessaire aujourd'hui.

**Précision importante** : `revision` identifie une *publication*, pas
une exécution arbitraire de la fonction. Compiler en mode preview, ou
dans un test, ne doit pas nécessairement produire ou consommer une
nouvelle `revision` — seule une vraie action de publication en mérite
une. Ne pas confondre "j'ai appelé le Compiler" et "j'ai publié".

**Format retenu pour la V1** : un identifiant basé sur un horodatage,
opaque (par exemple `20260808T054012Z`), plutôt qu'un compteur. Un
compteur exigerait de maintenir un état supplémentaire uniquement pour
savoir quel nombre vient après — un coût réel pour un bénéfice qu'on
n'a pas encore identifié. Le format exact reste un détail
d'implémentation, pas une question de conception.

---

## 8. Quand le Compiler s'exécute — décidé, pas laissé ouvert

**Corrigé** : une version précédente de ce document présentait deux
options comme architecturalement équivalentes. Ce n'est pas le cas —
l'une des deux contredit une décision produit déjà prise.

**La cible Tectonic est :**
```
Modifier
   ↓
Sauvegarder            (Authoritative Project State mis à jour)
   ↓
Prévisualiser
   ↓
PUBLIER                ← action explicite
   ↓
buildPublicationCandidate()
   ↓
compile(candidate, context)
   ↓
Site Manifest persisté (release publique)
   ↓
Runtime
```

Le Compiler ne tourne que sur cette action explicite "Publier". C'est
le seul mécanisme qui rend Save ≠ Publish réel : entre une sauvegarde
et une publication, l'état autoritaire peut évoluer librement sans
qu'aucune modification n'atteigne le public.

**Compiler à chaque lecture publique** (équivalent à ce que fait
`GET /api/content` aujourd'hui) **n'est pas une architecture cible
Tectonic** — c'est, au mieux, un mode de compatibilité transitoire
pour la période de migration Pangea → Tectonic, documenté ici pour
être honnête sur l'état actuel du système, pas présenté comme une
alternative valable à terme :

> *Compile-on-read peut exister temporairement comme mode de
> compatibilité Pangea. Ce n'est pas l'architecture de publication
> cible, parce qu'il ne peut pas préserver Save ≠ Publish* — toute
> modification simplement sauvegardée y devient immédiatement
> publique, ce qui annule la distinction que tout ce travail de
> conception cherche justement à établir.

---

## 9. Décisions ouvertes

1. **Règle transitoire d'activation des modules** (§6, "modules"),
   portée par `buildPublicationCandidate()` — pas par le Compiler,
   depuis cette correction. Nécessaire tant qu'aucune vraie
   configuration n'existe côté Studio ; à retirer explicitement de
   `buildPublicationCandidate()` le jour où cette configuration
   existe, sans que le Compiler ait quoi que ce soit à changer.
2. **Portage de `computeProgressFromMilestones`** — cette logique
   n'existe aujourd'hui que côté client. Où vit le Compiler
   exactement (même processus que `server.js` ? un module séparé ?) va
   déterminer où cette logique doit être portée. Pas tranché, dépend
   d'une décision d'architecture applicative pas encore prise dans ce
   document.
3. **`buildPublicationCandidate()` reste à concevoir en détail.** Ce
   document reconnaît son existence et sa responsabilité (§3bis), mais
   ne spécifie pas son fonctionnement interne — notamment *quel* état
   sauvegardé elle doit prendre comme candidat si plusieurs
   modifications ont eu lieu depuis la dernière publication. Sujet
   pour un document séparé, pas pour celui-ci.
4. **Notification au Studio en cas d'erreur bloquante** — le principe
   ("message explicite et actionnable", §6bis) est acté, mais le
   mécanisme concret (toast, email, tableau de bord dédié) n'est pas
   conçu ici.

Résolu depuis la dernière relecture, pour mémoire : la valeur `alt`
par défaut (§6, tranchée), le comportement face à une édition inconnue
(§6, erreur bloquante — plus un repli), le format de `meta.revision`
(§7, horodatage opaque retenu pour la V1), l'architecture cible
d'orchestration (§8, Publier explicite, compile-on-read relégué au
rang de pont transitoire), la contradiction entre l'invariant 1 et
§3bis sur qui décide de l'éligibilité (invariant 1, corrigé), le
pipeline qui rechargeait encore l'état autoritaire (§5, corrigé pour
démarrer par le candidate), la pureté rompue par la validation
d'édition (§7/§7bis, `supportedEditions` ajouté au contexte), la
formulation "structurellement impossible" trop forte pour un
environnement JavaScript vanilla (invariant 2 et §3bis, nuancée en
whitelist explicite de construction), la règle transitoire
`modules`/`navigation` encore attribuée au Compiler au lieu de
`buildPublicationCandidate()` (§6, réconcilié avec §3), le test §10 qui
réintroduisait la doctrine du "type qui empêche" (remplacé par un test
comportemental de `buildPublicationCandidate()`), et le vocabulaire
"depuis l'état autoritaire" employé à tort pour décrire ce que reçoit
le Compiler (`home`, `moodNudge`, corrigés en "depuis le Publication
Candidate").

---

## 10. Stratégie de test proposée

Dans l'esprit de ce qui a déjà fait ses preuves sur le contrat FAQ
(`test_faq_normalize.js`, `test_faq_behavior_snapshot.js`) :

- **Tests de non-régression sur données réelles** : compiler l'état
  actuel de Pangea (Projet XYZ) et vérifier que le Manifest produit
  correspond exactement à ce qui est déjà attendu dans l'exemple
  complet du Manifest gelé (§10 de `TECTONIC_SITE_MANIFEST.md`).
- **Tests de déterminisme** : compiler deux fois avec exactement le
  même `candidate` et le même `context` → égalité stricte sur
  l'intégralité du Manifest produit, `meta` inclus (voir §7, plus
  d'exception).
- **Tests d'erreurs bloquantes** : `theme` inconnu → compilation
  refusée, aucun Manifest produit, dernier Manifest valide inchangé.
  Vérifier explicitement qu'aucun Manifest partiel ne fuit en cas
  d'échec.
- **Tests d'avertissements récupérables** : référence `featured`
  invalide, `milestones` vide, `alt` non configuré → compilation
  réussie, Manifest valide produit, comportement de repli documenté
  vérifié pour chacun de ces cas précisément.
- **Test de frontière de publication** : vérifier que
  `buildPublicationCandidate()` construit son résultat par whitelist
  explicite et n'y propage jamais `faqDrafts`, télémétrie, soumissions
  opérationnelles ou état admin — **même lorsque ces champs sont
  présents dans l'état autoritaire source**. Concrètement, un test qui
  fournit délibérément un état autoritaire "piégé" :
  ```
  état autoritaire de test : {
    branding: {...}, milestones: [...],   // champs légitimes
    faqDrafts: [...], kpis: {...},
    adminToken: "...", contactSubmissions: [...]   // champs interdits
  }
        ↓  buildPublicationCandidate()
  candidate produit : aucune des propriétés interdites présente
  ```
  Ça teste le comportement réel de construction, pas un type JS
  imaginaire — Storm est en JavaScript vanilla, aucun type compilé
  n'empêche physiquement une propriété d'exister (voir invariant 2).
- **Test d'invariant sur la sortie du Compiler** : vérifier que la
  cohérence `modules`/`content`/`navigation` est respectée sur tout
  Manifest produit.

Aucun de ces tests n'est écrit dans ce document — proposés pour la
phase d'implémentation, pas construits ici.

---

## Ce que ce document ne fait pas, volontairement

Aucune modification de `server.js`, aucun nouveau endpoint, aucune
migration de `content.json`, aucun runtime, aucun dossier créé, aucun
test écrit, et `buildPublicationCandidate()` n'est pas conçue en
détail (seulement reconnue comme pièce nécessaire, voir §3bis). Les 4
points de la section 9 sont remontés pour relecture, pas comblés par
une décision inventée.

**Trois derniers résidus de cohérence corrigés à l'issue de cette
troisième relecture (la règle transitoire `modules`/`navigation`
réattribuée à `buildPublicationCandidate()`, le test §10 qui
réintroduisait la doctrine du type JS imaginaire, le vocabulaire
"état autoritaire" corrigé en "Publication Candidate" partout où le
sujet est le Compiler) — aucune nouvelle décision d'architecture. Prêt
pour le freeze.**
