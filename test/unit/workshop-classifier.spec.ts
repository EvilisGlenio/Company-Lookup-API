import { describe, expect, it } from "vitest";
import { classifyWorkshop } from "../../src/domain/workshop-classifier.js";

const activity = (code: string, description = "fixture") => ({
  code,
  description,
});

describe("classifyWorkshop", () => {
  it.each([
    ["4520001", "CAR_OR_LIGHT_VEHICLE"],
    ["4520002", "CAR_OR_LIGHT_VEHICLE"],
    ["4520003", "CAR_OR_LIGHT_VEHICLE"],
    ["4520004", "CAR_OR_LIGHT_VEHICLE"],
    ["4520005", "CAR_OR_LIGHT_VEHICLE"],
    ["4520006", "CAR_OR_LIGHT_VEHICLE"],
    ["4520007", "CAR_OR_LIGHT_VEHICLE"],
    ["4543900", "MOTORCYCLE"],
  ] as const)("classifica o CNAE principal %s", (code, segment) => {
    const result = classifyWorkshop(activity(code), []);

    expect(result).toEqual({
      isLikelyWorkshop: true,
      vehicleSegments: [segment],
      matchedActivities: [{ code, description: "fixture", isPrimary: true }],
    });
  });

  it("classifica quando só um CNAE secundário corresponde", () => {
    const result = classifyWorkshop(activity("4530703"), [
      activity("4520003", "elétrica"),
    ]);

    expect(result).toEqual({
      isLikelyWorkshop: true,
      vehicleSegments: ["CAR_OR_LIGHT_VEHICLE"],
      matchedActivities: [
        { code: "4520003", description: "elétrica", isPrimary: false },
      ],
    });
  });

  it("retorna os dois segmentos, ordenados, para carro e moto", () => {
    const result = classifyWorkshop(activity("4543900"), [activity("4520001")]);

    expect(result.vehicleSegments).toEqual([
      "CAR_OR_LIGHT_VEHICLE",
      "MOTORCYCLE",
    ]);
    expect(result.matchedActivities.map((m) => m.code)).toEqual([
      "4543900",
      "4520001",
    ]);
  });

  it("deduplica pelo código priorizando o principal", () => {
    const result = classifyWorkshop(activity("4520001", "principal"), [
      activity("4520001", "secundária"),
      activity("4520-0/01", "pontuada"),
      activity("4520002"),
      activity("4520002"),
    ]);

    expect(result.matchedActivities).toEqual([
      { code: "4520001", description: "principal", isPrimary: true },
      { code: "4520002", description: "fixture", isPrimary: false },
    ]);
  });

  it("normaliza códigos pontuados", () => {
    const result = classifyWorkshop(null, [activity("45.43-9/00")]);

    expect(result.matchedActivities).toEqual([
      { code: "4543900", description: "fixture", isPrimary: false },
    ]);
  });

  it("retorna resultado negativo sem correspondência", () => {
    expect(
      classifyWorkshop(activity("4530703"), [activity("4744099")]),
    ).toEqual({
      isLikelyWorkshop: false,
      vehicleSegments: [],
      matchedActivities: [],
    });
  });

  it("retorna resultado negativo sem atividades", () => {
    expect(classifyWorkshop(null, []).isLikelyWorkshop).toBe(false);
  });

  it("ignora descrições que lembram oficina em CNAEs fora da política", () => {
    const result = classifyWorkshop(
      activity("4744099", "OFICINA MECÂNICA DE MOTOS"),
      [],
    );

    expect(result.isLikelyWorkshop).toBe(false);
  });
});
