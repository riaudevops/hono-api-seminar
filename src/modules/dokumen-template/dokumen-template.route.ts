import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import DokumenTemplateHandler from './dokumen-template.handler';
import {
  postDokumenTemplateSchema,
  putDokumenTemplateSchema,
} from './dokumen-template.validator';

const dokumenTemplateRoute = new Hono({ router: new RegExpRouter() });

dokumenTemplateRoute.get(
  '/data-master/dokumen-template',
  AuthMiddleware.JWTBearerTokenExtraction,
  DokumenTemplateHandler.getAll
);

dokumenTemplateRoute.get(
  '/data-master/dokumen-template/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  DokumenTemplateHandler.getById
);

dokumenTemplateRoute.post(
  '/koordinator/dokumen-template',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postDokumenTemplateSchema, zodError),
  DokumenTemplateHandler.create
);

dokumenTemplateRoute.put(
  '/koordinator/dokumen-template/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', putDokumenTemplateSchema, zodError),
  DokumenTemplateHandler.update
);

dokumenTemplateRoute.delete(
  '/koordinator/dokumen-template/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  DokumenTemplateHandler.delete
);

export default dokumenTemplateRoute;
