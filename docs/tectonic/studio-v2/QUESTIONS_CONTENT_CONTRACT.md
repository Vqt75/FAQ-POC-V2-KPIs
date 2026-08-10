# Questions — contrat sémantique Tectonic

La structure de stockage reste volontairement compatible avec le moteur FAQ historique pendant la strangulation de Pangea.

```text
faqEntries[]
  id
  title               // question canonique
  answer              // réponse disponible aujourd’hui
  status              // confirmed | partial | waiting
  statusLabel         // dérivé par Storm, jamais libre
  category            // classement secondaire
  note                // précision facultative
  phrases[]           // formulations humaines alternatives, éditables

  keywords[]          // signaux moteur historiques, cachés dans Studio
  intentSignals[]     // signaux moteur, cachés
  emotionSignals[]    // signaux moteur, cachés
  negativeSignals[]   // signaux moteur, cachés
  priority            // signal moteur, caché
```

## Principe de propriété

Studio édite la vérité métier et les formulations humaines. Le moteur FAQ conserve la responsabilité des heuristiques de matching. Le Compiler transporte les signaux existants sans les exposer à l’utilisateur.

## Libellés de statut

- `confirmed` → `Information confirmée`
- `partial` → `Information susceptible d’évoluer`
- `waiting` → `Information en cours de définition`

Ces libellés sont dérivés du statut afin d’éviter des états contradictoires ou hérités de l’ancien CMS.
