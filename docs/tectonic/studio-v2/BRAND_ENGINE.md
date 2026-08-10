# Tectonic — Brand Engine

## Statut

Contrat actif à partir de Studio V2 / Identity 1A.

## Principe

Le Studio reçoit des **données de marque brutes** : une ou deux couleurs et une ou deux typographies. Il ne demande jamais à l'administrateur de choisir un `accent`, un `ambientAccent`, une teinte de surface ou un mode de palette.

> L'administrateur fournit la marque. Storm décide comment cette marque vit dans l'édition choisie.

Le moteur ne corrige jamais silencieusement une couleur fournie par le client et n'invente jamais une couleur intermédiaire pour rendre une composition plus jolie.

## Module

`public/brand-engine.js` est volontairement dual-runtime : le même fichier peut être chargé par le navigateur (`window.StormBrandEngine`) et par Node (`require`). Cela évite que le Studio et les futurs renderers développent deux interprétations différentes de la même marque.

Le moteur expose notamment :

- normalisation hexadécimale ;
- luminance relative et contraste ;
- conversion OKLCH ;
- analyse neutralité / chroma ;
- classification `MONO_ACCENT`, `TONAL_ACCENT`, `DUAL_ACCENT` ;
- résolution de rôles sémantiques `ink`, `surface`, `accent`, `accentSecondary`, `ambientAccent`.

## Resolver Ivory actuellement gelé

Sur le canvas Ivory `#F7F7F5`, le resolver reste déterministe :

1. primaire chromatique et exploitable → primaire ;
2. sinon secondaire chromatique et exploitable → secondaire ;
3. sinon repli sur l'encre Storm `#1E1D1E`.

Seuil de contraste d'accent : `1.8`, utilisé pour les grands moments expressifs et non comme validation WCAG de texte courant.

Exemples attendus :

- Parella `#1E1D1E` + `#C2AF7E` → accent `#C2AF7E` ;
- Wavestone `#451DC6` + `#04EF6A` → accent `#451DC6` ;
- palette uniquement noire → accent Storm ink, jamais beige inventé.

## Frontière UI

Les analyses OKLCH, ratios de contraste, modes de palette et rôles sémantiques ne sont **pas** des réglages Studio. Ils restent sous le capot.
