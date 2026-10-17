import crypto from 'crypto';
import type Database from 'better-sqlite3';

export function username() {
  return { id: 'username' };
}

export function admin() {
  return { id: 'admin' };
}

export function bearer() {
  return { id: 'bearer' };
}

/**
 * Cookie emulation, mirroring real Better Auth (better-call) semantics:
 * the session cookie `nommable.session_token` (cookiePrefix `nommable`)
 * holds a SIGNED value — `encodeURIComponent(token + '.' + base64(HMAC-SHA256(secret, token)))`.
 * A raw token presented as the cookie value is rejected by getSession, just
 * like production. The app code under test only forwards headers/cookies;
 * it never parses the value, so the mock's job is to be wire-faithful here.
 */
const SESSION_COOKIE_NAME = 'nommable.session_token';
const SESSION_COOKIE_ATTRS = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=604800';

function getSecret(): string {
  return process.env.BETTER_AUTH_SECRET || 'test-better-auth-secret';
}

function signCookieValue(token: string): string {
  const sig = crypto.createHmac('sha256', getSecret()).update(token).digest('base64');
  return encodeURIComponent(`${token}.${sig}`);
}

function unsignCookieValue(signed: string): string | null {
  try {
    const decoded = decodeURIComponent(signed);
    const idx = decoded.lastIndexOf('.');
    if (idx <= 0) return null;
    const token = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const expected = crypto.createHmac('sha256', getSecret()).update(token).digest('base64');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return token;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name && !out.has(name)) out.set(name, value);
  }
  return out;
}

function sessionCookieFromHeaders(headers: Headers | undefined): string | null {
  const cookies = parseCookieHeader(headers?.get?.('cookie') || undefined);
  // Real Better Auth may prefix with `__Secure-` when secure cookies are on.
  const signed = cookies.get(SESSION_COOKIE_NAME) ?? cookies.get(`__Secure-${SESSION_COOKIE_NAME}`);
  if (!signed) return null;
  return unsignCookieValue(signed);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export async function verifyPassword(opts: { hash: string; password: string }): Promise<boolean> {
  const [salt, key] = (opts.hash || '').split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(opts.password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

export function betterAuth(options: { database: Database.Database }) {
  const db = options.database;

  return {
    api: {
      async getSession({ headers }: { headers: Headers }) {
        // Bearer token first (the SPA's pattern), then the signed session
        // cookie (browser navigation / direct requests) — mirrors real
        // Better Auth, which accepts either.
        const authHeader = headers?.get?.('authorization') || '';
        let token: string | null = null;
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          token = authHeader.slice(7).trim() || null;
        } else {
          token = sessionCookieFromHeaders(headers);
        }
        if (!token) return null;

        const session = db
          .prepare('SELECT * FROM "session" WHERE "token" = ? LIMIT 1')
          .get(token) as any;
        if (!session) return null;

        if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
          return null;
        }

        const user = db
          .prepare('SELECT * FROM "user" WHERE "id" = ? LIMIT 1')
          .get(session.userId) as any;
        if (!user || user.banned) return null;

        return { session, user };
      },

      async signUpEmail({
        body,
      }: {
        body: { email: string; password: string; name: string; username?: string };
        headers?: Headers;
      }) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const hashed = await hashPassword(body.password);

        db.prepare(
          `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "username", "displayUsername", "role", "banned")
           VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'user', 0)`
        ).run(id, body.name, body.email, now, now, body.username ?? null, body.username ?? null);

        db.prepare(
          `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
           VALUES (?, ?, 'credential', ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), id, id, hashed, now, now);

        return {
          user: {
            id,
            email: body.email,
            name: body.name,
            username: body.username,
          },
        };
      },

      async signInUsername({
        body,
        returnHeaders,
      }: {
        body: { username: string; password: string };
        headers?: Headers;
        returnHeaders?: boolean;
      }) {
        const user = db
          .prepare('SELECT * FROM "user" WHERE "username" = ? OR "email" = ? LIMIT 1')
          .get(body.username, body.username) as any;
        if (!user) {
          throw new Error('Invalid username or password');
        }

        const account = db
          .prepare('SELECT * FROM "account" WHERE "userId" = ? AND "providerId" = ? LIMIT 1')
          .get(user.id, 'credential') as any;
        if (!account?.password) {
          throw new Error('Invalid username or password');
        }

        const valid = await verifyPassword({ hash: account.password, password: body.password });
        if (!valid) {
          throw new Error('Invalid username or password');
        }

        const token = crypto.randomBytes(24).toString('hex');
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        db.prepare(
          `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), expiresAt, token, now, now, user.id);

        // Real Better Auth returns `{ headers, response }` when
        // `returnHeaders: true` is passed, with the signed session cookie in
        // the Set-Cookie headers. Without it, only `{ token, user }` comes back.
        if (returnHeaders) {
          const headers = new Headers();
          headers.append(
            'set-cookie',
            `${SESSION_COOKIE_NAME}=${signCookieValue(token)}; ${SESSION_COOKIE_ATTRS}`
          );
          return { headers, response: { token, user } };
        }
        return { token, user };
      },

      async signOut({ headers, returnHeaders }: { headers: Headers; returnHeaders?: boolean }) {
        const authHeader = headers?.get?.('authorization') || '';
        let token: string | null = null;
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          token = authHeader.slice(7).trim() || null;
        } else {
          token = sessionCookieFromHeaders(headers);
        }
        if (token) {
          db.prepare('DELETE FROM "session" WHERE "token" = ?').run(token);
        }
        if (returnHeaders) {
          const outHeaders = new Headers();
          outHeaders.append(
            'set-cookie',
            `${SESSION_COOKIE_NAME}=; ${SESSION_COOKIE_ATTRS}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
          );
          return { headers: outHeaders, response: { success: true } };
        }
        return { success: true };
      },

      async changePassword({
        body,
        headers,
      }: {
        body: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean };
        headers: Headers;
      }) {
        const current = await this.getSession({ headers });
        if (!current?.user) {
          throw new Error('Unauthorized');
        }
        const account = db
          .prepare('SELECT * FROM "account" WHERE "userId" = ? AND "providerId" = ? LIMIT 1')
          .get(current.user.id, 'credential') as any;
        const valid =
          account?.password &&
          (await verifyPassword({ hash: account.password, password: body.currentPassword }));
        if (!valid) {
          throw new Error('Invalid current password');
        }
        const newHash = await hashPassword(body.newPassword);
        db.prepare('UPDATE "account" SET "password" = ? WHERE "id" = ?').run(newHash, account.id);
        return { status: true };
      },
    },
  };
}
