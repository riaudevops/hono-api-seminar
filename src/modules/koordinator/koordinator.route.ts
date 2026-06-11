import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import KoordinatorHandler from './koordinator.handler';

const koordinatorRoute = new Hono({ router: new RegExpRouter() });

// Dashboard
koordinatorRoute.get(
  '/koordinator/dashboard/stats',
  KoordinatorHandler.getDashboardStats
);
koordinatorRoute.get(
  '/koordinator/dashboard/semester-stats',
  KoordinatorHandler.getSemesterStats
);
koordinatorRoute.get(
  '/koordinator/dashboard/recent-activity',
  KoordinatorHandler.getRecentActivity
);
koordinatorRoute.get(
  '/koordinator/dashboard/lecturer-workload',
  KoordinatorHandler.getLecturerWorkload
);

// Dosen management
koordinatorRoute.get('/koordinator/dosen', KoordinatorHandler.getDosenList);
koordinatorRoute.get(
  '/koordinator/dosen/:nip',
  KoordinatorHandler.getDosenDetail
);
koordinatorRoute.get(
  '/koordinator/dosen/:nip/aktivitas',
  KoordinatorHandler.getDosenAktivitas
);

export default koordinatorRoute;
