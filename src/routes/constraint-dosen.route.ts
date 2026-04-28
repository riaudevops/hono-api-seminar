import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zodError } from '../utils/zod-error.util';
import { zValidator } from '@hono/zod-validator';
import ConstraintDosenHandler from '../handlers/constraint-dosen.handler';
import {
  postConstraintSchema,
  putConstraintSchema,
  chatConstraintSchema,
} from '../validators/constraint-dosen.validator';

const constraintDosenRoute = new Hono({ router: new RegExpRouter() });

constraintDosenRoute.get('/constraint-saya', ConstraintDosenHandler.getAll);
constraintDosenRoute.get('/constraint-saya/:id', ConstraintDosenHandler.get);
constraintDosenRoute.post(
  '/constraint-saya',
  zValidator('json', postConstraintSchema, zodError),
  ConstraintDosenHandler.create
);
constraintDosenRoute.put(
  '/constraint-saya/:id',
  zValidator('json', putConstraintSchema, zodError),
  ConstraintDosenHandler.update
);
constraintDosenRoute.delete('/constraint-saya/:id', ConstraintDosenHandler.delete);
constraintDosenRoute.post(
  '/constraint-saya/chat',
  zValidator('json', chatConstraintSchema, zodError),
  ConstraintDosenHandler.chat
);

export default constraintDosenRoute;
