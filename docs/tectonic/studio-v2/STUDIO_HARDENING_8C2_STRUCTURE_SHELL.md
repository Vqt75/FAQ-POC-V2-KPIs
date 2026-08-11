# Storm / Tectonic — Studio V2 — 8C.2 Shared domain shell

## Problème

8C et 8C.1 avaient une logique correcte et une DA proche du Studio, mais « Structure du site » maintenait encore son propre hero, sa propre largeur de canvas et sa propre échelle typographique. Le changement de rubrique restait perceptible comme un changement de sous-produit.

## Correction

8C.2 ne recrée plus le shell : la page consomme directement le composant partagé `studio-domain-head` déjà utilisé par Le projet, Actualités, Espaces et Questions.

- même eyebrow ;
- même H1 Italiana ;
- même largeur de copy ;
- même placement de l’action Enregistrer ;
- même comportement responsive ;
- canvas non centré à 980 px ;
- surface fonctionnelle rapprochée des panneaux d’Identité & apparence.

La liste et ses switches restent spécifiques à la tâche « Structure du site ».

## Invariant

Aucune donnée, sauvegarde, publication, Candidate, Compiler, Runtime ou édition publique n'est modifiée.
