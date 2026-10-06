import type {
  Clock,
  CompanyCache,
} from "../../application/ports/company-cache.js";
import type { CompanyLookupResult } from "../../domain/company.js";

interface CacheEntry {
  value: CompanyLookupResult;
  expiresAt: number;
}

interface InMemoryCompanyCacheOptions {
  ttlMs: number;
  maxItems: number;
  clock?: Clock;
}

// Cache local de um único processo, sem compartilhamento entre instâncias.
// Política de capacidade: LRU. O Map guarda a ordem de inserção, e cada acesso
// reinsere a chave no fim; a primeira chave é sempre a menos recentemente usada.
// Valores entram e saem como cópias, então ninguém altera o que está armazenado.
export class InMemoryCompanyCache implements CompanyCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxItems: number;
  private readonly clock: Clock;

  constructor({ ttlMs, maxItems, clock = Date }: InMemoryCompanyCacheOptions) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError("ttlMs must be a positive number");
    }
    if (!Number.isInteger(maxItems) || maxItems <= 0) {
      throw new RangeError("maxItems must be a positive integer");
    }
    this.ttlMs = ttlMs;
    this.maxItems = maxItems;
    this.clock = clock;
  }

  get(taxId: string): CompanyLookupResult | null {
    const entry = this.entries.get(taxId);
    if (!entry) return null;

    this.entries.delete(taxId);
    if (entry.expiresAt <= this.clock.now()) return null;

    this.entries.set(taxId, entry);
    return structuredClone(entry.value);
  }

  set(taxId: string, value: CompanyLookupResult): void {
    const now = this.clock.now();
    // ponytail: varredura O(n) por escrita; n é limitado por CACHE_MAX_ITEMS (≤ 10.000).
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }

    this.entries.delete(taxId);
    if (this.entries.size >= this.maxItems) {
      const leastRecentlyUsed = this.entries.keys().next().value;
      if (leastRecentlyUsed !== undefined) {
        this.entries.delete(leastRecentlyUsed);
      }
    }

    this.entries.set(taxId, {
      value: structuredClone(value),
      expiresAt: now + this.ttlMs,
    });
  }
}
