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
        const authHeader = headers?.get?.('authorization') || '';
        if (!authHeader.toLowerCase().startsWith('bearer ')) {
          return null;
        }
        const token = authHeader.slice(7).trim();
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
      }: {
        body: { username: string; password: string };
        headers?: Headers;
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

        return { token, user };
      },

      async signOut({ headers }: { headers: Headers }) {
        const authHeader = headers?.get?.('authorization') || '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          const token = authHeader.slice(7).trim();
          db.prepare('DELETE FROM "session" WHERE "token" = ?').run(token);
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
