# Studio V2 — Actualités 3A.1

## Statut
Vertical slice Actualités enrichi : éditeur riche sémantique + médias inline.

## Doctrine
L’auteur exprime la structure et l’emphase ; Storm garde la maîtrise de la mise en forme.

Autorisé dans le corps d’article :
- paragraphe ;
- intertitre ;
- gras ;
- italique ;
- mise en évidence sémantique ;
- lien ;
- liste à puces ;
- liste numérotée ;
- image inline ;
- galerie inline ;
- document PDF inline.

Volontairement absent :
- couleurs ;
- choix de surlignage ;
- polices ;
- tailles ;
- alignements ;
- styles de puces ;
- HTML arbitraire ;
- embeds vidéo externes dans cette passe.

## Modèle
`articles[].contentBlocks[]` porte la structure éditoriale. Les paragraphes/intertitres et items de listes contiennent des `runs` :

```js
{ text, bold?, italic?, highlight?, href? }
```

Les médias sont des blocs dédiés (`image`, `gallery`, `document`).

`body` reste généré en parallèle comme compatibilité Pangea pendant la coexistence ; il n’est plus la source riche de référence.

## Sécurité / robustesse
- les liens sont bornés à `http(s)`, `mailto`, chemins internes et ancres ;
- le collage depuis Word/PowerPoint est réduit à du texte simple ;
- aucun style/couleur entrant n’est persisté ;
- Node normalise les blocs avant persistence ;
- le Compiler re-normalise la projection riche avant Manifest ;
- Ivory rend les blocs et décide seul de leur apparence.

## Save / Publish
Pas d’autosave dans 3A.1. Le backlog global Autosave reste inchangé : un bouton d’enregistrement du domaine + publication explicite.
