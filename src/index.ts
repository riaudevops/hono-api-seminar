import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { RegExpRouter } from "hono/router/reg-exp-router";
import { swaggerUI } from "@hono/swagger-ui";
import { config } from "./core";
import { bootstrap, shutdown } from "./core";
import { createLogger } from "./utils/logger.util";
import GlobalHandler from "./handlers/global.handler";
import globalRoute from "./routes/global.route";
import LogMiddleware from "./middlewares/log.middleware";
import jadwalRoute from "./routes/jadwal.route";
import ruanganRoute from "./routes/ruangan.route";
import dosenRoute from "./routes/dosen.route";
import mahasiswaRoute from "./routes/mahasiswa.route";
import komponenRoute from "./routes/komponen-penilaian.route";
import penilaianRoute from "./routes/penilaian.route";

const logger = createLogger("Server");

// Initialize DI Container
await bootstrap();

const app = new OpenAPIHono({
  router: new RegExpRouter(),
});

// CORS Configuration from config
app.use(
  "*",
  cors({
    origin: config.cors.origins.includes("*") ? "*" : config.cors.origins,
    credentials: config.cors.allowCredentials,
    allowMethods: config.cors.allowMethods as any,
    allowHeaders: config.cors.allowHeaders,
  }),
);

app.use("*", LogMiddleware.structuredLogger);

app.notFound(GlobalHandler.notFound);
app.onError(GlobalHandler.error);

// OpenAPI Documentation
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Hono API Seminar - TIF UIN Suska",
    version: config.app.version,
    description: "API untuk sistem manajemen seminar kerja praktik dan tugas akhir",
  },
  servers: [
    {
      url: `http://${config.server.host}:${config.server.port}`,
      description: "Development Server",
    },
  ],
});

// Swagger UI
app.get(
  "/docs",
  swaggerUI({
    url: "/openapi.json",
  }),
);

app.route("/", globalRoute);
app.route("/", jadwalRoute);
app.route("/", ruanganRoute);
app.route("/", dosenRoute);
app.route("/", mahasiswaRoute);
app.route("/", komponenRoute);
app.route("/", penilaianRoute);

// Graceful shutdown handlers
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  await shutdown();
  process.exit(0);
});

const serverPort = config.server.port;

logger.info(`Server is running`, {
  port: serverPort,
  env: config.app.env,
  version: config.app.version,
  host: config.server.host,
});

export default {
  port: serverPort,
  fetch: app.fetch,
};
