import { Hono } from "hono";
import { RegExpRouter } from "hono/router/reg-exp-router";
import MahasiswaHandler from "../handlers/mahasiswa.handler";
import AuthMiddleware from "../middlewares/auth.middleware";

const mahasiswaRoute = new Hono({ router: new RegExpRouter() });

mahasiswaRoute.get("/seminar-saya", AuthMiddleware.JWTBearerTokenExtraction, MahasiswaHandler.getMe);
mahasiswaRoute.get("/mahasiswa/search", AuthMiddleware.JWTBearerTokenExtraction, MahasiswaHandler.search);
mahasiswaRoute.get("/mahasiswa", AuthMiddleware.JWTBearerTokenExtraction, MahasiswaHandler.getAll);
mahasiswaRoute.get("/mahasiswa/angkatan", AuthMiddleware.JWTBearerTokenExtraction, MahasiswaHandler.getAngkatanList);
mahasiswaRoute.post("/spreadsheet/refresh", AuthMiddleware.JWTBearerTokenExtraction, MahasiswaHandler.refreshSpreadsheet);

export default mahasiswaRoute;