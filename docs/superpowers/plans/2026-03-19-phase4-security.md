# Phase 4: Security — API Key Encryption + Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt AI provider API keys at rest using AES-256-GCM and add tiered rate limiting to all API endpoints.

**Architecture:** CryptoService utility using Node's built-in `crypto` module encrypts/decrypts API keys transparently in the AI controller and service. Rate limiting via `express-rate-limit` with three independent tiers (global, auth, AI). No new database columns — existing `apiKey` VARCHAR stores encrypted ciphertext.

**Tech Stack:** Node.js `crypto` (AES-256-GCM), `express-rate-limit`, TypeORM, Express

**Spec:** `docs/superpowers/specs/2026-03-19-phase4-security-design.md`

---

## File Structure

### New files
- `packages/backend/src/utils/crypto.ts` — CryptoService: encrypt, decrypt, isEncrypted
- `scripts/encrypt-existing-keys.ts` — One-time migration for plaintext keys

### Modified files
- `packages/backend/src/config/index.ts` — Add `encryption.key` config + startup validation
- `packages/backend/src/api/controllers/ai.controller.ts` — Encrypt API key on save
- `packages/backend/src/services/ai/ai.service.ts` — Decrypt API key on read
- `packages/backend/src/app.ts` — Add rate limiting middleware
- `packages/backend/package.json` — Add `express-rate-limit`
- `packages/backend/.env.example` — Add `ENCRYPTION_KEY`
- `docker-compose.yml` — Add `ENCRYPTION_KEY` env var

---

## Task 1: CryptoService Utility

**Files:**
- Create: `packages/backend/src/utils/crypto.ts`
- Test: `packages/backend/src/__tests__/utils/crypto.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/backend/src/__tests__/utils/crypto.test.ts`:

```typescript
import { encrypt, decrypt, isEncrypted } from '../../utils/crypto';

describe('CryptoService', () => {
  beforeAll(() => {
    // Set a test encryption key (32 bytes = 64 hex chars)
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts a string', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const plaintext = 'sk-test-api-key-12345';
      const a = encrypt(plaintext);
      const b = encrypt(plaintext);
      expect(a).not.toBe(b);
    });

    it('encrypted format is iv:authTag:ciphertext', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });
  });

  describe('isEncrypted', () => {
    it('returns true for encrypted values', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncrypted('sk-plaintext-key')).toBe(false);
    });

    it('returns false for strings with colons but wrong byte lengths', () => {
      expect(isEncrypted('abc:def:ghi')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w packages/backend -- --testPathPattern=crypto`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CryptoService**

Create `packages/backend/src/utils/crypto.ts`:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY || '';
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;

  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w packages/backend -- --testPathPattern=crypto`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/utils/crypto.ts packages/backend/src/__tests__/utils/crypto.test.ts
git commit -m "feat: add CryptoService for AES-256-GCM encryption of API keys"
```

---

## Task 2: Config + Startup Validation

**Files:**
- Modify: `packages/backend/src/config/index.ts`
- Modify: `packages/backend/.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Read current config file**

Read `packages/backend/src/config/index.ts` to find the Config interface and config object.

- [ ] **Step 2: Add encryption config**

Add to the `Config` interface:
```typescript
encryption: {
  key: string;
};
```

Add to the config object:
```typescript
encryption: {
  key: process.env.ENCRYPTION_KEY || '',
},
```

- [ ] **Step 3: Add startup validation**

After the config object export, add validation:
```typescript
// Validate encryption key
if (config.env === 'production' && !config.encryption.key) {
  console.error('FATAL: ENCRYPTION_KEY is required in production. Set a 64-character hex string.');
  process.exit(1);
}
if (config.encryption.key && Buffer.from(config.encryption.key, 'hex').length !== 32) {
  console.error('FATAL: ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters).');
  process.exit(1);
}
if (!config.encryption.key && config.env !== 'production') {
  console.warn('WARNING: ENCRYPTION_KEY not set. AI API key encryption will not work.');
}
```

- [ ] **Step 4: Add ENCRYPTION_KEY to .env.example**

Append to `packages/backend/.env.example`:
```
# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=
```

- [ ] **Step 5: Add ENCRYPTION_KEY to docker-compose.yml**

In the `backend` service `environment` section, add:
```yaml
ENCRYPTION_KEY: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

