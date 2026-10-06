import { beforeEach, describe, expect, it } from "vitest";
import type { CompanyLookupResult } from "../../src/domain/company.js";
import { classifyWorkshop } from "../../src/domain/workshop-classifier.js";
import { InMemoryCompanyCache } from "../../src/infrastructure/cache/in-memory-company-cache.js";
import { mapBrasilApiCompany } from "../../src/infrastructure/providers/brasil-api-company.mapper.js";
import { validBrasilApiCompany } from "../fixtures/brasil-api-company.js";

const TTL_MS = 1000;
const company = mapBrasilApiCompany(validBrasilApiCompany);

function result(taxId: string): CompanyLookupResult {
  return {
    ...company,
    taxId,
    workshop: classifyWorkshop(
      company.primaryActivity,
      company.secondaryActivities,
    ),
    metadata: {
      source: "BRASIL_API",
      cached: false,
      fetchedAt: "2026-10-05T12:00:00.000Z",
    },
  };
}

let now: number;
let cache: InMemoryCompanyCache;

beforeEach(() => {
  now = 0;
  cache = new InMemoryCompanyCache({
    ttlMs: TTL_MS,
    maxItems: 2,
    clock: { now: () => now },
  });
});

describe("InMemoryCompanyCache", () => {
  it("devolve null quando a chave não existe", () => {
    expect(cache.get("A")).toBeNull();
  });

  it("devolve o valor armazenado antes do TTL", () => {
    cache.set("A", result("A"));
    now = TTL_MS - 1;

    expect(cache.get("A")).toEqual(result("A"));
  });

  it("expira a entrada ao atingir o TTL", () => {
    cache.set("A", result("A"));
    now = TTL_MS;

    expect(cache.get("A")).toBeNull();
  });

  it("renova o TTL ao regravar a mesma chave", () => {
    cache.set("A", result("A"));
    now = 900;
    cache.set("A", result("A"));
    now = 1500;

    expect(cache.get("A")).not.toBeNull();
  });

  it("remove a entrada menos recentemente usada ao atingir a capacidade", () => {
    cache.set("A", result("A"));
    cache.set("B", result("B"));
    cache.get("A");
    cache.set("C", result("C"));

    expect(cache.get("A")).not.toBeNull();
    expect(cache.get("B")).toBeNull();
    expect(cache.get("C")).not.toBeNull();
  });

  it("descarta expirados antes de aplicar LRU", () => {
    cache.set("A", result("A"));
    now = 500;
    cache.set("B", result("B"));
    now = TTL_MS;
    cache.get("B");
    cache.set("C", result("C"));

    // A expirou e liberou espaço: B, mesmo sendo o mais antigo válido, permanece.
    expect(cache.get("B")).not.toBeNull();
    expect(cache.get("C")).not.toBeNull();
  });

  it("não deixa alterações externas atingirem o valor armazenado", () => {
    const value = result("A");
    cache.set("A", value);
    value.legalName = "ALTERADO NA ENTRADA";

    const first = cache.get("A");
    if (!first) throw new Error("cache miss");
    first.metadata.cached = true;
    first.secondaryActivities.length = 0;

    expect(cache.get("A")).toEqual(result("A"));
  });

  it.each([
    { ttlMs: 0, maxItems: 1 },
    { ttlMs: -1, maxItems: 1 },
    { ttlMs: Number.NaN, maxItems: 1 },
    { ttlMs: 1, maxItems: 0 },
    { ttlMs: 1, maxItems: 1.5 },
  ])("rejeita configuração inválida %o", (options) => {
    expect(() => new InMemoryCompanyCache(options)).toThrow(RangeError);
  });
});
