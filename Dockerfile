# syntax=docker/dockerfile:1
# Single image running both the NestJS API and the Next.js frontend.
# Only port 3000 (Next.js) is published; the API stays internal behind Next.js rewrites.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# Zona waktu default container (bisa ditimpa lewat docker-compose).
ENV TZ=Asia/Jakarta
ENV APP_TIMEZONE=Asia/Jakarta

# ---------- dependencies (build) ----------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM deps AS builder
COPY . .
RUN npm run prisma:generate
RUN npm run build --workspace apps/api
RUN npm run build --workspace apps/web

# ---------- dependencies (runtime) ----------
FROM base AS prod-deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
    && npm cache clean --force

# ---------- runtime ----------
FROM base AS runner
ENV NODE_ENV=production \
    API_PORT=3001 \
    WEB_PORT=3000 \
    API_INTERNAL_URL=http://127.0.0.1:3001 \
    UPLOAD_DIR=/app/uploads

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder  /app/apps/api/dist       ./apps/api/dist
COPY --from=builder  /app/apps/api/prisma     ./apps/api/prisma
COPY --from=builder  /app/apps/web/.next/standalone ./
COPY --from=builder  /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder  /app/apps/web/public ./apps/web/public
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/proxy.js ./docker/proxy.js

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p "$UPLOAD_DIR"

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
