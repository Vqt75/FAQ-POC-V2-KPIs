# TECTONIC — Implementation Plan

**Statut : plan d'exécution. Construit sur les 4 documents gelés
(Data Ownership, Site Manifest, Compiler, Publication Candidate).
Pas de nouvelle décision d'architecture ici — seulement l'ordre dans
lequel on construit ce qui est déjà conçu.**

---

## Principe transversal, valable à chaque phase

**Pangea reste le filet de sécurité jusqu'à ce que le Runtime Tectonic
soit validé, édition par édition.** À aucun moment une phase ne
retire ou ne casse le comportement actuel de Pangea. Chaque phase
ajoute quelque chose *à côté*, jamais *à la place*, jusqu'à la bascule
finale explicite (Phase 6). Si une phase échoue ou révèle une
contradiction, on peut s'arrêter net sans rien avoir dégradé.

---

## Phase 0 — Scaffolding, zéro changement de comportement

**But** : poser les fichiers, sans qu'ils fassent quoi que ce soit
d'observable.

**Fichiers créés** :
```
/tectonic/publication-candidate.js   (squelette, fonctions exportées vides)
/tectonic/compiler.js                (squelette, fonctions exportées vides)
```

**Tests** : `node --check` sur les deux fichiers. Rien d'autre —
il n'y a encore aucun comportement à tester.

**Critère de sortie** : les fichiers existent, syntaxiquement valides,
non importés nulle part dans `server.js`. Pangea tourne exactement
comme avant.

**Dépendance** : aucune.

---

## Phase 1 — `buildPublicationCandidate()`, en isolation

**But** : implémenter la fonction telle que conçue dans
`TECTONIC_PUBLICATION_CANDIDATE.md` — whitelist explicite,
règle transitoire `modules`/`navigation`.

**Fichiers** : `/tectonic/publication-candidate.js` (implémentation réelle).

**Tests** (fichier dédié, ex. `test_publication_candidate.js`) :
- Test de la whitelist "piégée" (état avec `faqDrafts`/`kpis`/`adminToken`
  en entrée → aucun ne ressort).
- Test de la règle transitoire `modules`/`navigation` (team vide → désactivé ;
  team non vide → activé ; les autres modules toujours activés).
- Test sur les vraies données Pangea (Projet XYZ) → candidat produit
  sans erreur, **forme conforme au contrat `PublicationCandidate`**
  (`TECTONIC_PUBLICATION_CANDIDATE.md` §2) — **pas** au Site
  Manifest. Le Candidate n'a précisément pas la forme du Manifest ;
  c'est le Compiler, en Phase 2, qui fait cette transformation. Un
  test qui vérifie la forme du Manifest à ce stade brouillerait la
  frontière qu'on vient de construire.

**Critère de sortie** : tous les tests passent. Toujours **aucun
import** dans `server.js` — cette fonction ne tourne encore nulle
part en dehors de ses propres tests.

**Dépendance** : Phase 0.

---

## Phase 2 — Compiler, en isolation

**But** : implémenter `compile(candidate, context)` tel que conçu dans
`TECTONIC_COMPILER_DESIGN.md` — pipeline complet, politique d'erreurs
bloquantes/récupérables, déterminisme strict.

**Fichiers** : `/tectonic/compiler.js` (implémentation réelle).

**Tests** (`test_compiler.js`) :
- **Test de référence** : `compile(candidate réel, context fixe)` sur
  les données Projet XYZ → comparer au Manifest exemple déjà gelé
  dans `TECTONIC_SITE_MANIFEST.md` §10.
- **Test de déterminisme** : mêmes `candidate` + `context` → sortie
  strictement identique, deux appels de suite.
- **Tests d'erreurs bloquantes** : édition absente de
  `context.supportedEditions` → compilation refusée, pas de Manifest
  partiel produit.
- **Tests d'avertissements récupérables** : référence `featured`
  cassée → repli sur le dernier article ; `alt` absent → valeurs par
  défaut du §6 appliquées.
- **Test d'invariant de sortie** : sur tout Manifest produit, vérifier
  la cohérence `modules`/`content`/`navigation` (invariant 9 du
  Manifest).

**Critère de sortie** : tous les tests passent, y compris sur les
vraies données. Toujours aucun branchement à `server.js`.

**Dépendance** : Phase 1 (le Compiler a besoin d'un vrai candidat en
entrée pour ses tests).

---

## Phase 3 — Générer un Manifest « en parallèle », sans le servir

