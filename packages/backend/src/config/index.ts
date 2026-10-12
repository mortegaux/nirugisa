import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

dotenv.config();

interface Config {
  env: string;
  port: number;
  host: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    synchronize: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  admin: {
    username: string;
    password: string;
  };
  ai: {
    openai: {
      apiKey: string | undefined;
    };
    anthropic: {
      apiKey: string | undefined;
    };
    google: {
      apiKey: string | undefined;
    };
    ollama: {
      baseUrl: string;
    };
  };
  upload: {
    dir: string;
    maxSize: number;
  };
  cors: {
    origin: string | string[] | boolean;
  };
  encryption: {
    key: string;
  };
  smtp: {
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    from: string;
  };
}

function parseCorsOrigin(value: string): string | string[] | boolean {
  if (value === '*') return true;
  if (value.includes(',')) return value.split(',').map(s => s.trim());
  return value;
}

function resolveEncryptionKey(): string {
  const envKey = (process.env.ENCRYPTION_KEY || '').trim();
  if (envKey) {
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      return envKey;
    }
    // Convert arbitrary passphrase into deterministic 32-byte hex key
    return crypto.createHash('sha256').update(envKey).digest('hex');
  }

  // Fallback: derive 32-byte key from JWT_SECRET so server never crashes on missing key
  const secret = process.env.JWT_SECRET || 'nommable-default-secret-key-change-this';
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function resolveUploadDir(): string {
  const envDir = (process.env.UPLOAD_DIR || '').trim();
  if (envDir) return envDir;
  if (fs.existsSync('/app/uploads')) return '/app/uploads';
  return path.join(process.cwd(), 'uploads');
}

export const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || 'localhost',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || 'nommable',
    user: process.env.DATABASE_USER || 'nommable',
    password: process.env.DATABASE_PASSWORD || 'nommable_password',
    // Auto-build schema from entities. Explicit DB_SYNCHRONIZE wins; otherwise
    // default to on outside production so fresh installs work with zero config.
    // Set DB_SYNCHRONIZE=false when using a managed DB driven by migrations.
    synchronize:
      process.env.DB_SYNCHRONIZE !== undefined
        ? process.env.DB_SYNCHRONIZE === 'true'
        : (process.env.NODE_ENV || 'development') !== 'production',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  },

  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY,
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
  },

  upload: {
    dir: resolveUploadDir(),
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
  },

  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN || 'http://localhost:5173'),
  },

  encryption: {
    key: resolveEncryptionKey(),
  },
  smtp: {
    host: process.env.SMTP_HOST || undefined,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@nommable.local',
  },
};

// --- Fail-closed production guards (security-fixes) ---
// These run after config resolution so dev stays frictionless while prod
// refuses to boot with insecure defaults.

// ENCRYPTION_KEY must be explicitly set in production. Note: we check the raw
// env var, not the resolved value, because resolveEncryptionKey() derives a
// fallback from JWT_SECRET — running prod on a derived key is exactly what
// this guard prevents.
if (config.env === 'production' && !process.env.ENCRYPTION_KEY) {
  console.error('FATAL: ENCRYPTION_KEY is required in production. Set a 64-character hex string.');
  process.exit(1);
}
// JWT_SECRET must never fall back to the insecure default in production —
// anyone with the default can forge valid session tokens.
if (
  config.env === 'production' &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-this')
) {
  console.error('FATAL: JWT_SECRET is required in production. Set a long random string.');
  process.exit(1);
}
// Same for the seeded admin password: shipping admin/admin is an open door.
if (config.env === 'production' && config.admin.password === 'admin') {
  console.error('FATAL: ADMIN_PASSWORD must be changed from the default in production.');
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.warn('NOTICE: ENCRYPTION_KEY not explicitly set. Using derived key from JWT_SECRET.');
}
