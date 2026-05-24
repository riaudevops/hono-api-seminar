import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import RateLimitMiddleware from '../middlewares/rate-limit.middleware';
import BidangKeahlianHandler from '../handlers/bidang-keahlian.handler';
import {
  createBidangKeahlianSchema,
  updateBidangKeahlianSchema,
} from '../validators/bidang-keahlian.validator';

const bidangKeahlianRoute = new Hono({ router: new RegExpRouter() });

bidangKeahlianRoute.get('/bidang-keahlian', BidangKeahlianHandler.getAll);
bidangKeahlianRoute.get('/bidang-keahlian/:id', BidangKeahlianHandler.get);
bidangKeahlianRoute.post(
  '/bidang-keahlian',
  RateLimitMiddleware.write(),
  zValidator('json', createBidangKeahlianSchema, zodError),
  BidangKeahlianHandler.create
);
bidangKeahlianRoute.put(
  '/bidang-keahlian/:id',
  RateLimitMiddleware.write(),
  zValidator('json', updateBidangKeahlianSchema, zodError),
  BidangKeahlianHandler.update
);
bidangKeahlianRoute.delete(
  '/bidang-keahlian/:id',
  RateLimitMiddleware.write(),
  BidangKeahlianHandler.delete
);

export default bidangKeahlianRoute;
