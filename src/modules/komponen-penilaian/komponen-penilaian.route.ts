import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import KomponenPenilaianHandler from './komponen-penilaian.handler';
import {
  createKomponenPenilaianSchema,
  getAllKomponenPenilaianQuerySchema,
  updateKomponenPenilaianSchema,
  toggleStatusKomponenSchema,
} from './komponen-penilaian.validator';

const komponenRoute = new Hono({ router: new RegExpRouter() });

komponenRoute.get(
  '/komponen-penilaian',
  zValidator('query', getAllKomponenPenilaianQuerySchema, zodError),
  KomponenPenilaianHandler.getAll
);

komponenRoute.post(
  '/komponen-penilaian',
  zValidator('json', createKomponenPenilaianSchema, zodError),
  KomponenPenilaianHandler.create
);

komponenRoute.put(
  '/komponen-penilaian/:id',
  zValidator('json', updateKomponenPenilaianSchema, zodError),
  KomponenPenilaianHandler.update
);

komponenRoute.patch(
  '/komponen-penilaian/:id/toggle',
  zValidator('json', toggleStatusKomponenSchema, zodError),
  KomponenPenilaianHandler.toggleStatus
);

komponenRoute.delete(
  '/komponen-penilaian/:id',
  KomponenPenilaianHandler.delete
);

export default komponenRoute;
