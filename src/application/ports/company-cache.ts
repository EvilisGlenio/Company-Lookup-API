import type { CompanyLookupResult } from "../../domain/company.js";

// Relógio injetável: permite testar TTL sem timers reais.
export interface Clock {
  // Milissegundos, como Date.now().
  now(): number;
}

export interface CompanyCache {
  get(taxId: string): CompanyLookupResult | null;
  set(taxId: string, value: CompanyLookupResult): void;
}
