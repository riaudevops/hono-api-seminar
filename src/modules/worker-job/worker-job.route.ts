import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import AuthMiddleware from '../../middlewares/auth.middleware';
import WorkerJobHandler from './worker-job.handler';

const workerJobRoute = new Hono({ router: new RegExpRouter() });

workerJobRoute.get(
  '/worker/jobs/:job_id',
  AuthMiddleware.JWTBearerTokenExtraction,
  WorkerJobHandler.get
);

export default workerJobRoute;
