import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ProviderError,
  ProviderInvalidResponseError,
  ProviderTimeoutError,
  ResponseTooLargeError,
} from "../../src/domain/errors.js";
import { BrasilApiCompanyProvider } from "../../src/infrastructure/providers/brasil-api-company.provider.js";
import { validBrasilApiCompany } from "../fixtures/brasil-api-company.js";

const TAX_ID = "11222333000181";
const MAX_BYTES = 4096;

// Servidor externo falso: registra cada requisição e responde com o handler do teste.
const requests: { url: string | undefined; headers: IncomingHttpHeaders }[] =
  [];
let handler: (res: ServerResponse) => void;
let server: Server;
let provider: BrasilApiCompanyProvider;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push({ url: req.url, headers: req.headers });
    handler(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  provider = new BrasilApiCompanyProvider({
    brasilApiBaseUrl: `http://127.0.0.1:${port}/api`,
    providerTimeoutMs: 200,
    providerMaxResponseBytes: MAX_BYTES,
  });
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  requests.length = 0;
});

describe("BrasilApiCompanyProvider", () => {
  it("consulta o path esperado e devolve a empresa mapeada", async () => {
    handler = (res) => json(res, 200, validBrasilApiCompany);

    const company = await provider.findByTaxId(TAX_ID);

    expect(company?.taxId).toBe(TAX_ID);
    expect(company?.legalName).toBe("OFICINA EXEMPLO LTDA");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`/api/cnpj/v1/${TAX_ID}`);
    expect(requests[0]?.headers.accept).toBe("application/json");
  });

  it("devolve null quando o provedor responde 404", async () => {
    handler = (res) => json(res, 404, { message: "CNPJ não encontrado" });

    await expect(provider.findByTaxId(TAX_ID)).resolves.toBeNull();
    expect(requests).toHaveLength(1);
  });

  it.each([429, 500, 503, 301, 204])(
    "lança ProviderError para status %i sem retry",
    async (status) => {
      handler = (res) => {
        res.writeHead(status);
        res.end();
      };

      await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
        ProviderError,
      );
      expect(requests).toHaveLength(1);
    },
  );

  it("lança ProviderTimeoutError quando o provedor demora", async () => {
    handler = (res) =>
      setTimeout(() => json(res, 200, validBrasilApiCompany), 1000);

    await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
      ProviderTimeoutError,
    );
    expect(requests).toHaveLength(1);
  });

  it("lança ProviderTimeoutError quando o corpo trava no meio", async () => {
    handler = (res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write('{"cnpj":');
    };

    await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
      ProviderTimeoutError,
    );
  });

  it("lança ProviderInvalidResponseError para JSON inválido", async () => {
    handler = (res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{não é json");
    };

    await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
      ProviderInvalidResponseError,
    );
  });

  it("lança ProviderInvalidResponseError quando o schema não confere", async () => {
    handler = (res) =>
      json(res, 200, { ...validBrasilApiCompany, razao_social: null });

    await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
      ProviderInvalidResponseError,
    );
  });

  it("lança ResponseTooLargeError quando o Content-Length excede o limite", async () => {
    handler = (res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("x".repeat(MAX_BYTES + 1));
    };

    await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
      ResponseTooLargeError,
    );
  });

  it("lança ResponseTooLargeError quando o corpo sem Content-Length excede o limite", async () => {
    handler = (res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      // write() sem Content-Length força Transfer-Encoding: chunked.
      res.write("x".repeat(MAX_BYTES));
      res.end("x");
    };

    await expect(provider.findByTaxId(TAX_ID)).rejects.toBeInstanceOf(
      ResponseTooLargeError,
    );
  });
});
