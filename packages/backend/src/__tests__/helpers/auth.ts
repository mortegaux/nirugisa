import crypto from 'crypto';
import { getAuthDb } from '../../lib/auth';

export function createTestToken(userId: string): string {
  const db = getAuthDb();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const token = `test-session-${userId}-${crypto.randomBytes(8).toString('hex')}`;
  const sessionId = crypto.randomUUID();
  const shortId = userId.slice(0, 8);

  db.prepare(
    `INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "username", "displayUsername", "role", "banned")
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'user', 0)`
  ).run(
    userId,
    `Test User ${shortId}`,
    `test-${shortId}@test.com`,
    now,
    now,
    `test-user-${shortId}`,
    `test-user-${shortId}`
  );

  db.prepare(
    `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sessionId, expiresAt, token, now, now, userId);

  return token;
}
