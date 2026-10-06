import { z } from "zod";
import { isValidTaxId } from "../../domain/tax-id.js";

// Contrato externo da BrasilAPI (GET /cnpj/v1/:cnpj). Valida somente os campos
// consumidos pelo mapeador; campos extras do provedor são tolerados e ignorados.
// Tipos conferidos contra uma resposta real em 05/10/2026: códigos de CNAE,
// situação, porte e natureza jurídica vêm como número; texto vazio vem como "".
const text = z.string().nullish();
const code = z.union([z.number().int(), z.string()]).nullish();

const brasilApiActivitySchema = z.object({
  codigo: z.union([z.number().int(), z.string()]),
  descricao: z.string(),
});

export const brasilApiCompanySchema = z.looseObject({
  cnpj: z.string().refine(isValidTaxId),
  razao_social: z.string().trim().min(1),
  nome_fantasia: text,
  situacao_cadastral: z.number().int().nullish(),
  descricao_situacao_cadastral: text,
  data_inicio_atividade: text,
  codigo_natureza_juridica: code,
  natureza_juridica: text,
  codigo_porte: z.number().int().nullish(),
  porte: text,
  capital_social: z.number().nullish(),
  email: text,
  // DDD e número concatenados, por exemplo "1123851939".
  ddd_telefone_1: text,
  cep: text,
  descricao_tipo_de_logradouro: text,
  logradouro: text,
  numero: text,
  complemento: text,
  bairro: text,
  municipio: text,
  uf: text,
  cnae_fiscal: code,
  cnae_fiscal_descricao: text,
  cnaes_secundarios: z.array(brasilApiActivitySchema).nullish(),
});

export type BrasilApiCompany = z.infer<typeof brasilApiCompanySchema>;
