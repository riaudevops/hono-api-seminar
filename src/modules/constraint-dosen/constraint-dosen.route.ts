import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import { zodError } from '../../utils/zod-error.util';
import ConstraintDosenHandler from './constraint-dosen.handler';
import {
  chatConstraintSchema,
  postConstraintSchema,
  putConstraintSchema,
} from './constraint-dosen.validator';

const constraintDosenRoute = new Hono({ router: new RegExpRouter() });

constraintDosenRoute.get(
  '/constraint-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  ConstraintDosenHandler.getAll
);

constraintDosenRoute.post(
  '/constraint-saya',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', postConstraintSchema, zodError),
  ConstraintDosenHandler.create
);

constraintDosenRoute.post(
  '/constraint-saya/chat',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.aiExpensive(),
  zValidator('json', chatConstraintSchema, zodError),
  ConstraintDosenHandler.chat
);

constraintDosenRoute.get(
  '/constraint-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  ConstraintDosenHandler.get
);

constraintDosenRoute.put(
  '/constraint-saya/:id/chat',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.aiExpensive(),
  zValidator('json', chatConstraintSchema, zodError),
  ConstraintDosenHandler.chatUpdate
);

constraintDosenRoute.put(
  '/constraint-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  zValidator('json', putConstraintSchema, zodError),
  ConstraintDosenHandler.update
);

constraintDosenRoute.delete(
  '/constraint-saya/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  ConstraintDosenHandler.delete
);

export default constraintDosenRoute;
