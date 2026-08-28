# Djeli Language Core

Brique linguistique **indépendante et réutilisable** (bambara / français /
code-switching). Consommée aujourd'hui par Djeli Business Assistant, demain par
Djeli Santé, Agriculture, Finance, Administration et des applications tierces
autorisées.

```
Applications Djeli  →  Djeli Language API (/api/v1/language)  →  Djeli Language Core
```

## Frontière d'indépendance

Le monorepo actuel impose une seule base PostgreSQL et un seul `schema.prisma`.
La séparation est donc **architecturale** :

- tous les modèles sont préfixés `language_*` ;
- **aucune relation Prisma vers les tables métier** : `organizationId`,
  `createdByRef`, `applicationCode` sont des **chaînes libres** ;
- un seul point de couplage : `src/language-core/db.ts` (l'instance Prisma).
  Pour extraire le service dans son propre dépôt, seul ce fichier change ;
- audit propre (`LanguageAuditLog`), auth propre (`LanguageApplicationClient`),
  API versionnée propre (`/api/v1/language`).

Le Business Assistant parle au Core **uniquement** via
`src/server/language/language-core-client.ts` (interface stable, appel
in-process aujourd'hui, HTTP possible demain sans toucher aux appelants).

## Principe : OBSERVATION ≠ SUGGESTION ≠ CONNAISSANCE VALIDÉE

| Étape | Modèle | Sert de référence ? |
|---|---|---|
| Occurrence réelle | `LanguageObservation` | non |
| Correction humaine | `LanguageCorrection` | non (matière du futur Learning Loop) |
| Proposition | `LanguageEntry` status `SUGGESTED` / `OBSERVED` | non |
| **Connaissance** | `LanguageEntry` status `VALIDATED` | **oui** |
| Écartée / retirée | `REJECTED` / `ARCHIVED` | non |

**Aucune correction ne crée automatiquement une entrée GLOBAL VALIDATED.**
L'agrégation / promotion est la **Phase 6D** (`learning-candidate-service.ts`
n'expose que la matière première, sans clustering ni scoring ni promotion).

## Scopes

- `GLOBAL` — validé, réutilisable partout.
- `DOMAIN` — lié à un `LanguageDomain` (commerce, health…). Une même expression
  peut avoir un sens différent selon le domaine.
- `ORGANIZATION` — **strictement privé** à une organisation. Jamais promu
  automatiquement vers DOMAIN ou GLOBAL. Une application externe n'y accède que
  pour la même organisation (`organizationId` + permission
  `language.organization.read`).

## Résolution (`POST /resolve`)

Priorité : **ORGANIZATION → DOMAIN → GLOBAL**, puis **exact → variante →
fuzzy**. Ne sert que `VALIDATED` non archivé.

```
resolve(org A, commerce)  → variante privée A si elle existe, sinon DOMAIN commerce, sinon GLOBAL
resolve(org B, commerce)  → DOMAIN commerce si elle existe, sinon GLOBAL
resolve(sans domaine)     → GLOBAL uniquement
```

## API v1

Auth : `Authorization: Bearer <clientId>.<secret>` (secret **haché bcrypt**).
`401` client invalide · `403` permission manquante · `429` rate-limit
(240 req/min/client, mémoire).

| Endpoint | Permission |
|---|---|
| `POST /resolve` · `POST /search` · `GET /entries` · `GET /entries/:id` · `GET /domains` | `language.read` |
| `POST /entries` · `PATCH /entries/:id` | `language.write` |
| `POST /entries/:id/validate` · `POST /entries/:id/reject` | `language.validate` |
| `GET /exports` | `language.export` |
| accès scope `ORGANIZATION` | `language.organization.read` / `.write` en plus |

`GET /api/v1/language/openapi.json` : schéma OpenAPI minimal.

## Normalisation

`normalize.ts` — nettoyage **doux** : casse, apostrophes, espaces, ponctuation
de bord. **Les diacritiques sont conservés** (ɛ ɔ ɲ ŋ, tons ; accents
français). Le texte original (`canonicalText`) est toujours stocké.

## Confiance ≠ validation

`confidence` (0–1) = indice statistique éventuel. `status = VALIDATED` = décision
humaine. Une entrée validée peut avoir une `confidence` nulle : c'est la revue
qui fait foi.

## Vie privée & gouvernance

- **PII** : `sanitize.ts` masque e-mails, téléphones, `CMD-xxxx`, nombres longs,
  montants. Ce qui garde un risque résiduel n'obtient **pas** de `sanitizedText`
  → **non partageable**.
- **Données privées** : sans consentement global, une connaissance reste en
  `scope ORGANIZATION` ou n'est pas transférée.
- **Provenance** : chaque entrée porte `source` + `provenance` (dataset,
  correction, recherche…).
- **Datasets** : `LanguageDatasetSource` exige une **licence** avant tout
  mélange.
- **Corpus partagé futur** : l'usage des conversations/audio pour un corpus
  global nécessitera une politique dédiée (consentement, anonymisation,
  rétention, suppression, séparation tenant ↔ global). **Rien n'est copié
  automatiquement** entre organisations.

## Export

`export-service.ts` — JSON / JSONL / CSV. Par défaut : `GLOBAL + DOMAIN`,
`VALIDATED` uniquement, **PII retirée**, **pas d'observations brutes**, **pas de
données ORGANIZATION** (celles-ci exigent permission + `organizationId`). Format
JSONL prêt pour un usage ML : `{ text, language, canonical, meaning, domain,
scope, intent, frenchTranslation }`.

## Import

`import-service.ts` — CSV/JSON → entrées en `SUGGESTED` (jamais `VALIDATED`
directement). Dataset enregistré avec sa licence.

## Versioning

Chaque changement (`create`, `update`, `validate`, `reject`, `archive`) écrit un
`LanguageEntryRevision` (`version`, `snapshot` JSON, `changedByRef`,
`changeReason`). Unicité `(languageEntryId, version)`.

## Propriété des données

Tout est en base relationnelle standard : sauvegarde, export, migration et
réutilisation sans dépendance propriétaire. Aucune dépendance à un moteur STT
(le Core reçoit du texte) ni à un LLM particulier.

## Learning Loop (Phase 6D — `learning/`)

`OBSERVATION → CORRECTION → CLUSTER/PATTERN → LEARNING CANDIDATE → HUMAN REVIEW
→ SUGGESTED → VALIDATED`. Agrégation **déterministe** (règles), pas de ML.

- `aggregator.recomputeLearningCandidates()` — **idempotent** (`upsert` sur
  `dedupeKey`), reconstruit les preuves anonymisées. Ne réécrit jamais un
  statut décidé par un humain.
- `scoring.calculateCandidateScore` / `explainScore` — score borné [0,1],
  **facteurs lisibles** (pas de score opaque).
- `scope-suggestion.suggestScope` — 1 org → `ORGANIZATION` ; non anonymisable →
  `ORGANIZATION` ; `DOMAIN` = plusieurs orgs, 1 domaine, seuils ; `GLOBAL` =
  multi-domaines + forte diversité + revue renforcée.
- `conflict.detectEntryConflict` — avant promotion ; **aucune fusion auto**.
- `promotion-service.promoteLearningCandidate` — crée une `LanguageEntry` /
  `LanguageVariant` / … en statut **`SUGGESTED`** (`assertPromotionStatus` —
  invariant §63 : jamais `VALIDATED`, jamais `GLOBAL` automatiquement).
- `dataset-builder.buildLearningDataset` — JSONL/CSV, candidats `APPROVED`/
  `PROMOTED` `shareable`, ré-anonymisés ; prêt pour évaluation ASR/LLM future.
- `review-service` — approve / reject / ignore / edit (historique
  `LearningReview` ; `reviewedByRef` peut différer du validateur final →
  dual-control possible).
- Permission API `language.review` (jamais accordée à une application métier).

## Ne fait PAS

Entraînement (ASR / LLM / fine-tuning / embeddings / vector DB / RL),
promotion automatique, approbation semi-automatique, clustering sémantique,
scoring d'accord inter-annotateurs, API publique Language Core, marketplace,
collecte automatique inter-entreprises. Le Learning Loop **propose** ; l'humain
**décide** ; `VALIDATED` / `GLOBAL` restent des actions humaines séparées.
