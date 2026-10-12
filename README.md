# Nommable

A self-hosted recipe management system with optional AI features powered by multiple providers (OpenAI, Anthropic, Google AI, Ollama).

## Features

- **Recipe Management & Collections**: Create, import, and organize recipes into custom collections or Favorites using searchable multi-select dialogs (`Add Recipes` from collection pages or bulk `Add to Collection` from the Recipes page)
- **URL & Text Import**: Automatically extract recipes from cooking websites (with Cloudflare/WordPress REST API fallbacks) or by copy-pasting raw, unformatted recipe text from any source
- **AI-Powered Features** (Optional):
  - Generate recipes from ingredients or descriptions
  - AI Food Photography: Generate photorealistic culinary photos with Google Gemini 2.0 Flash / Imagen 3 or OpenAI GPT-Image models (`gpt-image-1.5`, `gpt-image-2.5-sunburst`, `gpt-image-1`) with independent image model selection and transparent fallback for legacy DALL-E configs
  - Smart meal planning suggestions
  - Ingredient substitution recommendations
  - Recipe enhancement
- **Pantry Inventory & Smart Suggestions**: Track pantry stock, expiration status, and low-stock alerts in a compact row layout, with a dedicated **"Suggested from your pantry"** band on the Recipes page displaying per-recipe `"Uses N of M pantry ingredients"` match badges
- **Meal Planning**: Plan multiple recipes per day across Breakfast, Lunch, Dinner, and Snack slots with optional meal times (`[HH:MM]`) and reusable meal-plan templates
- **Shopping Lists**: Auto-generate shopping lists from meal plans or add items via a pinned quick-add bar with one-tap recent item chips, automatic keyword-based grocery category detection (~180 common items), collapsible aisle sections, and a collapsed Completed section
- **Batch Cooking**: Guided 3-step batch cooking session wizard (select recipes → review portions & local-calendar prep date → generate timeline), one-click `Freezer-Friendly` tag bootstrapping, and batch cooking analytics
- **Multi-Provider AI & BYOK (Bring Your Own Key)**: Choose your preferred AI provider (OpenAI, Anthropic, Google AI, Ollama, or none) with dynamic model listing, 1-hour caching, live model refresh, independent text vs image models, custom model overrides, and admin-selectable **Shared Instance Key** vs. **Per-User BYOK** modes
- **Granular Shared Library, Creator Attribution & Per-User Taxonomies**: Choose which elements are shared across all household/team users in Admin Settings — **Recipes & Tags** (with optional **"Show who added or created each recipe"** attribution badges), **Collections & Favorites**, **Meal Plans & Templates**, **Shopping Lists**, **Pantry Inventory**, and **Batch Cooking Plans** — or switch to **Per-User Private Library** mode at any time, with per-user category/tag taxonomy scoping
- **In-App Feedback Widget & Admin Inbox**: Built-in floating feedback widget for reporting bugs or requesting features (automatically capturing route, viewport, and browser metadata) paired with an admin-only `/admin/feedback` triage inbox
- **Built-in Email / SMTP Configuration**: Configure and test SMTP email delivery for user invitations directly from Admin Settings (with 1-click presets for Gmail, Outlook, Fastmail, iCloud, and transactional relays) or via `SMTP_*` environment variables

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express.js
- TypeORM + PostgreSQL
- JWT Authentication
- Multiple AI SDK integrations

**Frontend:**
- React 18 + TypeScript
- Vite
- React Router
- Zustand (State Management)
- Tailwind CSS

**DevOps:**
- Docker + Docker Compose
- npm workspaces (monorepo)

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (if running locally without Docker)

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd nommable
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Edit packages/backend/.env with your configuration
   ```

4. **Start PostgreSQL:**
   ```bash
   docker-compose up -d postgres
   ```

5. **Run database migrations:**
   ```bash
   npm run migration:run -w packages/backend
   ```

6. **Start the backend:**
   ```bash
   npm run dev:backend
   ```

7. **Start the frontend** (in a new terminal):
   ```bash
   npm run dev:frontend
   ```

8. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### Docker Deployment

See the [`release/`](release/) folder for a self-contained Docker deployment package with full instructions.

Quick start:
```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, ADMIN_PASSWORD
docker compose up -d
```

Secrets are never committed — `docker-compose.yml` reads them from a gitignored `.env` file.
For the self-contained package: `cp release/.env.example release/.env` and run compose in `release/`.

- Frontend: http://localhost:8765
- Backend API: http://localhost:8766

## AI Configuration

After creating an account, navigate to **AI Settings** to configure your preferred AI provider:

1. Choose your provider (OpenAI, Anthropic, Google AI, or Ollama)
2. Enter your API key (not required for Ollama)
3. Select your Text & Recipe Generation model from the dynamically populated list (or click **"Refresh models"** to query the provider live for newly released or installed models; custom model names are also supported)
4. (Optional) Configure an independent **Image Generation Model** (OpenAI `gpt-image-1.5`, `gpt-image-2.5-sunburst`, `gpt-image-1`, Google Gemini 2.0 Flash, or Imagen 3) with an optional dedicated image API key for cross-provider generation
5. Enable AI features

**Note:** AI features are completely optional. The app works fully without any AI configuration.

## Project Structure

```
nommable/
├── packages/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── api/      # Routes, controllers, middleware
│   │   │   ├── services/ # Business logic (AI, recipes, etc.)
│   │   │   ├── db/       # Database entities and migrations
│   │   │   └── config/   # Configuration
│   │   └── package.json
│   ├── frontend/         # React web app
│   │   ├── src/
│   │   │   ├── features/ # Feature modules
│   │   │   ├── services/ # API client
│   │   │   └── store/    # State management
│   │   └── package.json
│   └── shared/           # Shared TypeScript types
│       └── src/types/
├── docker-compose.yml
└── package.json          # Root workspace config
```

## Development

### Running Tests

```bash
# Run backend tests
npm run test -w packages/backend

