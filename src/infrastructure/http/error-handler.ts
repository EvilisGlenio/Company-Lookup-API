import type { FastifyInstance } from "fastify";
import { AppError } from "../../domain/errors.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          details: error.publicDetails,
        },
      });
    }

    // Erro desconhecido: registra o detalhe internamente e responde sem expô-lo.
    request.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno inesperado.",
        requestId: request.id,
        details: null,
      },
    });
  });
}
