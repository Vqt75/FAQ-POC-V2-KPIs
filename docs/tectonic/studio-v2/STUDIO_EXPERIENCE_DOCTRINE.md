# Storm Studio Experience V2 — Doctrine

Statut : **contrat de fondation — Tectonic**

## 1. Rôle du produit

Storm Studio n'est ni un CMS générique ni un constructeur de pages.

Son utilisateur principal est un consultant ou un membre de l'équipe projet qui connaît le projet, mais qui peut ne rien connaître aux CMS, à la publication web, aux Manifest, aux design systems ou aux outils de communication.

Principe directeur :

> **L'utilisateur décrit ce qui est vrai du projet. Storm administre le site.**

Principe miroir côté public :

> **L'administrateur dit ce que c'est. L'édition décide comment ça vit.**

## 2. La complexité appartient au système

Le Studio n'expose pas un concept simplement parce qu'il existe dans le modèle de données.

Restent sous le capot :
- champs du Manifest ;
- renderers ;
- règles de mise en page ;
- colonnes, marges, effets ;
- scores et seuils FAQ ;
- rôles média internes ;
- résolution des rôles de couleur ;
- construction du Publication Candidate ;
- plomberie télémétrique ;
- pondérations de recommandation ;
- seuils comportementaux de sollicitation.

Le Studio n'expose un choix que si l'utilisateur possède réellement cette décision.

Choix légitimes :
- cette information est confirmée / susceptible d'évoluer / en cours de définition ;
- ce média est une vue à regarder / un plan à explorer / un document à consulter ;
- le contact direct des ambassadeurs est autorisé ;
- l'appel à ambassadeurs est ouvert ;
- la météo du projet est activée.

Choix illégitimes dans l'interface :
- `status = waiting` ;
- `mediaKind = inspectable-document` ;
- `accentSecondary` ;
- `delayMs = 27000` ;
- `layout = 8 columns right`.

## 3. Règles d'expérience

### 3.1 L'intention avant la structure
Le Studio part des tâches réelles : ajouter une actualité, modifier une étape, créer un espace, répondre à une question, ajouter un ambassadeur.

### 3.2 Le même vocabulaire que le site
Si la destination publique s'appelle `Espaces`, sa destination Studio s'appelle `Espaces`.

### 3.3 Progressive disclosure
Les options avancées ou conditionnelles n'apparaissent qu'au moment où elles deviennent pertinentes.

### 3.4 Édition sémantique, pas construction de page
L'utilisateur choisit le sens du contenu. L'édition Storm possède la composition.

### 3.5 Travailler n'est pas publier
Enregistrer protège le travail. Publier le rend visible aux collaborateurs. Ce sont deux concepts et deux actions distincts.

### 3.6 Sûr sans être anxiogène
Aperçu, états clairs, réversibilité quand elle est possible et avertissements contextuels priment sur les modales et les messages alarmistes.

### 3.7 Les tâches courantes ne doivent pas nécessiter de formation
Si un consultant projet compétent ne peut pas accomplir une tâche fréquente sans formation CMS, l'hypothèse par défaut est que l'UX du Studio doit être améliorée.

## 4. Personas de review

Ces personas sont des lentilles de conception, pas des personnes réelles du produit.

- **Anna — Human Experience** : charge cognitive, progressive disclosure, comportement, compréhension.
- **Max — Language & Content Design** : wording, hiérarchie, langage naturel, clarté éditoriale.
- **John — Systems Architecture** : source de vérité, contrats, persistance, publication, résilience, migration.
- **Clara — Actual User** : consultante / PMO, très à l'aise avec le travail projet mais pas spécialiste CMS.
- **Maya — Service & Operations** : continuité dans le temps, reprises, handoffs, robustesse des workflows.

Protocole de décision :

> Anna demande si le choix appartient à l'utilisateur. Max décide comment il se comprend. John décide comment Storm le porte durablement. Clara vérifie qu'il peut être réalisé sous pression projet. Maya vérifie qu'il tient dans le temps.

## 5. Frontière Tectonic / Orogeny

### Tectonic couvre
- création et paramétrage initial ;
- identité et apparence ;
- contenus ;
- aperçu ;
- sauvegarde / brouillon ;
- publication ;
- médias ;
- Pilotage / analytics ;
- intelligence FAQ ;
- météo du projet ;
- recommandations de contenu déterministes ;
- migration Manifest/runtime Tectonic.

### Orogeny couvrira plus tard
- gestion des utilisateurs ;
- rôles ;
- permissions granulaires ;
- droits d'édition ;
- droits de publication ;
- workflows d'approbation ;
- gouvernance des accès ;
- modèles multi-équipes.

Tectonic ne doit pas bloquer Orogeny, mais ne doit pas pré-construire Orogeny.

## 6. Éléments de démonstration conservés pendant Tectonic

Deux capacités internes restent volontairement disponibles pendant la phase de développement/démonstration :

1. le sampler Wavestone des éditions/thèmes dans Identité & apparence ;
2. le raccourci permettant de relancer la démo de création initiale du site.

Ils sont utiles pour les démonstrations COMEX / collègues. Le raccourci de relance est explicitement **hors produit final**.
