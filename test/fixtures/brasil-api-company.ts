import type { BrasilApiCompany } from "../../src/infrastructure/providers/brasil-api-company.schema.js";

// Payload mínimo e anonimizado com apenas os campos consumidos (sem sócios).
export const validBrasilApiCompany: BrasilApiCompany = {
  cnpj: "11222333000181",
  razao_social: "OFICINA EXEMPLO LTDA",
  nome_fantasia: "OFICINA EXEMPLO",
  situacao_cadastral: 2,
  descricao_situacao_cadastral: "ATIVA",
  data_inicio_atividade: "2020-04-15",
  codigo_natureza_juridica: 2062,
  natureza_juridica: "Sociedade Empresária Limitada",
  codigo_porte: 1,
  porte: "MICRO EMPRESA",
  capital_social: 10000,
  email: "contato@oficina.com.br",
  ddd_telefone_1: "84999999999",
  cep: "59000000",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "EXEMPLO",
  numero: "100",
  complemento: "",
  bairro: "PLANALTO",
  municipio: "NATAL",
  uf: "RN",
  cnae_fiscal: 4520001,
  cnae_fiscal_descricao:
    "Serviços de manutenção e reparação mecânica de veículos automotores",
  cnaes_secundarios: [
    {
      codigo: 4520003,
      descricao:
        "Serviços de manutenção e reparação elétrica de veículos automotores",
    },
    {
      codigo: 4530703,
      descricao:
        "Comércio a varejo de peças e acessórios novos para veículos automotores",
    },
  ],
};
