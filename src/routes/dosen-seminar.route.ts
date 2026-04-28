import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { zValidator } from '@hono/zod-validator';
import { zodError } from '../utils/zod-error.util';
import DosenSeminarHandler from '../handlers/dosen-seminar.handler';
import {
  submitNilaiSchema,
  postConstraintSchema,
} from '../validators/dosen-seminar.validator';

const dosenSeminarRoute = new Hono({ router: new RegExpRouter() });

// #1 GET /dosen/seminar/jadwal
dosenSeminarRoute.get('/dosen/seminar/jadwal', DosenSeminarHandler.getJadwalSeminar);

// #2 GET /dosen/seminar/stats
dosenSeminarRoute.get('/dosen/seminar/stats', DosenSeminarHandler.getStats);

// #3 GET /dosen/seminar/komponen-penilaian
dosenSeminarRoute.get('/dosen/seminar/komponen-penilaian', DosenSeminarHandler.getKomponenPenilaian);

// #4 GET /dosen/seminar/penilaian?jadwal_id=
dosenSeminarRoute.get('/dosen/seminar/penilaian', DosenSeminarHandler.getPenilaianByJadwal);

// #5 POST /dosen/seminar/penilaian
dosenSeminarRoute.post(
  '/dosen/seminar/penilaian',
  zValidator('json', submitNilaiSchema, zodError),
  DosenSeminarHandler.submitNilai
);

// #6 GET /dosen/seminar/log-penilaian
dosenSeminarRoute.get('/dosen/seminar/log-penilaian', DosenSeminarHandler.getLogPenilaian);

// #7 GET /dosen/constraints
dosenSeminarRoute.get('/dosen/constraints', DosenSeminarHandler.getConstraints);

// #8 POST /dosen/constraints
dosenSeminarRoute.post(
  '/dosen/constraints',
  zValidator('json', postConstraintSchema, zodError),
  DosenSeminarHandler.createConstraint
);

export default dosenSeminarRoute;
