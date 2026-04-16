import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import DosenHandler from '../handlers/dosen.handler';
import AuthMiddleware from '../middlewares/auth.middleware';

const dosenRoute = new Hono({ router: new RegExpRouter() });

dosenRoute.get(
  '/dosen/search',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenHandler.search
);
dosenRoute.get(
  '/dosen',
  AuthMiddleware.JWTBearerTokenExtraction,
  DosenHandler.getAll
);

export default dosenRoute;
