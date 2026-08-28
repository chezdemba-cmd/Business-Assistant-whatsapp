# Déploiement STAGING — pas à pas

Objectif : une URL du type `https://staging.djeli.app` qu'un testeur ouvre dans
son navigateur. **Ne jamais toucher à la base de production.**

## 1. Créer la base PostgreSQL de staging

Base dédiée `djeli_staging` (Neon / Supabase / RDS / Postgres managé), **distincte**
de la future prod, avec ses propres identifiants. Récupérer son `DATABASE_URL`.

## 2. Configurer l'environnement

Depuis `.env.example`, définir au minimum :

```
APP_ENV=staging
DATABASE_URL=postgresql://…/djeli_staging?schema=public
AUTH_SESSION_SECRET=<48+ octets aléatoires>
NEXT_PUBLIC_APP_URL=https://staging.djeli.app

# Providers : mock accepté en staging (parcours 100 % testables)
WHATSAPP_PROVIDER=mock
AI_PROVIDER=mock
VOICE_PROVIDER=mock

# Comptes de test
DEMO_OWNER_PASSWORD=<…>
DEMO_ADMIN_PASSWORD=<…>
DEMO_MANAGER_PASSWORD=<…>
DEMO_SALES_PASSWORD=<…>
DEMO_EMPLOYEE_PASSWORD=<…>
DEMO_ALLOW_EXTERNAL_SEND=false

# Worker
AUTOMATION_CRON_SECRET=<32+ octets aléatoires>
```

Pour tester l'IA / la voix réelles : passer `AI_PROVIDER=openai-compatible` +
`AI_API_KEY` / `AI_BASE_URL` (idem `VOICE_*`). Sinon laisser `mock`.

## 3. Appliquer les migrations

```bash
npm ci
npx prisma generate
npx prisma migrate deploy      # applique 0001 → 0012
npx prisma migrate status      # doit être "up to date", aucune migration inattendue
```

## 4. Charger les données de démo

```bash
npm run demo:seed
```

Crée l'organisation **DJELI DEMO COMMERCE** (`isDemo=true`), les 5 comptes de
test, ~20 produits, ~18 clients, 16 commandes (tous statuts + créances par
tranche), conversations WhatsApp mock (FR / BM / MIXED), et lance une passe
d'automatisation (recommandations + résumé du jour). **Idempotent.**

Réinitialiser à tout moment (supprime UNIQUEMENT l'org démo puis re-seed) :

```bash
DEMO_RESET_CONFIRM=DJELI-DEMO npm run demo:reset
```

## 5. Build

```bash
npm run build
```

## 6. Déployer le **web**

Déployer l'app (Next `npm run start`, port 3000) derrière HTTPS sur le domaine
staging. Sur Vercel : projet séparé « djeli-staging », variables ci-dessus,
`APP_ENV=staging`.

## 7. Déployer le **worker** (optionnel pour l'UI)

`npm run worker` en process séparé (ou un cron toutes les 5 min sur
`/api/internal/{jobs,automations,maintenance}/run` avec l'en-tête
`x-automation-secret: $AUTOMATION_CRON_SECRET`). Les recommandations sont déjà
générées par le seed ; le worker les garde à jour.

## 8. Vérifier la santé

```bash
curl -s https://staging.djeli.app/api/health     # 200, "db": true
curl -s https://staging.djeli.app/api/readiness  # 200, tous les checks à true
SMOKE_BASE_URL=https://staging.djeli.app npm run smoke
```

Ne pas communiquer l'URL tant que `smoke` n'est pas vert.

## 9. Comptes test

Voir `docs/TEST-ACCOUNTS.md`. Vérifier une connexion par rôle et le périmètre
SALES / EMPLOYEE.

## 10. URL finale

Communiquer aux testeurs :

- l'URL `https://staging.djeli.app`
- `docs/TESTER-GUIDE.md` (1 page)
- les identifiants OWNER + SALES (les 3 autres sur demande)

---

### Notes

- `node --import ./scripts/register-paths.mjs` est utilisé par `demo:seed` /
  `demo:reset` pour résoudre l'alias `@/` (Node ne lit pas `tsconfig#paths`).
- `APP_ENV=staging` active la **bannière de démonstration** partout et interdit,
  pour toute organisation `isDemo`, l'envoi externe réel (sauf
  `DEMO_ALLOW_EXTERNAL_SEND=true`).
- `NODE_ENV` vaut « production » dans tout build Next — c'est **normal** ; seul
  `APP_ENV` distingue staging de production.
