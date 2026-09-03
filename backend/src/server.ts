import cors from "@fastify/cors";
import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";

export function buildServer() {
  const app = Fastify({ logger: true });

  void app.register(cors, { origin: config.CORS_ORIGIN });
  void app.register(sensible);
  void app.register(registerRoutes, { prefix: "/api" });

  return app;
}

const app = buildServer();

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
