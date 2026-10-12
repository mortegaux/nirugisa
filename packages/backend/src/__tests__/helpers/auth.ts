import jwt from 'jsonwebtoken';

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret';

export function createTestToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, TEST_SECRET, { expiresIn: '1h' });
}
