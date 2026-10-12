import dotenv from 'dotenv';
import path from 'path';

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
}

function parseCorsOrigin(value: string): string | string[] | boolean {
  if (value === '*') return true;
  if (value.includes(',')) return value.split(',').map(s => s.trim());
  return value;
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
    dir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
  },

  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN || 'http://localhost:5173'),
  },
};
