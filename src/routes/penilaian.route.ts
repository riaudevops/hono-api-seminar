import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import PenilaianHandler from '../handlers/penilaian.handler';
import { submitPenilaianSchema } from '../validators/penilaian.validator';

const penilaianRoute = new Hono({ router: new RegExpRouter() });

// Dosen endpoints
penilaianRoute.get('/penilaian/jadwal-saya', PenilaianHandler.getJadwalToAssess);
penilaianRoute.post(
  '/penilaian/:id/submit',
  zValidator('json', submitPenilaianSchema, zodError),
  PenilaianHandler.submitPenilaian
);

// General endpoints
penilaianRoute.get('/penilaian/jadwal/:id_jadwal', PenilaianHandler.getNilaiByJadwal);
penilaianRoute.get('/penilaian/jadwal/:id_jadwal/logs', PenilaianHandler.getLogsByJadwal);

export default penilaianRoute;
