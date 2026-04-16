export default class AuthHelper {
  // Static helper untuk decode JWT payload
  public static decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');

    const base64 = AuthHelper.padBase64(parts[1]);
    const json = atob(base64);
    return JSON.parse(json);
  }

  // Padding base64 biar valid untuk `atob`
  private static padBase64(base64: string): string {
    const padLength = 4 - (base64.length % 4);
    return base64 + '='.repeat(padLength === 4 ? 0 : padLength);
  }
}
