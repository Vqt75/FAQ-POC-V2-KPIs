# Spaces Content Contract — Tectonic Studio V2

```text
spaces[]
  id
  name
  location?
  status: designing | approved | delivered
  description
  usages[]
  media[]
    id
    kind: view | plan | document
    url
    label?
    alt?
```

## Invariants

1. `spaces` est une collection sémantique de lieux, pas de fichiers.
2. Un média appartient à un espace et reçoit un rôle d’usage, jamais un style.
3. Les usages décrivent ce qu’un collaborateur peut faire dans le lieu.
4. Un espace peut exister sans média.
5. Un média peut être une image ou un PDF ; son format ne décide pas seul de
   son rôle (un PDF peut par exemple être un plan à explorer).
6. Le public renderer reste libre de composer la collection selon l’édition.
