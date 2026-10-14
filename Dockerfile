# One image for the bot, the dashboard and the migration step — they share the
# workspace packages, and building them separately would mean three installs
# of the same lockfile. deploy/compose.yml picks the command per service.
FROM node:24-bookworm-slim

# Prisma's query engine links against OpenSSL; slim images do not ship it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Manifests first, so a code-only change reuses the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY tools/audio-probe/package.json tools/audio-probe/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm db:generate \
 && NODE_ENV=production pnpm --filter @tsuki/web build

ENV NODE_ENV=production
