# Studio V2 — 7A.2 Navigation Continuity

## Intention
La navigation du Studio doit donner l’impression d’un outil natif : le contexte du projet, la topbar et les actions de session restent stables ; seul le contenu utile défile.

## Comportement
- sidebar ancrée sur toute la hauteur du viewport ;
- carte projet stable en haut ;
- navigation centrale seule scrollable si la hauteur manque ;
- dock inférieur permanent avec `Mode démo`, `Relancer la création` et `Déconnexion` ;
- contenu principal avec son propre scroll vertical ;
- topbar sticky dans le contenu ;
- aucun leak visuel de la navigation Pangea dans le Studio ;
- transitions de navigation 140–160 ms, fade + 5 px maximum ;
- reduced motion : pas de translation ni de scroll smooth.

## Règle produit
La fluidité sert la continuité spatiale. Elle ne doit jamais devenir une chorégraphie.
