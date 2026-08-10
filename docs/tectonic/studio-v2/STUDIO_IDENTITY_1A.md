# Studio V2 — Identity & Appearance 1A

## But du lot

Premier vertical slice métier de Tectonic Studio V2. Il transforme l'ancien écran `Identité & textes` en un domaine d'administration cohérent, sans déplacer de contenu éditorial dans la configuration.

## Expérience

`Identité & apparence` contient désormais uniquement :

1. **Projet** — nom et logo ;
2. **Identité visuelle** — police principale, police d'expression facultative, couleur principale, couleur secondaire facultative ;
3. **Édition Storm** — édition utilisée, aperçu du projet et comparaison volontaire avec les autres éditions.

Les anciens `Textes du site` quittent cet écran. Ils seront absorbés par les domaines éditoriaux concernés pendant leurs vertical slices respectives.

Changer Ivory / Rainbow Glass / Midnight Frost n'est plus présenté comme un simple sélecteur de thème permanent : l'édition courante est montrée d'abord, et l'utilisateur demande explicitement à voir les autres éditions.

La démo Wavestone reste disponible pour les démonstrations internes.

## Sauvegarde / publication

`Enregistrer les réglages` sauvegarde dans l'Authoritative Project State. La topbar recalcule ensuite l'état de publication. Rien ne devient public sans l'action globale `Publier`.

## Typographies : dette fermée

Avant 1A, une police pouvait être prévisualisée localement dans le Studio mais n'était pas réellement persistée. Le Compiler bloquait donc à raison toute publication contenant `source: "upload"`.

1A ferme le circuit :

`fichier police -> /api/admin/upload -> /uploads/<nom opaque> -> branding.fonts[].assetUrl -> Compiler -> Manifest branding.fonts.*.asset -> @font-face Ivory`

Formats acceptés : WOFF2, WOFF, TTF, OTF. Le serveur ne persiste un `assetUrl` de police que s'il commence par `/uploads/`.

## Couleurs

Les couleurs saisies restent brutes. Une palette à une seule couleur ne reçoit plus automatiquement un secondaire beige au moment de la compilation : le secondaire compilé reprend la couleur unique. Le Brand Engine choisit les rôles visuels sans réécrire l'identité.

## Hors scope

- rôles et permissions (Orogeny) ;
- refonte des contenus `Le projet`, `Actualités`, `Espaces`, `Questions`, `Ambassadeurs` ;
- nouvelle édition publique ;
- gestion avancée des variantes de fontes (graisses, italique, variable fonts).
