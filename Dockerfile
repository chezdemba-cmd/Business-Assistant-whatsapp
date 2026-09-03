# syntax=docker/dockerfile:1
# Image unique pour le web ET le worker (commande différente au run).

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM deps AS build
COPY . .
RUN npx prisma generate
# `next build` exécute les modules de route (« collect page data ») qui valident
# l'environnement via getEnv(). Les valeurs ci-dessous sont FACTICES et locales à
# cette commande (aucune couche ENV persistante, rien d'inliné côté client car
# non préfixé NEXT_PUBLIC_). Les vraies valeurs sont fournies au run
# (docker run -e / compose / secrets k8s).
RUN APP_ENV=staging \
    AUTH_SESSION_SECRET=build-only-placeholder-not-a-secret-0000000000 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public \
    npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# Tout est possédé par l'utilisateur non-root `node` (présent dans l'image
# officielle). `.next/cache` doit rester inscriptible par lui (cache ISR/images).
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/scripts ./scripts
COPY --chown=node:node --from=build /app/src ./src
COPY --chown=node:node --from=build /app/next.config.mjs ./next.config.mjs
COPY --chown=node:node --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Liveness du conteneur web. Le worker (CMD surchargé) n'expose pas de HTTP :
# lancer son conteneur avec `--no-healthcheck`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

# Web :   docker run <image>
# Worker: docker run --no-healthcheck <image> npm run worker
# Migrations (release step): docker run <image> npx prisma migrate deploy
CMD ["npm", "run", "start"]
