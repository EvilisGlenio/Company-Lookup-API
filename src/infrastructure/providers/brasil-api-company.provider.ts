import type { CompanyProvider } from "../../application/ports/company-provider.js";
import type { ProviderCompany } from "../../domain/company.js";
import {
  AppError,
  ProviderError,
  ProviderInvalidResponseError,
  ProviderTimeoutError,
  ResponseTooLargeError,
} from "../../domain/errors.js";
import type { AppConfig } from "../config/env.js";
import { mapBrasilApiCompany } from "./brasil-api-company.mapper.js";
import { brasilApiCompanySchema } from "./brasil-api-company.schema.js";

type ProviderConfig = Pick<
  AppConfig,
  "brasilApiBaseUrl" | "providerTimeoutMs" | "providerMaxResponseBytes"
>;

// Content-Length pode faltar ou mentir: o limite vale para os bytes realmente lidos.
async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) {
    await response.body?.cancel();
    throw new ResponseTooLargeError();
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Sem retry: uma chamada por consulta. Nunca registra nem devolve o corpo bruto.
export class BrasilApiCompanyProvider implements CompanyProvider {
  private readonly baseUrl: string;

  constructor(private readonly config: ProviderConfig) {
    // Barra final garante que new URL acrescente o path em vez de substituir o último segmento.
    this.baseUrl = config.brasilApiBaseUrl.replace(/\/*$/, "/");
  }

  async findByTaxId(taxId: string): Promise<ProviderCompany | null> {
    const url = new URL(`cnpj/v1/${encodeURIComponent(taxId)}`, this.baseUrl);
    let body: string;

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(this.config.providerTimeoutMs),
      });

      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new ProviderError();
      }

      body = await readBodyWithLimit(
        response,
        this.config.providerMaxResponseBytes,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ProviderTimeoutError();
      }
      // Falha de rede (DNS, conexão recusada, conexão interrompida).
      throw new ProviderError();
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new ProviderInvalidResponseError();
    }

    const parsed = brasilApiCompanySchema.safeParse(json);
    if (!parsed.success) throw new ProviderInvalidResponseError();

    return mapBrasilApiCompany(parsed.data);
  }
}
