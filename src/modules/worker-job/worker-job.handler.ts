import type { Context } from 'hono';
import WorkerJobService from './worker-job.service';

export default class WorkerJobHandler {
  public static async get(c: Context) {
    const { job_id } = c.req.param();
    return c.json(await WorkerJobService.get(job_id));
  }
}
