import fastify, { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./infrastructure/http/routes/health.routes.js";
import { AppConfig, loadConfig } from "./infrastructure/config/env.js";
import { generateRequestId } from "./infrastructure/http/request-context.js";
import { registerErrorHandler } from "./infrastructure/http/error-handler.js";

interface BuildAppOptions {
  config?: AppConfig;
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig(process.env);

  const app = fastify({
    logger: false,
    trustProxy: config.trustProxy,
    genReqId: generateRequestId,
  });

  registerErrorHandler(app);
  await registerHealthRoute(app);

  return app;
}
