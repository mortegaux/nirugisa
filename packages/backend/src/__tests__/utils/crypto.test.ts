import { encrypt, decrypt, isEncrypted, safeDecrypt } from '../../utils/crypto';

describe('CryptoService', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts a string', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const plaintext = 'sk-test-api-key-12345';
      expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
    });

    it('encrypted format is iv:authTag:ciphertext', () => {
      const parts = encrypt('test').split(':');
      expect(parts).toHaveLength(3);
    });
  });

  describe('isEncrypted', () => {
    it('returns true for encrypted values', () => {
      expect(isEncrypted(encrypt('test'))).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncrypted('sk-plaintext-key')).toBe(false);
    });

    it('returns false for strings with colons but wrong byte lengths', () => {
      expect(isEncrypted('abc:def:ghi')).toBe(false);
    });
  });

  describe('safeDecrypt', () => {
    it('returns undefined for undefined or null or empty', () => {
      expect(safeDecrypt(undefined)).toBeUndefined();
      expect(safeDecrypt(null)).toBeUndefined();
      expect(safeDecrypt('')).toBeUndefined();
    });

    it('returns raw string for unencrypted plaintext', () => {
      expect(safeDecrypt('sk-test-plaintext-key')).toBe('sk-test-plaintext-key');
    });

    it('decrypts encrypted ciphertext', () => {
      const encrypted = encrypt('my-secret-key');
      expect(safeDecrypt(encrypted)).toBe('my-secret-key');
    });

    it('returns undefined gracefully on malformed encrypted string', () => {
      expect(safeDecrypt('invalid:base64:format')).toBeUndefined();
    });
  });
});
