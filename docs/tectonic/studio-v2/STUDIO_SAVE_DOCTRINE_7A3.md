# Studio V2 — Save Doctrine 7A.3

## Principe

**Autosave protège. Le bouton rassure. Ctrl+S donne le contrôle. Publier engage.**

## Règles d’expérience

- L’enregistrement est local à la rubrique active.
- Il n’existe pas de bouton Enregistrer par sous-section.
- Le bouton de rubrique reste dans le hero.
- Quand ce bouton sort du viewport, un contrôle compact contextuel apparaît dans le dock fixe de la sidebar ; il ne recouvre jamais le contenu.
- `Ctrl+S` / `Cmd+S` déclenche immédiatement le même enregistrement local.
- Un autosave silencieux se déclenche 900 ms après la dernière modification.
- L’autosave ne génère pas de toast de succès et ne rerend pas l’éditeur pendant la frappe.
- La topbar expose l’état : `Modifications en cours` → `Enregistrement…` → `Tout est enregistré`.
- Une erreur devient `Enregistrement impossible` sans faire croire que les données sont sécurisées.
- `Publier` reste une action globale et séparée spatialement de l’enregistrement.

## Identité & apparence

Le bandeau sticky flottant a été retiré : il polluait le champ visuel et pouvait masquer les champs. Le bouton `Enregistrer les réglages` rejoint désormais le hero de la rubrique comme les autres domaines.

## Cible

Le bouton manuel pourra être réévalué plus tard à partir des usages réels. L’autosave n’est pas utilisé comme prétexte pour retirer immédiatement un contrôle rassurant.
