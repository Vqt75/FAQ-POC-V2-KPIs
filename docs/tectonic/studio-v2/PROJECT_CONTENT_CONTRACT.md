# Studio V2 — Project Content Contract (2A)

`Le projet` devient le premier domaine éditorial Tectonic réellement structuré par sections sémantiques.

## Principe

> L’utilisateur décrit ce que le contenu est. Storm décide comment il vit.

Le Studio autorise :

- `focus`
- `text`
- `image`
- `gallery`
- `quote`
- `keyFigures`
- `timeline`
- `choices`
- `team`

Il n’autorise aucun choix de colonnes, largeur, fond, parallax, alignement ou composition publique.

## État autoritaire

```text
project
  intro
    title
    body
  sections[]
    id
    type
    ...contenu propre au type
```

`timeline` et `team` sont des marqueurs : leurs données restent respectivement dans `milestones[]` et `team[]`. Il n’existe donc qu’une seule source de vérité pour les étapes et les personnes.

`timeline` et `team` ne peuvent apparaître qu’une seule fois dans `project.sections[]`.

## Pipeline Tectonic

```text
content.json
  project + milestones + team
        ↓
buildPublicationCandidate()
        ↓
Publication Candidate
        ↓
compile()
        ↓
manifest.content.project
        + manifest.content.timeline
        + manifest.content.team
        ↓
Ivory
```

Le Manifest V1 conserve temporairement le module historique `timeline` comme ancre du domaine public `Le projet`. `content.project` est une extension sémantique compatible : Ivory l’utilise en priorité, avec son fallback historique uniquement si la donnée explicite est absente.

## Migration

Quand un ancien `content.json` ne possède pas `project`, Node fournit la structure éditoriale fallback déjà validée côté Ivory. Rien n’est écrit sur disque tant que l’administrateur n’enregistre pas. À la première sauvegarde, la donnée devient explicitement autoritaire.

## Équipe projet

Le champ historique `badge` reste conservé pour compatibilité, mais n’est plus borné à `XYZ` / `Parella`. Studio l’expose comme « Organisation ou équipe », afin de rester white-label.
