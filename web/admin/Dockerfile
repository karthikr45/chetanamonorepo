# syntax=docker/dockerfile:1
# Next.js (standalone) build for the admin console in a pnpm workspace.
# Build context must be the repo root: docker build -f web/admin/Dockerfile .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY web/admin/package.json web/admin/package.json
RUN pnpm install --filter @svbk/admin... --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY web/admin ./web/admin
# NEXT_PUBLIC_* must be baked at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @svbk/admin build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S svbk && adduser -S svbk -G svbk
# standalone bundle carries its own minimal node_modules + server.js
COPY --from=build /repo/web/admin/.next/standalone ./
COPY --from=build /repo/web/admin/.next/static ./web/admin/.next/static
COPY --from=build /repo/web/admin/public ./web/admin/public
USER svbk
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "web/admin/server.js"]
