# Storm / Tectonic — Studio V2 — 8C.1 Structure visual convergence

## Pourquoi

Le lot 8C fonctionnait correctement mais sa surface visuelle ne reprenait pas assez fidèlement la grammaire déjà établie dans « Identité & apparence ».

Le titre utilisait `var(--font-expression)`. Dans le Studio réel, cette variable n'est pas une dépendance sûre pour cette surface : le navigateur pouvait donc retomber sur la police d'interface.

## Correction

8C.1 est strictement visuel :

- Italiana est appelée explicitement pour le grand titre ;
- le kicker « Administration » retrouve de la respiration ;
- l'échelle typographique se rapproche d'« Identité & apparence » ;
- les lignes et la surface gagnent le rythme généreux du Studio ;
- les switches restent identiques fonctionnellement ;
- aucune logique de sauvegarde, publication, Candidate, Compiler, Runtime ou Ivory n'est modifiée.

## Invariant

8C.1 ne change aucune donnée et aucun comportement de publication.
