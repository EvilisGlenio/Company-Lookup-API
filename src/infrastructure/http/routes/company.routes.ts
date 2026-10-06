import type { FastifyInstance } from "fastify";
import type { LookupCompanyService } from "../../../application/lookup-company.service.js";
import { companyResponseSchema } from "../schemas/company-response.schema.js";

// Sem schema de params: CNPJ inválido precisa virar InvalidTaxIdError (400 com
// envelope próprio), e o serviço já normaliza e valida antes de usar cache ou provedor.
export async function registerCompanyRoutes(
  app: FastifyInstance,
  service: Pick<LookupCompanyService, "execute">,
): Promise<void> {
  app.get<{ Params: { cnpj: string } }>(
    "/v1/companies/:cnpj",
    { schema: { response: { 200: companyResponseSchema } } },
    async (request) => service.execute(request.params.cnpj),
  );
}