**But** : vérifier que le pipeline complet fonctionne sur le vrai
état de production, sans aucun risque pour le site public.

**Mécanisme** : un script autonome (`/tectonic/generate-manifest.js`,
exécuté manuellement en ligne de commande — **pas un endpoint**) qui :
1. lit `data/content.json` réel,
2. construit un `Publication Snapshot` (une copie profonde de l'état
   JSON actuel — l'implémentation la plus simple suffit, `Storm` ne
   prescrit pas de technique particulière ici),
3. appelle `buildPublicationCandidate()` puis `compile()`,
4. écrit le résultat dans un fichier de travail — **explicitement
   hors du dépôt Git**, par exemple `/tmp/manifest.debug.json` ou tout
   chemin listé dans `.gitignore`. Jamais dans un dossier suivi par
   Git, jamais lu par le site public. Vu l'historique de ce projet
   avec des fichiers de test qui ont fini par risquer d'être committés
   par erreur, ce n'est pas une précaution superflue.

**Tests** : exécuter le script sur les données réelles du projet
actuel, relire le fichier de debug, vérifier à l'œil et par script
qu'il correspond à ce qu'on attend.

**Critère de sortie** : un Manifest complet et correct est généré à la
demande, à partir de vraies données de production, sans que
`server.js` ni le site public n'aient changé d'un octet.

**Dépendance** : Phase 2.

---

## Phase 4 — Brancher Publish / Snapshot / Candidate / Compiler ensemble

**But** : rendre le pipeline déclenchable depuis l'admin, avec un
vrai bouton "Publier" — mais toujours sans que le site public ne
s'en serve.

**Fichiers modifiés** :
- `server.js` : nouvelle route `POST /api/admin/publish` (jeton admin
  requis) qui exécute le pipeline complet et persiste le résultat dans
  `data/manifest.json` — **par écriture atomique, pas une écriture
  directe** :
  ```
  compile → validate
        → écrire data/manifest.tmp
        → vérifier que l'écriture a réussi (relire, comparer)
        → rename atomique data/manifest.tmp → data/manifest.json
  ```
  En cas d'erreur à n'importe quelle étape, `data/manifest.json` reste
  strictement inchangé — c'est la traduction concrète de l'invariant
  déjà acté "le dernier Manifest valide est toujours servi". Une
  écriture directe (ouvrir `manifest.json` et écrire dedans) risquerait
  un fichier à moitié écrit si le processus est interrompu en cours de
  route ; le `rename` est atomique au niveau du système de fichiers,
  l'écriture intermédiaire ne l'est pas.
- `index.html` : un bouton "Publier" dans l'admin (zone dédiée,
  distincte des boutons "Enregistrer" existants).

**Tests** :
- Test d'intégration réel (serveur démarré, sur copie temporaire
  isolée — jamais le dépôt) : clic simulé sur "Publier" → 200,
  `data/manifest.json` créé et conforme.
- **Test d'atomicité** : simuler un échec entre l'écriture du
  `.tmp` et le `rename` (ou une erreur bloquante en cours de
  compilation) → `data/manifest.json` précédent reste identique, aucun
  fichier partiel ne le remplace.
- Test de non-régression : toutes les routes existantes de Pangea
  (`GET /api/content`, etc.) inchangées, testées avec
  `test_api_security.sh` déjà existant.
- Test d'erreur bloquante réelle : configurer une édition invalide →
  `POST /api/admin/publish` renvoie une erreur explicite, aucun
  `manifest.json` corrompu n'écrase l'ancien.

**Critère de sortie** : publier produit un vrai Manifest persisté à
la demande de l'admin. Le site public continue de fonctionner
exactement comme avant — personne ne lit encore `manifest.json`.

**Dépendance** : Phase 3.

---

## Phase 5 — Premier Runtime Tectonic : Ivory, en parallèle de Pangea

**But** : valider que le Manifest suffit réellement à rendre un site,
en commençant par l'édition la plus simple — cohérent avec le
principe déjà acté ailleurs ("Ivory comme renderer de référence").

**Fichiers créés** :
```
/public/runtime.js          (charge le Manifest, route vers un renderer)
/public/renderers/ivory.js  (rendu Ivory à partir du Manifest)
```

**Mécanisme d'accès, réversible** : accessible uniquement via un
paramètre explicite (`?tectonic=1`), jamais par défaut. Quiconque
n'ajoute pas ce paramètre continue de voir Pangea sans aucun
changement.

