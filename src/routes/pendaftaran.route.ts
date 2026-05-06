import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import PendaftaranHandler from '../handlers/pendaftaran.handler';

const pendaftaranRoute = new Hono({ router: new RegExpRouter() });

pendaftaranRoute.get('/pendaftaran/dashboard', PendaftaranHandler.getDashboard);
pendaftaranRoute.get('/pendaftaran', PendaftaranHandler.getAll);
pendaftaranRoute.get('/pendaftaran/detail/:id', PendaftaranHandler.getById);

export default pendaftaranRoute;
