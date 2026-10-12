# Phase 4: Security — API Key Encryption + Rate Limiting

## Decisions

| Feature | Decision |
|---|---|
| Encryption algorithm | AES-256-GCM via Node.js built-in `crypto` |
| Key management | Single `ENCRYPTION_KEY` env var (32-byte hex) |
| Storage format | `iv:authTag:ciphertext` (base64) in existing VARCHAR column |
| Rate limiting | `express-rate-limit`, three tiers (global, auth, AI) |
| CI/CD | Not in scope — manual deployment via docker-compose |

## API Key Encryption

### CryptoService

New utility at `packages/backend/src/utils/crypto.ts` using Node's built-in `crypto` module (no new dependencies).

- `encrypt(plaintext: string): string` — generates random 16-byte IV, encrypts with AES-256-GCM, returns `iv:authTag:ciphertext` (all base64-encoded)
- `decrypt(encrypted: string): string` — splits on `:`, decodes base64, decrypts with AES-256-GCM
- `isEncrypted(value: string): boolean` — splits on `:`, validates exactly 3 segments, and checks that segment[0] (IV) and segment[1] (authTag) each decode to exactly 16 bytes. This prevents false positives from plaintext keys that happen to contain colons.

Reads `ENCRYPTION_KEY` from config. Throws a clear error if the key is missing or invalid length.

### Config Changes

Add to `packages/backend/src/config/index.ts`:
```
encryption: {
  key: process.env.ENCRYPTION_KEY || ''
}
```

**Startup validation:** After the config object is constructed, validate that `ENCRYPTION_KEY` is present and decodes to exactly 32 bytes. In production (`NODE_ENV === 'production'`), log a fatal error and `process.exit(1)` if missing. In development, log a warning but allow the app to start (AI key save/read will fail at runtime with a clear error).

Add `ENCRYPTION_KEY` to:
- `packages/backend/.env.example`
- `docker-compose.yml` (generate a random 32-byte hex value)

### AIConfig Integration

No schema changes — the `apiKey` VARCHAR column stores encrypted ciphertext instead of plaintext.

**On save** (AIController): encrypt the API key before passing to the repository.

**On read** (AIService.createProvider): decrypt the API key before passing to AI providers.

**Frontend:** No changes needed — it already never reads the API key back (only sends it when saving, receives `hasApiKey: boolean`).

### Migration Script

`scripts/encrypt-existing-keys.ts` — one-time script to encrypt plaintext keys already in the database:

1. Read all AIConfig rows where `apiKey` is not null
2. For each, check `isEncrypted(apiKey)` — skip if already encrypted
3. Encrypt the plaintext key and save back
4. Log count of migrated keys

Run via: `npx tsx scripts/encrypt-existing-keys.ts`

**Important:** Restart the backend service after running this script. The in-memory provider cache holds constructed provider instances using the old plaintext key — it will not auto-refresh. A restart forces `createProvider()` to read and decrypt the newly encrypted values.

## Rate Limiting

### Dependency

`express-rate-limit` — lightweight, in-memory store (no Redis needed for single-instance self-hosted).

### Three Tiers

Applied in `packages/backend/src/app.ts`:

**Global (all routes):**
- 100 requests per minute per IP
- Applied first via `app.use()`

**Auth (`/api/auth`):**
- 10 requests per minute per IP
- Brute force protection on login/register
- Applied in addition to the global limiter — a request to `/api/auth` is checked against both the 10/min auth limit and the 100/min global limit independently

**AI (`/api/ai`, `/api/recipes/generate`, `/api/recipes/:id/enhance`):**
- 20 requests per minute per user (keyed by `(req as AuthRequest).userId ?? req.ip ?? 'unknown'` — TypeScript strict mode requires handling the `undefined` case explicitly even though `authMiddleware` guarantees the value is set)
- Protects external API costs
- Applied on specific route paths

### Response

429 status with `{ error: "Too many requests, please try again later" }`.

Standard `RateLimit-*` headers sent automatically by the library.

### Order

All three limiters are independent middleware — they do not override each other. A request to `/api/auth` hits both the auth limiter (10/min) and the global limiter (100/min). A request to `/api/recipes/generate` hits both the AI limiter (20/min) and the global limiter. This is the desired behavior: stricter limits apply on sensitive routes, while all routes are still bounded by the global limit.

## Docker Compose Updates

Add `ENCRYPTION_KEY` to the backend service environment in `docker-compose.yml` with a generated random value.

## Files Affected

### New files
- `packages/backend/src/utils/crypto.ts` — CryptoService (encrypt/decrypt/isEncrypted)
- `scripts/encrypt-existing-keys.ts` — One-time migration for existing plaintext keys

### Modified files
- `packages/backend/src/config/index.ts` — Add `encryption.key` config
- `packages/backend/src/app.ts` — Add rate limiting middleware
- `packages/backend/src/api/controllers/ai.controller.ts` — Encrypt API key on save
- `packages/backend/src/services/ai/ai.service.ts` — Decrypt API key on read
- `packages/backend/package.json` — Add `express-rate-limit` dependency
- `packages/backend/.env.example` — Add `ENCRYPTION_KEY`
- `docker-compose.yml` — Add `ENCRYPTION_KEY` env var
