import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import LogHandler from '../handlers/log.handler';
import { getLogQuerySchema } from '../validators/log.validator';

const logRoute = new Hono({ router: new RegExpRouter() });

logRoute.get(
  '/log',
  zValidator('query', getLogQuerySchema, zodError),
  LogHandler.getAll
);
logRoute.get('/log/:id', LogHandler.get);
logRoute.delete('/log/:id', LogHandler.delete);

export default logRoute;
