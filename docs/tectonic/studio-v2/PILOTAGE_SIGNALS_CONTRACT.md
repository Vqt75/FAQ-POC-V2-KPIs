# Pilotage — Signals Contract 7A

Pilotage 7A est une couche d’interprétation de signaux existants, pas une nouvelle source de vérité.

## Usage
- consultations uniques : nombre de sessions distinctes ;
- consultations de rubriques : somme des vues par rubrique ;
- ouvertures d’actualités : somme des ouvertures par article.

## Information / Storm Match
- questions posées : événements `faqAsked` ;
- réponse trouvée : `matched === true` ;
- sujet sollicité : regroupement des matchs par `entryId` ;
- information à compléter : regroupement des non-matchs par formulation normalisée.

## Attention
Les répartitions de vues sont des signaux d’intérêt. Elles ne doivent pas être décrites comme un classement de performance éditoriale.

## Climat
- données : `moodEntries[]` ;
- affichage principal : distribution 1..5 ;
- aucune moyenne ;
- affichage récent : fenêtre glissante de 7 jours ;
- seuil de confidentialité de présentation : au moins 5 contributions récentes.

## Actions
Un gap FAQ peut déclencher `Créer une réponse →`. Cette action ouvre l’éditeur Questions et préremplit uniquement la question canonique. Elle ne crée ni ne publie automatiquement une réponse.
