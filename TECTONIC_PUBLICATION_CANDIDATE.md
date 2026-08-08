# TECTONIC — `buildPublicationCandidate()` Design

**Statut : document de conception, volontairement court. Pas de
`server.js`, pas de nouvel endpoint, aucun commit applicatif. À
relire avant toute implémentation.**

Construit sur les trois documents gelés (`TECTONIC_DATA_OWNERSHIP.md`,
`TECTONIC_SITE_MANIFEST.md`, `TECTONIC_COMPILER_DESIGN.md`). Cette
pièce est apparue en cours de conception du Compiler comme une vraie
frontière d'architecture, pas un détail d'implémentation — ce document
la traite comme telle, sans rouvrir ce qui est déjà tranché ailleurs.

---

## 1. Rôle

```
buildPublicationCandidate( Publication Snapshot ) → Publication Candidate
```

**Signature ajustée** (décision prise en §4) : `buildPublicationCandidate()`
ne va jamais chercher lui-même "l'état courant" du Studio. Il reçoit un
**snapshot déjà figé**, produit en amont par une étape distincte
(`createPublicationSnapshot()`). Ça garde la fonction déterministe et
découplée — elle ne sait même pas que l'état autoritaire est un objet
vivant qui continue de changer pendant qu'elle travaille.

Une seule responsabilité : décider **quelles données** ont le droit
d'être compilées publiquement, et les assembler dans un objet neuf. Ce
n'est pas le Compiler (qui décide de la *forme* du Manifest, jamais de
l'*éligibilité* — invariant 1 du Compiler Design). Ce n'est pas non
plus une couche de validation de saisie (déjà assurée par les
`normalize*()` existants).

---

## 2. Règle de construction — whitelist, jamais clone-then-delete

Rappel de l'invariant déjà acté (Compiler Design, invariant 2) : Storm
est en JavaScript vanilla, aucun type compilé n'empêche une propriété
interdite d'exister sur un objet. La garantie doit donc venir de la
façon dont l'objet est construit, pas d'un système de types absent.

```js
// INTERDIT
const candidate = { ...authoritativeState };
delete candidate.faqDrafts;

// ATTENDU
const candidate = {
  branding: ...,
  publicContent: ...,
  milestones: ...,
  articles: ...,
  plans: ...,
  ambassadorsContent: ..., ambassadors: ...,
  teamContent: ..., team: ...,
  faqEntries: ...,
  modules: ...,     // calculé, voir §3
  navigation: ...   // calculé, voir §3
};
```

**Jamais membres du candidat, sous aucune forme** : `faqDrafts`, tout
`kpis.json`, jetons/mots de passe admin. Pas parce qu'on les filtre —
parce qu'aucune ligne de `buildPublicationCandidate()` ne les recopie
jamais.

---

## 3. Calcul transitoire de `modules` / `navigation`

Logique rapatriée ici depuis `TECTONIC_COMPILER_DESIGN.md` (§6), qui
l'attribuait par erreur au Compiler avant correction — c'est bien
`buildPublicationCandidate()` qui la porte :

```
pour chaque module candidat (home, timeline, spaces, news, questions,
ambassadors, team) :
  SI le module fait partie de {questions, timeline, spaces, news,
     ambassadors, home} → activé par défaut, même vide
     (ce sont les sections que Pangea affiche déjà inconditionnellement)
  SINON (aujourd'hui, seulement team) → activé seulement s'il a du
     contenu substantiel (ex. team activé si team.length > 0)

navigation ← dérivée de la liste des modules activés ci-dessus
```

**Explicitement transitoire** : le jour où Storm expose une vraie
configuration `modules`/`navigation` côté Studio,
`buildPublicationCandidate()` lit directement cette configuration au
lieu de la calculer — et rien d'autre ne change, ni le Compiler ni le
Manifest. C'est précisément ce que cette frontière est censée
permettre.

---

## 4. Décision : Option A — snapshot atomique au clic sur Publier

**Tranché.** Une version précédente de ce document présentait deux
options sans choisir. Décision prise :

> **V1 Tectonic utilise un snapshot atomique de l'Authoritative
> Project State au moment de l'action Publier.**
>
> `buildPublicationCandidate()` travaille exclusivement sur ce
> snapshot figé — jamais sur l'état vivant du Studio. Les
> modifications enregistrées après le début de la publication
> appartiennent à la publication suivante, pas à celle en cours.
>
> Storm ne maintient pas, en V1, de second datastore permanent
> "prêt à publier". Si un besoin réel de workflow éditorial plus
> avancé apparaît plus tard (staging, diff, rollback éditorial), un
> Editorial Working State plus riche pourra être introduit sans
> modifier le contrat Compiler/Manifest.

