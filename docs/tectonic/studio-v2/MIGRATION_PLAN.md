# Storm Studio V2 — Plan de migration Tectonic

Statut : **séquence de travail**

## Principe

Pas de big-bang rewrite.

Studio V2 se construit en vertical slices sur une fondation stable. Les mécanismes Pangea existants restent actifs jusqu'à ce que leur remplacement soit validé de bout en bout.

## Lot 0 — Studio Foundation

### 0A — Contrats & statut de publication
- doctrine ;
- architecture de l'information ;
- frontière de l'état autoritaire ;
- contrat save/publish ;
- frontières des engines ;
- contrat analytics ;
- service admin-only de statut de publication.

### 0B — Shell Studio
- sidebar/topbar V2 ;
- état de sauvegarde persistant ;
- statut de publication ;
- actions Aperçu / Publier ;
- Vue d'ensemble minimale fondée sur le vrai statut ;
- conservation du sampler Wavestone et du raccourci de relance de démo.

Aucun éditeur métier n'est migré uniquement pour homogénéiser visuellement le shell pendant 0B.

## Vertical slices après la fondation

1. **Identité & apparence**
   - éditeur identité ;
   - framing du choix d'édition ;
   - sampler Wavestone conservé ;
   - extraction du Brand Engine / resolver partagé.

2. **Le projet**
   - sections sémantiques typées ;
   - grandes étapes ;
   - équipe projet ;
   - ordre/réordonnancement ;
   - contrat project content.

3. **Actualités**
   - éditeur rédactionnel ;
   - médias ;
   - hooks futurs de recommandation.

4. **Espaces**
   - vraies entités `space` ;
   - rôles média ;
   - fin des inférences sur le legacy `plans[]`.

5. **Questions**
   - authoring humain ;
   - moteur de matching conservé ;
   - formulations alternatives ;
   - intégration des gaps Pilotage.

6. **Ambassadeurs**
   - roster ;
   - contactabilité optionnelle ;
   - recrutement optionnel ;
   - soumissions opérationnelles.

7. **Pilotage**
   - nouvelle grammaire dashboard ;
   - gaps FAQ actionnables ;
   - météo : configuration + résultats ;
   - intégration Signals Layer.

8. **Hardening / cleanup**
   - migration des derniers champs legacy ;
   - retrait des écrans/adaptateurs obsolètes ;
   - accessibilité ;
   - responsive QA ;
   - régressions/sécurité ;
   - préparation du cutover Tectonic.

## Migration Node

Extraction progressive uniquement.

À mesure que les domaines mûrissent, les responsabilités peuvent sortir de `server.js` vers :

```text
server/
  content-store.js
  publication-service.js
  telemetry-service.js
  media-service.js
```

Ne pas réécrire Node uniquement pour l'élégance avant qu'une vertical slice n'ait besoin de cette extraction.

## Discipline Git

Branche recommandée :

```text
tectonic-studio-v2
```

Commit par lot ou vertical slice validé. La baseline Ivory V2 validée doit rester facilement récupérable.
