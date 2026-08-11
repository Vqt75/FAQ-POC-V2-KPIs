# Tectonic Mood Nudge — 8B.2

Targeted recovery after 8B.1 visual QA.

Fixes:
- the halo no longer lives in a pseudo-element clipped by the pill's `overflow:hidden`;
- focus state is repaired by real page interaction and paused on window blur;
- a nudge is persisted only after the renderer confirms that the visual cue was applied;
- reduced-motion still suppresses the pulse;
- questionnaire opening remains strictly manual.

No backend, KPI schema, FAQ, Manifest, Pilotage or publication changes.
