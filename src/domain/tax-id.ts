import { InvalidTaxIdError } from "./errors.js";

// Algoritmo oficial do CNPJ (numérico e alfanumérico):
// https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj-alfanumerico/calculo-do-dv-do-cnpj-alfanumerico.pdf
// Cada caractere vale seu código ASCII menos 48: "0".."9" → 0..9, "A".."Z" → 17..42.
const FIRST_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SECOND_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const TAX_ID_PATTERN = /^[0-9A-Z]{12}[0-9]{2}$/;

export function normalizeTaxId(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[./\-\s]/g, "");
  if (!/^[0-9A-Z]*$/.test(normalized)) throw new InvalidTaxIdError();
  return normalized;
}

function calculateCheckDigit(base: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += (base.charCodeAt(i) - 48) * weights[i]!;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function parseTaxId(value: string): string {
  const taxId = normalizeTaxId(value);
  if (!TAX_ID_PATTERN.test(taxId)) throw new InvalidTaxIdError();

  const first = calculateCheckDigit(taxId, FIRST_DIGIT_WEIGHTS);
  const second = calculateCheckDigit(
    taxId.slice(0, 12) + first,
    SECOND_DIGIT_WEIGHTS,
  );
  if (taxId.slice(12) !== `${first}${second}`) throw new InvalidTaxIdError();

  return taxId;
}

export function isValidTaxId(value: string): boolean {
  try {
    parseTaxId(value);
    return true;
  } catch {
    return false;
  }
}
