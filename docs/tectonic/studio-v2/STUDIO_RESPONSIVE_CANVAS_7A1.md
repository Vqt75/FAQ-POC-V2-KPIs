# Studio V2 — Responsive Canvas 7A.1

## Problème
Le shell pouvait produire un scroll horizontal global sur certains laptops, niveaux de zoom navigateur ou configurations de scaling Windows. La sidebar et l’éditeur ne restaient alors plus visibles simultanément.

## Règle
Le Studio ne doit jamais demander un déplacement horizontal global pour utiliser un domaine. La sidebar et le domaine actif appartiennent à un même canvas.

## Correction
- sidebar et gouttières rendues fluides ;
- `min-width: 0` posé aux frontières des grilles/flex ;
- médias et champs bornés à leur conteneur ;
- colonnes métier proportionnelles aux largeurs desktop intermédiaires ;
- aperçu FAQ repoussé sous l’éditeur quand trois colonnes deviennent trop serrées ;
- conservation de la recomposition mobile sous 900 px.

## Principe
Responsive peut recomposer, jamais obliger l’utilisateur à chercher une partie de l’interface hors écran.
