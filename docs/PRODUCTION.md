# Déploiement & exploitation

## Environnements (§52)

| Env | `APP_ENV` | Base | Providers | Seed |
|---|---|---|---|---|
| Développement | `development` | Postgres local | `mock` | `npm run db:seed` |
| Staging | `staging` | Postgres dédié (données non prod) | sandbox / mock autorisé | seed staging dédié |
| Production | `production` | Postgres managé + sauvegardes | **réels obligatoires** | **jamais** |

Secrets **séparés par environnement** (aucun secret partagé prod ↔ staging).
`APP_ENV` est indépendant du `NODE_ENV` de Next (qui vaut toujours `production`
dans un build). Les garde-fous (`productionGuardIssues`) ne s'appliquent que si
`APP_ENV=production`.

## Composants à déployer (§51)

- **web** : `npm run start` (Next, port 3000).
- **worker** : `npm run worker` — process séparé, appelle les routes internes.
- **database** : PostgreSQL 14+.
- **redis** (optionnel mais recommandé multi-instance) : `RATE_LIMIT_STORE=redis` + `REDIS_URL`.
- **cron** (alternative au worker sur plateforme serverless) : `POST` toutes les
  N minutes sur `/api/internal/jobs/run`, `/api/internal/automations/run`,
  `/api/internal/maintenance/run` avec l'en-tête `x-automation-secret`.

Image unique : `Dockerfile` (build web + worker), la commande diffère au run.

## Procédure de release (§55)

1. `npm ci`
2. `npm run check:env` (valide la config + garde-fous prod)
3. `npx prisma generate`
4. **`npx prisma migrate deploy`** (jamais `migrate dev` en prod)
5. `npx prisma migrate status` → doit être *up to date*, **aucune** migration
   inattendue / destructive
6. `npm run build`
7. Déployer **web** puis **worker**
8. Smoke : `GET /api/readiness` → `200`, `GET /api/health` → `200`,
   connexion + création d'une commande de test sur un compte interne
9. Surveiller les logs `level:error` pendant 15 min

## Rollback (§56)

- **Code** : redéployer l'image précédente.
- **Migrations** : les migrations 0001→0012 sont **purement additives** (aucun
  `DROP` / `RENAME` / `ALTER COLUMN`). Un rollback de code fonctionne donc sans
  rollback de schéma. Ne **jamais** rollback automatiquement une migration
  destructive : restauration depuis sauvegarde + correctif manuel.
- Vérifier `prisma migrate status` après rollback.

## <a id="index"></a>Revue d'index (§37)

Requêtes chaudes et index associés (déjà en place) :

| Requête | Index |
|---|---|
| Liste clients / scope SALES | `customers(organizationId, status)`, `(organizationId, assignedToUserId)` |
| Catalogue / recherche | `products(organizationId, status)`, `(organizationId, barcode)` |
| Commandes par statut / échéance | `orders(organizationId, status)`, `(organizationId, dueDate)`, `(organizationId, createdAt)` |
| Messages d'une conversation | `messages(conversationId, createdAt)`, idempotence `(organizationId, externalMessageId)` |
| Paiements / encaissements du jour | `payments(organizationId, status)`, `(organizationId, paidAt)` |
| Créances | dérivées d'`orders` filtrées (`status=DELIVERED`, `paymentStatus≠PAID`) |
| Recommandations | `business_recommendations(organizationId, status, priority)`, dédup `(organizationId, dedupeKey)` |
| Usage metering | `usage_counters(organizationId, metric, period, periodKey)` unique |
| Language resolve | `language_entries` par scope + `language_variants(normalizedForm)` |

Pagination : toutes les listes principales sont bornées (`take`) et paginées.
Agrégats stock/finance : une requête `groupBy` par dimension (pas de N+1).

## Sécurité (§33, §34, §35, §36)

- En-têtes : CSP, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Content-Type-Options: nosniff` (`next.config.mjs`).
- CSRF : Server Actions Next = vérification d'origine intégrée ; routes internes
  = secret partagé `AUTOMATION_CRON_SECRET`.
- Jetons WhatsApp chiffrés au repos (`WHATSAPP_TOKEN_ENCRYPTION_KEY`, AES-256-GCM).
- Rotation des secrets : `docs/SECRETS-ROTATION.md`.

## Observabilité (§24, §25, §26, §27)

- Logs JSON structurés (`src/lib/logger.ts`) : `ts`, `level`, `msg`, `service`,
  `event`, `requestId?`, `organizationId?` — **jamais** de PII ni de secret.
- `installErrorTracking()` : branche Sentry si `SENTRY_DSN` (ajouter `@sentry/node`).
- `/api/health` : DB + latence + jobs bloqués + providers + store rate-limit.
- `/api/readiness` : config valide + DB + migrations appliquées.
