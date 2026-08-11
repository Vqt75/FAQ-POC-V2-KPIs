# Studio Pilotage 7A

## Intention

Pilotage n’est pas un dashboard de performance marketing. C’est le lieu où l’équipe projet écoute ce que le site lui apprend.

La page répond à quatre questions :

1. Le site est-il utilisé ?
2. Les collaborateurs trouvent-ils ce dont ils ont besoin ?
3. Qu’est-ce qui attire l’attention ?
4. Comment le projet est-il vécu ?

## Principes UX

- aucune moyenne du climat du projet ;
- les ressentis restent une distribution ;
- une tendance récente n’est affichée qu’à partir de 5 contributions ;
- les consultations ne sont pas présentées comme une compétition entre contenus ;
- les recherches Storm Match sans réponse deviennent des actions éditoriales ;
- `Créer une réponse →` ouvre Questions et préremplit la formulation recherchée ;
- les données sont présentées comme agrégées, jamais comme une mesure individuelle ;
- aucune action d’enregistrement n’est nécessaire : Pilotage est une surface de lecture/analyse.

## Données existantes

7A réutilise les signaux déjà disponibles dans `/api/kpi` :

- `visitSessions` ;
- `tabViews` ;
- `articleOpens` ;
- `faqAsked` ;
- `moodEntries` ;
- `contactSubmissions`.

Aucun nouveau tracking n’est introduit par ce lot.

## Storm Match

Les questions comprises sont regroupées par réponse correspondante (`entryId`) plutôt que par formulation littérale. Les recherches sans réponse sont regroupées par formulation normalisée et deviennent des opportunités éditoriales.

## Climat

Le climat n’est plus ramené à un score `/5`. La vue montre les cinq états et, lorsque le volume le permet, la distribution des sept derniers jours.

Ce lot ne prétend pas expliquer pourquoi le climat évolue et n’établit aucun lien causal avec les événements du projet.

## Export

L’export Excel reste disponible mais adopte le vocabulaire Pilotage, utilise le nom réel du projet et ajoute une feuille `Climat du projet`.
