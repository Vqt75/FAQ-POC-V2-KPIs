# Studio V2 — Questions 5A

## Intention

L’éditeur Questions doit permettre à une équipe projet de dire trois choses simplement :

1. ce que les collaborateurs cherchent à savoir ;
2. ce que le projet peut répondre aujourd’hui ;
3. à quel point cette information est stabilisée.

Le moteur FAQ reste responsable de la recherche, du scoring et des signaux techniques. Aucun score, seuil, mot-clé technique ou réglage d’algorithme n’est exposé dans Studio.

## Surface Studio

Une question expose :

- `Question`
- `Que peut-on répondre ?`
- `Cette information est…`
  - Confirmée
  - Encore susceptible d’évoluer
  - En cours de définition
- `Autres façons de poser cette question`
- `Thématique` (secondaire)
- une précision complémentaire facultative, en divulgation progressive.

Les formulations alternatives alimentent `phrases[]`, un signal fort déjà compris par le moteur FAQ Pangea/Ivory. Les anciens `keywords`, `intentSignals`, `emotionSignals`, `negativeSignals` et `priority` restent conservés mais deviennent des détails moteur non éditables dans la tâche courante.

## Import Word

L’import Word produit des éléments « À vérifier ». Ils ne disposent plus d’une action locale appelée « Publier » : l’utilisateur les vérifie puis les **ajoute aux questions du projet**. Le geste public reste le bouton global `Publier` du Studio.

## Save / Publish

5A conserve le modèle transitoire actuel : un bouton global `Enregistrer les questions`. L’autosave global est au backlog. La publication reste un geste distinct dans la topbar.
