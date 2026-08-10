# Studio V2 — Espaces 4A

## Intention

L’onglet **Espaces** ne gère plus une bibliothèque technique « Plans & 3D ».
Il décrit les lieux tels qu’ils existent dans le projet : nom, localisation,
état, usages et ressources visuelles associées.

> L’utilisateur décrit un espace. Storm administre ses représentations.

## Contrat Studio

Chaque espace possède :

- `name` — nom compréhensible par les collaborateurs ;
- `location` — facultative ;
- `status` — `designing`, `approved` ou `delivered` ;
- `description` — intention / information utile ;
- `usages[]` — taxonomie humaine, jamais des tags techniques ;
- `media[]` — ressources ordonnées avec un rôle sémantique :
  - `view` — une vue de l’espace ;
  - `plan` — un plan à explorer ;
  - `document` — un document à consulter.

L’ordre des espaces est l’ordre de découverte publié. Le Studio autorise le
réordonnancement, mais ne demande jamais au consultant de choisir une grille,
une largeur, une animation ou un style de carte.

## Migration Pangea

`spaces` devient la source éditoriale Tectonic. Lorsqu’un ancien `content.json`
ne possède que `plans`, Node applique une migration déterministe vers des
espaces. À la sauvegarde, `plans` est régénéré comme projection de compatibilité
pour le fallback Pangea ; il ne constitue plus une seconde source de vérité.

## Publication

Le Compiler transporte vers `content.spaces` : état traduit en libellé public,
usages, localisation et liste de médias avec leur rôle. Ivory décide ensuite
si une ressource doit être vue en grand, inspectée comme plan ou consultée
comme document.
