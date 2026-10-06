import { randomUUID } from "node:crypto";
import type { RawRequestDefaultExpression } from "fastify";

// 1 a 128 caracteres ASCII imprimíveis: bloqueia quebras de linha e IDs gigantes nos logs.
const VALID_REQUEST_ID = /^[\x20-\x7E]{1,128}$/;

// Usado como `genReqId` do Fastify: reaproveita o x-request-id válido ou gera um UUID.
export function generateRequestId(request: RawRequestDefaultExpression): string {
  const header = request.headers["x-request-id"];
  return typeof header === "string" && VALID_REQUEST_ID.test(header)
    ? header
    : randomUUID();
}
