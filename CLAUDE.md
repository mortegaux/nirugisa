# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nommable is a self-hosted recipe management system with optional multi-provider AI features (OpenAI, Anthropic, Google AI, Ollama). TypeScript monorepo with three npm workspace packages: `@nommable/shared`, `@nommable/backend`, `@nommable/frontend`.

## Common Commands

```bash
npm install                # Install all workspace dependencies
npm run dev                # Run backend + frontend concurrently
npm run dev:backend        # Backend dev server on :3001 (tsx watch)
npm run dev:frontend       # Frontend dev server on :5173 (Vite)
npm run build              # Build all packages (shared must build first)
npm run lint               # ESLint across all packages
npm run format             # Prettier across all packages

# Database
npm run migration:generate -w packages/backend -- -n Name
npm run migration:run -w packages/backend
npm run migration:revert -w packages/backend

# Docker
docker-compose up -d       # Full stack (postgres + backend + frontend)
```

## Architecture

**Monorepo layout:** `packages/shared` (types) → `packages/backend` (Express API) → `packages/frontend` (React SPA). Shared types must be built before backend or frontend.

### Backend (`packages/backend`)

Express.js + TypeORM + PostgreSQL. Layered architecture:

- **Routes** (`src/api/routes/`) define endpoints and wire middleware
- **Controllers** (`src/api/controllers/`) are thin request handlers that delegate to services
- **Services** (`src/services/`) contain all business logic
- **Entities** (`src/db/entities/`) are TypeORM models mapping to DB tables
- **Middleware** (`src/api/middleware/`) handles auth (JWT), validation (Zod), file upload (Multer), error handling

**AI service pattern:** `IAIProvider` interface in `src/services/ai/types.ts` with provider implementations in `src/services/ai/providers/`. `AIService.createProvider()` is a factory that caches provider instances per user. Per-user AI config stored in `AIConfig` entity.

**Key details:**
- TypeORM `synchronize: true` in dev (auto-schema), migrations for production
- Admin account auto-created on first startup (`AdminInitService`)
- Swagger docs at `/api/docs`
- All queries enforce user ownership via `userId` field

### Frontend (`packages/frontend`)

React 18 + Vite + Tailwind CSS + Radix UI.

- **Feature-based structure** in `src/features/` (auth, recipes, meal-plans, shopping-lists, pantry, batch-cooking, analytics, gamification, ai, preferences, settings)
- **State:** Zustand auth store (`src/store/auth.store.ts`), local state elsewhere
- **API client:** `src/services/api.ts` — Axios instance with JWT interceptor, namespaced exports per domain
- **Routing:** React Router 6 in `App.tsx`, auth check on mount, redirect to /login when unauthenticated
- Dev server proxies `/api/*` to backend on :3001 (see `vite.config.ts`)

## Adding Features

**New API endpoint:** Define types in `packages/shared/src/types/` → entity in `db/entities/` → service in `services/` → controller in `api/controllers/` → route in `api/routes/` → frontend API method in `services/api.ts` → use in components.

**New AI provider:** Implement `IAIProvider` in `services/ai/providers/` → register in `AIService.createProvider()` → add option to frontend AI settings.

**New frontend feature:** Create folder in `src/features/` → add routes in `App.tsx` → add nav link in `DashboardLayout.tsx`.

## Code Style

- TypeScript strict mode, ES2022 target
- Prettier: 100 char width, semicolons, trailing commas (es5), 2-space indent
- ESLint: unused vars error (except `_`-prefixed), `no-any` as warning
- Functional React components with hooks
