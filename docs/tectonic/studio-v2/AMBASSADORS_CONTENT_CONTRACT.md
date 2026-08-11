# Ambassadors content contract — Tectonic 6A.1

Authoritative saved state stays compatible with the existing `ambassadorsContent` + `ambassadors[]` shape while moving contact semantics to the individual ambassador.

`ambassadorsContent`: `introTitle`, `introBody`, `rosterLabel`, `contactEnabled`, `joinEnabled`, `joinMode`, `joinTitle`, `joinBody`, `joinLabel`, `joinHref`. Legacy `contactDestination` / `contactLabel` remain tolerated for migration but are no longer edited by Studio V2.

`ambassadors[]`: `id`, `name`, `role`, `tag`, `imageUrl`, `contactable`, `contactChannel`, `contactValue`.

Contact model:
- `ambassadorsContent.contactEnabled` is the network-level permission to expose direct contact.
- `contactable` is the individual opt-in / opt-out.
- `contactChannel` is `email`, `teams`, or `link`.
- `contactValue` stores the address or link entered by the project team.
- the Compiler resolves a safe public `contactHref` and generates the label `Contacter <prénom>`.

The Manifest exposes `content.ambassadors.intro`, `contact`, `join`, and `roster`. The network contact never needs a shared destination: Ivory already consumes each roster item's `contactHref` / `contactLabel`.
