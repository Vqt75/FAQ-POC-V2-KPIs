# Studio Questions 5A.1 — hero de domaine commun

## Pourquoi ce correctif

Questions 5A utilisait encore une composition d’ouverture héritée : titre nettement plus grand, introduction plus dense et largeur différente des autres domaines Studio V2. Visuellement, l’onglet semblait appartenir à un autre produit.

## Règle ajoutée

Les domaines Tectonic utilisent désormais une même grammaire d’ouverture via `studio-domain-head` :

- même alignement entre titre, introduction et action d’enregistrement ;
- même échelle du titre en police d’expression ;
- même statut secondaire pour la phrase d’introduction ;
- même largeur de lecture ;
- même comportement responsive ;
- même emplacement de l’action globale d’enregistrement.

Le projet, Actualités, Espaces et Questions utilisent ce composant commun. Les futurs lots Ambassadeurs et Pilotage doivent le réutiliser au lieu de recréer un hero local.

## Copy Questions

L’introduction est raccourcie :

> Renseignez les réponses utiles au projet. Storm reconnaît ensuite les différentes façons dont les collaborateurs peuvent poser la même question.

Elle décrit la tâche de l’utilisateur et la responsabilité du moteur sans devenir un chapeau éditorial.

## Ce qui ne change pas

Ce correctif ne modifie ni le contrat FAQ, ni le moteur de matching, ni la persistence, ni le pipeline de publication. Il s’agit d’un correctif de système visuel Studio.
