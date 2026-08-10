# Storm Studio V2 — Architecture de l'information

Statut : **cible de fondation — Tectonic**

## 1. Navigation cible

```text
STORM
Projet Quatro

Vue d'ensemble

CONTENU
Le projet
Actualités
Espaces
Questions
Ambassadeurs

ADMINISTRATION
Identité & apparence

ANALYSE
Pilotage

──────────────
Relancer la démo de création ↗   [démo uniquement]
Déconnexion
```

## 2. Topbar persistante

Grammaire cible :

```text
Projet Quatro                         Aperçu     Publier
                                      ──────────────────
                               Modifications non publiées
```

États possibles :
- `Tout est enregistré` ;
- `Enregistrement…` ;
- `Modifications non publiées` ;
- `Publié à 15:42` ;
- `Publication impossible — 1 point à corriger`.

La topbar n'expose ni revision, ni Manifest, ni Compiler, ni état de fichier.

## 3. Responsabilité de chaque destination

### Vue d'ensemble
Point de reprise du travail, pas dashboard KPI.

Peut faire remonter :
- modifications non publiées ;
- brouillons à reprendre ;
- contenus incomplets ;
- modifications récentes ;
- actions de création fréquentes.

### Le projet
Possède le récit stable du projet et ses sections sémantiques :
- introduction ;
- focus ;
- texte ;
- image ;
- galerie ;
- chiffres clés ;
- grandes étapes ;
- citation ;
- grands choix ;
- équipe projet.

### Actualités
Possède les publications chronologiques et leur contenu éditorial.

### Espaces
Possède les espaces comme entités sémantiques et leurs médias associés, pas une bibliothèque plate `plans[]`.

### Questions
Possède les réponses officielles, formulations alternatives, état de l'information et couverture FAQ.

### Ambassadeurs
Possède la communauté, la contactabilité optionnelle et l'appel à ambassadeurs optionnel.

### Identité & apparence
Zone d'administration / paramétrage. Possède :
- nom du projet ;
- logo ;
- couleurs de marque ;
- typographies ;
- édition Storm ;
- previews / sampler d'édition.

Ce sont des réglages rares de configuration, pas des contrôles éditoriaux quotidiens.

### Pilotage
Lieu où l'équipe projet écoute ce que le site lui apprend.

Trois questions principales :
1. Le site est-il utilisé ?
2. Les collaborateurs trouvent-ils ce dont ils ont besoin ?
3. Comment le projet est-il vécu ?

Pilotage peut faire remonter audience, couverture FAQ, attention portée aux contenus, météo du projet et signaux actionnables.

## 4. Concepts de navigation V1 qui disparaissent

Ne sont plus des destinations V2 :
- `Actualités & planning` ;
- `Plans & 3D` ;
- `Ambassadeurs & équipe` ;
- page autonome `Équipe projet` ;
- catch-all `Identité & textes`.

Leurs fonctions sont redistribuées vers le domaine sémantique qui les possède.

## 5. Réglage de l'édition Storm

Changer d'édition reste techniquement possible, mais ne doit pas être présenté comme un changement de skin anodin.

Préférer :

```text
Édition utilisée
Ivory

Voir les autres éditions
Changer d'édition
```

Éviter un simple select générique `Thème` lorsqu'une formulation plus intentionnelle est possible.

Le sampler Wavestone reste disponible pour comparaison et démonstration internes.
