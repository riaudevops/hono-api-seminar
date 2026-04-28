import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import MahasiswaHandler from '../handlers/mahasiswa.handler';

const mahasiswaRoute = new Hono({ router: new RegExpRouter() });

mahasiswaRoute.get('/seminar-saya', MahasiswaHandler.getMe);
mahasiswaRoute.get('/mahasiswa/search', MahasiswaHandler.search);
mahasiswaRoute.get('/mahasiswa', MahasiswaHandler.getAll);
mahasiswaRoute.get('/mahasiswa/angkatan', MahasiswaHandler.getAngkatanList);
mahasiswaRoute.post('/spreadsheet/refresh', MahasiswaHandler.refreshSpreadsheet);

export default mahasiswaRoute;
