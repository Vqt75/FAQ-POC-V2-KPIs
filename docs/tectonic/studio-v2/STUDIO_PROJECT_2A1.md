# Studio V2 — Le projet 2A.1

Refinement du premier vertical slice contenu à partir du test utilisateur du POC.

## Décisions UX

- La page ne démarre plus par une composition libre.
- Une structure recommandée de neuf typologies est proposée dans un ordre cohérent.
- Sept sections sont actives par défaut ; Image et Galerie sont proposées mais désactivées.
- Une section se masque avec un interrupteur sans perdre son contenu.
- Les sections se réordonnent avec une poignée de déplacement ; les flèches restent disponibles dans le détail comme solution de repli.
- L'ouverture reste fixe et toujours publiée.
- Le wording d'introduction devient : « Rassemblez les éléments qui racontent le projet ; Storm se charge de leur donner la bonne forme dans l’édition publiée. »
- Le POC est pré-rédigé autour d'un projet immobilier fictif en flex office.
- L'interface Équipe projet utilise une vraie zone photo avec drag & drop + parcours de fichiers et des champs explicitement labellisés.

## Contrat de publication

`project.sections[].enabled` appartient à l'état autoritaire du Studio. Le Compiler filtre les sections `enabled:false` lors de la génération du Manifest. Désactiver une section n'efface donc ni son contenu ni sa position dans le Studio.

## Migration 2A → 2A.1

- Image et Galerie sont ajoutées désactivées aux projets 2A qui ne les possèdent pas encore.
- Les textes exacts du contenu de démonstration 2A sont enrichis vers la version flex-office 2A.1.
- Tout texte déjà modifié par un utilisateur est conservé tel quel.
