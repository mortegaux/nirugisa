# Nommable — single-container build
# Frontend (Vite) is built to static files; the backend (Express) serves them.
# One container, one volume (/data), one port.

# ---------- Builder stage ----------
FROM node:20-alpine AS builder

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS=$NODE_OPTIONS

WORKDIR /app

# Native module build deps (better-sqlite3 prebuilds cover musl, but canvas needs these)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pkgconf

COPY package*.json ./
COPY tsconfig.json ./
COPY packages ./packages

RUN npm install

# Build in dependency order
WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/packages/backend
RUN npm run build

WORKDIR /app/packages/frontend
RUN npm run build

# ---------- Production stage ----------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Runtime libs for native modules
RUN apk add --no-cache \
    python3 \
    py3-pip \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

# Prod-only node_modules (workspace-aware)
RUN npm install --omit=dev --workspaces --include-workspace-root 2>/dev/null || npm install --omit=dev

# Built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
# Frontend static files, served by Express (lives next to backend dist)
COPY --from=builder /app/packages/frontend/dist ./packages/backend/public

# Python scraper (optional recipe import)
COPY packages/backend/requirements.txt ./packages/backend/
COPY packages/backend/src/services/scraper/recipe_scraper.py ./packages/backend/dist/services/scraper/ 2>/dev/null || true
RUN pip3 install --break-system-packages --no-cache-dir -r ./packages/backend/requirements.txt || true

# Persistent data: SQLite DB + uploads live here
VOLUME /data

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]
