import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/infrastructure/config/env.js";
import {
  InvalidTaxIdError,
  ResponseTooLargeError,
} from "../../src/domain/errors.js";

describe("error handler", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  // Cria o app com rotas de teste que lançam erros conhecidos e desconhecidos
  async function buildTestApp() {
    const app = await buildApp({ config: loadConfig({}) });
    apps.push(app);
    app.get("/invalid-tax-id", async () => {
      throw new InvalidTaxIdError();
    });
    app.get("/too-large", async () => {
      throw new ResponseTooLargeError();
    });
    app.get("/boom", async () => {
      throw new Error("secret stack detail");
    });
    return app;
  }

  it("returns the public envelope for a known error", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/invalid-tax-id",
      headers: { "x-request-id": "request-test-1" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "INVALID_TAX_ID",
        message: "O CNPJ informado é inválido.",
        requestId: "request-test-1",
        details: null,
      },
    });
  });

  it("hides unexpected errors behind INTERNAL_ERROR", async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("INTERNAL_ERROR");
    expect(response.body).not.toContain("secret stack detail");
  });

  it("translates a too-large provider response to PROVIDER_ERROR", async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: "GET", url: "/too-large" });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe("PROVIDER_ERROR");
  });

  it("generates a UUID when x-request-id is invalid", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/boom",
      headers: { "x-request-id": "x".repeat(129) },
    });

    expect(response.json().error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
