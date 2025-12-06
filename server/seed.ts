import * as bip39 from 'bip39';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(128);
}

export function validateSeedPhrase(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic.toLowerCase().trim());
}

export async function hashSeedPhrase(mnemonic: string): Promise<string> {
  const normalized = mnemonic.toLowerCase().trim().replace(/\s+/g, ' ');
  return bcrypt.hash(normalized, BCRYPT_ROUNDS);
}

export async function verifySeedPhrase(mnemonic: string, hash: string): Promise<boolean> {
  const normalized = mnemonic.toLowerCase().trim().replace(/\s+/g, ' ');
  return bcrypt.compare(normalized, hash);
}