Generate a proper random key for this default.

- [ ] **Step 6: Add ENCRYPTION_KEY to backend .env file**

Read `packages/backend/.env` and add an `ENCRYPTION_KEY` with a generated value. Generate it with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/config/index.ts packages/backend/.env.example docker-compose.yml packages/backend/.env
git commit -m "feat: add ENCRYPTION_KEY config with startup validation"
```

---

## Task 3: Encrypt API Keys on Save / Decrypt on Read

**Files:**
- Modify: `packages/backend/src/api/controllers/ai.controller.ts`
- Modify: `packages/backend/src/services/ai/ai.service.ts`

- [ ] **Step 1: Read the AI controller**

Read `packages/backend/src/api/controllers/ai.controller.ts` fully. Find where `apiKey` is saved in `createConfig` and `updateConfig` methods.

- [ ] **Step 2: Encrypt API key on save**

In the controller, import `encrypt` from `../../utils/crypto`:

```typescript
import { encrypt } from '../../utils/crypto';
```

In `createConfig` — before saving to database, encrypt the API key:
```typescript
if (apiKey) {
  config.apiKey = encrypt(apiKey);
}
```

In `updateConfig` — same pattern when the API key is being updated:
```typescript
if (apiKey) {
  existingConfig.apiKey = encrypt(apiKey);
}
```

- [ ] **Step 3: Decrypt API key on read**

Read `packages/backend/src/services/ai/ai.service.ts`. Find `createProvider()` where `config.apiKey` is used.

Import `decrypt`:
```typescript
import { decrypt } from '../../utils/crypto';
```

In `createProvider()`, decrypt before passing to providers:
```typescript
const apiKey = config.apiKey ? decrypt(config.apiKey) : undefined;
```

Then replace each per-provider key reference in the switch statement. The current code has a pattern like:

```typescript
case 'openai':
  const openaiKey = aiConfig.apiKey || config.ai.openai.apiKey;
```

Replace `aiConfig.apiKey` with the decrypted `apiKey` variable in each case block:

```typescript
case 'openai':
  const openaiKey = apiKey || config.ai.openai.apiKey;
```

Do this for all four provider cases (openai, anthropic, google, ollama). The Ollama provider may not use `apiKey` — if so, leave it alone. Read the actual switch statement and replace each `aiConfig.apiKey` reference individually.

- [ ] **Step 4: Add ENCRYPTION_KEY to test envSetup**

Add to `packages/backend/src/__tests__/envSetup.ts`:
```typescript
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
```

This prevents existing AI-related tests from breaking after encryption is integrated.

- [ ] **Step 5: Verify the frontend doesn't need changes**

Confirm that `getConfig` in the controller returns `hasApiKey: boolean` (not the actual key). No frontend changes should be needed. Note: the controller's `getConfig`, `createConfig`, and `updateConfig` do not filter by `userId` — this is a pre-existing issue outside Phase 4's scope.

- [ ] **Step 6: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/api/controllers/ai.controller.ts packages/backend/src/services/ai/ai.service.ts packages/backend/src/__tests__/envSetup.ts
git commit -m "feat: encrypt API keys on save, decrypt on read"
```

---

## Task 4: Migration Script for Existing Keys

**Files:**
- Create: `scripts/encrypt-existing-keys.ts`

- [ ] **Step 1: Create the migration script**

Create `scripts/encrypt-existing-keys.ts`:

