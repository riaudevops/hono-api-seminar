import { Context, Next } from 'hono';
import AuthHelper from '../helpers/auth.helper';
import { APIError } from '../utils/api-error.util';

export default class AuthMiddleware {
  public static async JWTBearerTokenExtraction(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APIError('Format authorization header tidak valid.', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = AuthHelper.decodeJwtPayload(token);
      c.set('user', payload);
      await next();
    } catch (error) {
      throw new APIError('Token tidak valid atau telah kadaluarsa.', 401);
    }
  }
}
