import {
  GlobalServiceHealthResponse,
  GlobalServiceIntroduceResponse,
} from '../types/global.type';

export default class GlobalService {
  public static async introduce(): Promise<GlobalServiceIntroduceResponse> {
    return {
      response: true,
      message: 'Selamat datang di API Seminar.',
      version: process.env.APP_VERSION || '1.0.0',
      contributor: 'https://github.com/Gindra-o7/hono-api-seminar',
      timezone: `Asia/Jakarta ~ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    };
  }

  public static async health(): Promise<GlobalServiceHealthResponse> {
    return {
      response: true,
      message: 'API Seminar berjalan normal.',
      status: 'OK',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }
}
