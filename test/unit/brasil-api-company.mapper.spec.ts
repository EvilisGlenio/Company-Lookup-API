import { describe, expect, it } from "vitest";
import { mapBrasilApiCompany } from "../../src/infrastructure/providers/brasil-api-company.mapper.js";
import type { BrasilApiCompany } from "../../src/infrastructure/providers/brasil-api-company.schema.js";
import { validBrasilApiCompany } from "../fixtures/brasil-api-company.js";

function map(overrides: Partial<BrasilApiCompany>) {
  return mapBrasilApiCompany({ ...validBrasilApiCompany, ...overrides });
}

describe("mapBrasilApiCompany", () => {
  it("mapeia a empresa completa", () => {
    expect(mapBrasilApiCompany(validBrasilApiCompany)).toEqual({
      taxId: "11222333000181",
      legalName: "OFICINA EXEMPLO LTDA",
      tradeName: "OFICINA EXEMPLO",
      status: "ACTIVE",
      openedAt: "2020-04-15",
      legalNature: {
        code: "2062",
        description: "Sociedade Empresária Limitada",
      },
      companySize: "MICRO_COMPANY",
      shareCapital: 10000,
      email: "contato@oficina.com.br",
      phone: { areaCode: "84", number: "999999999" },
      address: {
        postalCode: "59000000",
        street: "RUA EXEMPLO",
        number: "100",
        complement: null,
        district: "PLANALTO",
        city: "NATAL",
        state: "RN",
      },
      primaryActivity: {
        code: "4520001",
        description:
          "Serviços de manutenção e reparação mecânica de veículos automotores",
      },
      secondaryActivities: [
        expect.objectContaining({ code: "4520003" }),
        expect.objectContaining({ code: "4530703" }),
      ],
    });
  });

  it("não altera o objeto recebido", () => {
    const input = structuredClone(validBrasilApiCompany);
    mapBrasilApiCompany(input);
    expect(input).toEqual(validBrasilApiCompany);
  });

  it("transforma strings vazias e ausências em null", () => {
    const result = map({
      nome_fantasia: "  ",
      email: "",
      ddd_telefone_1: "",
      natureza_juridica: "",
      complemento: undefined,
      cnae_fiscal: null,
      cnaes_secundarios: null,
    });
    expect(result.tradeName).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.legalNature).toBeNull();
    expect(result.address.complement).toBeNull();
    expect(result.primaryActivity).toBeNull();
    expect(result.secondaryActivities).toEqual([]);
  });

  it("preserva acentos", () => {
    const result = map({
      razao_social: "AUTO PEÇAS JOÃO & CIA",
      municipio: "SÃO GONÇALO DO AMARANTE",
    });
    expect(result.legalName).toBe("AUTO PEÇAS JOÃO & CIA");
    expect(result.address.city).toBe("SÃO GONÇALO DO AMARANTE");
  });

  it.each([
    [1, "NULL"],
    [2, "ACTIVE"],
    [3, "SUSPENDED"],
    [4, "UNFIT"],
    [8, "CLOSED"],
    [99, "UNKNOWN"],
  ] as const)("mapeia situação %d para %s", (code, expected) => {
    expect(map({ situacao_cadastral: code }).status).toBe(expected);
  });

  it("usa a descrição da situação só quando falta o código", () => {
    expect(
      map({ situacao_cadastral: null, descricao_situacao_cadastral: "BAIXADA" })
        .status,
    ).toBe("CLOSED");
    expect(
      map({ situacao_cadastral: null, descricao_situacao_cadastral: "NOVA" })
        .status,
    ).toBe("UNKNOWN");
  });

  it.each([
    [0, "UNINFORMED"],
    [1, "MICRO_COMPANY"],
    [3, "SMALL_COMPANY"],
    [5, "OTHER"],
    [7, "UNKNOWN"],
  ] as const)("mapeia porte %d para %s", (code, expected) => {
    expect(map({ codigo_porte: code }).companySize).toBe(expected);
  });

  it("usa a descrição do porte só quando falta o código", () => {
    expect(map({ codigo_porte: null, porte: "DEMAIS" }).companySize).toBe(
      "OTHER",
    );
    expect(map({ codigo_porte: null, porte: "GIGANTE" }).companySize).toBe(
      "UNKNOWN",
    );
  });

  it.each(["2021-02-30", "15/04/2020", "2020-13-01", ""])(
    "descarta data inválida %j",
    (date) => {
      expect(map({ data_inicio_atividade: date }).openedAt).toBeNull();
    },
  );

  it("descarta capital social negativo", () => {
    expect(map({ capital_social: -1 }).shareCapital).toBeNull();
    expect(map({ capital_social: 0 }).shareCapital).toBe(0);
  });

  it("separa DDD de telefone fixo e rejeita tamanhos inesperados", () => {
    expect(map({ ddd_telefone_1: "1123851939" }).phone).toEqual({
      areaCode: "11",
      number: "23851939",
    });
    expect(map({ ddd_telefone_1: "123" }).phone).toBeNull();
  });

  it("normaliza CNAE pontuado e restaura o zero à esquerda", () => {
    expect(map({ cnae_fiscal: "45.20-0-01" }).primaryActivity?.code).toBe(
      "4520001",
    );
    expect(map({ cnae_fiscal: 111301 }).primaryActivity?.code).toBe("0111301");
  });

  it("remove CNAEs secundários duplicados, vazios e iguais ao principal", () => {
    const result = map({
      cnaes_secundarios: [
        { codigo: 4520001, descricao: "repete o principal" },
        { codigo: 4520003, descricao: "elétrica" },
        { codigo: "45.20-0-03", descricao: "elétrica repetida" },
        { codigo: 0, descricao: "" },
      ],
    });
    expect(result.secondaryActivities).toEqual([
      { code: "4520003", description: "elétrica" },
    ]);
  });
});
