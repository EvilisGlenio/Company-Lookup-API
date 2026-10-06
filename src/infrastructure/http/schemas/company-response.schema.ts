// Contrato público de GET /v1/companies/:cnpj (seções 9.3 a 9.5 da spec).
// O serializador do Fastify só escreve o que está aqui: campos extras nunca vazam.
const nullableString = { type: ["string", "null"] } as const;

const activitySchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "description"],
  properties: {
    code: { type: "string" },
    description: { type: "string" },
  },
} as const;

export const companyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "taxId",
    "legalName",
    "tradeName",
    "status",
    "openedAt",
    "legalNature",
    "companySize",
    "shareCapital",
    "email",
    "phone",
    "address",
    "primaryActivity",
    "secondaryActivities",
    "workshop",
    "metadata",
  ],
  properties: {
    taxId: { type: "string" },
    legalName: { type: "string" },
    tradeName: nullableString,
    status: {
      type: "string",
      enum: ["ACTIVE", "SUSPENDED", "UNFIT", "CLOSED", "NULL", "UNKNOWN"],
    },
    openedAt: { type: ["string", "null"], format: "date" },
    legalNature: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["code", "description"],
      properties: {
        code: { type: "string" },
        description: { type: "string" },
      },
    },
    companySize: {
      type: "string",
      enum: [
        "MICRO_COMPANY",
        "SMALL_COMPANY",
        "OTHER",
        "UNINFORMED",
        "UNKNOWN",
      ],
    },
    shareCapital: { type: ["number", "null"], minimum: 0 },
    email: nullableString,
    phone: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["areaCode", "number"],
      properties: {
        areaCode: { type: "string" },
        number: { type: "string" },
      },
    },
    address: {
      type: "object",
      additionalProperties: false,
      required: [
        "postalCode",
        "street",
        "number",
        "complement",
        "district",
        "city",
        "state",
      ],
      properties: {
        postalCode: nullableString,
        street: nullableString,
        number: nullableString,
        complement: nullableString,
        district: nullableString,
        city: nullableString,
        state: nullableString,
      },
    },
    primaryActivity: { ...activitySchema, type: ["object", "null"] },
    secondaryActivities: { type: "array", items: activitySchema },
    workshop: {
      type: "object",
      additionalProperties: false,
      required: ["isLikelyWorkshop", "vehicleSegments", "matchedActivities"],
      properties: {
        isLikelyWorkshop: { type: "boolean" },
        vehicleSegments: {
          type: "array",
          items: {
            type: "string",
            enum: ["CAR_OR_LIGHT_VEHICLE", "MOTORCYCLE"],
          },
        },
        matchedActivities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["code", "description", "isPrimary"],
            properties: {
              code: { type: "string" },
              description: { type: "string" },
              isPrimary: { type: "boolean" },
            },
          },
        },
      },
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["source", "cached", "fetchedAt"],
      properties: {
        source: { type: "string", enum: ["BRASIL_API"] },
        cached: { type: "boolean" },
        fetchedAt: { type: "string", format: "date-time" },
      },
    },
  },
} as const;
