import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import LogPenilaianHandler from '../handlers/log-penilaian.handler';
import {
  createLogPenilaianSchema,
  getLogPenilaianQuerySchema,
  updateLogPenilaianSchema,
} from '../validators/log-penilaian.validator';

const logPenilaianRoute = new Hono({ router: new RegExpRouter() });

logPenilaianRoute.get(
  '/log-penilaian',
  zValidator('query', getLogPenilaianQuerySchema, zodError),
  LogPenilaianHandler.getAll
);
logPenilaianRoute.get('/log-penilaian/:id', LogPenilaianHandler.get);
logPenilaianRoute.post(
  '/log-penilaian',
  zValidator('json', createLogPenilaianSchema, zodError),
  LogPenilaianHandler.create
);
logPenilaianRoute.put(
  '/log-penilaian/:id',
  zValidator('json', updateLogPenilaianSchema, zodError),
  LogPenilaianHandler.update
);
logPenilaianRoute.delete('/log-penilaian/:id', LogPenilaianHandler.delete);

export default logPenilaianRoute;
