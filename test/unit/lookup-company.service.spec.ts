import { beforeEach, describe, expect, it } from "vitest";
import type { CompanyCache } from "../../src/application/ports/company-cache.js";
import type { CompanyProvider } from "../../src/application/ports/company-provider.js";
import { LookupCompanyService } from "../../src/application/lookup-company.service.js";
import type {
  CompanyLookupResult,
  ProviderCompany,
} from "../../src/domain/company.js";
import {
  CompanyNotFoundError,
  InvalidTaxIdError,
  ProviderError,
} from "../../src/domain/errors.js";
import { mapBrasilApiCompany } from "../../src/infrastructure/providers/brasil-api-company.mapper.js";
import { validBrasilApiCompany } from "../fixtures/brasil-api-company.js";

const TAX_ID = "11222333000181";
const NOW = Date.parse("2026-10-05T12:00:00.000Z");
const company = mapBrasilApiCompany(validBrasilApiCompany);

// Resposta configurável por chamada; o default é a empresa da fixture.
class FakeCompanyProvider implements CompanyProvider {
  calls = 0;
  respond: () => Promise<ProviderCompany | null> = async () => company;

  findByTaxId(): Promise<ProviderCompany | null> {
    this.calls++;
    return this.respond();
  }
}

// Guarda referências, sem cópias: expõe qualquer mutação feita pelo serviço.
class FakeCompanyCache implements CompanyCache {
  readonly store = new Map<string, CompanyLookupResult>();

  get(taxId: string): CompanyLookupResult | null {
    return this.store.get(taxId) ?? null;
  }

  set(taxId: string, value: CompanyLookupResult): void {
    this.store.set(taxId, value);
  }
}

let provider: FakeCompanyProvider;
let cache: FakeCompanyCache;
let service: LookupCompanyService;

beforeEach(() => {
  provider = new FakeCompanyProvider();
  cache = new FakeCompanyCache();
  service = new LookupCompanyService({
    provider,
    cache,
    clock: { now: () => NOW },
  });
});

describe("LookupCompanyService", () => {
  it("em cache miss consulta o provedor, classifica e armazena", async () => {
    const result = await service.execute(TAX_ID);

    expect(provider.calls).toBe(1);
    expect(result).toMatchObject({
      taxId: TAX_ID,
      workshop: {
        isLikelyWorkshop: true,
        vehicleSegments: ["CAR_OR_LIGHT_VEHICLE"],
      },
      metadata: {
        source: "BRASIL_API",
        cached: false,
        fetchedAt: "2026-10-05T12:00:00.000Z",
      },
    });
    expect(cache.store.get(TAX_ID)).toEqual(result);
  });

  it("em cache hit não chama o provedor e marca cached sem alterar o armazenado", async () => {
    await service.execute(TAX_ID);
    const result = await service.execute(TAX_ID);

    expect(provider.calls).toBe(1);
    expect(result.metadata).toEqual({
      source: "BRASIL_API",
      cached: true,
      fetchedAt: "2026-10-05T12:00:00.000Z",
    });
    expect(cache.store.get(TAX_ID)?.metadata.cached).toBe(false);
  });

  it("normaliza o CNPJ antes de usar cache e provedor", async () => {
    await service.execute("11.222.333/0001-81");
    await service.execute(TAX_ID);

    expect(provider.calls).toBe(1);
    expect([...cache.store.keys()]).toEqual([TAX_ID]);
  });

  it("rejeita CNPJ inválido sem consultar o provedor", async () => {
    await expect(service.execute("11222333000180")).rejects.toBeInstanceOf(
      InvalidTaxIdError,
    );
    expect(provider.calls).toBe(0);
  });

  it("lança CompanyNotFoundError e não armazena quando o provedor devolve null", async () => {
    provider.respond = async () => null;

    await expect(service.execute(TAX_ID)).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
    expect(cache.store.size).toBe(0);
  });

  it("compartilha uma única consulta entre chamadas simultâneas", async () => {
    const [first, second] = await Promise.all([
      service.execute(TAX_ID),
      service.execute("11.222.333/0001-81"),
    ]);

    expect(provider.calls).toBe(1);
    expect(first.taxId).toBe(second.taxId);
  });

  it("propaga a falha a todos os aguardando e libera nova tentativa depois", async () => {
    provider.respond = async () => {
      throw new ProviderError();
    };

    const results = await Promise.allSettled([
      service.execute(TAX_ID),
      service.execute(TAX_ID),
    ]);

    expect(provider.calls).toBe(1);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(cache.store.size).toBe(0);

    provider.respond = async () => company;
    await expect(service.execute(TAX_ID)).resolves.toMatchObject({
      taxId: TAX_ID,
    });
    expect(provider.calls).toBe(2);
  });
});
