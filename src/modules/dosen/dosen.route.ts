import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import DosenHandler from './dosen.handler';

const dosenModuleRoute = new Hono({ router: new RegExpRouter() });

dosenModuleRoute.get('/data-master/dosen', DosenHandler.getAll);

export default dosenModuleRoute;