Raison du choix, pas juste la simplicité pour la simplicité : l'option
alternative (un état "validé pour publication" distinct de l'état de
travail courant) implique rapidement des notions de staging, de diff,
de révision, éventuellement de conflits — utile dans un CMS de niveau
Contentful ou Adobe Experience Manager, disproportionné pour Storm
aujourd'hui. Le mot clé de l'option retenue est **figé** : une fois le
clic sur Publier effectué, la publication travaille sur une
photographie exacte de cet instant, jamais contaminée par ce qui se
sauvegarde ensuite pendant qu'elle s'exécute.

Le pipeline complet, avec cette décision intégrée :

```
PUBLIER (action explicite)
   ↓
createPublicationSnapshot()     — fige l'état autoritaire à cet instant
   ↓
buildPublicationCandidate(snapshot)
   ↓
compile(candidate, context)
   ↓
validation du Manifest
   ↓
persistance du Manifest
   ↓
bascule de la release live
```

`createPublicationSnapshot()` n'est pas conçue en détail dans ce
document — signalée comme la pièce qui produit l'argument attendu par
`buildPublicationCandidate()`, pas plus.

---

## 5. Erreurs

**Nuancé** : dire que `buildPublicationCandidate()` "ne devrait
normalement jamais échouer" était trop absolu. La règle plus juste,
cohérente avec la doctrine déjà fixée dans `TECTONIC_COMPILER_DESIGN.md`
§6bis :

> `buildPublicationCandidate()` doit être tolérant aux données
> optionnelles malformées (les `normalize*()` déjà en place
> garantissent des valeurs de repli sûres pour ces cas), **mais peut
> produire une erreur bloquante si les préconditions minimales de
> publication ne peuvent pas être satisfaites** — par exemple un
> snapshot dépourvu de tout nom de projet exploitable, ou dans un état
> trop corrompu pour qu'aucun candidat cohérent n'en sorte.

Dans ce cas : pas de candidat produit, pas de compilation tentée,
dernier Manifest valide inchangé — exactement le même comportement
que pour toute autre erreur bloquante du pipeline.

---

## 6. Stratégie de test

Un seul test central, déjà annoncé dans `TECTONIC_COMPILER_DESIGN.md`
§10 — sa vraie place est ici :

```
état autoritaire de test, délibérément piégé :
{
  branding: {...}, milestones: [...],            ← légitimes
  faqDrafts: [...], kpis: {...},
  adminToken: "...", contactSubmissions: [...]    ← interdits
}
        ↓ buildPublicationCandidate()
candidat produit : aucune des propriétés interdites présente,
                   même si elles étaient là dans la source
```

À compléter par un test sur la règle transitoire (§3) : un projet avec
`team` vide → `modules.team === false` ; un projet avec au moins un
membre → `modules.team === true`.

---

## 7. Décisions tranchées à l'issue de cette relecture

1. **Quel état devient le candidat** (§4) — Option A retenue :
   snapshot atomique de l'état autoritaire au clic sur Publier. Plus
   une question ouverte.
2. **Où vivent `buildPublicationCandidate()` et le Compiler** —
   décidé : des **modules JavaScript séparés**, exécutés dans le
   **même processus Node que `server.js`**, jamais dans `server.js`
   lui-même, jamais un service distinct. Conceptuellement :
   ```
   /server.js
   /tectonic/publication-candidate.js
   /tectonic/compiler.js
   ```
   Même processus, fichiers séparés, responsabilités séparées — le
   niveau de modularité qu'il faut pour Storm, sans détour vers une
   architecture distribuée dont rien ne justifie le besoin.

Plus de question ouverte dans ce document.

---

## Ce que ce document ne fait pas

Aucune modification de `server.js`, aucun nouvel endpoint, aucun
commit applicatif. `createPublicationSnapshot()` n'est pas conçue en
détail (§4) — reconnue comme pièce nécessaire, pas plus.

**Prêt pour le freeze — plus de question ouverte. Après ce document,
la conception des frontières principales de Tectonic est terminée ;
la suite peut redevenir du code.**
