import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import KeahlianDosenHandler from '../handlers/keahlian-dosen.handler';
import {
  createKeahlianDosenSchema,
  getKeahlianDosenQuerySchema,
  updateKeahlianDosenSchema,
} from '../validators/keahlian-dosen.validator';

const keahlianDosenRoute = new Hono({ router: new RegExpRouter() });

keahlianDosenRoute.get(
  '/keahlian-dosen',
  zValidator('query', getKeahlianDosenQuerySchema, zodError),
  KeahlianDosenHandler.getAll
);
keahlianDosenRoute.get('/keahlian-dosen/:id', KeahlianDosenHandler.get);
keahlianDosenRoute.post(
  '/keahlian-dosen',
  zValidator('json', createKeahlianDosenSchema, zodError),
  KeahlianDosenHandler.create
);
keahlianDosenRoute.put(
  '/keahlian-dosen/:id',
  zValidator('json', updateKeahlianDosenSchema, zodError),
  KeahlianDosenHandler.update
);
keahlianDosenRoute.delete('/keahlian-dosen/:id', KeahlianDosenHandler.delete);

export default keahlianDosenRoute;
