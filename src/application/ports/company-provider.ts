import type { ProviderCompany } from "../../domain/company.js";

export interface CompanyProvider {
  // `null` quando o provedor informa que o CNPJ não existe.
  findByTaxId(taxId: string): Promise<ProviderCompany | null>;
}