# Run frontend tests
npm run test -w packages/frontend
```

### Database Migrations

```bash
# Generate a new migration
npm run migration:generate -w packages/backend -- -n MigrationName

# Run migrations
npm run migration:run -w packages/backend

# Revert last migration
npm run migration:revert -w packages/backend
```

### Code Quality

```bash
# Lint all packages
npm run lint

# Format code
npm run format
```

## API Documentation

The backend API is available at `http://localhost:3001/api` with the following endpoints:

- **Auth**: `/api/auth` - User registration and login
- **Recipes**: `/api/recipes` - CRUD operations, import, AI generation, and AI culinary photo generation (`/api/recipes/:id/generate-image`, `/api/recipes/generate-image`)
- **Users**: `/api/users` - User management, role assignment, password reset, and admin safeguards
- **Invitations**: `/api/invitations` - Invitation tokens, validation, resending, and revocation
- **Settings**: `/api/settings` - System catalog sharing & author attribution (`/api/settings/general`), SMTP configuration & test delivery (`/api/settings/smtp`, `/api/settings/smtp/test`), and database management (`/api/settings/data/clear`)
- **AI**: `/api/ai` - AI configuration, dynamic model listing (`/api/ai/models`), test connection, and ingredient substitution
- **Meal Plans**: `/api/meal-plans` - Meal planning and management
- **Shopping Lists**: `/api/shopping-lists` - Shopping list management

## Environment Variables

See `packages/backend/.env.example` for all available configuration options.

Key variables:
- `JWT_SECRET`: Secret key for JWT tokens
- `ENCRYPTION_KEY`: 32-byte hex key for AES-256-GCM encryption of stored AI API keys and SMTP credentials at rest
- `DATABASE_*`: PostgreSQL connection details
- `SMTP_*`: Optional fallback SMTP host, port, user, pass, and from address for sending invitation emails (can also be configured directly in Admin Settings → Email / SMTP)
- `OPENAI_API_KEY`: OpenAI API key (optional)
- `ANTHROPIC_API_KEY`: Anthropic API key (optional)
- `GOOGLE_AI_API_KEY`: Google AI API key (optional)
- `OLLAMA_BASE_URL`: Ollama server URL (optional)

## Security

Nommable is built for self-hosting with defense-in-depth:

- **Authentication**: JWT-based auth with bcrypt password hashing; protected API routes.
- **Flexible recipe sharing & per-user ownership**: Personal data (meal plans, shopping lists, pantry items, analytics, batch cooks, and meal-plan templates) is strictly scoped to the authenticated `userId`, while recipes support either a shared household catalog (with optional creator attribution) or strict per-user private isolation.
- **Admin-gated operations**: System settings, SMTP configuration, user management, and destructive actions require an admin role.
- **Input validation**: All request bodies and query params are validated and coerced with Zod.
- **Encrypted secrets**: AI provider API keys and SMTP passwords are encrypted at rest (AES-256-GCM) via the `ENCRYPTION_KEY` env var.
- **Secret hygiene**: `docker-compose.yml` contains no hardcoded secrets (all via gitignored `.env`); the backend refuses to boot in production with a missing `ENCRYPTION_KEY` or default `JWT_SECRET` / `ADMIN_PASSWORD` values.
- **Rate limiting**: Tiered limits (global, auth, and AI endpoints).
- **Safe defaults**: TypeORM `synchronize` is disabled outside development, CORS defaults are locked to known origins, and recipe imports use `execFile` (no shell interpolation).
- **Uploads**: File extensions are derived from validated MIME types rather than user-supplied filenames; uploaded and AI-generated images are backed up in PostgreSQL for container resilience.

Set a strong `JWT_SECRET` and `ENCRYPTION_KEY`, and a restrictive `CORS_ORIGIN`, before deploying to production.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
