# Ivory v2 — Foundation + Home

First Experience v2 UI increment. This is deliberately renderer-side only except for the POC admin bridge in `index.html`.

## Implemented

- Ivory foundation tokens, 12-column composition, responsive spacing and typography roles.
- Client font families consumed from `manifest.branding.fonts`; Storm defaults remain Roboto + Italiana.
- Sticky breathing header, responsive menu, active navigation state.
- POC-only `Administration` entry linking to `/?pangea=1&admin=1`.
- Pangea understands `admin=1` and opens the existing auth wall/admin directly.
- Home rebuilt as a present-first editorial composition: current state, next milestone, featured content, non-duplicate latest news, Questions exit.
- Footer signature: `Powered by Storm · Tectonic 2.1`.
- Hash-based page switching removes the legacy one-pager feel without changing Manifest v1 or server routes.
- Ivory reveal motion + compacting header + reduced-motion support.
- Existing FAQ, contact, plan filters/lightbox, article, ambassador/team behaviours preserved.

## Intentionally not solved in this increment

- New Experience v2 content model / Manifest schema.
- Dedicated editable home headline/current-state fields. Schema v1 has no such upstream fields; renderer uses `home.message` when present and a neutral fallback otherwise.
- Dedicated `/le-projet`, `/actualites/...`, `/espaces/...` server routes. Hash routing is a UI bridge for the POC.
- Final Experience v2 treatment for Project, News, Spaces, Questions, Ambassadors. Their old functional markup remains, with only foundation-level styling.
- Weather prompt, analytics, uploads, publishing plumbing, auth redesign.

## Architecture invariant

The Manifest continues to carry semantic data only. No Ivory layout instructions were added to Candidate, Compiler, Manifest or Runtime.
