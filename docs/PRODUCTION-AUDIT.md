# Audit de mise en production — Phase 8

Classement : **CRITICAL** (bloquant), **HIGH** (à corriger avant pilote élargi),
**MEDIUM**, **LOW**. État : `✅ corrigé` · `🟡 partiel / documenté` · `⬜ à faire hors dépôt`.

## CRITICAL

| # | Sujet | Constat | État |
|---|---|---|---|
| C1 | Providers | AI/Voice pouvaient tourner en `mock` en prod sans garde-fou | ✅ `productionGuardIssues()` bloque le démarrage (`APP_ENV=production` + `*_PROVIDER=mock` sans `*_ALLOW_MOCK_IN_PROD=1`) |
| C2 | Seed | Seed de démo sans protection prod | ✅ garde-fou `ALLOW_DEMO_SEED` + `assertSeedAllowed()` dans `prisma/seed.ts` |
| C3 | Coût fournisseur | Aucun plafond d'usage IA/Voice/marketing par tenant | ✅ `checkUsageLimit()` + `UsageCounter` avant chaque appel coûteux ; refus = zéro dépense |
| C4 | En-têtes HTTP | Pas de CSP / anti-clickjacking / referrer policy | ✅ `next.config.mjs` `headers()` (CSP, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, nosniff) |

## HIGH

| # | Sujet | Constat | État |
|---|---|---|---|
| H1 | Sessions | Révocation limitée au changement de mot de passe | ✅ `User.sessionInvalidBefore` + `revokeAllSessions()` (logout global, appareil compromis, suspension) — `isSessionStillValid()` testé |
| H2 | Rate limiting | Compteur mémoire par instance ; login non limité | 🟡 abstraction `RateLimitStore` + login limité par IP ; store Redis à fournir pour le multi-instance |
| H3 | Queue | Dispatchers AI/Voice en `setImmediate` | ✅ handlers `AI_PROCESS` / `VOICE_TRANSCRIBE` / `WHATSAPP_SEND` + enqueue si `*_DISPATCH=queue` |
| H4 | Scheduler | Automatisations seulement via bouton / route | ✅ `scripts/worker.ts` (process séparé) frappe `/api/internal/{jobs,automations,maintenance}/run` ; cron possible |
| H5 | Opérateur | Aucune console super-admin | ✅ `/admin` (route group isolée, `requireSuperAdminPage`), aucun contenu privé |
| H6 | Health | `/api/health` superficiel, pas de readiness | ✅ `/api/health` enrichi + `/api/readiness` (env, DB, migrations) |
| H7 | Logs | `console.error` brut | ✅ `src/lib/logger.ts` (JSON structuré, redaction) + `logError()` structuré + hook Sentry |
| H8 | CI | Aucun pipeline | ✅ `.github/workflows/ci.yml` (env, generate, migrate deploy + status, typecheck, tests DB, build) |
| H9 | Tests DB | Tous les tests d'intégration `skip` | 🟡 8 fichiers `*.integration` + `e2e-full` + `e2e-tenant` prêts, activés par `RUN_DB_TESTS=1` en CI ; **exécution réelle hors de cet environnement (pas de Postgres)** |

## MEDIUM

| # | Sujet | État |
|---|---|---|
| M1 | Plans / Subscription / feature gating / metering | ✅ `Plan`, `Subscription`, `UsageCounter` + `hasFeature()` / `checkUsageLimit()` centraux |
| M2 | Export & suppression d'organisation | ✅ export CSV/JSON (OWNER) ; demande de suppression + période de grâce 14 j + annulation |
| M3 | Pages légales | 🟡 `/privacy`, `/terms`, `/data-processing` — **placeholders à faire valider juridiquement** |
| M4 | Support / feedback | ✅ `SupportTicket` + `/support` ; bouton « Donner mon avis » global (`Feedback`) |
| M5 | Rotation de secrets | 🟡 `docs/SECRETS-ROTATION.md` (procédure). Rotation de la clé de chiffrement WhatsApp = re-saisie des connexions ou script dédié |
| M6 | Déploiement | ✅ `Dockerfile` (web + worker), `docs/PRODUCTION.md` (environnements, staging, release, rollback) |
| M7 | Onboarding | ✅ suivi dynamique (`getOnboardingProgress`) sur le dashboard + indicateur d'activation (§46) |

## LOW

| # | Sujet | État |
|---|---|---|
| L1 | Index DB | 🟡 revus (cf. `docs/PRODUCTION.md#index`) ; index ajoutés uniquement avec justification aux phases 1–8 |
| L2 | Product analytics / activation | ✅ `src/server/analytics/product-metrics.ts` + `/admin/analytics` |
| L3 | CSRF | 🟡 Server Actions Next = protection d'origine intégrée ; routes internes protégées par secret partagé. Pas de token CSRF custom (non nécessaire) |
| L4 | Pagination / N+1 | 🟡 listes principales paginées/bornées depuis les phases précédentes ; snapshots stock/finance en une requête d'agrégat |

## Bloqué par l'environnement (à exécuter là où l'infra existe)

- Base **staging PostgreSQL** réelle + `prisma migrate deploy` + `prisma migrate status`
  (migrations 0001→0012 générées hors-ligne, purement additives — à valider sur une vraie DB).
- Exécution effective des tests `RUN_DB_TESTS=1` (0 skip critique).
- **Redis** pour le rate-limit partagé et une vraie file BullMQ.
- **Sentry** (DSN) — le hook est prêt (`installErrorTracking`).
- **Sauvegardes** PostgreSQL quotidiennes + **test de restauration** (`docs/BACKUPS.md`).
- **Load smoke** (catalog search, liste conversations, webhook, language resolve).
