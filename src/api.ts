import { OpenAPIHono } from '@hono/zod-openapi';
import globalRoute from './routes/global.route';
import { JadwalRoute } from './modules/jadwal';
import { RuanganRoute } from './modules/ruangan';
import dosenRoute from './routes/dosen.route';
import { KomponenPenilaianRoute } from './modules/komponen-penilaian';
import penilaianRoute from './routes/penilaian.route';
import { ConstraintDosenModuleRoute } from './modules/constraint-dosen';
import { JadwalDraftModuleRoute } from './modules/jadwal-draft';
import { BidangKeahlianRoute } from './modules/bidang-keahlian';
import { KeahlianDosenRoute } from './modules/keahlian-dosen';
import dosenSeminarRoute from './routes/dosen-seminar.route';
import koordinatorRoute from './routes/koordinator.route';
import { JenisSeminarRoute } from './modules/jenis-seminar';
import { DokumenTemplateRoute } from './modules/dokumen-template';
import { RequirementDokumenRoute } from './modules/requirement-dokumen';
import { PendaftaranModuleRoute } from './modules/pendaftaran';
import { MahasiswaModuleRoute } from './modules/mahasiswa';
import { LogModuleRoute } from './modules/log';
import { DetailPenilaianRoute } from './modules/detail-penilaian';
import { RegExpRouter } from 'hono/router/reg-exp-router';

const apiRouter = new OpenAPIHono({
  router: new RegExpRouter(),
});

const routes = [
  globalRoute,
  JadwalRoute,
  RuanganRoute,
  dosenRoute,
  KomponenPenilaianRoute,
  penilaianRoute,
  ConstraintDosenModuleRoute,
  JadwalDraftModuleRoute,
  BidangKeahlianRoute,
  KeahlianDosenRoute,
  dosenSeminarRoute,
  koordinatorRoute,
  JenisSeminarRoute,
  DokumenTemplateRoute,
  RequirementDokumenRoute,
  PendaftaranModuleRoute,
  MahasiswaModuleRoute,
  DetailPenilaianRoute,
  LogModuleRoute,
]

routes.forEach((route) => {
  apiRouter.route('/', route);
});

export default apiRouter;