# PANGEA — État figé de référence

Ce document capture l'état du POC Storm juste avant le début de la
refonte architecturale **Tectonic**. Il sert de comportement de
référence : toute nouvelle architecture doit reproduire ces parcours
et respecter ces invariants avant de les améliorer.

Tag Git associé : `pangea-freeze`

---

## 1. Parcours critiques (à ne jamais casser)

### Site public
1. Un collaborateur arrive sur `/`, atterrit sur la page FAQ.
2. Il pose une question (recherche libre ou suggestion) → une réponse
   s'affiche, ou un message "réponse indisponible" avec formulaire de
   contact.
3. Il navigue entre les 5 onglets (FAQ, Actualités, Plans & 3D,
   Ambassadeurs, Équipe projet) sans rechargement de page.
4. Il peut répondre au baromètre météo (bouton flottant, 1 réponse/jour).
5. Il peut soumettre le formulaire de contact.

### Administration
1. Connexion via mot de passe (`/api/admin/login`) → jeton de session.
2. Dashboard : KPI agrégés (questions posées, taux de réponse,
   consultations, climat du projet, demandes de contact).
3. Édition de l'identité (nom, logo, couleurs, thème) → aperçu en
   direct → sauvegarde.
4. Édition FAQ (liste → édition → aperçu), import Word, brouillons.
5. Édition Planning & Actus (jalons, articles) avec avancement
   auto-calculé.
6. Édition Ambassadeurs & Équipe, Plans & 3D (upload image/PDF).
7. Bascule de thème (Ivory / Rainbow Glass / Midnight Frost) → aperçu
   en direct dans l'admin → sauvegarde → application réelle sur le
   site public au rechargement.

### Démo de présentation (Storm Showcase)
1. Accessible via le bouton "Démo de création" dans la sidebar admin,
   `?stormDemo=1`, ou `Alt+D`.
2. Parcours : intro → langue → identité → visite des rubriques → écran
   final. Purement cosmétique, ne modifie jamais `content.json`.

---

## 2. Invariants fonctionnels

- **Aucune visibilité critique ne dépend d'un `requestAnimationFrame`
  isolé.** Toute apparition/disparition doit être pilotée par l'API
  Web Animations (séquencée par promesses) ou par une transition CSS
  déclenchée par un attribut simple (`[hidden]`). *(Deux régressions
  réelles ont eu cette cause exacte durant le développement du POC.)*
- **Le contenu ne dépend jamais du thème choisi.** Changer de thème ne
  doit jamais modifier `publicContent`, `faqEntries`, `milestones`,
  `articles`, `ambassadors`, `team` ou `plans`.
- **`normalizeBranding()` doit explicitement lister chaque valeur de
  thème valide.** Toute nouvelle édition ajoutée sans mise à jour de
  cette fonction est silencieusement ramenée à `'default'` — bug réel
  rencontré avec l'ajout de `midnight-frost`.
- **Le baromètre météo est anonyme par construction.** Aucun
  identifiant de session, IP ou autre n'est jamais associé à une
  entrée `moodEntries` — seule la valeur (1–5) et l'horodatage sont
  conservés.
- **Les uploads sont strictement limités** : PNG/JPEG/PDF uniquement,
  8 Mo maximum, noms de fichiers générés côté serveur (jamais le nom
  d'origine du client).
- **`content.json` et `kpis.json` sont rétrocompatibles.** Toute
  lecture passe par des fonctions `normalize*()` défensives qui
  fournissent une valeur par défaut pour tout champ manquant ou
  invalide plutôt que de planter.

## 3. Faille de sécurité connue, à corriger avant toute mise en avant du POC

`GET /api/content` et `GET /api/kpi` sont **actuellement ouverts sans
authentification**. N'importe qui connaissant l'URL peut lire les
demandes de contact (nom, email, message) et les entrées météo. Le
POC accepte ce risque tant que l'accès reste privé et de confiance,
mais ce point doit être traité avant tout partage plus large de
l'URL, indépendamment du calendrier Tectonic.

---

## 4. Contrat API actuel (tel qu'implémenté dans `server.js`)

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| GET | `/health` | — | Sonde de disponibilité |
| GET | `/api/content` | — | Lit tout le contenu public + branding |
| POST | `/api/content` | jeton admin | Écrit tout le contenu (payload complet attendu) |
| GET | `/api/kpi` | — | Lit tous les indicateurs |
| POST | `/api/kpi/track` | — | Enregistre un événement (`faq`, `article`, `tab`, `visit`, `contact`, `mood`) |
| POST | `/api/kpi/reset` | jeton admin | Réinitialise tous les indicateurs |
| POST | `/api/admin/login` | mot de passe | Retourne le jeton de session admin |
| POST | `/api/admin/upload` | jeton admin | Envoie un fichier (image ou PDF) |

Le jeton admin est un HMAC déterministe du mot de passe — il n'expire
jamais et reste identique tant que `ADMIN_PASSWORD` ne change pas.

### Champs de `branding` actuellement valides
```
theme: 'default' | 'rainbow-glass' | 'midnight-frost'
projectName: string
logoUrl: string
```

### Thèmes existants et leur mécanisme d'activation
- **Ivory (`default`)** — aucun fichier externe, styles de base.
- **Rainbow Glass** — `themes/rainbow-glass.css` + `.js`, active via
  `body.classList.toggle('theme-rainbow-glass', ...)`.
- **Midnight Frost** — `themes/midnight-frost.css` + `.js`, active via
  `body.classList.toggle('theme-midnight-frost', ...)`. *(Mutation du
  DOM existant après coup — identifié dans le cadrage Tectonic comme
  le principal problème d'architecture à résoudre.)*

---

## 5. Données de démonstration conservées

Le contenu par défaut (`defaultContent` dans `server.js`) simule un
projet fictif "Projet XYZ" : déménagement vers Issy-les-Moulineaux,
12 ambassadeurs, 11 membres d'équipe (mix XYZ/Parella), 6 visuels
Plans & 3D, 34 entrées FAQ, 6 jalons de planning, 4 articles
d'actualité rédigés. Ces données doivent rester intactes comme
jeu de test de référence pour valider tout futur renderer.

---

## 6. Ce que ce gel ne couvre pas

- Le detail visuel complet de chaque thème (non exhaustif ici,
  se référer aux fichiers CSS eux-mêmes).
- Les scripts d'installation Python historiques (Rainbow Glass V1-V4)
  — leur logique est déjà intégrée dans `index.html`/`server.js`,
  ils ne sont plus nécessaires à l'exécution.
- Les fichiers `storm/rainbow-engine.js` et le sampler Wavestone dans
  l'admin — ce dernier est un exemple temporaire pour présentation
  interne (comex Parella), à retirer avant tout déploiement client
  réel.
