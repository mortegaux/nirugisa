import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = config.encryption?.key || process.env.ENCRYPTION_KEY || '';
  if (keyHex && /^[0-9a-fA-F]{64}$/.test(keyHex)) {
    return Buffer.from(keyHex, 'hex');
  }
  const fallback = config.auth?.secret || process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'nommable-default-secret-key';
  return crypto.createHash('sha256').update(fallback).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

export function isEncrypted(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

export function safeDecrypt(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (!isEncrypted(value)) {
    // Plaintext legacy or unencrypted key, return as-is
    return value;
  }
  try {
    return decrypt(value);
  } catch (err) {
    console.warn('Failed to decrypt API key, returning undefined:', (err as any)?.message);
    return undefined;
  }
}

