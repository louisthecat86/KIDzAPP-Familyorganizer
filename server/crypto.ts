import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('[Security] ENCRYPTION_KEY not set - using fallback key. SET THIS IN PRODUCTION!');
    return 'kidz-app-default-encryption-key-change-me-in-production-please';
  }
  return key;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(getEncryptionKey(), salt);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    const result = Buffer.concat([salt, iv, tag, encrypted]);
    return result.toString('base64');
  } catch (error) {
    console.error('[Crypto] Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  
  try {
    const buffer = Buffer.from(ciphertext, 'base64');
    
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = deriveKey(getEncryptionKey(), salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[Crypto] Decryption failed - key may have changed or data corrupted');
    return '';
  }
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length > SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}
