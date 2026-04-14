import { Hono } from "hono";
import { RegExpRouter } from "hono/router/reg-exp-router";
import { zValidator } from "@hono/zod-validator";
import { zodError } from "../utils/zod-error.util";
import AuthMiddleware from "../middlewares/auth.middleware";
import KomponenPenilaianHandler from "../handlers/komponen-penilaian.handler";
import { createKomponenPenilaianSchema, updateKomponenPenilaianSchema, toggleStatusKomponenSchema } from "../validators/komponen-penilaian.validator";

const komponenRoute = new Hono({ router: new RegExpRouter() });

komponenRoute.get("/komponen-penilaian", AuthMiddleware.JWTBearerTokenExtraction, KomponenPenilaianHandler.getAll);
komponenRoute.post("/komponen-penilaian", AuthMiddleware.JWTBearerTokenExtraction, zValidator("json", createKomponenPenilaianSchema, zodError), KomponenPenilaianHandler.create);
komponenRoute.put("/komponen-penilaian/:id", AuthMiddleware.JWTBearerTokenExtraction, zValidator("json", updateKomponenPenilaianSchema, zodError), KomponenPenilaianHandler.update);
komponenRoute.patch("/komponen-penilaian/:id/toggle", AuthMiddleware.JWTBearerTokenExtraction, zValidator("json", toggleStatusKomponenSchema, zodError), KomponenPenilaianHandler.toggleStatus);
komponenRoute.delete("/komponen-penilaian/:id", AuthMiddleware.JWTBearerTokenExtraction, KomponenPenilaianHandler.delete);

export default komponenRoute;
