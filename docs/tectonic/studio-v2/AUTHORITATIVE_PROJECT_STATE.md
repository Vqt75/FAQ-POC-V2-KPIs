# Storm Tectonic — Authoritative Project State

Statut : **contrat d'architecture — fondation**

## 1. Définition

L'Authoritative Project State est tout ce que le Studio connaît et a sauvegardé à propos du projet.

Ce n'est **pas** le site public.
Ce n'est **pas** le Site Manifest.
Il peut contenir des brouillons ou des informations opérationnelles qui ne doivent jamais être publiques.

Pipeline conceptuel :

```text
Studio
  ↓
Authoritative Project State
  ↓
Publication Snapshot
  ↓
buildPublicationCandidate()  [whitelist explicite]
  ↓
Publication Candidate
  ↓
Compiler
  ↓
Site Manifest
  ↓
Runtime public / édition
```

## 2. État transitoire actuel

Pendant la migration Tectonic, `data/content.json` reste la persistance autoritaire actuelle.

Le modèle V2 sera introduit progressivement, domaine par domaine, sans remplacer toute la structure de stockage en une seule migration.

Des champs legacy peuvent donc coexister temporairement avec de nouveaux domaines sémantiques.

## 3. Domaines sémantiques cibles

Conceptuellement, l'état autoritaire doit converger vers :

```text
projectIdentity
projectContent
news
spaces
questions
ambassadors
studioConfiguration
moodConfiguration
```

Il s'agit d'une carte de responsabilités, pas d'un engagement à stocker tout cela dans un unique JSON monolithique.

## 4. Public vs non-public

Peuvent exister dans l'état autoritaire sans entrer automatiquement dans le Manifest :
- brouillons FAQ ;
- état d'édition incomplet ;
- notes Studio internes ;
- analytics/KPI ;
- demandes de contact opérationnelles ;
- futures données de permissions/gouvernance ;
- diagnostics internes de recommandation ;
- jetons et secrets admin.

Le Publication Candidate reste une whitelist positive, jamais un clone suivi de suppressions.

## 5. Données dérivées

Ne pas stocker comme vérité une valeur de présentation que Storm peut calculer de façon déterministe.

Exemples :
- rôle d'accent résolu pour Ivory ;
- pourcentage de timeline lorsqu'il est dérivable ;
- navigation publique lorsqu'elle est dérivable ;
- scores FAQ / recommandation ;
- éligibilité comportementale de la météo.

Ces valeurs appartiennent aux engines, au Compiler ou au Runtime selon leur responsabilité.

## 6. Règle de migration

Une vertical slice Studio V2 n'est terminée que lorsque :
1. le Studio édite le domaine sémantique ;
2. le serveur le persiste sans ambiguïté ;
3. le Publication Candidate whitelist sa partie publique ;
4. le Compiler émet la forme Manifest correspondante ;
5. Ivory la consomme sans inférence legacy ;
6. les tests protègent les frontières public / non-public.
