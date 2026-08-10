# Studio V2 — Le projet 2A.2

Correctif de robustesse du bootstrap de l’éditeur `Le projet`.

## Bug corrigé

Dans un repo encore partiellement migré, `/api/content` pouvait ne pas exposer `project` (ou exposer un ancien objet vide). Le navigateur utilisait alors son fallback historique `{ intro: vide, sections: [] }`, ce qui produisait une interface `0 active` avec uniquement l’Introduction vide.

## Correction

- Node continue de normaliser `project` depuis `project-schema.js` et renvoie une structure POC complète quand l’état stocké est absent ou vide.
- Le Studio possède maintenant un garde-fou client supplémentaire : même si une API legacy renvoie un projet absent/vide, il amorce immédiatement la structure Flex Office proposée (9 sections, 7 actives, Image/Galerie désactivées).
- Si ce garde-fou client a dû intervenir, le Studio marque l’état comme `à enregistrer` afin que la base proposée puisse être persistée.
- Les données déjà saisies dans un projet non vide restent inchangées.

Ce garde-fou est volontairement redondant avec la normalisation serveur : une migration partielle ne doit jamais remettre l’utilisateur devant une page blanche.
