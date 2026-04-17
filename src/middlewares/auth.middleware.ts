import { Context, Next } from 'hono';
import AuthHelper from '../helpers/auth.helper';
import { APIError } from '../utils/api-error.util';

type Role = 'mahasiswa' | 'dosen' | 'koordinator';

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

  public static requireRole(...roles: Role[]) {
    return async (c: Context, next: Next) => {
      const user = c.get('user') as Record<string, unknown> | undefined;

      if (!user) {
        throw new APIError('Unauthorized. Silakan login terlebih dahulu.', 401);
      }

      const userRole = user.role as string;
      if (!userRole || !roles.includes(userRole as Role)) {
        throw new APIError('Anda tidak memiliki akses ke resource ini.', 403);
      }

      await next();
    };
  }
}
