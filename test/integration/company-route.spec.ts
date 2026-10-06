import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import type { CompanyProvider } from "../../src/application/ports/company-provider.js";
import type { ProviderCompany } from "../../src/domain/company.js";
import {
  ProviderError,
  ProviderInvalidResponseError,
  ProviderTimeoutError,
  ResponseTooLargeError,
} from "../../src/domain/errors.js";
import { loadConfig } from "../../src/infrastructure/config/env.js";
import { mapBrasilApiCompany } from "../../src/infrastructure/providers/brasil-api-company.mapper.js";
import { validBrasilApiCompany } from "../fixtures/brasil-api-company.js";

const TAX_ID = "11222333000181";
const company = mapBrasilApiCompany(validBrasilApiCompany);

class FakeCompanyProvider implements CompanyProvider {
  calls = 0;
  constructor(
    private readonly respond: () => Promise<ProviderCompany | null>,
  ) {}

  findByTaxId(): Promise<ProviderCompany | null> {
    this.calls++;
    return this.respond();
  }
}

describe("GET /v1/companies/:cnpj", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  async function request(
    respond: () => Promise<ProviderCompany | null>,
    cnpj = TAX_ID,
  ) {
    const provider = new FakeCompanyProvider(respond);
    const app = await buildApp({
      config: loadConfig({}),
      companyProvider: provider,
    });
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: `/v1/companies/${cnpj}`,
      headers: { "x-request-id": "req-1" },
    });
    return { response, provider, app };
  }

  it("devolve o contrato normalizado da seção 9.3", async () => {
    const { response } = await request(async () => ({
      ...company,
      secondaryActivities: [],
    }));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      taxId: "11222333000181",
      legalName: "OFICINA EXEMPLO LTDA",
      tradeName: "OFICINA EXEMPLO",
      status: "ACTIVE",
      openedAt: "2020-04-15",
      legalNature: {
        code: "2062",
        description: "Sociedade Empresária Limitada",
      },
      companySize: "MICRO_COMPANY",
      shareCapital: 10000,
      email: "contato@oficina.com.br",
      phone: { areaCode: "84", number: "999999999" },
      address: {
        postalCode: "59000000",
        street: "RUA EXEMPLO",
        number: "100",
        complement: null,
        district: "PLANALTO",
        city: "NATAL",
        state: "RN",
      },
      primaryActivity: {
        code: "4520001",
        description:
          "Serviços de manutenção e reparação mecânica de veículos automotores",
      },
      secondaryActivities: [],
      workshop: {
        isLikelyWorkshop: true,
        vehicleSegments: ["CAR_OR_LIGHT_VEHICLE"],
        matchedActivities: [
          {
            code: "4520001",
            description:
              "Serviços de manutenção e reparação mecânica de veículos automotores",
            isPrimary: true,
          },
        ],
      },
      metadata: {
        source: "BRASIL_API",
        cached: false,
        fetchedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      },
    });
  });

  it("não expõe campos fora do contrato", async () => {
    const { response } = await request(
      async () =>
        ({
          ...company,
          razao_social: "VAZOU",
          address: { ...company.address, ibge: "2408102" },
        }) as ProviderCompany,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("razao_social");
    expect(response.body).not.toContain("ibge");
  });

  it("marca cached na segunda consulta sem chamar o provedor de novo", async () => {
    const { app, provider } = await request(async () => company);

    const second = await app.inject({
      method: "GET",
      url: `/v1/companies/${TAX_ID}`,
    });

    expect(provider.calls).toBe(1);
    expect(second.json().metadata.cached).toBe(true);
  });

  it.each(["11222333000180", "123", "11.222.333-0001-81x"])(
    "responde 400 para CNPJ inválido %s sem consultar o provedor",
    async (cnpj) => {
      const { response, provider } = await request(async () => company, cnpj);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: "INVALID_TAX_ID",
          message: "O CNPJ informado é inválido.",
          requestId: "req-1",
          details: null,
        },
      });
      expect(provider.calls).toBe(0);
    },
  );

  it.each([
    ["empresa ausente", null, 404, "COMPANY_NOT_FOUND"],
    ["timeout", new ProviderTimeoutError(), 504, "PROVIDER_TIMEOUT"],
    [
      "payload inválido",
      new ProviderInvalidResponseError(),
      502,
      "PROVIDER_INVALID_RESPONSE",
    ],
    ["falha externa", new ProviderError(), 502, "PROVIDER_ERROR"],
    [
      "resposta grande demais",
      new ResponseTooLargeError(),
      502,
      "PROVIDER_ERROR",
    ],
  ] as const)("traduz %s em %i", async (_, error, status, code) => {
    const respond = async () => {
      if (error) throw error;
      return null;
    };
    const { response } = await request(respond);

    expect(response.statusCode).toBe(status);
    expect(response.json().error).toMatchObject({ code, requestId: "req-1" });
  });
});
