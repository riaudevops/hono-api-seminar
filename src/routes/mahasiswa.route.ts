import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import AuthMiddleware from '../middlewares/auth.middleware';
import MahasiswaHandler from '../handlers/mahasiswa.handler';
import PendaftaranHandler from '../handlers/pendaftaran.handler';
import {
  postPendaftaranSchema,
  putPendaftaranSchema,
} from '../validators/pendaftaran.validator';

const mahasiswaRoute = new Hono({ router: new RegExpRouter() });

mahasiswaRoute.get(
  '/mahasiswa/pendaftaran-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.getPendaftaranSaya
);
mahasiswaRoute.post(
  '/mahasiswa/pendaftaran-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postPendaftaranSchema, zodError),
  PendaftaranHandler.createByMahasiswa
);
mahasiswaRoute.put(
  '/mahasiswa/pendaftaran-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', putPendaftaranSchema, zodError),
  PendaftaranHandler.updateByMahasiswa
);

mahasiswaRoute.get(
  '/seminar-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.getMe
);
mahasiswaRoute.get(
  '/mahasiswa/search',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.search
);
mahasiswaRoute.get(
  '/mahasiswa',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.getAll
);
mahasiswaRoute.get(
  '/mahasiswa/angkatan',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.getAngkatanList
);
mahasiswaRoute.post(
  '/spreadsheet/refresh',
  AuthMiddleware.JWTBearerTokenExtraction,
  MahasiswaHandler.refreshSpreadsheet
);

export default mahasiswaRoute;
