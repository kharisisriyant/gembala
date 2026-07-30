# syntax=docker/dockerfile:1
# Build context must be the monorepo root:
#   docker build -f apps/api/Dockerfile -t gembala-api .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# Install deps for the whole workspace (cached unless lockfile/manifests change)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build shared package + api, then produce a standalone deploy dir
# (pnpm deploy resolves workspace:* deps into real files, not symlinks)
FROM deps AS build
COPY . .
RUN pnpm rebuild
RUN pnpm --filter @gembala/shared build
RUN pnpm --filter @gembala/api build
RUN pnpm --filter @gembala/api deploy --prod /out/api

# Migration runner — needs drizzle-kit (a devDependency), so it uses the
# full `build` stage rather than the pruned runtime image.
#   docker build -f apps/api/Dockerfile --target migrate -t gembala-api-migrate .
#   docker run --rm --env-file apps/api/.env gembala-api-migrate
FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "db:migrate"]

# Minimal runtime image
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/api .
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
