import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import AuthMiddleware from '../../middlewares/auth.middleware';
import RateLimitMiddleware from '../../middlewares/rate-limit.middleware';
import UploadHandler from './upload.handler';

const uploadRoute = new Hono({ router: new RegExpRouter() });

uploadRoute.post(
  '/mahasiswa/uploads/drive',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  UploadHandler.uploadDriveFile
);

uploadRoute.delete(
  '/mahasiswa/uploads/drive/:fileId',
  AuthMiddleware.JWTBearerTokenExtraction,
  RateLimitMiddleware.write(),
  UploadHandler.deleteDriveFile
);

export default uploadRoute;
