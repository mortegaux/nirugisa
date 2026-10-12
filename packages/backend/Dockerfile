# Build stage
FROM node:20-alpine AS builder

# Build arguments
ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS=$NODE_OPTIONS

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.)
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

# Copy root configuration files first
COPY package*.json ./
COPY tsconfig.json ./

# Copy all packages (complete structure)
COPY packages ./packages

# Install all dependencies (respects workspaces)
RUN npm install

# Build shared package first (required by backend)
WORKDIR /app/packages/shared
RUN npm run build

# Build backend (can now reference built shared package)
WORKDIR /app/packages/backend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies for native modules and Python
RUN apk add --no-cache \
    python3 \
    py3-pip \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

# Copy root configuration for workspaces
COPY package*.json ./

# Copy package configs
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

# Copy built artifacts and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy Python scraper and dependencies
COPY packages/backend/requirements.txt ./packages/backend/
COPY packages/backend/src/services/scraper/recipe_scraper.py ./packages/backend/dist/services/scraper/

# Install Python dependencies (--break-system-packages is safe in Docker)
RUN pip3 install --break-system-packages --no-cache-dir -r ./packages/backend/requirements.txt

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]
