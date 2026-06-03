# syntax=docker/dockerfile:1
# Next.js (standalone) build for the parent portal in a pnpm workspace.
# Build context must be the repo root: docker build -f web/parent/Dockerfile .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY web/parent/package.json web/parent/package.json
RUN pnpm install --filter @svbk/parent... --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY web/parent ./web/parent
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @svbk/parent build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S svbk && adduser -S svbk -G svbk
COPY --from=build /repo/web/parent/.next/standalone ./
COPY --from=build /repo/web/parent/.next/static ./web/parent/.next/static
COPY --from=build /repo/web/parent/public ./web/parent/public
USER svbk
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "web/parent/server.js"]
