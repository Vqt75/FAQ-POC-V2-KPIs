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
3. Édition de l'identité (nom, logo, couleurs, polices, thème) →
   aperçu en direct → sauvegarde.
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
- **`normalizeBranding()` doit explicitement lister chaque valeur/champ
  valide.** Toute nouvelle édition ou tout nouveau champ (thème,
  couleur, police) ajouté côté front sans mise à jour correspondante
  côté serveur est silencieusement perdu à la sauvegarde — deux bugs
  réels de ce type ont été trouvés et corrigés pendant le POC
  (`midnight-frost` non reconnu, puis `colors`/`fonts` non persistés).
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

## 3. Sécurité — état au moment du gel, et correctifs de la phase 2

Précision de vocabulaire importante (remarque de revue externe, retenue
telle quelle) : le sujet n'est pas *"telle route est publique"* — le
site public **doit** pouvoir lire du contenu sans authentification,
c'est son rôle. Le sujet est *"qu'est-ce que cette route expose
exactement"*. On distingue donc :

**Public par conception** (aucune authentification requise, c'est
volontaire) :
- `GET /api/content` — sert la lecture du site par les collaborateurs.
- `GET /health` — sonde de disponibilité.
- `POST /api/kpi/track` — un visiteur anonyme doit pouvoir déposer un
  événement (question posée, météo, contact) sans être connecté.

**Réservé à l'admin** (jeton requis) :
- `GET /api/kpi` — expose noms, emails et messages du formulaire de
  contact. *(Faille réelle au moment du gel : cette route était
  ouverte sans authentification — corrigée en phase 2, voir plus bas.)*
- `POST /api/content`, `POST /api/kpi/reset`, `POST /api/admin/upload`
  — déjà protégées au moment du gel.

**Correctifs appliqués en phase 2 :**
- `GET /api/kpi` exige désormais un jeton admin valide (401 sinon).
- `GET /api/content` filtre désormais `faqDrafts` pour les requêtes
  non authentifiées — ce champ contient des questions FAQ importées
  mais pas encore validées pour publication ; il n'a jamais été utilisé
  par le site public, seulement par l'éditeur admin, et n'avait donc
  aucune raison de transiter dans la réponse publique.
- `normalizeBranding()` valide désormais aussi `colors` et `fonts` —
  ces deux champs étaient silencieusement perdus à chaque sauvegarde
  (bug réel, découvert et corrigé pendant l'audit de la phase 2).

---

## 4. Contrat API actuel (tel qu'implémenté dans `server.js`)

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| GET | `/health` | — | Sonde de disponibilité |
| GET | `/api/content` | optionnelle* | Lit le contenu public + branding |
| POST | `/api/content` | jeton admin | Écrit tout le contenu (payload complet attendu) |
| GET | `/api/kpi` | jeton admin | Lit tous les indicateurs |
| POST | `/api/kpi/track` | — | Enregistre un événement (`faq`, `article`, `tab`, `visit`, `contact`, `mood`) |
| POST | `/api/kpi/reset` | jeton admin | Réinitialise tous les indicateurs |
| POST | `/api/admin/login` | mot de passe | Retourne le jeton de session admin |
| POST | `/api/admin/upload` | jeton admin | Envoie un fichier (image ou PDF) |

*`GET /api/content` : sans jeton, `faqDrafts` est omis de la réponse ;
avec un jeton admin valide, la réponse est complète.

Le jeton admin est un HMAC déterministe du mot de passe — il n'expire
jamais et reste identique tant que `ADMIN_PASSWORD` ne change pas.

### Champs de `branding` actuellement valides
```
theme: 'default' | 'rainbow-glass' | 'midnight-frost'
projectName: string
logoUrl: string
colors: string[]   (jusqu'à 2 couleurs hexadécimales, ex. #1E1D1E)
fonts: { name, fileName, source }[]   (jusqu'à 2 polices)
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

## 6. Gouvernance de travail (retenue après un incident réel)

- **Ne jamais faire de nettoyage destructif sur `uploads/` (ou tout
  autre dossier de données utilisateur) sans vérifier le diff Git
  avant de committer.** Un `rm -rf uploads` utilisé pour nettoyer un
  environnement de test a failli supprimer 5 vraies images déjà
  committées — repéré uniquement grâce à `git status` avant le commit.
- **Préférer des branches dédiées à `main`** pour tout travail en
  cours, plutôt que de pousser directement sur la branche principale.

## 7. Ce que ce gel ne couvre pas

- Le detail visuel complet de chaque thème (non exhaustif ici,
  se référer aux fichiers CSS eux-mêmes).
- Les scripts d'installation Python historiques (Rainbow Glass V1-V4)
  — leur logique est déjà intégrée dans `index.html`/`server.js`,
  ils ne sont plus nécessaires à l'exécution.
- Les fichiers `storm/rainbow-engine.js` et le sampler Wavestone dans
  l'admin — ce dernier est un exemple temporaire pour présentation
  interne (comex Parella), à retirer avant tout déploiement client
  réel.
