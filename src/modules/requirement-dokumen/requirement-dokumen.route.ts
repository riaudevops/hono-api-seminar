import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RequirementDokumenHandler from './requirement-dokumen.handler';
import {
  getAllRequirementDokumenQuerySchema,
  postRequirementDokumenSchema,
  putRequirementDokumenSchema,
} from './requirement-dokumen.validator';

const requirementDokumenRoute = new Hono({ router: new RegExpRouter() });

requirementDokumenRoute.get(
  '/data-master/requirement-dokumen',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('query', getAllRequirementDokumenQuerySchema, zodError),
  RequirementDokumenHandler.getAll
);

requirementDokumenRoute.get(
  '/data-master/requirement-dokumen/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RequirementDokumenHandler.getById
);

requirementDokumenRoute.post(
  '/koordinator/requirement-dokumen',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', postRequirementDokumenSchema, zodError),
  RequirementDokumenHandler.create
);

requirementDokumenRoute.put(
  '/koordinator/requirement-dokumen/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', putRequirementDokumenSchema, zodError),
  RequirementDokumenHandler.update
);

requirementDokumenRoute.delete(
  '/koordinator/requirement-dokumen/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RequirementDokumenHandler.delete
);

export default requirementDokumenRoute;
