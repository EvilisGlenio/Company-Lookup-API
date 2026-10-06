import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/infrastructure/config/env.js";

describe("loadConfig", () => {
  it("uses safe defaults", () => {
    expect(loadConfig({})).toMatchObject({
      host: "0.0.0.0",
      port: 3000,
      providerTimeoutMs: 5000,
      cacheTtlSeconds: 900,
      cacheMaxItems: 500,
    });
  });

  it("rejects invalid numeric values", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow("Invalid environment");
  });

  it("requires an HTTPS provider URL in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BRASIL_API_BASE_URL: "http://brasilapi.com.br/api",
      }),
    ).toThrow("Invalid environment");
  });

  it("accepts only 'true' or 'false' for TRUST_PROXY", () => {
    expect(loadConfig({ TRUST_PROXY: "true" }).trustProxy).toBe(true);
    expect(() => loadConfig({ TRUST_PROXY: "yes" })).toThrow(
      "Invalid environment",
    );
  });
});
