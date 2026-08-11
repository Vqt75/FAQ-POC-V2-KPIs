# Tectonic Mood Bridge 8B.1

Port de la météo projet et de la sollicitation comportementale 8B sur le front public Tectonic / Ivory.

- Ivory possède le bouton, le popover et les cinq états.
- `public/mood-engine.js` décide uniquement quand un nudge discret peut apparaître.
- `public/runtime.js` possède `submitMood()` et réutilise `POST /api/kpi/track`.
- `server.js` reste inchangé : il valide déjà les valeurs 1–5 et stocke le ressenti de façon anonyme.
- 25–40 s d'attention active, onglet visible et focalisé, exposition significative, 1,5 s de calme.
- Aucun auto-open ; un seul nudge et une seule réponse par jour et par navigateur.
- `prefers-reduced-motion` supprime la vague.
- Question : « Comment vous sentez-vous par rapport au projet aujourd’hui ? »
- États : Orageux / Nuageux / Couvert / Éclairci / Ensoleillé.

Le renderer repart du Hardening 8A validé, ce qui élimine aussi le token littéral `\\nfunction` qui bloquait l'import ES module et rétablit le rendu sémantique gras/italique/souligné prévu par 8A.
