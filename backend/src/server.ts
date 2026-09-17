import cors from "@fastify/cors";
import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { allowedCorsOrigins, config } from "./config.js";
import { refundExpiredRedPackets, registerRoutes } from "./routes.js";

export function buildServer() {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: allowedCorsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  void app.register(sensible);
  void app.register(registerRoutes, { prefix: "/api" });

  return app;
}

const app = buildServer();

const refundInterval = setInterval(() => {
  void refundExpiredRedPackets().catch((error) => {
    app.log.error(error, "Expired red-packet refund worker failed");
  });
}, 60_000);
refundInterval.unref();

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
