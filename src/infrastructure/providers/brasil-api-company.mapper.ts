import type {
  BusinessActivity,
  CompanySize,
  CompanyStatus,
  Phone,
  ProviderCompany,
} from "../../domain/company.js";
import { normalizeTaxId } from "../../domain/tax-id.js";
import type { BrasilApiCompany } from "./brasil-api-company.schema.js";

// Códigos de situação cadastral da Receita Federal.
const STATUS_BY_CODE: Record<number, CompanyStatus> = {
  1: "NULL",
  2: "ACTIVE",
  3: "SUSPENDED",
  4: "UNFIT",
  8: "CLOSED",
};
const STATUS_BY_DESCRIPTION: Record<string, CompanyStatus> = {
  NULA: "NULL",
  ATIVA: "ACTIVE",
  SUSPENSA: "SUSPENDED",
  INAPTA: "UNFIT",
  BAIXADA: "CLOSED",
};

// Códigos de porte da Receita Federal.
const SIZE_BY_CODE: Record<number, CompanySize> = {
  0: "UNINFORMED",
  1: "MICRO_COMPANY",
  3: "SMALL_COMPANY",
  5: "OTHER",
};
const SIZE_BY_DESCRIPTION: Record<string, CompanySize> = {
  "NÃO INFORMADO": "UNINFORMED",
  "MICRO EMPRESA": "MICRO_COMPANY",
  "EMPRESA DE PEQUENO PORTE": "SMALL_COMPANY",
  DEMAIS: "OTHER",
};

type RawCode = number | string | null | undefined;

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function digitsOnly(value: RawCode): string | null {
  return emptyToNull(String(value ?? "").replace(/\D/g, ""));
}

// A BrasilAPI devolve CNAE numérico, o que perde o zero à esquerda (0111301 → 111301).
// O código 0 aparece quando não há CNAE.
function normalizeCnae(value: RawCode): string | null {
  const digits = digitsOnly(value);
  if (!digits || digits.length > 7 || /^0+$/.test(digits)) return null;
  return digits.padStart(7, "0");
}

// Usa o código quando disponível; o texto só entra quando o código falta.
// Valor desconhecido vira UNKNOWN, nunca um palpite.
function mapStatus(input: BrasilApiCompany): CompanyStatus {
  if (input.situacao_cadastral != null) {
    return STATUS_BY_CODE[input.situacao_cadastral] ?? "UNKNOWN";
  }
  const description = input.descricao_situacao_cadastral?.trim().toUpperCase();
  return STATUS_BY_DESCRIPTION[description ?? ""] ?? "UNKNOWN";
}

function mapCompanySize(input: BrasilApiCompany): CompanySize {
  if (input.codigo_porte != null) {
    return SIZE_BY_CODE[input.codigo_porte] ?? "UNKNOWN";
  }
  const description = input.porte?.trim().toUpperCase();
  return SIZE_BY_DESCRIPTION[description ?? ""] ?? "UNKNOWN";
}

// Aceita somente YYYY-MM-DD que corresponda a uma data real do calendário.
function mapDate(value: string | null | undefined): string | null {
  const date = emptyToNull(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().startsWith(date)
    ? date
    : null;
}

// ddd_telefone_1 traz DDD e número juntos: 2 dígitos de DDD + 8 ou 9 do número.
function mapPhone(value: string | null | undefined): Phone | null {
  const digits = digitsOnly(value);
  if (!digits || (digits.length !== 10 && digits.length !== 11)) return null;
  return { areaCode: digits.slice(0, 2), number: digits.slice(2) };
}

function mapShareCapital(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

function mapActivity(
  code: RawCode,
  description: string | null | undefined,
): BusinessActivity | null {
  const normalized = normalizeCnae(code);
  return normalized
    ? { code: normalized, description: description?.trim() ?? "" }
    : null;
}

// Remove códigos repetidos e os que já aparecem como CNAE principal.
function deduplicateActivities(
  activities: readonly (BusinessActivity | null)[],
  primary: BusinessActivity | null,
): BusinessActivity[] {
  const seen = new Set(primary ? [primary.code] : []);
  return activities.filter((activity): activity is BusinessActivity => {
    if (!activity || seen.has(activity.code)) return false;
    seen.add(activity.code);
    return true;
  });
}

function mapStreet(input: BrasilApiCompany): string | null {
  const parts = [input.descricao_tipo_de_logradouro, input.logradouro]
    .map(emptyToNull)
    .filter((part) => part !== null);
  return parts.length ? parts.join(" ") : null;
}

export function mapBrasilApiCompany(input: BrasilApiCompany): ProviderCompany {
  const legalNatureCode = digitsOnly(input.codigo_natureza_juridica);
  const legalNatureDescription = emptyToNull(input.natureza_juridica);
  const primaryActivity = mapActivity(
    input.cnae_fiscal,
    input.cnae_fiscal_descricao,
  );

  return {
    taxId: normalizeTaxId(input.cnpj),
    legalName: input.razao_social.trim(),
    tradeName: emptyToNull(input.nome_fantasia),
    status: mapStatus(input),
    openedAt: mapDate(input.data_inicio_atividade),
    legalNature:
      legalNatureCode && legalNatureDescription
        ? { code: legalNatureCode, description: legalNatureDescription }
        : null,
    companySize: mapCompanySize(input),
    shareCapital: mapShareCapital(input.capital_social),
    email: emptyToNull(input.email)?.toLowerCase() ?? null,
    phone: mapPhone(input.ddd_telefone_1),
    address: {
      postalCode: digitsOnly(input.cep),
      street: mapStreet(input),
      number: emptyToNull(input.numero),
      complement: emptyToNull(input.complemento),
      district: emptyToNull(input.bairro),
      city: emptyToNull(input.municipio),
      state: emptyToNull(input.uf)?.toUpperCase() ?? null,
    },
    primaryActivity,
    secondaryActivities: deduplicateActivities(
      (input.cnaes_secundarios ?? []).map((activity) =>
        mapActivity(activity.codigo, activity.descricao),
      ),
      primaryActivity,
    ),
  };
}
