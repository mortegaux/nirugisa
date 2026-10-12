# Build stage
FROM node:20-alpine AS builder

# Build arguments
ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS=$NODE_OPTIONS

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.) needed by workspace deps
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

# Build shared package first (required by frontend)
WORKDIR /app/packages/shared
RUN npm run build

# Build frontend (can now reference built shared package)
WORKDIR /app/packages/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
