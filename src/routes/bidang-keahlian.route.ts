import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import AuthMiddleware from '../middlewares/auth.middleware';
import BidangKeahlianHandler from '../handlers/bidang-keahlian.handler';
import {
  createBidangKeahlianSchema,
  updateBidangKeahlianSchema,
} from '../validators/bidang-keahlian.validator';

const bidangKeahlianRoute = new Hono({ router: new RegExpRouter() });

bidangKeahlianRoute.get(
  '/bidang-keahlian',
  AuthMiddleware.JWTBearerTokenExtraction,
  BidangKeahlianHandler.getAll
);
bidangKeahlianRoute.get(
  '/bidang-keahlian/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  BidangKeahlianHandler.get
);
bidangKeahlianRoute.post(
  '/bidang-keahlian',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', createBidangKeahlianSchema, zodError),
  BidangKeahlianHandler.create
);
bidangKeahlianRoute.put(
  '/bidang-keahlian/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  zValidator('json', updateBidangKeahlianSchema, zodError),
  BidangKeahlianHandler.update
);
bidangKeahlianRoute.delete(
  '/bidang-keahlian/:id',
  AuthMiddleware.JWTBearerTokenExtraction,
  BidangKeahlianHandler.delete
);

export default bidangKeahlianRoute;
