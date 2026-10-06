import type {
  BusinessActivity,
  MatchedActivity,
  VehicleSegment,
  WorkshopClassification,
} from "./company.js";

// Política de CNAEs de oficina (spec §12.3). Conferida em 05/10/2026 na API
// oficial do IBGE: https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/{codigo}
// 4520-0 cobre "veículos automotores" em geral; 4543-9, motocicletas e motonetas.
// As descrições vêm da consulta, nunca desta tabela.
const WORKSHOP_POLICY: Readonly<Record<string, VehicleSegment>> = {
  "4520001": "CAR_OR_LIGHT_VEHICLE", // reparação mecânica
  "4520002": "CAR_OR_LIGHT_VEHICLE", // lanternagem ou funilaria e pintura
  "4520003": "CAR_OR_LIGHT_VEHICLE", // reparação elétrica
  "4520004": "CAR_OR_LIGHT_VEHICLE", // alinhamento e balanceamento
  "4520005": "CAR_OR_LIGHT_VEHICLE", // lavagem, lubrificação e polimento
  "4520006": "CAR_OR_LIGHT_VEHICLE", // borracharia
  "4520007": "CAR_OR_LIGHT_VEHICLE", // instalação e reparação de acessórios
  "4543900": "MOTORCYCLE", // manutenção e reparação de motocicletas
};

// Determinística e baseada só nos CNAEs: o nome empresarial não entra.
export function classifyWorkshop(
  primary: BusinessActivity | null,
  secondary: readonly BusinessActivity[],
): WorkshopClassification {
  // O principal vem primeiro para vencer duplicidades com isPrimary: true.
  const candidates = [
    ...(primary ? [{ ...primary, isPrimary: true }] : []),
    ...secondary.map((activity) => ({ ...activity, isPrimary: false })),
  ];

  const seen = new Set<string>();
  const matchedActivities: MatchedActivity[] = [];
  const segments = new Set<VehicleSegment>();

  for (const candidate of candidates) {
    const code = candidate.code.replace(/\D/g, "");
    const segment = WORKSHOP_POLICY[code];
    if (seen.has(code) || !segment) continue;
    seen.add(code);
    segments.add(segment);
    matchedActivities.push({
      code,
      description: candidate.description,
      isPrimary: candidate.isPrimary,
    });
  }

  return {
    isLikelyWorkshop: matchedActivities.length > 0,
    vehicleSegments: [...segments].sort(),
    matchedActivities,
  };
}
