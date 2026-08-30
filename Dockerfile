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
RUN npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Liveness : le process répond-il en HTTP ? On accepte n'importe quelle réponse
# (même 503 « DB down ») — seul un échec de connexion signale un process mort.
# La READINESS (DB + migrations) se contrôle séparément via GET /api/readiness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(()=>process.exit(0)).catch(()=>process.exit(1))"

# Web :   docker run <image>
# Worker: docker run <image> npm run worker
# Migrations (release step): docker run <image> npx prisma migrate deploy
CMD ["npm", "run", "start"]
