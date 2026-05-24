import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import AuthMiddleware from '../../middlewares/auth.middleware';
import TahunAjaranHandler from './tahun-ajaran.handler';

const tahunAjaranRoute = new Hono({ router: new RegExpRouter() });

tahunAjaranRoute.get(
  '/data-master/tahun-ajaran',
  AuthMiddleware.JWTBearerTokenExtraction,
  TahunAjaranHandler.getAll
);

export default tahunAjaranRoute;
