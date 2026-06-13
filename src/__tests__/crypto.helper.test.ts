/**
 * Complex Unit Tests — CryptoHelper
 *
 * Tests encrypt/decrypt round-trips and URL-safe encoding.
 * Uses a fixed test key so tests are deterministic.
 */
import { describe, test, expect, beforeEach } from 'bun:test';

// Set the crypto key BEFORE importing the helper
process.env.HANZ_CRYPTO_KEY = 'test-key-unit-testing-only';

import CryptoHelper from '../helpers/crypto.helper';

describe('CryptoHelper — encrypt/decrypt round-trip', () => {
  beforeEach(() => {
    CryptoHelper.resetInstance();
  });

  test('string sederhana bisa di-encrypt dan di-decrypt kembali', () => {
    const original = 'hello-world-123';
    const encrypted = CryptoHelper.generateEncryptedIDByPayload(original);
    const decrypted = CryptoHelper.decryptIDToPayload(encrypted);

    expect(decrypted).toBe(original);
  });

  test('JSON object bisa di-encrypt dan di-decrypt kembali', () => {
    const original = { nim: '12345678', nama: 'Budi', tahun: 2026 };
    const encrypted = CryptoHelper.generateEncryptedIDByPayload(
      JSON.stringify(original)
    );
    const decrypted = CryptoHelper.decryptIDToPayload(encrypted);

    // simple-crypto-js decrypt may return the parsed object directly
    const parsed =
      typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
    expect(parsed).toEqual(original);
  });

  test('URL-safe encoding: tidak mengandung / atau +', () => {
    const original = 'some/payload+with+special/chars';
    const encrypted = CryptoHelper.generateEncryptedIDByPayload(original);

    expect(encrypted).not.toContain('/');
    expect(encrypted).not.toContain('+');
  });

  test('URL-safe decoding: _hanz_ dan -hanz_ dikembalikan dengan benar', () => {
    const original = 'PEND-TEST-001';
    const encrypted = CryptoHelper.generateEncryptedIDByPayload(original);

    const decrypted = CryptoHelper.decryptIDToPayload(encrypted);
    expect(decrypted).toBe(original);
  });

  test('payload kosong bisa di-encrypt', () => {
    const encrypted = CryptoHelper.generateEncryptedIDByPayload('');
    const decrypted = CryptoHelper.decryptIDToPayload(encrypted);

    expect(decrypted).toBe('');
  });

  test('ID berbeda menghasilkan ciphertext berbeda', () => {
    const enc1 = CryptoHelper.generateEncryptedIDByPayload('payload-1');
    const enc2 = CryptoHelper.generateEncryptedIDByPayload('payload-2');

    expect(enc1).not.toBe(enc2);
  });

  test('decrypt ID palsu melempar error', () => {
    const bogus = 'this-is-not-a-valid-encrypted-id';

    expect(() => CryptoHelper.decryptIDToPayload(bogus)).toThrow();
  });
});