**Tests** :
- **Parité fonctionnelle sur les fonctionnalités migrées de Pangea**
  — pas une reproduction 1:1 de tout Pangea, puisque Tectonic
  introduit déjà des éléments qui n'existent pas côté Pangea (vraie
  home, modules configurables). Concrètement :
  ```
  FAQ Pangea         → même contenu, même scoring
  Actualités          → même contenu
  Timeline            → même contenu, même progression
  Espaces             → mêmes assets
  Ambassadeurs/équipe → mêmes données
  ```
- **Validation séparée des comportements Tectonic nouveaux**, selon
  leur propre cahier des charges (les documents gelés), pas contre un
  équivalent Pangea qui n'existe pas :
  ```
  Home Tectonic           → testée selon TECTONIC_SITE_MANIFEST.md §4
  Navigation configurable → testée selon le Manifest publié
  Modules optionnels      → testés selon leur activation dans le Manifest
  ```
- Test de non-dépendance : vérifier que `/public/runtime.js` ne fait
  aucun appel à une route admin, ne lit jamais `faqDrafts` ni
  `kpis.json` (impossible de toute façon, absents du Manifest).

**Critère de sortie** : parité confirmée sur tout ce qui vient de
Pangea, comportement correct et documenté sur tout ce qui est propre
à Tectonic. Toujours accessible seulement en opt-in.

**Dépendance** : Phase 4 (a besoin d'un `manifest.json` réel à lire).

---

## Phase 6 — Bascule Ivory : Tectonic devient le chemin par défaut

**But** : première bascule réelle, uniquement pour Ivory, avec un
retour arrière immédiat possible.

**Changement** : la route `/` sert désormais le Runtime Tectonic par
défaut pour les projets en édition Ivory ; Pangea reste servi via un
paramètre de secours (`?pangea=1`) le temps de la période de
confiance.

**Critère de sortie** : une période d'observation (à définir avec
l'équipe, pas dans ce document) sans régression signalée. Une fois
cette période passée sans incident, `?pangea=1` peut être retiré pour
Ivory spécifiquement.

**Dépendance** : Phase 5, validée sans réserve.

---

## Phase 7 — Rainbow Glass, puis Midnight Frost

**But** : répéter exactement Phases 5-6 pour chaque édition restante,
une à la fois, jamais les deux en parallèle.

Chaque édition suit le même cycle : renderer écrit
(`/public/renderers/rainbow-glass.js`, puis `midnight-frost.js`) →
comparaison fonctionnelle contre le comportement Pangea actuel →
bascule opt-out → période d'observation → retrait du filet de
sécurité pour cette édition spécifiquement.

**Dépendance** : Phase 6 réussie pour Ivory. Rainbow Glass et Midnight
Frost ne dépendent pas l'un de l'autre, mais ne se migrent pas
simultanément — une édition à la fois, pour isoler toute régression
à sa cause exacte.

---

## Phase 8 — Retrait du code Pangea de service direct

**But** : seulement une fois les trois éditions validées sur
Tectonic. `index.html` cesse de servir directement le site public ;
il devient l'interface du Studio uniquement. Le Public Runtime devient
le seul chemin de rendu public.

**Critère de sortie** : documenté à part, le moment venu — prématuré
de le détailler avant que les Phases 5-7 soient terminées.

---

## Tableau récapitulatif

| Phase | Ce qui existe après | Risque pour Pangea |
|---|---|---|
| 0 | Fichiers vides | Aucun |
| 1 | Candidate isolé, testé | Aucun |
| 2 | Compiler isolé, testé | Aucun |
| 3 | Manifest généré en CLI | Aucun |
| 4 | Bouton Publier fonctionnel | Aucun (personne ne lit le Manifest) |
| 5 | Runtime Ivory en opt-in | Aucun (opt-in uniquement) |
| 6 | Ivory bascule par défaut | Retour arrière immédiat (`?pangea=1`) |
| 7 | Toutes éditions basculées | Retour arrière par édition |
| 8 | Pangea retiré du service direct | Décision finale, pas avant validation complète |

---

## Ce que ce document ne fait pas

Aucune ligne de code. Les Phases 0 à 4 sont prêtes à démarrer
immédiatement, dans l'ordre. Les Phases 5-8 dépendent de validations
successives, pas d'un calendrier fixé à l'avance.

**Prêt pour le cambouis, phase par phase — en commençant par la
Phase 0.**
