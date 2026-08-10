# Studio V2 — Espaces 4A.1 — Bootstrap robuste

Correctif de migration du lot 4A.

## Problème observé

Certaines données issues des lots précédents possédaient déjà une clé `spaces: []`.
Le normaliseur 4A interprétait alors ce tableau vide comme une décision éditoriale et
ne lançait ni la migration de `plans[]`, ni l’amorçage du POC. Le Studio affichait
 donc `0 espace`.

## Règle 4A.1

- ancien état non initialisé + `plans[]` : migration déterministe vers `spaces[]` ;
- ancien état non initialisé sans plan : amorçage des espaces Flex Office du POC ;
- état 4A déjà initialisé : une collection volontairement vide reste autorisée ;
- `spacesInitialized` est un marqueur interne Node, non exposé comme choix CMS ;
- le navigateur possède un filet de sécurité équivalent pour la démo.

Cette distinction évite à la fois la page blanche accidentelle et la réinjection
magique de contenu après une suppression volontaire.
