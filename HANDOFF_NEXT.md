# Nommable Handoff — 2026-10-12 (`HANDOFF_NEXT.md` — authoritative version)

For: the next agent picking this up when Pedro's credits reset.  
Repo: `mortegaux/nommable` (public, active) — `mortegaux/culinode` is archived with a pointer README.

## What's done

- **Nommable is live on GitHub:** `mortegaux/nommable`, clean history, no leaked secrets. 469 files migrated from Culinode with full rename (`culinode` → `nommable`, all case variants).
- **4 PNG favicons/logo:** `logo.png` (256x256), `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png` (180x180) copied into `packages/frontend/public/`. `index.html` already has the PNG favicon links and `DashboardLayout.tsx` already renders `/logo.png`.
- **Old repo archived:** `mortegaux/culinode` → Settings → Archived. README points to Nommable.
- **SQLite + single container (done):** PostgreSQL replaced with `better-sqlite3`. Single `1788000000000-InitialSchema.ts` migration creates all 26 tables (22 app + 4 Better Auth). One `Dockerfile` (multi-stage: shared → backend → frontend, backend serves SPA via Express static). `docker-compose.yml` = one service, one `/data` volume, one port (`8765` → `3001`). `DB_PATH` env var (default `/data/nommable.db`).
- **Better Auth (done):** v1.7.7, MIT verified. Replaces hand-rolled JWT/bcrypt. `src/lib/auth.ts` with `username()`, `admin()`, `bearer()` plugins. App keeps its `users` table linked by shared `id` via `ensureAppUser()`. Password hashing is now `scrypt`. Frontend Bearer pattern preserved — minimal SPA changes.
- **README updated** for the new stack and deploy instructions.
- **Stale `release/` directory deleted** (was a pre-SQLite copy of backend code).
- **All 4 leaked secrets rotated** on the live deployment (`culinode.gracklenet.com`). Admin password changed via API. AI provider key re-entered.
- **Name history:** Culinode → Nirugisa (picked, then rejected next morning) → Nomio (dead, 4 companies) → nomnomnom (dead, recipe app exists) → Nomsky (clear but Chomsky pun) → **Nommable** (picked from batch of 20 checked, 7 clear). Back-pocket: Butterdish, Namyo.

---

## What's next (in order — each step is a complete spec)

### 1. Onboarding wizard (Michael approved)
First-run flow shown when the app starts with no admin user yet. Steps:
1. **Admin account:** username + password (min 8 chars). Creates the first admin via Better Auth signup + `ensureAppUser()` with admin role.
2. **SMTP (skippable):** host, port, user, pass, from-address. "Skip for now" button. Stores in app settings table (or env override).
3. **Library mode:** shared library vs per-user private library. Radio select with plain-language descriptions.
4. **Shared portions:** if shared mode, checkboxes for which elements are shared: Recipes & Tags, Collections & Favorites, Meal Plans & Templates, Shopping Lists, Pantry Inventory, Batch Cooking Plans. (This mirrors the existing Admin → Data Management toggles — do NOT remove those; the wizard just sets initial values.)
5. **AI enabled?** Yes/No toggle.
6. **Gemini API key:** text input (only if AI enabled). Stored encrypted via the existing provider-key mechanism.
7. **Image provider:** dropdown of the currently working image providers + key input (only if AI enabled). Only include providers that actually work today — OpenAI, Anthropic, Ollama are backlog, do NOT include them.
8. **Enter dashboard:** completion screen with "Go to dashboard" button.

**Implementation notes:** Backend needs a `GET /api/setup/status` endpoint (returns `{needsSetup: boolean}`) and `POST /api/setup/complete` (accepts all wizard data, creates admin, saves settings). Frontend needs a `/setup` route that renders the wizard and redirects to `/` when `needsSetup` is false. The wizard must work before any login exists — no auth required on setup endpoints, but they must `403` once setup is complete (prevent re-running).

### 2. Rework auth-dependent tests for Better Auth sessions
The test suite compiles but auth tests are stubbed. They need:
- Replace mocked JWT/bcrypt with Better Auth test helpers (see Better Auth docs for `getTestInstance` or similar).
- Test signup → session → authenticated request flow using Bearer tokens.
- Test admin role gating via the `admin()` plugin.
- Files are in `packages/backend/src/__tests__/`. Look for `.skip` or `TODO` markers.

