import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../../utils/zod-error.util';
import { postRuanganSchema } from './ruangan.validator';
import RuanganHandler from './ruangan.handler';

const ruanganRoute = new Hono({ router: new RegExpRouter() });

ruanganRoute.get('/ruangan', RuanganHandler.getAll);
ruanganRoute.get('/ruangan/:kode', RuanganHandler.get);
ruanganRoute.post(
  '/ruangan',
  zValidator('json', postRuanganSchema, zodError),
  RuanganHandler.post
);
ruanganRoute.put(
  '/ruangan/:kode',
  zValidator('json', postRuanganSchema, zodError),
  RuanganHandler.put
);
ruanganRoute.delete('/ruangan/:kode', RuanganHandler.delete);

export default ruanganRoute;
