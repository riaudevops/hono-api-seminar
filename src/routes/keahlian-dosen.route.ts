import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import AuthMiddleware from '../middlewares/auth.middleware';
import KeahlianDosenHandler from '../handlers/keahlian-dosen.handler';
import {
  createKeahlianDosenSchema,
  getKeahlianDosenQuerySchema,
  updateKeahlianDosenSchema,
} from '../validators/keahlian-dosen.validator';

const keahlianDosenRoute = new Hono({ router: new RegExpRouter() });

keahlianDosenRoute.get(
  '/keahlian-dosen',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getKeahlianDosenQuerySchema, zodError),
  KeahlianDosenHandler.getAll
);
keahlianDosenRoute.get(
  '/keahlian-dosen/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  KeahlianDosenHandler.get
);
keahlianDosenRoute.post(
  '/keahlian-dosen',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', createKeahlianDosenSchema, zodError),
  KeahlianDosenHandler.create
);
keahlianDosenRoute.put(
  '/keahlian-dosen/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', updateKeahlianDosenSchema, zodError),
  KeahlianDosenHandler.update
);
keahlianDosenRoute.delete(
  '/keahlian-dosen/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  KeahlianDosenHandler.delete
);

export default keahlianDosenRoute;
