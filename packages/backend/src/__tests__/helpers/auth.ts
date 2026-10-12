// Test auth helper — TODO: rework for Better Auth
// The old JWT-based helper no longer works. Tests that need authenticated
// requests should create a real Better Auth session via `auth.api.signInUsername`
// and use the returned session token as the Bearer token.

export function createTestToken(_userId: string): string {
  throw new Error(
    'createTestToken is deprecated: use a real Better Auth session token. ' +
      'See auth.api.signInUsername.'
  );
}
