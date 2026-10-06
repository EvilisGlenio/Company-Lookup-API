import type { CompanyLookupResult } from "../domain/company.js";
import { CompanyNotFoundError } from "../domain/errors.js";
import { parseTaxId } from "../domain/tax-id.js";
import { classifyWorkshop } from "../domain/workshop-classifier.js";
import type { Clock, CompanyCache } from "./ports/company-cache.js";
import type { CompanyProvider } from "./ports/company-provider.js";

interface LookupCompanyServiceDeps {
  provider: CompanyProvider;
  cache: CompanyCache;
  clock?: Clock;
}

export class LookupCompanyService {
  // Consultas em andamento por CNPJ: chamadas simultâneas compartilham a mesma promessa.
  private readonly inFlight = new Map<string, Promise<CompanyLookupResult>>();
  private readonly provider: CompanyProvider;
  private readonly cache: CompanyCache;
  private readonly clock: Clock;

  constructor({ provider, cache, clock = Date }: LookupCompanyServiceDeps) {
    this.provider = provider;
    this.cache = cache;
    this.clock = clock;
  }

  // Lança InvalidTaxIdError, CompanyNotFoundError ou os erros do provedor.
  execute(rawTaxId: string): Promise<CompanyLookupResult> {
    // Normaliza antes de tudo: a chave do cache e do inFlight é sempre o CNPJ canônico.
    let taxId: string;
    try {
      taxId = parseTaxId(rawTaxId);
    } catch (error) {
      return Promise.reject(error);
    }

    const cached = this.cache.get(taxId);
    if (cached) {
      // Cópia rasa com metadata novo: o objeto armazenado nunca é alterado.
      return Promise.resolve({
        ...cached,
        metadata: { ...cached.metadata, cached: true },
      });
    }

    const pending = this.inFlight.get(taxId);
    if (pending) return pending;

    const promise = this.loadAndCache(taxId).finally(() => {
      if (this.inFlight.get(taxId) === promise) this.inFlight.delete(taxId);
    });
    this.inFlight.set(taxId, promise);
    return promise;
  }

  // Falhas e "não encontrado" não vão para o cache.
  private async loadAndCache(taxId: string): Promise<CompanyLookupResult> {
    const company = await this.provider.findByTaxId(taxId);
    if (!company) throw new CompanyNotFoundError();

    const result: CompanyLookupResult = {
      ...company,
      workshop: classifyWorkshop(
        company.primaryActivity,
        company.secondaryActivities,
      ),
      metadata: {
        source: "BRASIL_API",
        cached: false,
        fetchedAt: new Date(this.clock.now()).toISOString(),
      },
    };
    this.cache.set(taxId, result);
    return result;
  }
}
