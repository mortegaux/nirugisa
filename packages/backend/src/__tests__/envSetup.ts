// setupFiles runs in the worker process before any module loads.
process.env.DATABASE_NAME = 'nommable_test';
process.env.DATABASE_PORT = '5435';
process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
