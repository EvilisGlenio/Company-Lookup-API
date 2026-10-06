import { describe, expect, it } from "vitest";
import { brasilApiCompanySchema } from "../../src/infrastructure/providers/brasil-api-company.schema.js";
import { validBrasilApiCompany } from "../fixtures/brasil-api-company.js";

describe("brasilApiCompanySchema", () => {
  it("aceita o payload completo", () => {
    expect(
      brasilApiCompanySchema.safeParse(validBrasilApiCompany).success,
    ).toBe(true);
  });

  it("aceita campos opcionais nulos ou ausentes", () => {
    const result = brasilApiCompanySchema.safeParse({
      ...validBrasilApiCompany,
      nome_fantasia: undefined,
      email: null,
      ddd_telefone_1: null,
      capital_social: null,
      cnae_fiscal: null,
      cnaes_secundarios: null,
    });
    expect(result.success).toBe(true);
  });

  it("tolera campos extras do provedor", () => {
    const result = brasilApiCompanySchema.safeParse({
      ...validBrasilApiCompany,
      qsa: [{ nome_socio: "FULANO" }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita CNAE como texto pontuado", () => {
    const result = brasilApiCompanySchema.safeParse({
      ...validBrasilApiCompany,
      cnae_fiscal: "45.20-0-01",
    });
    expect(result.success).toBe(true);
  });

  it.each([null, undefined, "", "   "])(
    "rejeita razão social %j",
    (razaoSocial) => {
      const result = brasilApiCompanySchema.safeParse({
        ...validBrasilApiCompany,
        razao_social: razaoSocial,
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejeita CNAE secundário com tipos errados", () => {
    const result = brasilApiCompanySchema.safeParse({
      ...validBrasilApiCompany,
      cnaes_secundarios: [{ codigo: { valor: 4520003 }, descricao: 123 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita CNAE fiscal com tipo errado", () => {
    const result = brasilApiCompanySchema.safeParse({
      ...validBrasilApiCompany,
      cnae_fiscal: true,
    });
    expect(result.success).toBe(false);
  });
});
