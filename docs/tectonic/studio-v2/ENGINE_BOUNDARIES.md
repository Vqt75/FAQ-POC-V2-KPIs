# Storm Tectonic — Frontières des engines

Statut : **carte d'architecture de fondation**

Storm V2 comporte plusieurs formes d'intelligence produit. Elles doivent vivre dans des moteurs/services indépendants, pas dans des heuristiques enfouies dans les composants UI.

## 1. Brand Engine

Rôle :
- analyser les couleurs de marque brutes ;
- déterminer le mode sémantique de marque ;
- résoudre les rôles accent / accent secondaire / ambient accent selon l'édition.

Entrée : identité brute + contexte d'édition.
Sortie : rôles sémantiques.

Le Studio édite l'identité brute. Il n'édite jamais les rôles visuels résolus.

Le sampler Wavestone et les éditions publiques doivent à terme utiliser le même resolver.

## 2. FAQ Engine

Le moteur Pangea actuel de matching/scoring reste autoritaire tant qu'une révision explicite n'est pas décidée.

Langage Studio :
- Question ;
- Réponse ;
- État de l'information ;
- Autres façons de poser cette question.

Le moteur interne peut conserver normalisation, phrases, keywords, signaux, priorité, seuils et scores.

Le Studio n'affiche pas de pourcentages de confiance ou de scores techniques.

## 3. FAQ Coverage / Gap Analyzer

Rôle :
- agréger les recherches non résolues ou à faible confiance ;
- rapprocher les formulations similaires de façon déterministe ;
- faire remonter des manques actionnables dans Pilotage.

Exemple :

```text
12 recherches autour de « parking visiteurs »
Créer une réponse →
```

Le moteur recommande une action éditoriale. Il ne crée jamais automatiquement une réponse officielle.

## 4. Recommendation Engine

Rôle :
- alimenter `Lire aussi` ;
- proposer un fallback de contenu mis en avant quand aucune curation explicite n'existe ;
- plus tard, faire émerger des opportunités éditoriales utiles.

Signaux possibles :
- proximité thématique ;
- phase projet ;
- relations déclarées ;
- fraîcheur ;
- importance éditoriale ;
- consultations ;
- exclusion des contenus déjà lus / obsolètes.

La curation humaine explicite prime toujours sur l'automatique.

Aucun objectif de clickbait ou de rétention addictive.

## 5. Mood Solicitation Engine

Rôle : déterminer si et quand la météo peut faire une invitation subtile sur le site public.

Entrées possibles :
- fonction activée / suspendue ;
- réponse déjà donnée selon la règle de mesure ;
- exposition significative au contenu ;
- lecture/interaction active ;
- moment comportemental calme ;
- préférence reduced-motion.

Le Studio ne règle pas les seuils bas niveau.

## 6. Mood Analytics

Rôle :
- agréger les valeurs anonymes ;
- restituer distribution et tendance longitudinale ;
- contextualiser avec les événements projet sans revendiquer une causalité.

Éviter de réduire le climat à un pseudo-score principal `3,7/5`.

## 7. Signals Layer

Architecture cible :

```text
Telemetry / signaux opérationnels
             ↓
        Signals Layer
             ↓
FAQ gaps · attention contenus · tendances météo · opportunités éditoriales
             ↓
          Pilotage
```

Les signaux produisent des suggestions. Ils ne modifient jamais seuls le contenu officiel.
