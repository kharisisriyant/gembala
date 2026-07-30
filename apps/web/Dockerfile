# syntax=docker/dockerfile:1
# Build context must be the monorepo root:
#   docker build -f apps/web/Dockerfile \
#     --build-arg VITE_API_URL=https://api.staging.example.com/api \
#     -t gembala-web .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm rebuild
# Vite bakes VITE_* vars into the bundle at build time — must be set per
# environment (staging vs production point at different API hosts).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @gembala/shared build
RUN pnpm --filter @gembala/web build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
