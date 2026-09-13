export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  host: string;
  port: number;
  logLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  brasilApiBaseUrl: string;
  providerTimeoutMs: number;
  providerMaxResponseBytes: number;
  cacheTtlSeconds: number;
  cacheMaxItems: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  trustProxy: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    // Validação com zod
 
  };
}
