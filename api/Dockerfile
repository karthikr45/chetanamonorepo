# syntax=docker/dockerfile:1
# Multi-stage build for the NestJS API in a pnpm workspace.
# Build context must be the repo root: docker build -f api/Dockerfile .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

# ---- deps: install workspace deps for the api package only ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY api/package.json api/package.json
# --ignore-scripts skips native postinstalls from the mobile packages,
# which the API never needs.
RUN pnpm install --filter @svbk/api... --frozen-lockfile --ignore-scripts

# ---- build: compile TypeScript ----
FROM deps AS build
COPY api ./api
RUN pnpm --filter @svbk/api build

# ---- prod deps only ----
FROM base AS proddeps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/package.json
RUN pnpm install --filter @svbk/api... --frozen-lockfile --ignore-scripts --prod

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo/api
RUN addgroup -S svbk && adduser -S svbk -G svbk
COPY --from=proddeps /repo/node_modules /repo/node_modules
COPY --from=proddeps /repo/api/node_modules /repo/api/node_modules
COPY --from=build /repo/api/dist ./dist
COPY api/package.json ./package.json
USER svbk
EXPOSE 3001
# Honors PORT env (defaults to 3001 in main.ts).
CMD ["node", "dist/main.js"]