### 3. Portainer stack update (Michael's server — he does this part)
- In Portainer: Stacks → `nommable` → Environment variables.
- **Remove:** `POSTGRES_PASSWORD`, `DATABASE_PASSWORD`, `JWT_SECRET`.
- **Add:** `BETTER_AUTH_SECRET` (generate a new 32+ char random string), `DB_PATH=/data/nommable.db`.
- **Keep:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, `SMTP_*` vars, `CORS_ORIGIN`.
- Update the stack (re-pull ON) to pull the single-container build.
- **Breaking change — warn Michael:** no auto-migration from old Postgres data. The old `postgres_data` volume still exists but won't be read. Fresh start.

### 4. GitHub Issues backlog
Seed the `mortegaux/nommable` repo with initial issues:
- [ ] Onboarding wizard (link to spec above)
- [ ] Auth test rework
- [ ] Feedback widget developer-forwarding opt-in
- [ ] One-click deploy buttons (Railway/Render)
- [ ] Umbrel app store listing
- [ ] Unraid Community Applications listing
- [ ] Copy 4 PNG favicons/logo to `packages/frontend/public/` (files at `~/workspace/culinode-logo/site-assets/`)
- [ ] Mobile responsiveness pass (if not already done)
- [ ] Dark mode verification (if not already done)
Use labels: `enhancement`, `good first issue` (for small ones), `breaking-change` (for Portainer/data migration).

### 5. Feedback widget — developer forwarding opt-in
The in-app feedback widget currently saves to a local admin-only inbox (`/admin/feedback`). Add:
- A settings toggle (Admin → Settings): "Share anonymous feedback with Nommable developers" — default OFF.
- When ON, show explicit consent text before each submission: "This will send an anonymized report to the Nommable team. No names, emails, recipes, or private data are included."
- Anonymized payload: feedback text + app version + route + viewport + browser metadata. Strip everything else.
- Forwarding endpoint: TBD (Michael hasn't set up a receiver yet — flag this as blocked on his decision for where reports go).

### 6. One-click deploy buttons (Railway/Render)
- Add "Deploy on Railway" and "Deploy on Render" buttons to `README.md`.
- Create `railway.json` (or use their template spec) with: single container, `/data` persistent volume, required env vars (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`).
- Create `render.yaml` blueprint with same config.
- Test the button URLs before publishing.

### 7. Umbrel app store listing
- Create `umbrel-app-store/` directory or follow Umbrel's app packaging spec.
- Needs: `umbrel-app.yml` manifest, icon, description, port mapping, volume mount for `/data`.
- Reference: `https://github.com/getumbrel/umbrel-apps` for the manifest format.
- Submit PR to Umbrel's app store repo when ready (Michael approves).

### 8. Unraid Community Applications listing
- Create the CA template XML following the Community Applications spec.
- Needs: container icon, description, port/volume mappings, env var documentation.
- Reference: existing CA templates for single-container SQLite apps.
- Submit to the CA repository when ready (Michael approves).

---

## Key technical notes
- **Better Auth + TypeORM coexistence:** Better Auth manages its own tables (`user`, `session`, `account`, `verification`) on the same SQLite file in WAL mode. App's `users` table links by shared `id`. See `src/lib/auth.ts` and `ensureAppUser()`.
- **`declaration: false` in backend tsconfig** (required — Better Auth plugin types break `.d.ts` generation; backend is an app, not a library).
- **Michael's standing rule:** NEVER hand-roll auth (hashing, sessions, TOTP, CSRF) — always use a vetted library. Better Auth is the approved choice.
- **BYOK model:** every instance is BYOK. Michael never pays for AI on someone else's server. Two modes: shared admin key OR per-user BYOK. No silent fallback.
- **Secrets:** never in chat/memory. `ADMIN_PASSWORD` env is seed-only (doesn't change existing accounts). `ENCRYPTION_KEY` rotation invalidates stored provider keys.
