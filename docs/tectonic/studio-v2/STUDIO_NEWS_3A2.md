# Studio V2 — Actualités 3A.2

## Intention

L’éditeur d’actualités reste un outil de rédaction, pas un traitement de texte. Le rédacteur exprime la structure et l’emphase ; Storm conserve la responsabilité de la composition visuelle.

## Interaction texte

- Gras, italique, mise en évidence et lien s’appliquent uniquement à une sélection explicite.
- Sans sélection, les commandes d’emphase ne basculent pas dans un mode persistant : elles refusent calmement l’action.
- Aucune couleur, police, taille, alignement ou style de puce n’est exposé.
- Le collage entrant est nettoyé des styles Word / PowerPoint.

## Insertion média

Le point d’insertion est celui du curseur au moment où `+ Média` est invoqué.

- Au milieu d’un paragraphe, Storm scinde le paragraphe en deux blocs et insère le média entre les deux, en conservant les emphases de texte.
- Dans une liste, Storm sépare la liste autour de l’élément courant lorsque cela est nécessaire.
- Image, galerie et document partagent le même modèle d’insertion.

## Documents PDF

Un PDF est une ressource du projet, pas une pièce jointe technique.

Le Studio demande seulement :
- le fichier PDF ;
- un titre ;
- une description courte facultative.

Storm conserve aussi le nom et le poids du fichier lorsqu’ils sont disponibles.

Dans Ivory, le document apparaît sous forme d’objet éditorial calme avec deux actions :
- `Consulter` ouvre le reader Storm en plein écran applicatif, avec retour explicite à l’article ;
- `Télécharger` reste une action secondaire.

Le reader masque autant que possible le chrome PDF du navigateur et garde seulement le chrome Storm : retour, titre, plein écran optionnel et téléchargement. Le rendu PDF lui-même reste natif au navigateur dans ce POC ; aucune dépendance PDF tierce n’est introduite.

## Limite éditoriale

Une information critique ne doit jamais exister uniquement dans un PDF. L’article porte l’essentiel ; le document apporte le détail.
