import fastify, { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./infrastructure/http/routes/health.routes.js";
import { AppConfig, loadConfig } from "./infrastructure/config/env.js";
import { generateRequestId } from "./infrastructure/http/request-context.js";
import { registerErrorHandler } from "./infrastructure/http/error-handler.js";
import type { CompanyProvider } from "./application/ports/company-provider.js";
import type { CompanyCache } from "./application/ports/company-cache.js";
import { LookupCompanyService } from "./application/lookup-company.service.js";
import { BrasilApiCompanyProvider } from "./infrastructure/providers/brasil-api-company.provider.js";
import { InMemoryCompanyCache } from "./infrastructure/cache/in-memory-company-cache.js";
import { registerCompanyRoutes } from "./infrastructure/http/routes/company.routes.js";

// Portas opcionais: por padrão usa as implementações reais; testes injetam fakes.
interface BuildAppOptions {
  config?: AppConfig;
  companyProvider?: CompanyProvider;
  companyCache?: CompanyCache;
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

  const lookupCompany = new LookupCompanyService({
    provider: options.companyProvider ?? new BrasilApiCompanyProvider(config),
    cache:
      options.companyCache ??
      new InMemoryCompanyCache({
        ttlMs: config.cacheTtlSeconds * 1000,
        maxItems: config.cacheMaxItems,
      }),
  });

  registerErrorHandler(app);
  await registerHealthRoute(app);
  await registerCompanyRoutes(app, lookupCompany);

  return app;
}
