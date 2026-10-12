# Nommable — Docker Deployment

Self-hosted recipe management system with optional AI features.

## Prerequisites

- Docker and Docker Compose (v2)

## Quick Start

1. **Create your `.env` file** — copy the example and fill in real secrets:
   ```bash
   cp .env.example .env
   # edit .env: set POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, ADMIN_PASSWORD
   ```
   Compose will refuse to start if a required secret is missing.

2. **Build and start:**
   ```bash
   docker compose up -d
   ```

3. **Access the app:**
   - Web UI: `http://localhost:8765`
   - API: `http://localhost:8766`

4. **Log in** with the admin credentials you set in `.env`.

## Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Yes | _(none — must be set)_ | PostgreSQL password |
| `JWT_SECRET` | Yes | _(none — must be set)_ | JWT signing secret (32+ chars). The app refuses to start in production with the insecure default. |
| `ENCRYPTION_KEY` | Yes | _(none — must be set)_ | AI-key encryption at rest; exactly 64 hex chars — generate with `openssl rand -hex 32` |
| `ADMIN_USERNAME` | No | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | Yes | _(none — must be set)_ | Initial admin password — change after first login |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |
| `DB_SYNCHRONIZE` | No | `false` | Schema managed by migrations (recommended). Set `true` only for dev auto-sync from entities (see note below) |
| `FRONTEND_PORT` | No | `8765` | Host port for web UI |
| `BACKEND_PORT` | No | `8766` | Host port for API |
| `MAX_FILE_SIZE` | No | `5242880` | Max upload size in bytes (5MB) |
| `OPENAI_API_KEY` | No | _(none)_ | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | _(none)_ | Anthropic API key |
| `GOOGLE_AI_API_KEY` | No | _(none)_ | Google AI API key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |

## Database Schema Management

The schema is managed by **migrations**, which run automatically on startup
(`DB_SYNCHRONIZE=false`, the default). A fresh database is provisioned by the
baseline migration on first boot, and version upgrades apply any new migrations
in order — no manual steps. Existing databases previously built by `synchronize`
are detected and adopted without being recreated.

`DB_SYNCHRONIZE=true` switches to TypeORM's auto-sync, which mirrors the code's
entities directly. It's convenient for development but can silently alter or drop
columns, so keep it `false` for any deployment with data you care about.

## AI Configuration

AI features are optional. You can set default API keys via the environment variables above, or users can configure their own keys per-account in the web UI under **AI Settings**. Supported providers: OpenAI, Anthropic, Google AI, Ollama.

## Managing the Stack

```bash
# View logs
docker compose logs -f

# Stop
docker compose down

# Stop and remove data (WARNING: deletes all recipes and database)
docker compose down -v

# Rebuild after update
docker compose up -d --build
```

## Backups

Back up the PostgreSQL data volume:
```bash
docker compose exec postgres pg_dump -U nommable nommable > backup.sql
```

Restore:
```bash
cat backup.sql | docker compose exec -T postgres psql -U nommable nommable
```

## Updating

1. Pull the latest release files
2. Rebuild: `docker compose up -d --build`
3. The database will auto-migrate on startup
