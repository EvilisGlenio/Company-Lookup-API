import { describe, expect, it } from "vitest";
import { InvalidTaxIdError } from "../../src/domain/errors.js";
import {
  isValidTaxId,
  normalizeTaxId,
  parseTaxId,
} from "../../src/domain/tax-id.js";
import {
  invalidTaxIds,
  validAlphanumericTaxIds,
  validNumericTaxIds,
} from "../fixtures/tax-ids.js";

describe("normalizeTaxId", () => {
  it("remove pontuação e espaços e converte para maiúsculas", () => {
    expect(normalizeTaxId(" 11.222.333/0001-81 ")).toBe("11222333000181");
    expect(normalizeTaxId("ab.c12.3d4/0001-00")).toBe("ABC123D4000100");
  });

  it("rejeita caracteres fora do conjunto permitido", () => {
    expect(() => normalizeTaxId("11@222333000181")).toThrow(InvalidTaxIdError);
  });
});

describe("parseTaxId", () => {
  it.each([...validNumericTaxIds, ...validAlphanumericTaxIds])(
    "aceita %s",
    (taxId) => {
      expect(parseTaxId(taxId)).toBe(taxId);
      expect(isValidTaxId(taxId)).toBe(true);
    },
  );

  it("aceita CNPJ formatado e devolve normalizado", () => {
    expect(parseTaxId("11.222.333/0001-81")).toBe("11222333000181");
    expect(parseTaxId("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it.each(invalidTaxIds)("rejeita %j", (taxId) => {
    expect(() => parseTaxId(taxId)).toThrow(InvalidTaxIdError);
    expect(isValidTaxId(taxId)).toBe(false);
  });

  it("rejeita dígito verificador errado no formato alfanumérico", () => {
    expect(isValidTaxId("12ABC34501DE36")).toBe(false);
  });

  it("rejeita letra nas posições dos dígitos verificadores", () => {
    expect(isValidTaxId("12ABC34501DE3A")).toBe(false);
  });
});
