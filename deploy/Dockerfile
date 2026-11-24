# syntax=docker/dockerfile:1

# ---- build the interface ---------------------------------------------------
FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/web apps/web
RUN pnpm --filter @idontknot/web build

# ---- production dependencies of the server ---------------------------------
FROM node:24-alpine AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod --filter "@idontknot/server..."

# ---- runtime -----------------------------------------------------------------
FROM node:24-alpine
ARG VERSION=dev

RUN apk add --no-cache su-exec tzdata \
    && mkdir -p /data \
    && chown node:node /data

LABEL org.opencontainers.image.title="IDontKnot" \
      org.opencontainers.image.description="An interactive encyclopedia and laboratory for knots, rope systems and knot theory." \
      org.opencontainers.image.source="https://github.com/jalmena/IDontKnot" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

WORKDIR /app
COPY package.json ./
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY packages/core/package.json packages/core/
COPY packages/core/src packages/core/src
COPY apps/server/package.json apps/server/
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The server runs its TypeScript source directly; Node strips the types.
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    IDK_VERSION=${VERSION} \
    IDK_DATA_DIR=/data \
    PUID=1000 \
    PGID=1000

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "--conditions=source", "apps/server/src/index.ts"]
