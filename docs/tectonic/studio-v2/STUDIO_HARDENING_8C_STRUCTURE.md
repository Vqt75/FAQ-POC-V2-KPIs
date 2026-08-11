# Storm / Tectonic — Studio V2 Hardening 8C — Structure du site

## Intention

Le Studio demande quelles parties du projet doivent apparaître sur le site public. Storm administre ensuite le Manifest.

## Doctrine

- Accueil est toujours visible.
- Le projet, Actualités, Espaces, Questions, Ambassadeurs et Équipe projet peuvent être visibles ou masqués.
- Masquer une rubrique ne supprime jamais son contenu éditorial.
- Enregistrer persiste l'intention dans l'état autoritaire du Studio.
- Publier est le seul geste qui modifie le Manifest servi au public.
- Aucun rôle, droit ou workflow d'approbation n'est introduit : Orogeny reste hors périmètre.

## Architecture

`siteStructure` est persisté dans `data/content.json` via la route existante `POST /api/content`.

`buildPublicationCandidate()` résout cette intention vers les sept booléens `modules` du contrat Manifest. Le Compiler reste inchangé et continue seulement de valider/transformer le Candidate.

Pour les anciens snapshots sans `siteStructure`, le fallback historique est conservé afin qu'installer 8C ne modifie jamais silencieusement le site déjà publié.

## Hors périmètre

- réordonner la navigation ;
- renommer les rubriques ;
- supprimer du contenu ;
- permissions / rôles / workflow ;
- modification du renderer Ivory ;
- modification du Compiler.
