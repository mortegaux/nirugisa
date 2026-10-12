# Nommable Handoff & Architecture Guide

> **Last Updated:** October 12, 2026  
> **Repository:** [https://github.com/mortegaux/nommable](https://github.com/mortegaux/nommable)  
> **Default Branch:** `main`  
> **Active Target:** Self-hosted Docker / Portainer Stack

---

## 1. Project Overview & Environments

Nommable is a self-hosted recipe management system featuring per-user data isolation, calendar meal planning, automated shopping list compilation, recipe web scraping, intelligent raw text extraction, and optional multi-provider AI integrations.

### Architecture & Workspaces
- **Monorepo (`npm workspaces`):**
  - `@nommable/shared` (`packages/shared`): Common TypeScript models, interfaces, and DTOs.
  - `@nommable/backend` (`packages/backend`): Node.js / Express.js REST API using TypeORM and PostgreSQL.
  - `@nommable/frontend` (`packages/frontend`): React 18 + Vite SPA using Tailwind CSS, Radix UI, and Zustand.

### Development & Deployment Setup
- **Development Environment:** Android Laptop (Android host with Debian Linux VM execution shell).
- **Fast Local Build Cache (Important):** Because `/storage/emulated/10` is mounted over `virtiofs` / FUSE, running `tsc` or `vite build` directly in the workspace is slow. Copy changed `src/` directories into `/home/droid/.cache/projects/nommable-build` (on the VM's native `ext4` filesystem) and run `npm --prefix /home/droid/.cache/projects/nommable-build/packages/<pkg> run build` for 2-second builds.
- **Testing & Deployment Environment:** The user tests headlessly by deploying directly to a separate remote Linux server running Docker via **Portainer**.
- **Crucial Rule:** Do **not** leave local development servers (`npm run dev`) running in the background. Always commit and push working changes to GitHub (`main`) so the user can pull the latest image/code on their server.
- **Default System Admin Credentials:**
  - **Username:** `admin` (configurable via `ADMIN_USERNAME`)
  - **Password:** `admin123` (configurable via `ADMIN_PASSWORD` in `docker-compose.portainer.yml` / `.env`)
  - Seeded automatically on first boot by `packages/backend/src/services/seeder/admin-seeder.service.ts` with `isSystemAdmin: true`.
- **Port Mapping (Docker / Portainer):**
  - **`8765`**: Frontend Web UI (served via Nginx). Open `http://<server-ip>:8765` in the browser.
  - **`8766`**: Backend Express API. Note: Accessing this port directly in a browser results in `Cannot GET /` because it is an API-only server without root index routes.
  - **`5432`**: Internal PostgreSQL container network.

---

## 2. Latest Updates & Implemented Features

### Dynamic AI Model Retrieval (Oct 2026)
- **Problem Solved:** Previously, AI models had to be manually typed or hardcoded.
- **Implementation:**
  - Added `AIModelInfo` in `@nommable/shared/types/ai.ts`.
  - Added `AIService.listModels()` with provider-specific fetchers and curated fallbacks:
    - **OpenAI:** Queries `client.models.list()`, filtering for chat and reasoning models (`gpt-4o`, `gpt-4o-mini`, `o1`, etc.).
    - **Anthropic:** Queries `/v1/models` endpoint for Claude family models.
    - **Google Gemini:** Queries `/v1beta/models` via Google AI Studio API for `generateContent` models (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, etc.).
    - **Ollama:** Queries `${baseUrl}/api/tags` to list installed models and their disk sizes.
  - In-memory cache with **1-hour TTL** to prevent unnecessary API hits.
  - Endpoints added: `GET /api/ai/models` (using saved keys) and `POST /api/ai/models` (allowing live testing of newly typed unsaved keys).
  - Updated `AISettingsPage.tsx` with dynamic dropdown selection, recommended model badges, a live **"Refresh models"** button, and an arbitrary **Custom model** input fallback.

### Database Migration Hardening & Build Fix
- Added `EnsureBaselineTables1787949824881` migration.
- Guarantees that all 21 tables (including `recipe_collections`, `recipe_collection_items`, `recipe_views`, `recipe_ratings`, `batch_cooking_plans`, and `taxonomies`) are created with appropriate foreign keys and unique constraints even on databases upgraded from older releases.
- Fixed TypeScript compile error in backend `AIService.listModels` argument signature and OpenAI response parsing (`exit code: 2` during Docker build).
- Added `docker-compose.portainer.yml` and updated `docker-compose.yml` to use named volume for `uploads`.

### AI Connection Testing & Gemini Provider Hardening (Oct 2026)
- **Problem Solved:** 
  1. Testing connection in AI Settings was ignoring whatever model was selected in the dropdown (or unsaved API keys in the input) because `POST /api/ai/config/test` took no parameters and only tested the database's saved config or cached global provider instance.
  2. Testing Google Gemini was throwing `Model "gemini-1.5-flash" not found` regardless of what model was chosen. This was caused by the legacy `@google/generative-ai` package calling legacy `v1` endpoints (where 1.5/2.0 models didn't exist) and an overly broad catch block `error.message?.includes('models/')` which matched all Google SDK error URLs and replaced them with a hardcoded recommendation text.
- **Implementation:**
  - `aiApi.testConnection()` in frontend and `AIController.testConnection` in backend now accept ephemeral `{ provider, apiKey, model, baseUrl }` overrides directly from the active form state. If the user leaves `apiKey` blank, backend seamlessly decrypts and tests using the saved database key.
  - Rewrote `GoogleProvider` to use Google's official Generative Language `v1beta` REST API directly via `axios`. This supports all modern Gemini models (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, `gemini-flash-lite-latest`, etc.) with zero SDK version mismatch or legacy endpoint breakage.
  - Transparent error reporting: Specific HTTP 400, 401, 403, 404, and 429 errors from Google AI Studio are parsed and presented clearly to the user without masking.
  - Sanitized model fallbacks in all provider constructors so empty strings cleanly resolve to their respective recommended default model.

### 502 Bad Gateway Fix & Backend Hardening (Oct 2026)
- **Problem Solved:** Testing AI settings in self-hosted deployments returned HTTP `502 Bad Gateway`.
- **Root Cause & Fixes:**
  1. **Startup Crash on Missing `ENCRYPTION_KEY`:** In `packages/backend/src/config/index.ts`, missing `ENCRYPTION_KEY` in production called `process.exit(1)`, causing backend containers to crash on boot if users redeployed their Portainer stack without explicitly setting `ENCRYPTION_KEY` in stack environment variables.
     - *Fix:* Replaced fatal startup exit with `resolveEncryptionKey()`. If `ENCRYPTION_KEY` is not provided, it deterministically derives a 32-byte key from `JWT_SECRET` (always present), and hashes arbitrary passphrases with SHA-256 to ensure exact 32-byte keys without crashing.
  2. **Uncaught Decryption Exceptions:** Calling `decrypt(savedConfig.apiKey)` directly threw unhandled exceptions if the stored key was plaintext (pre-encryption legacy data) or if ciphertext format/auth tags did not match.
     - *Fix:* Introduced `safeDecrypt()` in `packages/backend/src/utils/crypto.ts` which detects unencrypted strings via `isEncrypted()`, catches decipher errors safely, and returns `undefined` rather than throwing. Replaced all raw `decrypt` calls across `AIService` and `AIController`.
  3. **Unprotected Route Handlers:** Unhandled errors during connection testing dropped requests without structured responses.
     - *Fix:* Added top-level try/catch blocks in both `AIService.testConnection` and `AIController.testConnection` to ensure structured `{ success: false, message: ... }` JSON responses are always returned.
  4. **TypeORM Migration Resilience:** Replaced PL/pgSQL anonymous `DO $$` blocks in migrations with idempotent native PostgreSQL `ADD COLUMN IF NOT EXISTS` DDL guarded by `queryRunner.hasTable("ai_configs")`. Also ensured `ai_configs` table creation in `EnsureBaselineTables`.
  5. **Process Crash Guard:** Added process-level `unhandledRejection` and `uncaughtException` handlers in `packages/backend/src/index.ts` to prevent unexpected async rejections from terminating the Node server.
  6. **Nginx Timeouts:** Added `proxy_read_timeout 120s; proxy_connect_timeout 60s; proxy_send_timeout 60s;` in `packages/frontend/nginx.conf` so lengthy AI network requests do not get dropped by Nginx defaults.
  7. **Frontend User Feedback:** Updated `AISettingsPage.tsx` to provide clear, actionable guidance if the backend gateway is temporarily unavailable.

### AI Recipe Image Generation & Independent Model Configuration (Oct 2026)
- **Feature Overview:** Generates photorealistic culinary food photographs for recipes using Google AI (Gemini 2.0 Flash multimodal, Imagen 3) and OpenAI (DALL-E 3, DALL-E 2).
- **Independent Model Configuration & Multi-Strategy Routing:**
  - Users can select and configure their **Image Generation Model** independently from their **Text & Recipe Generation Model** in **AI Settings**.
  - Stored in `image_model` and `image_api_key` columns of `ai_configs` (via migrations `1787949824882-AddImageModelToAIConfig.ts` and `1787949824883-AddImageApiKeyToAIConfig.ts`).
  - **Google Multi-Strategy Execution:**
    1. **Gemini Multimodal:** Generates images via `generateContent` using `responseModalities: ["TEXT", "IMAGE"]` on `gemini-2.0-flash`.
    2. **OpenAI Compatibility Layer:** Queries Google's `/v1beta/openai/images/generations` endpoint.
    3. **Imagen Predict:** Queries Google's `/v1beta/models/{model}:predict` endpoint.
    4. **Smart Error Translation:** If Google returns 404/predict unsupported, the system transparently identifies that the API key lacks Google Cloud billing for Imagen/image models and provides clear, actionable guidance instead of raw endpoint errors.
  - **Cross-Provider Credentials:** Users can provide an optional **OpenAI API Key for Images** in AI Settings to use DALL-E 3 for photo generation even if their primary recipe text provider is Google, Anthropic, or Ollama.
- **On-the-Fly Model Override:**
  - `AIGenerateImageModal`: Users can pick an image model directly in the modal when generating photos for recipes (Default from settings, Gemini 2.0 Flash, Imagen 3, DALL-E 3, DALL-E 2, or custom).
- **Architecture & Persistence:**
  - AI image models return Base64 image data which the backend immediately converts into binary buffers and saves permanently into `/uploads/recipes/recipe-ai-<timestamp>.jpg` within the named `/uploads` volume.
  - No temporary expiring URLs; images are served locally and persist across stack restarts.
  - Automatically updates `recipe.imageUrl` in PostgreSQL.
- **Backend Endpoints:**
  - `POST /api/recipes/:id/generate-image`: Generates an image tailored to an existing recipe and updates the recipe record; accepts optional `{ prompt, model }`.
  - `POST /api/recipes/generate-image`: Standalone endpoint generating a preview image given `{ title, description, cuisine, prompt, model }`.
  - `POST /api/recipes/generate` supports `generateImage: true` to auto-generate and attach a photo during recipe creation.
  - `GET /api/ai/models?type=image` and `POST /api/ai/models` (`{ type: 'image' }`): Returns available image generation models.
- **Frontend Integration:**
  - `AIGenerateImageModal`: Dedicated modal with prompt customization, style presets (Restaurant Plating, Rustic Home-cooked, Bright & Airy, Dark & Moody), image model selector, live preview, and regenerate/apply buttons.
  - `AISettingsPage`: Independent model selector for Text Generation vs Image Generation, plus optional dedicated image API key input.
  - `RecipeDetailPage`: Action buttons added to hero image overlay, "AI Photo" quick button when no image exists, and option inside the action dropdown menu.
  - `ImageUpload`: Added "AI Generate" mode tab for creating images during manual recipe editing.
  - `AIGenerateRecipeModal`: Added checkbox to automatically generate an AI photograph alongside the recipe.
- **Build Hardening:**
  - Fixed TypeORM 0.3 relations object syntax `{ ingredients: true }` in `AIService.generateAndSaveRecipeImage`.
  - Added optional chaining on `response.data?.[0]` in `OpenAIProvider.generateImage` to satisfy strict null checks.
  - Added explicit typing on `req.params.id` in `RecipeController` and callback parameters in `AIGenerateImageModal.tsx` and `RecipeDetailPage.tsx` preventing exit code 2 during `npm run build` in Docker.

---

## 3. Database Schema & Migrations

- **Database:** PostgreSQL with TypeORM.
- **Schema Management:** Driven strictly by migrations (`migrationsRun: true` when `DB_SYNCHRONIZE=false`).
- **Baseline Migration:** `1787949824880-BaselineSchema.ts` (creates baseline tables for clean installs).
- **Safety Migration:** `1787949824881-EnsureBaselineTables.ts` (creates missing tables idempotently for existing/upgraded volumes).
- **Image Model Migration:** `1787949824882-AddImageModelToAIConfig.ts` (adds `image_model` column to `ai_configs`).
- **Image Key Migration:** `1787949824883-AddImageApiKeyToAIConfig.ts` (adds `image_api_key` column to `ai_configs`).
- **Resetting Database (Testing only):**
  - To wipe the database completely on Portainer: Stop the stack, remove the PostgreSQL volume, and restart the stack.

---

## 4. Key Security & Environment Variables

- `JWT_SECRET`: Secret key used to sign and verify user authentication tokens.
- `ENCRYPTION_KEY`: 32-byte hex string (`openssl rand -hex 32`) used for AES-256-GCM encryption of stored AI API keys at rest.
- `DB_SYNCHRONIZE`: Set to `false` for production/Portainer (schema is managed via migrations).
- `CORS_ORIGIN`: Allowed origins (e.g. `http://<server-ip>:8765`).
- All API routes and database queries enforce `userId` scoping to ensure multi-user isolation.

### Docker Build Exit Code 2 Fix (Oct 2026)
- **Problem Solved:** Portainer / Docker Compose failed with `failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 2`.
- **Root Cause & Fixes:**
  1. **Strict TypeORM DeepPartial Mismatch:** In `packages/backend/src/api/controllers/ai.controller.ts`, `imageApiKey` was typed as `string | undefined` in `AIConfig.ts`, but `createConfig` passed `imageApiKey ? encrypt(imageApiKey) : null` and `updateConfig` assigned `null`. Under strict null checks, TypeORM's `DeepPartial<AIConfig>` rejected `string | null` for `imageApiKey`, causing `tsc` to exit with status 2 during Docker image build.
     - *Fix:* Replaced `null` fallback with `undefined` in `aiConfigRepo.create(...)` and `config.imageApiKey = ... ? ... : undefined`, along with trim handling for optional `model`, `imageModel`, and `baseUrl`.
  2. **TypeORM 0.3 Relations Syntax & Callback Typing:** In `packages/backend/src/api/controllers/recipe.controller.ts`, updated `getRecentlyViewed` to use TypeORM 0.3 relations object syntax `{ recipe: { ingredients: true } }` and explicitly typed the callback parameter in `views.map((v: any) => v.recipe)` to prevent implicit `any` compiler errors.
  3. **Verification:** Validated that `npm run build` cleanly compiles all three workspaces (`@nommable/shared`, `@nommable/backend`, `@nommable/frontend`) with zero errors (exit code 0).

### Image Generation 400 Unknown Parameter Fix (Oct 2026)
- **Problem Solved:** Generating recipe photos using DALL-E (or Google OpenAI-compatible endpoints) returned `400 Unknown parameter: 'response_format'`.
- **Root Cause & Fixes:**
  1. **Unsupported `response_format` in Image APIs:** OpenAI's image generation endpoint and Google's OpenAI-compatible image endpoint reject the `response_format` parameter on modern image models with `400 Unknown parameter: 'response_format'`.
  2. **Universal Image Extraction:** Updated `OpenAIProvider.generateImage` and `GoogleProvider.tryOpenAICompat` to omit the `response_format` parameter completely. The response parser now dynamically handles both payload types:
     - Direct `b64_json` (used by modern image models returning Base64 buffers directly).
     - Image `url` (used by DALL-E endpoints returning temporary URLs; automatically downloaded via `axios` as an `arraybuffer` and converted directly into a binary Buffer).
  3. **Verification:** Verified clean build with 0 compiler errors and comprehensive fallback for DALL-E 3 and DALL-E 2.

### OpenAI GPT-Image Series & Retired DALL-E Fallback (Oct 2026)
- **Problem Solved:** Calling OpenAI image generation with `dall-e-3` or `dall-e-2` failed with `400 The model 'dall-e-3' does not exist`.
- **Root Cause & Fixes:**
  1. **OpenAI DALL-E Retirement:** OpenAI officially retired `dall-e-3` and `dall-e-2` in favor of its `gpt-image` model family (`gpt-image-1.5`, `gpt-image-2.5-sunburst`, `gpt-image-1`). Requesting retired model names on standard OpenAI API accounts produces `400 The model 'dall-e-3' does not exist`.
  2. **Modern Model Lineup & Intelligent Fallback:**
     - Updated default OpenAI image model to `gpt-image-1.5` (modern recommended default with high instruction adherence and fast generation).
     - Added `gpt-image-2.5-sunburst` and `gpt-image-1` to model selector dropdowns in both `AISettingsPage` and `AIGenerateImageModal`, clearly labeling DALL-E models as `(Retired by OpenAI)`.
     - In `OpenAIProvider.generateImage`, implemented proactive mapping and an automated candidate retry loop:
       - When `dall-e-3` or `dall-e-2` is requested (from legacy configs or settings), it prioritizes `['gpt-image-1.5', 'gpt-image-1', 'gpt-image-2.5-sunburst', requested]`, preventing unnecessary failing HTTP 400 round-trips while keeping the legacy model in the chain as a last resort.
       - Robust error detection catches all missing/retired model error signatures (`does not exist`, `model_not_found`, HTTP 400/404) and continues through candidates without failing user requests.
     - Preserved legacy `dall-e-3` and `dall-e-2` support for backward-compatibility with older proxies or private gateways.
  3. **Verification & Production Validation:**
     - Validated that full monorepo build passes cleanly with zero errors (`@nommable/backend` tsc exit code 0, `@nommable/frontend` tsc + vite build exit code 0).
     - Confirmed operational end-to-end in production: stack deployment succeeded, OpenAI `gpt-image-1.5` image generation operates properly, and transparent fallback rescues any legacy DALL-E configurations.

### User Management, Invitations & Admin Protection Rework (Oct 2026)
- **Problem Solved:** 
  1. Invitations did not send because `EmailService.sendInvitation` was a mock console logger with no real email integration, and tokens were omitted from API responses so admins could not copy links.
  2. When logged in as an administrator, admins could delete their own account, delete the system administrator, or delete the last remaining administrator in the system.
- **Root Cause & Fixes:**
  1. **Native SMTP Delivery with Zero Dependencies:**
     - Implemented RFC 5321 SMTP client in `EmailService.ts` using Node.js native `net` and `tls` sockets. Supports SSL (port 465) and STARTTLS (port 587/25) with authentication and responsive HTML templates.
     - Gracefully falls back if SMTP is not configured: returns `emailSent: false` and the full `inviteUrl` without crashing.
  2. **Copyable Registration Links:**
     - Both `POST /api/invitations` and `GET /api/invitations` now return `token` and `inviteUrl`.
     - In the UI, creating an invite provides an **"Invitation Ready"** modal with 1-click **Copy Link** button and delivery status.
     - Added `POST /api/invitations/:id/resend` to refresh expiration and re-trigger email sending.
  3. **Multi-Tier Admin & Self-Deletion Protection:**
     - `UserService.getAllUsers` now selects and returns `isSystemAdmin: boolean`.
     - `UserService.deleteUser` prevents self-deletion (`userId === currentUserId`), deleting system admin (`user.isSystemAdmin || user.username === config.admin.username`), and deleting the last remaining admin (`adminCount <= 1`).
     - `UserService.updateUserRole` prevents demoting system admin, demoting self, or demoting the last remaining admin.
     - Added `UserService.resetPassword` (`POST /api/users/:userId/reset-password`) allowing admins to reset passwords and generate temporary passwords for users with a copy-to-clipboard modal.
  4. **Frontend Modernization (`UserManagement.tsx`):**
     - User metrics bar (Total Users, Administrators, Members, Pending Invites).
     - Live search filter and role selector.
     - Visual badges: `System Admin` (shield icon) and `You`.
     - Protected action buttons (delete & demote disabled for root, self, and last admin).
     - Direct user creation modal with username suggestions and temporary password generator.
     - Pending invitations table with 1-click **Copy Link**, **Resend**, and **Revoke** actions.
  5. **Verification:**
     - `@nommable/shared`: `tsc` -> 0 errors
     - `@nommable/backend`: `tsc` -> 0 errors
     - `@nommable/frontend`: `tsc && vite build` -> 0 errors

### Recipe Image & Persistent Uploads Fix (Oct 2026)
- **Problem Solved:** Uploaded and AI-generated recipe images were lost upon container redeployment/rebuild in Portainer.
- **Root Cause & Fix:**
  - In `packages/backend/Dockerfile`, `WORKDIR` is `/app/packages/backend`. `process.cwd()` evaluated to `/app/packages/backend`, so uploads were saved to and served from `/app/packages/backend/uploads`.
  - In `docker-compose.portainer.yml`, the persistent Docker volume `uploads` was mounted to `/app/uploads`. Images were thus written into the container's ephemeral layer instead of the persistent volume and vanished when Docker recreated the container.
  - **Resolution:**
    1. In `config/index.ts`, `upload.dir` now resolves `UPLOAD_DIR`, checks `/app/uploads` (mounted volume), and falls back to `path.join(process.cwd(), 'uploads')`.
    2. In `app.ts`, `express.static` serves from `config.upload.dir`, `/app/uploads`, and local `./uploads` to ensure all existing and new images are reachable.
    3. In `upload.ts` (multer) and `ai.service.ts`, files are written to `config.upload.dir`.
    4. In `docker-compose.portainer.yml` and `docker-compose.yml`, set `UPLOAD_DIR: /app/uploads` and dual-mount `uploads` volume to both `/app/uploads` and `/app/packages/backend/uploads`.

### Recipe URL Scraper & Cloudflare Protection Fix (Oct 2026)
- **Problem Solved:** Importing recipes from food blogs like `https://www.thechunkychef.com/best-homemade-sloppy-joes/` resulted in an unhandled "Internal Server Error" (HTTP 500).
- **Root Cause & Fix:**
  1. **Cloudflare Impersonation Detection:** The scraper previously sent a spoofed `Chrome/120` User-Agent with `Sec-Fetch-*` browser headers. Cloudflare detected the TLS fingerprint mismatch from Node.js and blocked requests with HTTP 403 Forbidden.
  2. **Adaptive Client User-Agent:** Implemented multi-tier User-Agent negotiation in `ScraperService.fetchHtml`. Sending an honest application identifier (`Nommable/1.0 (Recipe Importer)`) avoids browser spoofing heuristics, allowing direct HTTP 200 recipe extraction.
  3. **WordPress REST API Fallback:** For sites with aggressive bot management, added automated fallback to the public WordPress REST API (`/wp-json/wp/v2/posts?slug=<slug>`), parsing structured recipe content from WP Recipe Maker (WPRM), Tasty Recipes, and Mediavine Create.
  4. **Wayback Machine Fallback:** Added secondary fallback to Wayback Machine snapshots for blocked legacy domains.
  5. **Operational Error Handling:** `RecipeController.importFromUrl` now wraps scraper errors as `AppError(422)` with descriptive messages instead of failing into generic 500 errors.

### Paste Text Recipe Extraction (`37b95c1`, Oct 2026)
- **Feature Overview:** Replaced the raw JSON import option in the Recipe Import modal with an intelligent **Paste Text** tab (`POST /api/recipes/extract-from-text`). Users can copy and paste unformatted or poorly formatted website/document text (including blog posts with navigation clutter, ads, checkboxes, unicode fractions, or headerless recipe notes) and have Nommable parse and generate a structured recipe preview.
- **Architecture & Files:**
  1. **Multi-Provider AI Text Extraction:**
     - Added `extractRecipeFromText?(text: string): Promise<AIGeneratedRecipe>` to `IAIProvider` (`packages/backend/src/services/ai/types.ts`).
     - Implemented across all 4 providers:
       - `OpenAIProvider.extractRecipeFromText` (`packages/backend/src/services/ai/providers/openai.provider.ts`)
       - `AnthropicProvider.extractRecipeFromText` (`packages/backend/src/services/ai/providers/anthropic.provider.ts`)
       - `GoogleProvider.extractRecipeFromText` (`packages/backend/src/services/ai/providers/google.provider.ts`)
       - `OllamaProvider.extractRecipeFromText` (`packages/backend/src/services/ai/providers/ollama.provider.ts`)
  2. **Deterministic Heuristic Fallback (`packages/backend/src/utils/recipe-text-parser.ts`):**
     - Orchestrated by `AIService.extractRecipeFromText` (`packages/backend/src/services/ai/ai.service.ts`).
     - If no AI provider is configured, or if the AI provider call fails, Nommable automatically falls back to `parseRecipeFromTextHeuristic(rawText)`:
       - Strips website boilerplate (`Jump to Recipe`, `Print Recipe`, `Pin Recipe`, `1x 2x 3x`, star ratings, author metadata).
       - Normalizes HTML tags/entities and unicode fractions (`½` -> `1/2`, `¼` -> `1/4`, `¾` -> `3/4`, etc.).
       - Extracts `prepTime`, `cookTime`, `servings`, and `nutrition` (`calories`, `protein`, `carbohydrates`, `fat`) across both inline and multi-line label formats.
       - Supports both header-delimited recipes (`Ingredients` / `Instructions`) and headerless plain-text recipes via line-level ingredient vs. cooking-verb classification.
       - Parses each ingredient line into `{ quantity, unit, name, notes, section }` with support for sub-sections (e.g., `For the Sauce:`), parenthetical notes, and trailing comma notes.
       - Transparently supports raw JSON via `normalizeRawRecipeJson` if a user pastes JSON into the text box.
  3. **Backend Route & Controller:**
     - `POST /api/recipes/extract-from-text` in `packages/backend/src/api/routes/recipe.routes.ts`.
     - `RecipeController.extractFromText` in `packages/backend/src/api/controllers/recipe.controller.ts` auto-categorizes extracted recipes via `RecipeCategorizerService.autoCategorizRecipe` and normalizes ingredient quantities with `parseFraction`.
  4. **Frontend Preview & Save Flow (`packages/frontend/src/features/recipes/RecipeImportExport.tsx` & `packages/frontend/src/services/api.ts`):**
     - Added `recipeApi.extractFromText(text: string)` client method.
     - Replaced the `Import JSON` tab with `Paste Text`, displaying the extracted recipe preview card with 1-click **Save Recipe** and **Back** controls.

### Recipe Filtering Fix & Inline Tag/Category Management (Oct 2026)
- **Problems Solved:**
  1. Selecting a category or tag filter on `/recipes` (e.g., `"Appetizer"`) continued showing all recipes even when none matched.
  2. Custom tags were hidden on recipe cards and detail pages because only hardcoded `DIETARY_BADGES` keys were displayed.
  3. Adding or removing tags/categories required navigating into the 4th tab (`Details`) of the Edit Recipe form, and did not allow typing custom tags/categories.
- **Root Cause & Fixes:**
  1. **Query Parameter Serialization & Parsing (`api.ts`, `recipe.controller.ts`):**
     - `RecipesPage.tsx` passed `categories: Array.from(selectedCategories)` to `axios.get('/recipes', { params })`, which Axios serialized as `?categories[]=Appetizers`. Express parsed `req.query.categories` as an Array (`['Appetizers']`), causing `categories.split(',')` in `RecipeController.findAll` to throw `TypeError: categories.split is not a function` (HTTP 500). `RecipesPage.tsx` caught the 500 error and left the existing unfiltered `recipes` array on screen.
     - Fixed `recipeApi.getAll` in `packages/frontend/src/services/api.ts` to serialize array parameters as comma-separated strings, and added `parseArrayParam()` in `packages/backend/src/api/controllers/recipe.controller.ts` to accept strings, arrays, and `key[]` query parameters.
  2. **Case-Insensitive & Singular/Plural JSONB Filtering (`recipe.service.ts`):**
     - Updated `RecipeService.findAll` in `packages/backend/src/services/recipe/recipe.service.ts` with `expandFilterTerms()` (`"Appetizer"` <-> `"appetizers"`), `jsonb_typeof(...) = 'array'` guards, and case-insensitive `LOWER(...) IN (...)` matching across `recipe.categories` and `recipe.tags`.
  3. **Recipes Page Filter UX (`RecipesPage.tsx`):**
     - Combined taxonomy categories/tags with custom categories/tags found on recipes in the filter dropdowns.
     - Hid `"Recently Viewed"` and `"Suggested For You"` carousels whenever any search or filter is active so only matching results (or `"No recipes match your filters"`) are shown.
     - Displayed all `recipe.tags` on recipe cards (not just hardcoded dietary badges).
  4. **Inline Tag & Category Management on Recipe Page (`RecipeDetailPage.tsx`) & Edit Form (`RecipeForm.tsx`):**
     - Added 1-click removal (`×`) on tag and category pills directly on `RecipeDetailPage.tsx`, plus an inline `+ Add Tag` panel with **Tags / Categories** mode toggle, custom text input (`Enter` to add), and 1-click preset pills that save immediately via `recipeApi.update`.
     - Added custom category & tag inputs + quick-toggle pills to both the **Basics** tab and **Details** tab in `RecipeForm.tsx`.

### Unified Recipe Image Storage & PostgreSQL Backup (Oct 2026)
- **Architecture (`packages/backend/src/services/image-storage.service.ts`):**
  1. **Single Storage Pipeline:** All recipe images—whether AI-generated (`AIService.generateAndSaveRecipeImage`), manually uploaded (`RecipeController.uploadImage`), or imported via URL (`RecipeController.importFromUrl`)—as well as user profile photos (`UserController.uploadProfilePhoto`) now use `ImageStorageService`.
  2. **Unified Directory & Naming:** All recipe images are written to the same `/uploads/recipes/` directory (`config.upload.dir/recipes`) with the unified `recipe-<timestamp>-<random>.<ext>` naming convention and mirrored across candidate upload roots (`/app/uploads` and `./uploads`).
  3. **PostgreSQL Binary Backup (`stored_images` table):** Every saved image is also persisted in PostgreSQL (`stored_images`: `file_path`, `mime_type`, `data` `bytea`, `created_at`).
  4. **Startup Sync & On-Demand Self-Healing (`index.ts`, `app.ts`):**
     - On startup, `ImageStorageService.initialize()` backs up any existing disk images into PostgreSQL and restores any database images missing from disk.
     - In `app.ts`, if `express.static` does not find `/uploads/:subdir/:filename` on disk (e.g., after a container rebuild or volume reset), the fallback route serves the image directly from PostgreSQL and restores the file to disk automatically.
  5. **Edit Form AI Image Auto-Save (`ImageUpload.tsx`, `RecipeForm.tsx`):**
     - Passed `recipeId` into `ImageUpload` so generating an AI image while editing an existing recipe immediately saves `imageUrl` to the recipe record in PostgreSQL, matching file upload behavior.

### Email / SMTP Settings UI & PostgreSQL Persistence (Oct 2026)
- **Problem Solved:** When inviting a new user, the UI reported that SMTP was not configured on the server, but there was nowhere in the web application to configure or test SMTP settings (previously only readable via `SMTP_*` environment variables).
- **Architecture & Implementation:**
  1. **PostgreSQL Persistence with Encrypted Credentials (`packages/backend/src/services/email/email.service.ts`):**
     - `EmailService.initialize()` creates the `"smtp_settings"` table in PostgreSQL (`id`, `host`, `port`, `secure`, `username`, `password_encrypted`, `from_email`, `from_name`, `enabled`, `updated_at`).
     - Passwords are encrypted at rest using AES-256-GCM (`encrypt` / `safeDecrypt` in `packages/backend/src/utils/crypto.ts`).
     - `EmailService.getEffectiveConfig()` reads from PostgreSQL first and falls back to `SMTP_*` environment variables (`config.smtp`) if not configured in the database.
     - Added `AUTH PLAIN` fallback alongside `AUTH LOGIN` in `sendRawSmtp()` and support for custom sender display names (`From: "Sender Name" <email>`).
  2. **Admin API Endpoints (`packages/backend/src/api/routes/settings.routes.ts`, `settings.controller.ts`):**
     - `GET /api/settings/smtp` (admin only): Returns current SMTP settings (`hasPassword`, `source`, `isConfigured`) without exposing the plaintext password.
     - `PUT /api/settings/smtp` (admin only): Saves SMTP configuration to PostgreSQL (preserving the existing encrypted password when `pass` is left blank).
     - `POST /api/settings/smtp/test` (admin only): Tests SMTP connectivity and sends a live test email using either the saved config or unsaved form values.
  3. **Frontend UI (`packages/frontend/src/features/settings/EmailSettings.tsx`, `SettingsPage.tsx`, `UserManagement.tsx`):**
     - Added an **Email / SMTP** tab in **Settings** (`SettingsPage.tsx`) for administrators.
     - Added 1-click **Provider Presets** (Gmail / Google Workspace, Outlook / Microsoft 365, Fastmail, iCloud Mail, Mailgun / SendGrid / SES) with inline setup hints (e.g., Google App Passwords) and automatic port/TLS selection.
     - Added a **Send Test Email** tool to verify SMTP settings directly from the UI.
     - Integrated live SMTP status and a 1-click **Configure SMTP** modal directly inside **User Management** (`UserManagement.tsx`) and inside the **Invite New User** modal so admins can configure SMTP and immediately click **Send Email Now** without leaving the invitation flow.

### Granular Shared Library & Author Attribution (Oct 2026)
- **Feature Overview:** Allows administrators to choose which library elements are shared across all users vs. kept private per user in **Settings → Data Management**, with individual toggles for:
  1. **Shared recipes and tags** (`sharedRecipes`) — with a nested **"Show who added or created each recipe"** (`showRecipeAuthor`) toggle
  2. **Shared collections and favorites** (`sharedCollections`) — with automatic consolidation of per-user Favorites lists into a single unified Favorites collection
  3. **Shared meal plans and templates** (`sharedMealPlans`)
  4. **Shared shopping lists** (`sharedShoppingLists`)
  5. **Shared pantry inventory** (`sharedPantry`)
  6. **Shared batch cooking plans** (`sharedBatchCooking`)
- **Architecture & Implementation:**
  1. **System Settings Persistence (`packages/backend/src/services/settings/system-settings.service.ts`):**
     - `SystemSettingsService.initialize()` creates/migrates the `"system_settings"` table in PostgreSQL (`id = 'default'`, `shared_recipes`, `show_recipe_author`, `shared_collections`, `shared_meal_plans`, `shared_shopping_lists`, `shared_pantry`, `shared_batch_cooking` — all `boolean NOT NULL DEFAULT true`) and caches the settings in memory.
     - Exposed via `GET /api/settings/general` and `PUT /api/settings/general` (admin only) in `settings.routes.ts` / `settings.controller.ts`.
  2. **Shared Library Access & Author Attribution Across Services:**
     - `RecipeService`: When `sharedRecipes` is `true`, `findAll`, `findById`, `update`, `delete`, `bulkDelete`, `bulkUpdate`, and `getDistinctCategories` operate across the shared recipe catalog without filtering by `userId`.
     - When `sharedRecipes && showRecipeAuthor` are both enabled, `RecipeService` (`findAll`, `findById`), `RecipeController.getRecentlyViewed`, `CollectionService.findById`, and `SuggestionService.getSuggestions` join `recipe.user` and attach a sanitized `author` object (`id`, `username`, `firstName`, `lastName`, `profilePhotoUrl`) via `RecipeService.formatRecipeWithAuthor()` while stripping raw `recipe.user`.
     - `CollectionService`: When `sharedCollections` is `true`, all users share custom collections and a consolidated Favorites collection (`getOrConsolidateSharedFavorites`).
     - `MealPlanService` & `MealPlanTemplateService`: When `sharedMealPlans` is `true`, all users share meal plans and saved templates.
     - `ShoppingListService`: When `sharedShoppingLists` is `true`, all users share shopping lists and item check-off state.
     - `PantryService` & `SuggestionService`: When `sharedPantry` is `true`, all users share the household pantry inventory and pantry-based recipe suggestions.
     - `BatchCookingService` & `BatchCookingAnalyticsService`: When `sharedBatchCooking` is `true`, all users share batch cooking plans, checklists, and analytics.
     - `UserService.deleteUser`: Reassigns any enabled shared entities (`Recipe`, `RecipeCollection`, `MealPlan`, `MealPlanTemplate`, `ShoppingList`, `PantryItem`, `BatchCookingPlan`) created by a deleted user to the administrator performing the deletion so shared library data is never lost on user deletion.
  3. **Admin UI Controls & Recipe Attribution Display (`DataManagement.tsx`, `UserManagement.tsx`, `RecipesPage.tsx`, `RecipeDetailPage.tsx`):**
     - Added a **Library Sharing Mode** card in **Settings → Data Management** (`Shared Library` with **Select All / Deselect All** and individual switches for all 6 library modules + nested `showRecipeAuthor` switch vs. `Per-User Private Library`).
     - Added quick `Shared Recipes: ON / OFF` and `Show Author: ON / OFF` toggle buttons in the **Settings → User Management** header bar.
     - Displayed `Added by <Name / @username>` with avatar/initials on recipe cards (`RecipesPage.tsx` — main grid, Recently Viewed, and Suggested For You) and in the recipe detail header (`RecipeDetailPage.tsx` — hero overlay, no-image header, and print view) whenever `recipe.author` is present.

### Nommable Brand Logo & Favicons (PR #4, Oct 2026)
- **Feature Overview:** Added the Nommable chef's-hat brand icon across the application header and browser favicons (`d4b88c6`).
- **Files & Implementation:**
  - Added binary PNG assets in `packages/frontend/public/`: `logo.png` (256×256), `favicon-32x32.png` (32×32), `favicon-16x16.png` (16×16), and `apple-touch-icon.png` (180×180).
  - Updated `packages/frontend/index.html` to reference `/favicon-32x32.png`, `/favicon-16x16.png`, and `/apple-touch-icon.png` (replacing the default `/vite.svg`).
  - Updated `packages/frontend/src/features/layout/DashboardLayout.tsx` to display `/logo.png` next to the `Nommable` brand link in the top navigation bar.

### User Feedback UX Enhancements: Pantry, Collections, Shopping Lists, Meal Plans & Batch Cooking (PR #5, Oct 2026)
- **Feature Overview:** Addressed 6 usability workflows across the frontend (`2493d50`):
  1. **Pantry-Matched Recipe Suggestions (`RecipesPage.tsx`):**
     - Styled the suggestions carousel as an emerald-tinted band titled **"Suggested from your pantry"** with per-card `"Uses N of M pantry ingredients"` badges.
  2. **Compact Pantry Layout (`PantryPage.tsx`):**
     - Replaced oversized cards with dense, scannable rows preserving 40px touch targets, expiration/low-stock status tints, quantity `+/-` steppers, low-stock toggle, and delete actions.
  3. **Bidirectional Recipe-to-Collection Flows (`AddRecipesDialog.tsx`, `CollectionDetailPage.tsx`, `AddToCollectionDialog.tsx`, `RecipesPage.tsx`):**
     - Added an **"Add Recipes"** button and empty-state CTA in `CollectionDetailPage.tsx` opening `AddRecipesDialog.tsx` (searchable multi-select modal).
     - Added an **"Add to Collection"** action in the `RecipesPage.tsx` bulk selection bar opening `AddToCollectionDialog.tsx` (add selected recipes to an existing collection or create a new collection inline).
  4. **Shopping List State Sync & Auto-Categorization (`ShoppingListsPage.tsx`):**
     - Fixed stale state when adding, renaming, or deleting items in the currently selected shopping list so the active list view updates immediately.
     - Added keyword-based grocery category auto-detection (~180 common ingredient keywords) with an editable category dropdown.
  5. **Multi-Recipe Per-Day Meal Plan Builder (`MealPlanBuilder.tsx`, `MealPlanDashboard.tsx`, `mealPlanEntry.ts`):**
     - Redesigned the meal plan builder around a per-day list supporting multiple recipes per day, each with a meal-type tag (`Breakfast`, `Lunch`, `Dinner`, `Snack`) and optional time (`[HH:MM]` prefix encoded in `notes`, backward-compatible with existing plans).
  6. **Guided Batch Cooking Session Wizard (`CreateBatchSessionModal.tsx`, `BatchCookingPage.tsx`):**
     - Added a guided 3-step batch cooking wizard (pick recipes → review portions & prep date → save) and an inline setup helper to apply the `Freezer-Friendly` tag when no recipes have batch-cooking tags yet.

### Feedback Round 2: Batch Cooking Local-Date Fix & Shopping List Redesign (PR #6, Oct 2026)
- **Feature Overview:** Addressed 2 follow-ups from live testing (`490c190`):
  1. **Batch Cooking Local-Calendar Date Handling (`batchCookingDates.ts`, `CreateBatchSessionModal.tsx`, `CreateBatchPlanModal.tsx`, `BatchCookingPage.tsx`):**
     - Fixed UTC-midnight date shift where selecting "today" was rejected by date validation and selecting "tomorrow" displayed/recorded as "today" in negative-offset timezones.
     - Added shared `batchCookingDates.ts` helpers to parse `YYYY-MM-DD` strings as local calendar dates and compare calendar days accurately across the session wizard, plan modal, and plan list display.
  2. **Compact Shopping List Redesign (`ShoppingListsPage.tsx`):**
     - Replaced bulky item cards with dense divider rows, a pinned always-visible quick-add bar (`Enter` to add), one-tap recent-item chips, collapsible category sections in grocery aisle order, and an auto-collapsed **Completed** section for checked items.

### Shopping List Delete Toast Fix, Feedback Widget & Admin Inbox, and Mobile/Dark-Mode UX (PRs #7, #8, #9, Oct 2026)
- **PR #7 — Fix False "Failed to Delete" Toast on Shopping Lists (`ShoppingListsPage.tsx`, `c8ec052`):**
  - Prevented post-delete follow-up refresh failures from triggering a misleading `"Failed to delete"` error toast when the underlying `DELETE` request had already succeeded, updating local state optimistically and isolating refresh errors.
- **PR #8 — In-App Feedback Widget & Admin Triage Inbox (`61e2692`):**
  - **Database & Entity (`FeedbackReport.ts`, `1787949824884-CreateFeedbackReports.ts`):** Added the `feedback_reports` table storing `type` (`bug` / `feature`), `summary`, `details`, `route`, `user_agent`, `viewport`, `app_version`, `user_id`, and `status` (`open` / `in_progress` / `resolved` / `dismissed`).
  - **Backend API (`feedback.controller.ts`, `feedback.routes.ts`):** Added `POST /api/feedback` (authenticated users), `GET /api/feedback` (admin-only list with status/type filtering), and `PATCH /api/feedback/:id/status` (admin-only status triage).
  - **Frontend (`FeedbackWidget.tsx`, `FeedbackInboxPage.tsx`, `UserDropdown.tsx`, `DashboardLayout.tsx`, `App.tsx`, `api.ts`):** Mounted a floating feedback widget in `DashboardLayout`, added an admin-only **Feedback** inbox link in `UserDropdown`, and built `/admin/feedback` (`FeedbackInboxPage.tsx`) for reviewing and updating feedback status.
- **PR #9 — Mobile Header, Tag Collapse & Touch-Target Improvements (`e1416e4`):**
  - Improved mobile header spacing and touch targets across `DashboardLayout.tsx`, `UserDropdown.tsx`, and `StarRating.tsx`.
  - Added collapsible tag overflow (`+N more` / `Show less`) on `RecipeDetailPage.tsx` so recipes with many tags stay clean on mobile viewports.

### Intelligent Meal Plan Duplicate Recipe Fix (Oct 2026)
- **Problem Solved:** Generating a meal plan via **Smart Generate** (`IntelligentMealPlanModal`) inserted the exact same recipe for every meal slot across the entire plan.
- **Root Causes:**
  1. `MealPlanGenerationService.generatePreview()` passed the same unmodified candidate array into `generateMealSuggestion()` on every iteration without tracking already-selected recipes (`usedRecipeIds`), and `findBestRecipeForMeal()` always returned `filtered[0]` deterministically.
  2. When even 1 recipe met `minIngredientMatchScore` (`0.3`), `matchingRecipes.length > 0 ? matchingRecipes : candidateRecipes` discarded all other recipes in the library and passed only `matchingRecipes` into the loop.
  3. Clicking `🔄 Replace` in `MealPlanPreviewModal` called `replaceMeal` without passing `excludeRecipeIds`, returning the exact same `filtered[0]` recipe.
  4. `findBestRecipeForMeal()` only checked `recipe.tags` (ignoring `recipe.categories` and `excludeIngredients`).
- **Fixes (`meal-plan-generation.service.ts`, `MealPlansPage.tsx`, `meal-plan-generation.ts`):**
  - Replaced the hard `matchingRecipes` filter cutoff with priority score bonuses (`+30` for fresh recipes, `+25` for pantry-matching recipes) so the full library remains available after high-match recipes are assigned.
  - Tracked `usedRecipeIds` (`Set<string>`) and `usageCountByRecipeId` (`Map<string, number>`) across meal slots so every slot picks an unused recipe first (matching meal-type tags/categories and culinary aliases, then falling back to unused recipes in the general pool before ever repeating).
  - Added randomized tie-breaking among top-tier candidates (within 15 priority points of the top score) for natural variety across generated plans.
  - Updated `ReplaceMealRequest` and `MealPlansPage.handleReplaceMeal` to pass `excludeRecipeIds` (all recipe IDs currently in the preview) so `🔄 Replace` always picks a different recipe.

### BYOK Per-User AI Keys, Per-User Taxonomies & Security Hardening (PRs #10, #11, #1, Oct 2026)
- **PR #10 — Bring Your Own Key (BYOK) Per-User AI Configuration (`694558a`):**
  - **Database & Entity (`AIConfig.ts`, `1787949824886-AddByokToAIConfig.ts`):** Added `is_global` (`boolean`, default `false`) and `ai_mode` (`'shared' | 'per-user'`, default `'shared'`) to `ai_configs`.
  - **Backend Resolution (`ai.service.ts`, `ai.controller.ts`, `ai.routes.ts`, `recipe.controller.ts`, `meal-plan.controller.ts`):** Added mode-aware provider resolution (`AIService.resolveProvider(userId)`), `/api/ai/my-config` endpoints (`GET`, `PUT`, `DELETE`, `POST /test`, `POST /models`) for authenticated non-admin users, and `sendAIUnavailable()` helper returning structured `AI_KEY_REQUIRED` responses when in `'per-user'` mode without a user key.
  - **Frontend (`UserAIKeySettings.tsx`, `AISettingsPage.tsx`, `SettingsPage.tsx`, `api.ts`):** Added an admin toggle between **Shared Instance Key** and **Per-User Keys (BYOK)** in `AISettingsPage.tsx` and a **Your AI Key** tab in `SettingsPage.tsx` (`UserAIKeySettings.tsx`) accessible to all users.
- **PR #11 — Per-User Taxonomy Scoping (`f40a2a6`):**
  - **Database & Entity (`Taxonomy.ts`, `User.ts`, `1787949824885-ScopeTaxonomiesPerUser.ts`):** Added `user_id` to `taxonomies` with per-user unique constraints `(user_id, name, type)` and backfilled existing taxonomy rows to every user.
  - **Service & Seeding (`taxonomy.service.ts`, `taxonomy.controller.ts`, `user.service.ts`, `seeder.service.ts`):** Scoped taxonomy CRUD, reordering, and recipe rename/delete propagation by `userId`, and seeded default categories/tags per user on startup and user creation.
- **PR #1 — Security Hardening: Secrets, SSRF Guard & Upload Validation (`66f2a1a`):**
  - Moved secrets out of `docker-compose.yml` and `release/docker-compose.yml` into gitignored `.env` files with `.env.example` templates, and added production startup guards in `config/index.ts`.
  - Added DNS/IP SSRF protection (`assertSafeUrl`, `isBlockedIp`) in `ScraperService` blocking loopback, private RFC1918, carrier-grade NAT, link-local/metadata (`169.254.0.0/16`), and IPv6 local ranges.
  - Added magic-byte image content verification (`validateImageContent` in `upload.ts`) across recipe image upload, extraction, and profile photo endpoints.

---

## 5. Developer & Workflow Checklist

Whenever completing any work:
1. **Ensure Documentation Integrity:** Keep comments, docs, and this `HANDOFF.md` updated.
2. **Update README:** Update `README.md` if user-facing behavior, settings, or endpoints change.
3. **Commit & Push to GitHub:**
   ```bash
   git add <files>
   git commit -m "feat/fix: descriptive summary"
   git push origin main
   ```
4. **Notify User:** Inform the user with the commit hash so they can pull/rebuild their Portainer stack.
