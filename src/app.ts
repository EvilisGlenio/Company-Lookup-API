import fastify ,{ FastifyInstance } from "fastify";
import { registerHealthRoute } from "./infrastructure/http/routes/health.routes.js";

export interface AppConfig {
    nodeEnv: 'development' | 'production' | 'test';
    host: string;
    port: number;
    logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    brasilApiBaseUrl: string;
    providerTimeoutMs: number;
    providerMaxResponseBytes: number;
    cacheTtlSeconds: number;
    cacheMaxItems: number;
    rateLimitMax: number;
    rateLimitWindowSeconds: number;
    trustProxy: boolean;
}

export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({logger: false});
    await registerHealthRoute(app);
    return app;
}