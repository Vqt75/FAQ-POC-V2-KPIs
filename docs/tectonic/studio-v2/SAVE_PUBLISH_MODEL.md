# Storm Studio V2 — Modèle Save / Preview / Publish

Statut : **contrat de fondation — Tectonic**

## 1. Sens côté utilisateur

### Enregistrer
Protège le travail.

Cible : persistance automatique ou quasi automatique. L'utilisateur ne doit pas cliquer constamment sur `Enregistrer` après chaque petit changement.

### Aperçu
Montre ce que l'état sauvegardé actuel deviendrait s'il était publié.

### Publier
Rend explicitement visibles aux collaborateurs les changements publics sauvegardés.

Ces concepts ne doivent jamais être confondus.

## 2. Fondation technique existante

Tectonic possède déjà une transaction de publication explicite :

```text
Authoritative State
  → snapshot
  → Publication Candidate
  → Compiler
  → écriture atomique du Manifest
```

Studio V2 doit traduire cette architecture en confiance :
- travail enregistré ;
- modifications pas encore publiques ;
- prêt / non prêt à publier ;
- publication réussie.

## 3. Contrat d'état de publication

Foundation introduit un service admin-only avec cette forme conceptuelle :

```js
{
  published: boolean,
  hasUnpublishedChanges: boolean,
  publishable: boolean,
  publishedRevision: string | null,
  publishedAt: string | null,
  blockingError: string | null
}
```

Comportements indispensables :
- modifier une donnée Studio-only ne doit pas créer de faux changement public ;
- modifier une donnée publique doit créer un changement en attente ;
- un état public invalide peut être sauvegardé mais doit être signalé comme non publiable ;
- une publication échouée ne doit jamais altérer le dernier Manifest valide.

## 4. Règle de comparaison

Le statut repose sur la **projection publique compilée**, jamais sur l'égalité brute de `content.json`.

Raison : l'état autoritaire peut légitimement contenir des éléments non publics comme les brouillons FAQ.

La projection actuelle est compilée de façon déterministe avec les métadonnées du dernier Manifest puis comparée à ce Manifest. La question réellement posée est :

> « Publier l'état sauvegardé actuel changerait-il ce que reçoivent les collaborateurs ? »

## 5. Résumé de changements — incrément suivant

Un incrément futur pourra produire des résumés sémantiques :

```text
Le projet
Grandes étapes modifiées

Actualités
1 nouvelle publication

Ambassadeurs
Camille Martin ajoutée
```

Ce résumé doit être métier, jamais un diff JSON brut.

## 6. Règles d'autosave à brancher avec le shell Studio

Cible recommandée :
- une saisie met immédiatement à jour l'état local ;
- persistance debounced après une courte période calme ;
- navigation déclenche une dernière tentative de sauvegarde si nécessaire ;
- états visibles : `Enregistrement…` → `Tout est enregistré` ;
- un échec réseau reste visible et ne simule jamais un succès ;
- `Publier` opère uniquement sur l'état autoritaire sauvegardé côté serveur, jamais sur un payload navigateur non sauvegardé.
