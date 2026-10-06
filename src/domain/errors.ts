// Erros conhecidos da aplicação: cada um carrega o código e o status HTTP públicos.
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly publicDetails: Readonly<Record<string, unknown>> | null = null;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTaxIdError extends AppError {
  readonly code = "INVALID_TAX_ID";
  readonly statusCode = 400;
  constructor() {
    super("O CNPJ informado é inválido.");
  }
}

export class CompanyNotFoundError extends AppError {
  readonly code = "COMPANY_NOT_FOUND";
  readonly statusCode = 404;
  constructor() {
    super("Nenhuma empresa encontrada para o CNPJ informado.");
  }
}

export class ProviderError extends AppError {
  readonly code = "PROVIDER_ERROR";
  readonly statusCode = 502;
  constructor() {
    super("Falha ao consultar o provedor externo.");
  }
}

// Herda de ProviderError: nos logs aparece o nome próprio, mas a resposta pública é PROVIDER_ERROR/502.
export class ResponseTooLargeError extends ProviderError {}

export class ProviderInvalidResponseError extends AppError {
  readonly code = "PROVIDER_INVALID_RESPONSE";
  readonly statusCode = 502;
  constructor() {
    super("O provedor externo retornou uma resposta inválida.");
  }
}

export class ProviderTimeoutError extends AppError {
  readonly code = "PROVIDER_TIMEOUT";
  readonly statusCode = 504;
  constructor() {
    super("O provedor externo excedeu o tempo limite.");
  }
}
