import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import KomponenPenilaianHandler from './komponen-penilaian.handler';
import {
  createKomponenPenilaianSchema,
  getAllKomponenPenilaianQuerySchema,
  getKomponenByRoleParamSchema,
  getKomponenByRoleQuerySchema,
  updateKomponenPenilaianSchema,
  toggleStatusKomponenSchema,
} from './komponen-penilaian.validator';

const komponenRoute = new Hono({ router: new RegExpRouter() });

komponenRoute.get(
  '/data-master/komponen-penilaian',
  zValidator('query', getAllKomponenPenilaianQuerySchema, zodError),
  KomponenPenilaianHandler.getAll
);

komponenRoute.get(
  '/data-master/komponen-penilaian/role/:role',
  zValidator('param', getKomponenByRoleParamSchema, zodError),
  zValidator('query', getKomponenByRoleQuerySchema, zodError),
  KomponenPenilaianHandler.getByRole
);

komponenRoute.post(
  '/koordinator/komponen-penilaian',
  RateLimitMiddleware.write(),
  zValidator('json', createKomponenPenilaianSchema, zodError),
  KomponenPenilaianHandler.create
);

komponenRoute.put(
  '/koordinator/komponen-penilaian/:id',
  RateLimitMiddleware.write(),
  zValidator('json', updateKomponenPenilaianSchema, zodError),
  KomponenPenilaianHandler.update
);

komponenRoute.patch(
  '/koordinator/komponen-penilaian/:id/toggle',
  RateLimitMiddleware.write(),
  zValidator('json', toggleStatusKomponenSchema, zodError),
  KomponenPenilaianHandler.toggleStatus
);

komponenRoute.delete(
  '/koordinator/komponen-penilaian/:id',
  RateLimitMiddleware.write(),
  KomponenPenilaianHandler.delete
);

export default komponenRoute;
