#!/bin/bash
# Test de régression — contrat de sécurité API (phase Tectonic 2)
# À relancer à chaque modification touchant /api/content ou /api/kpi.
set -e
BASE="http://localhost:3000"

echo "=== anonymous GET /api/content -> 200, faqDrafts absent ==="
BODY=$(curl -s "$BASE/api/content")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/content")
echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'faqDrafts' not in d, 'ECHEC: faqDrafts exposé sans auth'; print('OK — code', '$CODE', '— faqDrafts absent')"

echo "=== authenticated GET /api/content -> 200, faqDrafts présent ==="
TOKEN=$(curl -s -X POST "$BASE/api/admin/login" -H "Content-Type: application/json" -d '{"password":"parella2026"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
BODY=$(curl -s "$BASE/api/content" -H "x-admin-token: $TOKEN")
echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'faqDrafts' in d, 'ECHEC: faqDrafts manquant avec auth'; print('OK — faqDrafts présent')"

echo "=== anonymous GET /api/kpi -> 401 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/kpi")
[ "$CODE" = "401" ] && echo "OK — code $CODE" || (echo "ECHEC — code $CODE attendu 401" && exit 1)

echo "=== authenticated GET /api/kpi -> 200 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/kpi" -H "x-admin-token: $TOKEN")
[ "$CODE" = "200" ] && echo "OK — code $CODE" || (echo "ECHEC — code $CODE attendu 200" && exit 1)

echo ""
echo "=== branding.theme accepte toujours midnight-frost (non-régression) ==="
CONTENT=$(curl -s "$BASE/api/content" -H "x-admin-token: $TOKEN")
echo "$CONTENT" | python3 -c "
import json,sys
d = json.load(sys.stdin)
d['branding']['theme'] = 'midnight-frost'
print(json.dumps(d))
" > /tmp/_regression_payload.json
curl -s -X POST "$BASE/api/content" -H "Content-Type: application/json" -H "x-admin-token: $TOKEN" -d @/tmp/_regression_payload.json > /dev/null
RETHEME=$(curl -s "$BASE/api/content" -H "x-admin-token: $TOKEN" | python3 -c "import json,sys;print(json.load(sys.stdin)['branding']['theme'])")
[ "$RETHEME" = "midnight-frost" ] && echo "OK — theme persisté: $RETHEME" || (echo "ECHEC — theme relu: $RETHEME" && exit 1)

echo ""
echo "TOUS LES TESTS SONT PASSÉS."
