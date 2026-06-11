import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import GlobalHandler from './global.handler';

const globalRoute = new Hono({ router: new RegExpRouter() });

globalRoute.get('/', GlobalHandler.introduce);
globalRoute.get('/health', GlobalHandler.health);

export default globalRoute;
