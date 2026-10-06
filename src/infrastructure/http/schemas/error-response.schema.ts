// Envelope público de erro (seção 14.1 da spec), reutilizado nas rotas e no OpenAPI.
export const errorResponseSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "requestId", "details"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
        details: { type: ["object", "null"], additionalProperties: true },
      },
    },
  },
} as const;
