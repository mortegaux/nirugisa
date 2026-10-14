# Nommable Deployment Guide

Single container, single volume, single port. The backend serves the API
and the frontend SPA. SQLite database lives at `/data/nommable.db`.

## Quick Start (Docker Compose)

```bash
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET and ENCRYPTION_KEY (see below)
docker compose up -d
```

- App: http://localhost:8992 (API at `/api`, first-run onboarding wizard at `/setup`)
- Secrets are never committed — `docker-compose.yml` reads them from a
  gitignored `.env` file (or from Portainer stack environment variables).

## Required Environment Variables

| Variable | Purpose | Generate |
|---|---|---|
| `BETTER_AUTH_SECRET` | Session signing secret (min 32 chars) | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Encrypts stored AI keys / SMTP passwords (exactly 64 hex chars) | `openssl rand -hex 32` |

Optional but recommended:

| Variable | Default | Purpose |
|---|---|---|
| `HOST_PORT` | `8992` | Host port the app listens on |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | _(empty)_ | Initial admin password — change after first login |
| `CORS_ORIGIN` | `http://localhost:8992` | Allowed origin for the frontend |
| `SMTP_*` | _(unset)_ | Email for invitations (also configurable in Admin Settings) |

See `.env.example` for the full list.

## Deploying in Portainer

1. **Stacks** → **Add stack**, name it `nommable`
2. Build method: **Repository**
   - Repository URL: `https://github.com/mortegaux/nommable`
   - Repository reference: `main`
   - Compose path: `docker-compose.yml`
3. In **Environment variables**, set at minimum:
   - `BETTER_AUTH_SECRET` — long random string (32+ chars)
   - `ENCRYPTION_KEY` — exactly 64 hex chars
   - `ADMIN_PASSWORD` — a strong password
   - `CORS_ORIGIN` — your public URL (e.g. `https://nommable.example.com`)
4. **Deploy the stack**
5. Open the app and complete the onboarding wizard to create the admin account.

> **Redeploy twice and verify.** Portainer may use a cached build on the
> first redeploy after a push — run the redeploy a second time, then check
> the app shows the new behavior.

## Updating

1. Push changes to `main`.
2. In Portainer, open the stack → **Update the stack** → enable
   **Re-pull image and redeploy** → **Update**.
3. Repeat the update once more (see the cached-build note above).

For local Compose:

```bash
git pull
docker compose up -d --build
```

## Backup and Restore

The entire state is one SQLite file plus uploads:

```bash
# Backup
docker cp nommable:/data/nommable.db ./nommable-backup.db
docker cp nommable:/data/uploads ./uploads-backup

# Restore (stop the container first)
docker compose down
docker cp ./nommable-backup.db nommable:/data/nommable.db
docker cp ./uploads-backup/. nommable:/data/uploads/
docker compose up -d
```

## Troubleshooting

**Build fails in Portainer but works locally**
- Portainer needs enough RAM for the build (~2GB+). If the host is small,
  build locally and push a pre-built image instead.
- Delete any partial `nommable` images in Portainer, then redeploy twice.

**App won't start / exits immediately**
- Check the container logs for a missing-secret error. The backend refuses
  to boot in production without `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY`.
- Confirm `BETTER_AUTH_SECRET` is at least 32 chars and `ENCRYPTION_KEY`
  is exactly 64 hex chars.

**First-run wizard never appears / login fails**
- The onboarding wizard runs only when no admin exists yet. If the
  database already has an admin, log in with that account.
- If you need a fresh start, stop the container, delete
  `/data/nommable.db` (you lose all data), and restart.

**Port already in use**
- Change `HOST_PORT` in the stack environment variables (e.g. `8993`).

## Production Checklist

- [ ] Strong `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` set (no defaults)
- [ ] `ADMIN_PASSWORD` changed after first login
- [ ] `CORS_ORIGIN` set to the real public URL
- [ ] HTTPS via reverse proxy (Traefik, Nginx Proxy Manager, etc.)
- [ ] Regular backups of `/data/nommable.db` and `/data/uploads`
- [ ] Portainer access control enabled
