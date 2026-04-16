import SimpleCrypto from 'simple-crypto-js';

// =============================================================================
// Get crypto key from environment directly (lazy loading)
// =============================================================================
function getCryptoKey(): string {
  return (
    process.env.HANZ_CRYPTO_KEY || 'default-crypto-key-change-in-production'
  );
}

// =============================================================================
// Crypto Helper Singleton Class
// =============================================================================
class CryptoHelper {
  private static instance: CryptoHelper | null = null;
  private crypto: SimpleCrypto;

  private constructor() {
    this.crypto = new SimpleCrypto(getCryptoKey());
  }

  public static getInstance(): CryptoHelper {
    if (!CryptoHelper.instance) {
      CryptoHelper.instance = new CryptoHelper();
    }
    return CryptoHelper.instance;
  }

  /**
   * Mengenkripsi payload menjadi sebuah ID yang aman untuk digunakan di dalam URL.
   * Hasil enkripsi tidak akan mengandung karakter '/' atau '+'.
   *
   * @param payload yang akan dienkripsi.
   * @returns ID terenkripsi yang URL-safe.
   */
  public generateEncryptedIDByPayload(payload: string): string {
    const encryptedData = this.crypto.encrypt(payload) as string;

    // URL-Safe Encoding
    // Ganti karakter yang tidak aman untuk URL
    return encryptedData
      .replace(/\//g, '_hanz_') // Ganti '/' dengan '_hanz_'
      .replace(/\+/g, '-hanz-')
      .toString() as string; // Ganti '+' dengan '-hanz-'
  }

  /**
   * Mendekripsi sebuah ID (yang sebelumnya dibuat agar URL-safe) kembali menjadi payload.
   *
   * @param urlSafeId ID terenkripsi yang didapat dari URL.
   * @returns Payload asli jika dekripsi berhasil, atau `null` jika ID tidak valid.
   */
  public decryptIDToPayload(id: string): any {
    // URL-Safe Decoding
    // Kembalikan dulu karakter ke format Base64 standar SEBELUM dekripsi
    const originalEncryptedData = id
      .replace(/_hanz_/g, '/') // Kembalikan '$hanz$' menjadi '/'
      .replace(/-hanz-/g, '+'); // Kembalikan '&hanz&' menjadi '+'

    return this.crypto.decrypt(originalEncryptedData);
  }

  public static resetInstance(): void {
    CryptoHelper.instance = null;
  }

  // Static methods for backward compatibility
  public static generateEncryptedIDByPayload(payload: string): string {
    return CryptoHelper.getInstance().generateEncryptedIDByPayload(payload);
  }

  public static decryptIDToPayload(id: string): any {
    return CryptoHelper.getInstance().decryptIDToPayload(id);
  }
}

export const cryptoHelper = CryptoHelper.getInstance();
export default CryptoHelper;
