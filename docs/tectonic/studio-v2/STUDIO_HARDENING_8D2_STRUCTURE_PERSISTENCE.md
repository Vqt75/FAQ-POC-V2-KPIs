# Storm / Tectonic — 8D.2 Structure Persistence Hardening

## Cause opérationnelle

8C avait déjà ajouté `siteStructure` dans plusieurs chemins de chargement et de sauvegarde.
Malgré cela, l'état réellement persisté restait parfois sans `siteStructure`.

8D.2 déplace donc la garantie aux **deux frontières impossibles à contourner** :

1. juste avant chaque `POST /api/content`, dans `saveContent()` ;
2. juste avant `writeContentState()`, côté serveur.

## Frontend

`saveContent()` réinjecte la structure courante depuis `contentState.siteStructure`
ou, à défaut, depuis `currentAdminContent.siteStructure`.

Ainsi, même si une fonction historique construit un payload partiel, elle ne peut plus
faire disparaître la structure.

## Backend

Si un payload n'envoie pas `siteStructure`, le serveur conserve la valeur déjà persistée
au lieu de la normaliser vers les valeurs par défaut.

## Invariant

- Masqué + Enregistrer => `data/content.json` contient immédiatement `spaces:false`.
- Aucun autre bouton Enregistrer du Studio ne peut remettre silencieusement `spaces:true`.
- Publier reste le seul geste qui modifie le Manifest public.
