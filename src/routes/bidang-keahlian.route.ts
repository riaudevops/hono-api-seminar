import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
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
  zValidator('json', createBidangKeahlianSchema, zodError),
  BidangKeahlianHandler.create
);
bidangKeahlianRoute.put(
  '/bidang-keahlian/:id',
  zValidator('json', updateBidangKeahlianSchema, zodError),
  BidangKeahlianHandler.update
);
bidangKeahlianRoute.delete('/bidang-keahlian/:id', BidangKeahlianHandler.delete);

export default bidangKeahlianRoute;
