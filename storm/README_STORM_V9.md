# Storm V9 — première modularisation sûre

Cette version garde le fonctionnement existant de l'Index V8 et extrait uniquement
le premier morceau qui a vocation à devenir une intelligence produit partagée :
le moteur Rainbow Glass.

## Fichiers

- `index.html`
  - V8 conservée autant que possible.
  - charge `./storm/rainbow-engine.js`.
  - les samplers Rainbow utilisent maintenant la décision calculée par le moteur.

- `storm/rainbow-engine.js`
  - aucune dépendance.
  - déterministe.
  - reçoit 1 ou 2 couleurs de marque.
  - calcule en interne : `prismatic`, `pearl` ou `tinted`.
  - retourne les variables optiques Rainbow Glass.

## Doctrine

L'utilisateur ne voit jamais Prismatic / Pearl / Tinted.

Il donne :
- logo
- 1 ou 2 polices
- 1 ou 2 couleurs
- édition Rainbow Glass

Storm décide :
- influence chromatique de la marque
- palette statique
- halos
- couleurs de réfraction
- gradient de titre
- stratégie optique

### Cas attendus

- Wavestone `#451DC6` + `#04EF6A` -> Prismatic
- Parella `#1E1D1E` + `#C2AF7E` -> Pearl
- noir + rouge vif -> Tinted

En cas de doute, le moteur privilégie volontairement la solution la moins chromatique.

## Important

Cette passe ne déplace PAS encore tout le CSS et tout le JS admin hors de l'Index.
Ce serait une refactorisation beaucoup plus large et risquée.

La stratégie recommandée reste :
1. figer l'UX ;
2. valider les comportements ;
3. extraire ensuite `storm-admin.css` et `storm-admin.js` sans changer le fond.

Le moteur Rainbow, lui, est déjà isolé ici parce qu'il s'agit d'une logique autonome
et réutilisable par tous les projets.
