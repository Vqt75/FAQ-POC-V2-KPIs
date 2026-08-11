# Mood Solicitation Engine — 8B

## Doctrine

Le baromètre reste accessible manuellement à tout moment. Storm ne l'ouvre jamais automatiquement.

La sollicitation automatique est seulement un **nudge discret** qui devient éligible lorsque trois conditions sont réunies :

1. **Attention active** : entre 25 et 40 secondes de présence réellement active dans l'expérience.
2. **Exposition significative** : scroll, interaction avec du contenu, ou lecture prolongée.
3. **Moment calme** : aucune saisie en cours, aucun modal ouvert, et une courte pause après le dernier geste.

## Comportement

- une seule sollicitation par jour et par navigateur ;
- une seule vague / ouverture brève du label ;
- si elle est ignorée, Storm n'insiste pas ;
- `prefers-reduced-motion` supprime la vague ;
- le clic sur le bouton reste toujours volontaire ;
- une réponse maximum par jour et par navigateur ;
- aucune question ouverte, aucun commentaire, aucun email, aucun identifiant individuel ;
- question : « Comment vous sentez-vous par rapport au projet aujourd’hui ? » ;
- après réponse : accusé de réception bref, puis fermeture.

## Pilotage

Pilotage continue d'interpréter le climat par **distribution** et **tendance agrégée**, jamais par une moyenne principale de type `3,7/5`.