```typescript
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { encrypt, isEncrypted } from '../packages/backend/src/utils/crypto';

async function main() {
  // Read database config from env
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'nommable',
    username: process.env.DATABASE_USER || 'nommable',
    password: process.env.DATABASE_PASSWORD || 'nommable_password',
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const result = await dataSource.query(
    'SELECT id, api_key FROM ai_configs WHERE api_key IS NOT NULL'
  );

  let migrated = 0;
  let skipped = 0;

  for (const row of result) {
    if (isEncrypted(row.api_key)) {
      skipped++;
      continue;
    }

    const encrypted = encrypt(row.api_key);
    await dataSource.query(
      'UPDATE ai_configs SET api_key = $1 WHERE id = $2',
      [encrypted, row.id]
    );
    migrated++;
  }

  console.log(`Migration complete: ${migrated} keys encrypted, ${skipped} already encrypted`);
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

Note: The exact import path for `encrypt`/`isEncrypted` may need adjustment. Read the actual project structure. The script should be runnable from the repo root with `npx tsx scripts/encrypt-existing-keys.ts`. It needs `ENCRYPTION_KEY` set in the environment (from `.env` or explicitly).

- [ ] **Step 2: Commit**

```bash
git add scripts/encrypt-existing-keys.ts
git commit -m "feat: add one-time migration script to encrypt existing plaintext API keys"
```

---

## Task 5: Rate Limiting

**Files:**
- Modify: `packages/backend/package.json`
- Modify: `packages/backend/src/app.ts`

- [ ] **Step 1: Install express-rate-limit**

```bash
npm install express-rate-limit -w packages/backend
```

- [ ] **Step 2: Read app.ts**

Read `packages/backend/src/app.ts` to understand the middleware order.

- [ ] **Step 3: Add rate limiting middleware**

In `packages/backend/src/app.ts`, import and configure three rate limiters:

```typescript
import rateLimit from 'express-rate-limit';

// Inside createApp(), before routes:

// Global rate limit: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Auth rate limit: 10 req/min per IP (brute force protection)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// AI rate limit: 20 req/min per user
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).userId ?? req.ip ?? 'unknown';
  },
  message: { error: 'Too many AI requests, please try again later' },
});

app.use(globalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);
```

Place the global limiter in `app.ts` AFTER body parsers but BEFORE route handlers.

**Important:** The auth and AI limiters should NOT go in `app.ts` — they must be applied inside the route files, after `authMiddleware`, so that `req.userId` is available for the AI limiter's `keyGenerator`. If applied at `app.use()` level, `req.userId` is always `undefined` because route-level auth middleware hasn't run yet, silently falling back to IP-based limiting.

Instead, apply them in the route files:

In `packages/backend/src/api/routes/auth.routes.ts`, add at the top (before any routes):
```typescript
import rateLimit from 'express-rate-limit';
const authLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});
router.use(authLimiter);
```

In `packages/backend/src/api/routes/ai.routes.ts`, add after `router.use(authMiddleware)`:
```typescript
import rateLimit from 'express-rate-limit';
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? req.ip ?? 'unknown',
  message: { error: 'Too many AI requests, please try again later' },
});
router.use(aiLimiter);
```

In `packages/backend/src/api/routes/recipe.routes.ts`, apply the AI limiter on specific AI-consuming routes (after authMiddleware):
```typescript
import rateLimit from 'express-rate-limit';
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req as any).userId ?? req.ip ?? 'unknown',
  message: { error: 'Too many AI requests, please try again later' },
});
// Apply to AI-consuming recipe routes:
router.post('/generate', aiLimiter, controller.generateWithAI.bind(controller));
router.post('/:id/enhance', aiLimiter, controller.enhanceWithAI.bind(controller));
router.post('/extract-from-images', aiLimiter, ...);
router.post('/detect-ingredients', aiLimiter, ...);
```

Read the actual route file to see exact route registration syntax and adapt — the limiter should be added as middleware on each AI route, not as `router.use()` (which would rate-limit all recipe routes).

- [ ] **Step 4: Build and verify**

Run: `npx tsc --noEmit -p packages/backend/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/app.ts packages/backend/package.json package-lock.json
git commit -m "feat: add tiered rate limiting (global 100/min, auth 10/min, AI 20/min)"
```

---

## Task 6: Final Verification

- [ ] **Step 1:** Run `npm run build` — clean build
- [ ] **Step 2:** Run `npm run lint` — fix any new errors
- [ ] **Step 3:** Run `npm run test` — all tests pass (including new crypto tests)
- [ ] **Step 4:** `git status` — working tree clean
- [ ] **Step 5:** `git log --oneline` — show all commits
- [ ] **Step 6:** Push to GitHub: `git push`
