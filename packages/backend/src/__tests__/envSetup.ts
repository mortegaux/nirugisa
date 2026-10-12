// setupFiles runs in the worker process before any module loads.
import path from 'path';
import os from 'os';

process.env.DB_PATH = path.join(os.tmpdir(), `nommable-test-${process.pid}.db`);
process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-chars-long-for-better-auth';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long-for-better-auth';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
