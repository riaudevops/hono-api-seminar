import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import MahasiswaHandler from './mahasiswa.handler';
import { putDataSayaSchema } from './mahasiswa.validator';

const mahasiswaModuleRoute = new Hono({ router: new RegExpRouter() });

mahasiswaModuleRoute.get(
  '/mahasiswa/data-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.getDataSaya
);

mahasiswaModuleRoute.put(
  '/mahasiswa/data-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', putDataSayaSchema, zodError),
  MahasiswaHandler.updateDataSaya
);

export default mahasiswaModuleRoute;
