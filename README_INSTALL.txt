Storm Studio V2 — Questions 5A.3
Storm Match chrome card

Contenu du micro-pack
- docs/tectonic/studio-v2/STUDIO_QUESTIONS_5A3.md
- public/studio-v2/storm-match-chrome-card.css
- patches/questions_5a3_html_snippet.html
- patches/questions_5a3_integration_guide.md

Objectif
- Supprimer les filets gris autour du bloc Storm Match
- Le transformer en cartouche produit distinctif
- Lui donner une matière légèrement chromée / nacrée / verre givré
- Ne pas modifier le contenu ni le comportement de Questions / Storm Match

Installation (manuelle)
1. Ouvrez votre repo local.
2. Ajoutez le contenu du fichier CSS dans votre feuille Studio V2 / Questions, ou importez directement public/studio-v2/storm-match-chrome-card.css.
3. Remplacez le markup actuel du bloc Storm Match par le snippet fourni dans patches/questions_5a3_html_snippet.html.
4. Vérifiez qu'aucun filet gris séparateur n'encadre encore le bloc.
5. Rebuild / refresh du back-office.

QA visuelle attendue
- Le bloc Storm Match se détache des autres surfaces.
- Il a un fond plus froid / nacré que les autres cartes.
- Le badge ENGINE est plus intégré.
- Aucun effet tape-à-l'oeil.
- Le bloc n'est pas confondu avec un simple séparateur.
