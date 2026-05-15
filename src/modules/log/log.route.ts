import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import LogHandler from './log.handler';
import { getLogQuerySchema } from './log.validator';

const logRoute = new Hono({ router: new RegExpRouter() });

logRoute.get(
  '/log',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getLogQuerySchema, zodError),
  LogHandler.getAll
);

logRoute.get('/log/:id', AuthMiddleware.JWTBearerTokenExtraction, LogHandler.get);

logRoute.delete(
  '/log/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  LogHandler.delete
);

export default logRoute;
