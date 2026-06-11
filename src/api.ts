import { OpenAPIHono } from '@hono/zod-openapi';
import { GlobalRoute as globalRoute } from './modules/global';
import { JadwalRoute } from './modules/jadwal';
import { RuanganRoute } from './modules/ruangan';
import { KomponenPenilaianRoute } from './modules/komponen-penilaian';
import { PenilaianRoute as penilaianRoute } from './modules/penilaian';
import { DosenModuleRoute } from './modules/dosen';
import { ConstraintDosenModuleRoute } from './modules/constraint-dosen';
import { JadwalDraftModuleRoute } from './modules/jadwal-draft';
import { BidangKeahlianRoute } from './modules/bidang-keahlian';
import { BobotPenilaiModuleRoute } from './modules/bobot-penilai';
import { KeahlianDosenRoute } from './modules/keahlian-dosen';
import { DosenSeminarRoute as dosenSeminarRoute } from './modules/dosen-seminar';
import { KoordinatorRoute as koordinatorRoute } from './modules/koordinator';
import { JenisSeminarRoute } from './modules/jenis-seminar';
import { DokumenTemplateRoute } from './modules/dokumen-template';
import { RequirementDokumenRoute } from './modules/requirement-dokumen';
import { PendaftaranModuleRoute } from './modules/pendaftaran';
import { MahasiswaModuleRoute } from './modules/mahasiswa';
import { LogModuleRoute } from './modules/log';
import { DetailPenilaianRoute } from './modules/detail-penilaian';
import { TahunAjaranRoute } from './modules/tahun-ajaran';
import { UploadRoute } from './modules/upload';
import { WorkerJobRoute } from './modules/worker-job';
import { RegExpRouter } from 'hono/router/reg-exp-router';

const apiRouter = new OpenAPIHono({
  router: new RegExpRouter(),
});

const routes = [
  globalRoute,
  JadwalRoute,
  RuanganRoute,
  DosenModuleRoute,
  KomponenPenilaianRoute,
  penilaianRoute,
  ConstraintDosenModuleRoute,
  JadwalDraftModuleRoute,
  BidangKeahlianRoute,
  BobotPenilaiModuleRoute,
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
  TahunAjaranRoute,
  UploadRoute,
  WorkerJobRoute,
];

routes.forEach((route) => {
  apiRouter.route('/', route);
});

export default apiRouter;
