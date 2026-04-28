import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import DosenHandler from '../handlers/dosen.handler';

const dosenRoute = new Hono({ router: new RegExpRouter() });

dosenRoute.get('/dosen/search', DosenHandler.search);
dosenRoute.get('/dosen', DosenHandler.getAll);

export default dosenRoute;
