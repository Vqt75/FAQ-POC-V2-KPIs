# Storm Studio V2 — Foundation 0B / Shell

## Objet

0B rend visible le nouveau modèle mental du Studio sans réécrire encore les éditeurs métier.

Le shell devient :

- Vue d’ensemble
- Contenu : Le projet, Actualités, Espaces, Questions, Ambassadeurs
- Administration : Identité & apparence
- Analyse : Pilotage

La topbar expose :

- l’état local de sauvegarde (`Tout est enregistré` / `Modifications à enregistrer`) ;
- l’état réel de publication fourni par `GET /api/admin/publication-status` ;
- `Aperçu` (ouvre l’expérience Tectonic publiée dans un nouvel onglet) ;
- `Publier`, disponible uniquement quand l’état enregistré diffère réellement du Manifest publié et que le Compiler autorise la publication.

## Vue d’ensemble

La Vue d’ensemble est un point de reprise, pas un deuxième dashboard. Elle remonte uniquement quelques éléments actionnables à partir des données déjà disponibles : brouillons FAQ, recherches sans réponse, absence éventuelle d’actualités, de visuels ou d’ambassadeurs.

## Ponts transitoires

Les éditeurs métier ne sont pas encore tous réécrits. 0B sépare déjà le vocabulaire public :

- `Le projet` et `Actualités` utilisent encore temporairement le même moteur d’édition historique, mais seules les parties pertinentes sont visibles selon la route ;
- `Ambassadeurs` masque la partie historique `Équipe projet`, qui sera déplacée vers le futur éditeur `Le projet` ;
- `Identité & apparence` conserve intégralement les samplers et la démonstration Wavestone.

Ces ponts sont temporaires et doivent disparaître au fil des vertical slices.

## Hors scope

- autosave complet ;
- preview du draft non publié ;
- réécriture du dashboard Pilotage ;
- éditeur narratif `Le projet` ;
- droits / rôles / permissions (Orogeny).
