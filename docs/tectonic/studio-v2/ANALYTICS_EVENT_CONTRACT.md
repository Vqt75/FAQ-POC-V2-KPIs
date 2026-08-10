# Storm Tectonic — Contrat Analytics & Signals

Statut : **direction de fondation ; les schémas d'événements restent versionnables**

## 1. Rôle de Pilotage

Pilotage n'est pas un dashboard de vanity metrics.

Il répond à quatre questions :
1. Les collaborateurs utilisent-ils l'espace ?
2. Trouvent-ils ce dont ils ont besoin ?
3. Comment le projet est-il vécu ?
4. Y a-t-il une action que l'équipe projet devrait entreprendre ?

## 2. Télémétrie existante utile

La plomberie Pangea/Tectonic possède déjà des signaux pour :
- visites ;
- vues par destination ;
- recherches FAQ et résultat de matching ;
- ouvertures d'articles ;
- valeurs météo ;
- demandes de contact (opérationnelles, pas analytics passives).

Ce sont des actifs de migration à préserver.

## 3. Frontière des classes de données

### Télémétrie
Événements passifs / comportementaux agrégés.
Exemples : visite, vue destination, résultat de recherche FAQ, ouverture article, météo anonyme.

### Soumissions opérationnelles
Informations qui attendent une action humaine.
Exemples : demande de contact, demande pour devenir ambassadeur.

Les soumissions opérationnelles ne doivent pas être fondues dans les analytics anonymes simplement parce qu'elles apparaissent dans le même écran Pilotage.

## 4. Familles de lecture Pilotage

### Audience
- visites / visiteurs actifs lorsque la mesure est techniquement fiable ;
- retour lorsque la mesure est techniquement fiable ;
- consultations par destination.

### Questions
- volume de recherches ;
- résolues vs non résolues ;
- gaps récurrents ;
- action `Créer une réponse`.

### Attention aux contenus
- ouvertures d'actualités / attention utile ;
- aucun vocabulaire gamifié de performance éditoriale.

### Climat du projet
- volume de réponses ;
- distribution des cinq états ;
- tendance dans le temps ;
- contexte optionnel d'événements projet.

### Demandes
- messages opérationnels à traiter.

## 5. Anti-patterns

Ne pas :
- qualifier automatiquement une destination utilitaire peu consultée de sous-performante ;
- inférer une causalité à partir de la coïncidence entre météo et événement projet ;
- afficher une précision que la méthode de mesure ne permet pas ;
- identifier les réponses anonymes à la météo ;
- optimiser la communication projet pour de l'engagement addictif.
