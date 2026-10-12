/**
 * lib/auth.ts — the Better Auth instance (vetted auth library, MIT).
 *
 * Everything security-critical comes from Better Auth or its official
 * plugins: password hashing (scrypt) + verification, session
 * creation/validation/rotation/expiry, and admin user management. Our code
 * only adds thin app-level wiring on top.
 *
 * Design notes:
 * - Better Auth uses its own `better-sqlite3` connection to the same SQLite
 *   file as TypeORM (WAL mode). It manages its own tables (`user`,
 *   `session`, `account`, `verification`) via the initial migration.
 * - The app keeps its own `users` table (TypeORM entity) for profile data,
 *   roles, and relations. Rows share the Better Auth user id; the helper
 *   `ensureAppUser` below creates the app-side row. All user-creation paths
 *   (invitation signup, admin seed, admin panel) call it explicitly.
 * - `username()` plugin: sign in with username or email (matches old behavior).
 * - `admin()` plugin: roles, ban/unban, user management via `auth.api`.
 * - `bearer()` plugin: the SPA keeps sending `Authorization: Bearer <token>`
 *   — the token is now a Better Auth session token instead of a JWT.
 */
import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';
import { username, admin, bearer } from 'better-auth/plugins';
import { config } from '../config';
import { AppDataSource } from '../db/data-source';
import { User } from '../db/entities';
import { UserRole } from '@nommable/shared';

let authDb: Database.Database | null = null;

/**
 * Raw better-sqlite3 connection for Better Auth's built-in Kysely adapter.
 * Points at the same SQLite file as TypeORM. WAL mode allows both
 * connections to coexist.
 */
export function getAuthDb(): Database.Database {
  if (!authDb) {
    authDb = new Database(config.database.path);
    authDb.pragma('journal_mode = WAL');
    authDb.exec(`
      CREATE TABLE IF NOT EXISTS "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "username" text unique, "displayUsername" text, "role" text, "banned" integer, "banReason" text, "banExpires" date);
      CREATE TABLE IF NOT EXISTS "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "impersonatedBy" text);
      CREATE TABLE IF NOT EXISTS "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
      CREATE TABLE IF NOT EXISTS "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
      CREATE INDEX IF NOT EXISTS "session_userId_idx" on "session" ("userId");
      CREATE INDEX IF NOT EXISTS "account_userId_idx" on "account" ("userId");
      CREATE INDEX IF NOT EXISTS "verification_identifier_idx" on "verification" ("identifier");
    `);
  }
  return authDb;
}

/**
 * Ensure the app-side `users` row exists for a Better Auth user id.
 * Called explicitly by all user-creation paths.
 */
export async function ensureAppUser(
  authUserId: string,
  opts: { email: string; username: string; role?: UserRole }
): Promise<User> {
  const repo = AppDataSource.getRepository(User);
  const existing = await repo.findOne({ where: { id: authUserId } });
  if (existing) return existing;
  const user = repo.create({
    id: authUserId,
    email: opts.email,
    username: opts.username,
    role: opts.role ?? UserRole.USER,
    isSystemAdmin: false,
  });
  return repo.save(user);
}

// Note: wrapped in a function (like Porch) so the complex plugin-augmented
// type infers cleanly without TS2742.
function createAuth() {
  return betterAuth({
    database: getAuthDb(),
    secret: config.auth.secret,
    baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${config.port}`,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // accounts are admin-created or invited
      autoSignIn: false, // our routes drive sign-in explicitly
      minPasswordLength: 8,
    },
    plugins: [
      // Sign in with username or email. `name` carries the username for
      // compatibility with the app's existing user model.
      username(),
      // Roles, ban/unban, list/remove users via `auth.api`.
      admin(),
      // Accept `Authorization: Bearer <session-token>` (the SPA's pattern).
      bearer(),
    ],
    session: {
      expiresIn: 7 * 24 * 60 * 60, // 7 days absolute
      updateAge: 24 * 60 * 60, // 1 day sliding refresh
      cookieCache: { enabled: false }, // always hit the DB: bans take effect immediately
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 200,
    },
    advanced: {
      cookiePrefix: 'nommable',
      useSecureCookies: process.env.COOKIE_SECURE === 'true',
    },
  });
}

export const auth = createAuth();
export type Auth = ReturnType<typeof createAuth>;
