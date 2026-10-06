import z from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    HOST: z.string().min(1).default("0.0.0.0"),

    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    BRASIL_API_BASE_URL: z
      .string()
      .url()
      .default("https://brasilapi.com.br/api"),

    PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30_000)
      .default(5000),

    PROVIDER_MAX_RESPONSE_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(5_242_880)
      .default(1_048_576),

    CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(86_400).default(900),

    CACHE_MAX_ITEMS: z.coerce.number().int().min(1).max(10_000).default(500),

    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((config, context) => {
    if (
      config.NODE_ENV === "production" &&
      new URL(config.BRASIL_API_BASE_URL).protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["BRASIL_API_BASE_URL"],
        message: "must use HTTPS in production",
      });
    }
  });

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  host: string;
  port: number;
  logLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
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
  const result = envSchema.safeParse(env);

  if (!result.success) {
    throw new Error(`Invalid environment`, { cause: result.error });
  }

  const parsed = result.data;

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    brasilApiBaseUrl: parsed.BRASIL_API_BASE_URL,
    providerTimeoutMs: parsed.PROVIDER_TIMEOUT_MS,
    providerMaxResponseBytes: parsed.PROVIDER_MAX_RESPONSE_BYTES,
    cacheTtlSeconds: parsed.CACHE_TTL_SECONDS,
    cacheMaxItems: parsed.CACHE_MAX_ITEMS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowSeconds: parsed.RATE_LIMIT_WINDOW_SECONDS,
    trustProxy: parsed.TRUST_PROXY,
  };
}
