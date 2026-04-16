import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import TahunAjaranHandler from '../handlers/tahun-ajaran.handler';

const tahunAjaranRoute = new Hono({ router: new RegExpRouter() });

tahunAjaranRoute.get('/tahun-ajaran', TahunAjaranHandler.getAll);

export default tahunAjaranRoute;
