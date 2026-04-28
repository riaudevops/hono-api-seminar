import { Context } from 'hono';
import KoordinatorService from '../services/koordinator.service';

export default class KoordinatorHandler {
  /** #1 GET /api/koordinator/dashboard/stats */
  public static async getDashboardStats(c: Context) {
    return c.json(await KoordinatorService.getDashboardStats());
  }

  /** #2 GET /api/koordinator/dashboard/semester-stats */
  public static async getSemesterStats(c: Context) {
    return c.json(await KoordinatorService.getSemesterStats());
  }

  /** #3 GET /api/koordinator/dashboard/recent-activity */
  public static async getRecentActivity(c: Context) {
    return c.json(await KoordinatorService.getRecentActivity());
  }

  /** #4 GET /api/koordinator/dashboard/lecturer-workload */
  public static async getLecturerWorkload(c: Context) {
    return c.json(await KoordinatorService.getLecturerWorkload());
  }

  /** #5 GET /api/koordinator/dosen */
  public static async getDosenList(c: Context) {
    return c.json(await KoordinatorService.getDosenList());
  }

  /** #6 GET /api/koordinator/dosen/:nip */
  public static async getDosenDetail(c: Context) {
    const { nip } = c.req.param();
    return c.json(await KoordinatorService.getDosenDetail(nip));
  }

  /** #7 GET /api/koordinator/dosen/:nip/aktivitas */
  public static async getDosenAktivitas(c: Context) {
    const { nip } = c.req.param();
    return c.json(await KoordinatorService.getDosenAktivitas(nip));
  }
}
