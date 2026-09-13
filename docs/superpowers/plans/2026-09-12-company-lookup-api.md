# Company Lookup API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir e publicar uma API Node.js stateless que consulta empresas brasileiras por CNPJ, normaliza os dados e interpreta CNAEs relacionados a oficinas automotivas.

**Architecture:** O núcleo da aplicação define contratos e regras puras; o caso de uso coordena cache e provedor; adaptadores de infraestrutura implementam Fastify, BrasilAPI e cache em memória. O contrato público nunca expõe diretamente o payload externo, e o futuro CRM continua responsável por cadastro, tenant e persistência.

**Tech Stack:** Node.js LTS ativa, TypeScript estrito, ESM, Fastify, Zod, Pino, Vitest, OpenAPI, Docker e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-company-lookup-api-spec.md`

## Global Constraints

- Usar Node.js em versão LTS ativa, TypeScript estrito e módulos ESM.
- Usar Fastify, Zod, Pino e Vitest.
- Não usar NestJS, Axios, ORM, PostgreSQL, Redis ou biblioteca de injeção de dependências.
- Não implementar autenticação, usuários, empresa persistida, tenant, front-end ou consulta por placa.
- Usar `fetch` nativo e `AbortSignal.timeout` no cliente externo.
- Nunca devolver nem registrar o payload bruto da BrasilAPI.
- Tratar CNPJ sempre como `string` e preparar o domínio para o formato alfanumérico.
- Não fazer retry, consulta em lote, crawling ou varredura de CNPJs.
- Testes automatizados nunca podem acessar a BrasilAPI real.
- Cada tarefa deve terminar com testes relevantes passando e um commit pequeno.

---

## 1. Mapa de arquivos

```text
company-lookup-api/
├── .github/workflows/ci.yml
├── docs/
│   ├── architecture.md
│   └── superpowers/
│       ├── specs/2026-09-12-company-lookup-api-spec.md
│       └── plans/2026-09-12-company-lookup-api.md
├── src/
│   ├── application/
│   │   ├── lookup-company.service.ts
│   │   └── ports/
│   │       ├── company-cache.ts
│   │       └── company-provider.ts
│   ├── domain/
│   │   ├── company.ts
│   │   ├── errors.ts
│   │   ├── tax-id.ts
│   │   └── workshop-classifier.ts
│   ├── infrastructure/
│   │   ├── cache/in-memory-company-cache.ts
│   │   ├── config/env.ts
│   │   ├── providers/
│   │   │   ├── brasil-api-company.mapper.ts
│   │   │   ├── brasil-api-company.provider.ts
│   │   │   └── brasil-api-company.schema.ts
│   │   └── http/
│   │       ├── error-handler.ts
│   │       ├── request-context.ts
│   │       ├── routes/company.routes.ts
│   │       ├── routes/health.routes.ts
│   │       └── schemas/
│   │           ├── company-response.schema.ts
│   │           └── error-response.schema.ts
│   ├── app.ts
│   └── server.ts
├── test/
│   ├── fixtures/brasil-api-company.ts
│   ├── integration/
│   │   ├── company-route.spec.ts
│   │   ├── health-route.spec.ts
│   │   └── provider-http.spec.ts
│   └── unit/
│       ├── brasil-api-company.mapper.spec.ts
│       ├── in-memory-company-cache.spec.ts
│       ├── lookup-company.service.spec.ts
│       ├── tax-id.spec.ts
│       └── workshop-classifier.spec.ts
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── eslint.config.js
├── package-lock.json
├── package.json
├── tsconfig.build.json
├── tsconfig.json
└── vitest.config.ts
```

### Responsabilidades que não devem se misturar

| Arquivo/unidade | Responsabilidade única |
| --- | --- |
| `tax-id.ts` | Normalizar e validar CNPJ |
| `workshop-classifier.ts` | Classificar atividades por uma política explícita de CNAEs |
| `brasil-api-company.schema.ts` | Validar somente o payload externo |
| `brasil-api-company.mapper.ts` | Converter contrato externo em contrato interno |
| `brasil-api-company.provider.ts` | Executar HTTP, timeout, limite de bytes e classificação de status |
| `in-memory-company-cache.ts` | TTL, capacidade e cópias defensivas |
| `lookup-company.service.ts` | Orquestrar cache, provedor, classificação e chamadas concorrentes |
| `company.routes.ts` | Traduzir HTTP para o caso de uso |
| `error-handler.ts` | Traduzir erros tipados para envelope HTTP público |
| `app.ts` | Compor dependências sem abrir porta |
| `server.ts` | Inicializar processo e encerrar graciosamente |

---

### Task 1: Bootstrap do projeto e primeiro endpoint executável

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `.gitignore`
- Create: `docs/superpowers/specs/2026-09-12-company-lookup-api-spec.md`
- Create: `docs/superpowers/plans/2026-09-12-company-lookup-api.md`
- Create: `src/app.ts`
- Create: `src/infrastructure/http/routes/health.routes.ts`
- Create: `test/integration/health-route.spec.ts`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `buildApp(): FastifyInstance` e `registerHealthRoute(app: FastifyInstance): Promise<void>`.

- [ ] **Step 1: Inicializar o repositório e instalar dependências**

```bash
mkdir company-lookup-api
cd company-lookup-api
git init
mkdir -p docs/superpowers/specs docs/superpowers/plans
# Copiar para essas pastas a spec aprovada e este plano antes do primeiro commit.
npm init -y
npm install fastify zod
npm install -D typescript @types/node vitest eslint @eslint/js typescript-eslint prettier tsx
```

Editar `package.json` para conter pelo menos:

```json
{
  "name": "company-lookup-api",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Após instalar o provider de cobertura exigido pela versão selecionada do Vitest, manter o `package-lock.json` versionado. O `engines.node` deverá refletir a LTS escolhida no início da execução; se a LTS ativa não for 24, alterar esse único valor e usar a mesma versão no CI e Docker.

- [ ] **Step 2: Configurar TypeScript estrito**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "test", "vitest.config.ts", "eslint.config.js"]
}
```

`tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["test", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Escrever o teste HTTP que falha**

`test/integration/health-route.spec.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'

describe('GET /health', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = []

  afterEach(async () => Promise.all(apps.map((app) => app.close())))

  it('reports that the process is available', async () => {
    const app = await buildApp()
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
    expect(response.json().timestamp).toEqual(expect.any(String))
  })
})
```

- [ ] **Step 4: Executar o teste e confirmar a falha**

Run: `npm test -- test/integration/health-route.spec.ts`  
Expected: FAIL porque `src/app.ts` ainda não existe.

- [ ] **Step 5: Implementar o mínimo para passar**

```ts
// src/infrastructure/http/routes/health.routes.ts
import type { FastifyInstance } from 'fastify'

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }))
}
```

```ts
// src/app.ts
import Fastify, { type FastifyInstance } from 'fastify'
import { registerHealthRoute } from './infrastructure/http/routes/health.routes.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await registerHealthRoute(app)
  return app
}
```

- [ ] **Step 6: Verificar teste, typecheck e build**

Run: `npm test -- test/integration/health-route.spec.ts && npm run typecheck && npm run build`  
Expected: todos os comandos passam.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json vitest.config.ts eslint.config.js .gitignore src test
git commit -m "chore: bootstrap fastify typescript api"
```

---

### Task 2: Configuração validada na inicialização

**Files:**
- Create: `src/infrastructure/config/env.ts`
- Create: `.env.example`
- Create: `test/unit/env.spec.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `buildApp()` da Task 1.
- Produces: `AppConfig`, `loadConfig(env?: NodeJS.ProcessEnv): AppConfig` e `buildApp(options?: { config?: AppConfig }): Promise<FastifyInstance>`.

- [ ] **Step 1: Escrever testes de configuração**

```ts
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/infrastructure/config/env.js'

describe('loadConfig', () => {
  it('uses safe defaults', () => {
    expect(loadConfig({})).toMatchObject({
      host: '0.0.0.0', port: 3000, providerTimeoutMs: 5000,
      cacheTtlSeconds: 900, cacheMaxItems: 500,
    })
  })

  it('rejects invalid numeric values', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid environment')
  })
})
```

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- test/unit/env.spec.ts`  
Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar schema e conversão**

Criar um schema Zod que converta strings numéricas e produza:

```ts
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  brasilApiBaseUrl: string
  providerTimeoutMs: number
  providerMaxResponseBytes: number
  cacheTtlSeconds: number
  cacheMaxItems: number
  rateLimitMax: number
  rateLimitWindowSeconds: number
  trustProxy: boolean
}
```

Regras exatas: porta `1..65535`; timeout `100..30000`; resposta `1024..5242880`; TTL `1..86400`; cache `1..10000`; rate limit e janela maiores que zero; URL `https:` em produção; boolean somente `true` ou `false`.

- [ ] **Step 4: Criar `.env.example`**

Copiar exatamente as variáveis e padrões da seção 17 da spec.

- [ ] **Step 5: Injetar configuração opcional em `buildApp`**

O teste não deverá depender de `process.env`. Quando `options.config` estiver ausente, chamar `loadConfig(process.env)`.

- [ ] **Step 6: Verificar**

Run: `npm test -- test/unit/env.spec.ts test/integration/health-route.spec.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/config/env.ts src/app.ts test/unit/env.spec.ts .env.example
git commit -m "feat: validate runtime configuration"
```

---

### Task 3: Modelo de erros e contexto de requisição

**Files:**
- Create: `src/domain/errors.ts`
- Create: `src/infrastructure/http/request-context.ts`
- Create: `src/infrastructure/http/error-handler.ts`
- Create: `src/infrastructure/http/schemas/error-response.schema.ts`
- Create: `test/integration/error-handler.spec.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: instância Fastify da Task 1.
- Produces: `AppError`, subclasses tipadas, `registerRequestContext(app)` e `registerErrorHandler(app)`.

- [ ] **Step 1: Escrever teste do envelope público**

Criar uma rota de teste que lança `new InvalidTaxIdError()` e verificar:

```ts
expect(response.statusCode).toBe(400)
expect(response.json()).toEqual({
  error: {
    code: 'INVALID_TAX_ID',
    message: 'O CNPJ informado é inválido.',
    requestId: 'request-test-1',
    details: null,
  },
})
```

Também testar que um `Error('secret stack detail')` retorna `INTERNAL_ERROR` sem a mensagem original.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- test/integration/error-handler.spec.ts`  
Expected: FAIL por classes/handlers ausentes.

- [ ] **Step 3: Implementar os erros tipados**

```ts
export abstract class AppError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number
  readonly publicDetails: Readonly<Record<string, unknown>> | null = null
}

export class InvalidTaxIdError extends AppError {
  readonly code = 'INVALID_TAX_ID'
  readonly statusCode = 400
  constructor() { super('O CNPJ informado é inválido.') }
}
```

Criar ainda `CompanyNotFoundError`, `ProviderError`, `ProviderInvalidResponseError`, `ProviderTimeoutError` e `ResponseTooLargeError`. O último será traduzido publicamente como `PROVIDER_ERROR`/`502`.

- [ ] **Step 4: Registrar request ID e error handler**

Aceitar `x-request-id` somente se tiver `1..128` caracteres imprimíveis sem quebra de linha; caso contrário usar o ID gerado pelo Fastify. O handler deve usar `AppError` para respostas conhecidas e `INTERNAL_ERROR` para as demais.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/integration/error-handler.spec.ts && npm run typecheck`  
Expected: PASS e nenhuma mensagem interna na resposta.

- [ ] **Step 6: Commit**

```bash
git add src/domain/errors.ts src/infrastructure/http test/integration/error-handler.spec.ts src/app.ts
git commit -m "feat: add sanitized api error contract"
```

---

### Task 4: Value object de CNPJ

**Files:**
- Create: `src/domain/tax-id.ts`
- Create: `test/unit/tax-id.spec.ts`
- Create: `test/fixtures/tax-ids.ts`

**Interfaces:**
- Consumes: `InvalidTaxIdError`.
- Produces: `normalizeTaxId(value: string): string`, `isValidTaxId(value: string): boolean` e `parseTaxId(value: string): string`.

- [ ] **Step 1: Reunir fixtures verificáveis antes de codificar**

Criar `test/fixtures/tax-ids.ts` com:

```ts
export const validNumericTaxIds = ['11222333000181'] as const
// Exemplo público divulgado na implantação do CNPJ alfanumérico:
// https://www.juntacomercial.pr.gov.br/ — consultado em 12/09/2026.
export const validAlphanumericTaxIds = ['12345678000A08'] as const
export const invalidTaxIds = ['', '123', '11222333000180', '11@222333000181'] as const
```

Conferir o exemplo acima contra a documentação técnica da Receita Federal vigente na data da implementação. A fonte normativa para o algoritmo é `https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj-alfanumerico/calculo-do-dv-do-cnpj-alfanumerico.pdf`. Se a Receita substituir o documento, preservar no comentário a URL oficial sucessora e a data da consulta.

- [ ] **Step 2: Escrever testes de normalização**

```ts
expect(normalizeTaxId(' 11.222.333/0001-81 ')).toBe('11222333000181')
expect(normalizeTaxId('ab.c12.3d4/0001-00')).toBe('ABC123D4000100')
expect(() => normalizeTaxId('11@222333000181')).toThrow(InvalidTaxIdError)
```

Adicionar testes dos dígitos verificadores numéricos e, depois de obter fixtures oficiais, alfanuméricos.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/unit/tax-id.spec.ts`  
Expected: FAIL por funções ausentes.

- [ ] **Step 4: Implementar funções puras**

`normalizeTaxId` aplica `trim`, uppercase e remove apenas `.`, `/`, `-` e espaços. `parseTaxId` normaliza, exige 14 caracteres, valida conjunto de caracteres/posições e dígitos verificadores, lançando `InvalidTaxIdError` em qualquer falha.

Separar internamente:

```ts
function calculateCheckDigit(base: string, weights: readonly number[]): number
```

O valor numérico de letras deverá seguir exatamente a especificação oficial, sem aproximações.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/unit/tax-id.spec.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/tax-id.ts test/unit/tax-id.spec.ts test/fixtures/tax-ids.ts
git commit -m "feat: normalize and validate brazilian tax ids"
```

---

### Task 5: Contratos internos de empresa

**Files:**
- Create: `src/domain/company.ts`
- Create: `src/application/ports/company-provider.ts`

**Interfaces:**
- Consumes: CNPJ normalizado da Task 4.
- Produces: `Company`, `ProviderCompany`, `BusinessActivity`, `CompanyLookupResult`, `CompanyProvider` e enums associados.

- [ ] **Step 1: Definir os contratos**

```ts
export type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'UNFIT' | 'CLOSED' | 'NULL' | 'UNKNOWN'
export type CompanySize = 'MICRO_COMPANY' | 'SMALL_COMPANY' | 'OTHER' | 'UNINFORMED' | 'UNKNOWN'
export type VehicleSegment = 'CAR_OR_LIGHT_VEHICLE' | 'MOTORCYCLE'

export interface BusinessActivity { code: string; description: string }
export interface MatchedActivity extends BusinessActivity { isPrimary: boolean }
export interface WorkshopClassification {
  isLikelyWorkshop: boolean
  vehicleSegments: VehicleSegment[]
  matchedActivities: MatchedActivity[]
}
```

Completar `Company`, `ProviderCompany` e `CompanyLookupResult` com todos os campos da seção 9.3 da spec. `ProviderCompany` não contém `workshop` nem `metadata.cached`; `CompanyLookupResult` contém ambos.

- [ ] **Step 2: Definir porta do provedor**

```ts
export interface CompanyProvider {
  findByTaxId(taxId: string): Promise<ProviderCompany | null>
}
```

- [ ] **Step 3: Executar typecheck**

Run: `npm run typecheck`  
Expected: PASS sem `any` explícito.

- [ ] **Step 4: Commit**

```bash
git add src/domain/company.ts src/application/ports/company-provider.ts
git commit -m "feat: define company lookup contracts"
```

---

### Task 6: Schema runtime do payload BrasilAPI

**Files:**
- Create: `src/infrastructure/providers/brasil-api-company.schema.ts`
- Create: `test/fixtures/brasil-api-company.ts`
- Create: `test/unit/brasil-api-company.schema.spec.ts`

**Interfaces:**
- Consumes: nenhum tipo de domínio; representa exclusivamente o contrato externo.
- Produces: `brasilApiCompanySchema` e `BrasilApiCompany` inferido com `z.infer`.

- [ ] **Step 1: Capturar uma fixture mínima e anonimizada**

Criar uma fixture que contenha todos os campos externos realmente usados: CNPJ, razão social, nome fantasia, situação, data de início, natureza jurídica, porte, capital social, contato, endereço, CNAE principal e CNAEs secundários. Não incluir sócios ou campos sem consumidor.

- [ ] **Step 2: Escrever testes do schema**

Testar payload completo, campos opcionais nulos, campos extras tolerados, ausência de razão social e tipos errados em CNAEs.

```ts
expect(brasilApiCompanySchema.safeParse(validBrasilApiCompany).success).toBe(true)
expect(brasilApiCompanySchema.safeParse({ ...validBrasilApiCompany, razao_social: null }).success).toBe(false)
```

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/unit/brasil-api-company.schema.spec.ts`  
Expected: FAIL por schema ausente.

- [ ] **Step 4: Implementar schema com Zod**

Usar `.passthrough()` no objeto raiz para tolerar novos campos externos. Para cada campo consumido, representar corretamente a combinação observada de `string`, `number`, `null` e opcional. Não usar `z.any()`.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/unit/brasil-api-company.schema.spec.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/providers/brasil-api-company.schema.ts test/fixtures/brasil-api-company.ts test/unit/brasil-api-company.schema.spec.ts
git commit -m "feat: validate brasil api company payload"
```

---

### Task 7: Mapeamento do provedor para o domínio

**Files:**
- Create: `src/infrastructure/providers/brasil-api-company.mapper.ts`
- Create: `test/unit/brasil-api-company.mapper.spec.ts`

**Interfaces:**
- Consumes: `BrasilApiCompany` e `ProviderCompany`.
- Produces: `mapBrasilApiCompany(input: BrasilApiCompany): ProviderCompany`.

- [ ] **Step 1: Escrever testes do mapeador**

Cobrir:

```ts
const result = mapBrasilApiCompany(validBrasilApiCompany)
expect(result.taxId).toBe('11222333000181')
expect(result.status).toBe('ACTIVE')
expect(result.secondaryActivities).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: '4520003' }),
]))
```

Adicionar cenários para strings vazias, acentos, situação desconhecida, porte desconhecido, data inválida, CNAE pontuado e duplicado.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- test/unit/brasil-api-company.mapper.spec.ts`  
Expected: FAIL por função ausente.

- [ ] **Step 3: Implementar funções auxiliares puras**

Criar funções privadas `emptyToNull`, `normalizeCnae`, `mapStatus`, `mapCompanySize`, `mapDate`, `mapPhone` e `deduplicateActivities`. Não alterar a fixture recebida.

- [ ] **Step 4: Implementar o mapeamento completo**

Não inventar valores. Campo obrigatório externo incompatível deve ter sido barrado pelo schema; campo interno opcional ausente torna-se `null` ou `[]` conforme o contrato.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/unit/brasil-api-company.mapper.spec.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/providers/brasil-api-company.mapper.ts test/unit/brasil-api-company.mapper.spec.ts
git commit -m "feat: map provider data to company domain"
```

---

### Task 8: Cliente HTTP da BrasilAPI

**Files:**
- Create: `src/infrastructure/providers/brasil-api-company.provider.ts`
- Create: `test/integration/provider-http.spec.ts`

**Interfaces:**
- Consumes: `CompanyProvider`, schema, mapeador, `providerTimeoutMs` e `providerMaxResponseBytes`.
- Produces: `BrasilApiCompanyProvider implements CompanyProvider`.

- [ ] **Step 1: Escrever um servidor externo falso no teste**

Usar `node:http` com porta efêmera. Ele deve registrar path e headers e permitir respostas controladas: JSON válido, `404`, `429`, `500`, demora, JSON inválido e corpo grande.

- [ ] **Step 2: Escrever o teste de sucesso**

Verificar path `/api/cnpj/v1/11222333000181`, `Accept: application/json`, resultado mapeado e ausência de retry.

- [ ] **Step 3: Escrever testes de falha**

Mapear:

- `404` para `null`;
- abort por tempo para `ProviderTimeoutError`;
- JSON/schema inválido para `ProviderInvalidResponseError`;
- `429`, `5xx` e demais status inesperados para `ProviderError`;
- corpo acima do limite para `ResponseTooLargeError`.

- [ ] **Step 4: Confirmar as falhas**

Run: `npm test -- test/integration/provider-http.spec.ts`  
Expected: FAIL por classe ausente.

- [ ] **Step 5: Implementar leitura limitada**

Criar uma função interna:

```ts
async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string>
```

Ela verifica `Content-Length`, lê `response.body` com reader, acumula o total real de bytes e cancela a leitura ao exceder o limite. Decodificar ao final com `TextDecoder`.

- [ ] **Step 6: Implementar `findByTaxId`**

Construir URL com `new URL`, chamar `fetch` com `AbortSignal.timeout`, classificar status antes de ler/mapear e validar JSON com o schema. O log do provedor não poderá conter corpo bruto.

- [ ] **Step 7: Verificar**

Run: `npm test -- test/integration/provider-http.spec.ts && npm run typecheck`  
Expected: PASS, uma chamada por cenário e nenhuma rede pública.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/providers/brasil-api-company.provider.ts test/integration/provider-http.spec.ts
git commit -m "feat: add bounded brasil api http client"
```

---

### Task 9: Classificador explicável de oficinas

**Files:**
- Create: `src/domain/workshop-classifier.ts`
- Create: `test/unit/workshop-classifier.spec.ts`

**Interfaces:**
- Consumes: `BusinessActivity`, `WorkshopClassification` e `VehicleSegment`.
- Produces: `classifyWorkshop(primary: BusinessActivity | null, secondary: BusinessActivity[]): WorkshopClassification`.

- [ ] **Step 1: Conferir os CNAEs oficiais**

Validar no IBGE/CONCLA os códigos `4520001` a `4520007` e `4543900`. Registrar no comentário da política a URL consultada e a data. Se algum código não representar os serviços definidos na spec, parar e corrigir a spec antes da implementação.

- [ ] **Step 2: Escrever testes parametrizados**

```ts
it.each([
  ['4520001', 'CAR_OR_LIGHT_VEHICLE'],
  ['4520007', 'CAR_OR_LIGHT_VEHICLE'],
  ['4543900', 'MOTORCYCLE'],
] as const)('classifies CNAE %s', (code, segment) => {
  const result = classifyWorkshop({ code, description: 'fixture' }, [])
  expect(result.isLikelyWorkshop).toBe(true)
  expect(result.vehicleSegments).toContain(segment)
})
```

Adicionar CNAE secundário, ambos os segmentos, duplicidade, ausência de correspondência e nome empresarial irrelevante.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/unit/workshop-classifier.spec.ts`  
Expected: FAIL por função ausente.

- [ ] **Step 4: Implementar a política explícita**

Usar `Readonly<Record<string, VehicleSegment>>`. Combinar principal/secundários, normalizar, deduplicar pelo código, ordenar segmentos e preencher `isPrimary` corretamente.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/unit/workshop-classifier.spec.ts && npm run typecheck`  
Expected: PASS para todos os códigos oficiais selecionados.

- [ ] **Step 6: Commit**

```bash
git add src/domain/workshop-classifier.ts test/unit/workshop-classifier.spec.ts
git commit -m "feat: classify workshop activities by cnae"
```

---

### Task 10: Cache em memória com relógio controlável

**Files:**
- Create: `src/application/ports/company-cache.ts`
- Create: `src/infrastructure/cache/in-memory-company-cache.ts`
- Create: `test/unit/in-memory-company-cache.spec.ts`

**Interfaces:**
- Consumes: `CompanyLookupResult`.
- Produces: `Clock`, `CompanyCache` e `InMemoryCompanyCache`.

- [ ] **Step 1: Definir portas**

```ts
export interface Clock { now(): number }
export interface CompanyCache {
  get(taxId: string): CompanyLookupResult | null
  set(taxId: string, value: CompanyLookupResult): void
}
```

- [ ] **Step 2: Escrever testes sem timers reais**

Usar `let now = 0` e `{ now: () => now }`. Testar hit, expiração, capacidade, remoção do menos recentemente usado e cópia defensiva.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/unit/in-memory-company-cache.spec.ts`  
Expected: FAIL por implementação ausente.

- [ ] **Step 4: Implementar entradas internas**

```ts
interface CacheEntry {
  value: CompanyLookupResult
  expiresAt: number
  lastAccessedAt: number
}
```

O construtor recebe `{ ttlMs, maxItems, clock }`. Validar valores positivos. `get` remove expirado, atualiza acesso e devolve `structuredClone(value)`. `set` armazena cópia e remove expirados antes de aplicar LRU.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/unit/in-memory-company-cache.spec.ts && npm run typecheck`  
Expected: PASS sem `setTimeout` nos testes.

- [ ] **Step 6: Commit**

```bash
git add src/application/ports/company-cache.ts src/infrastructure/cache/in-memory-company-cache.ts test/unit/in-memory-company-cache.spec.ts
git commit -m "feat: add bounded in-memory company cache"
```

---

### Task 11: Caso de uso com cache e deduplicação concorrente

**Files:**
- Create: `src/application/lookup-company.service.ts`
- Create: `test/unit/lookup-company.service.spec.ts`

**Interfaces:**
- Consumes: `CompanyProvider`, `CompanyCache`, `classifyWorkshop` e `CompanyNotFoundError`.
- Produces: `LookupCompanyService.execute(taxId: string): Promise<CompanyLookupResult>`.

- [ ] **Step 1: Criar fakes pequenos no teste**

Criar `FakeCompanyProvider` com contador de chamadas e resposta configurável, e `FakeCompanyCache` com `Map`. Não mockar métodos privados.

- [ ] **Step 2: Escrever testes de hit e miss**

Verificar que hit não chama o provedor e devolve `metadata.cached: true`; miss chama uma vez, classifica, adiciona `fetchedAt`, armazena e devolve `cached: false`.

- [ ] **Step 3: Escrever teste concorrente**

```ts
const [first, second] = await Promise.all([
  service.execute('11222333000181'),
  service.execute('11222333000181'),
])
expect(provider.calls).toBe(1)
expect(first.taxId).toBe(second.taxId)
```

Adicionar teste que provoca rejeição, confirma remoção de `inFlight` e permite uma nova chamada posterior.

- [ ] **Step 4: Confirmar a falha**

Run: `npm test -- test/unit/lookup-company.service.spec.ts`  
Expected: FAIL por serviço ausente.

- [ ] **Step 5: Implementar o serviço**

Usar `private readonly inFlight = new Map<string, Promise<CompanyLookupResult>>()`. `execute` verifica cache, reutiliza promessa ou cria `loadAndCache`. A promessa deverá ser removida em `.finally()` somente se ainda for a mesma referência armazenada.

- [ ] **Step 6: Verificar**

Run: `npm test -- test/unit/lookup-company.service.spec.ts && npm run typecheck`  
Expected: PASS e exatamente uma chamada concorrente ao fake.

- [ ] **Step 7: Commit**

```bash
git add src/application/lookup-company.service.ts test/unit/lookup-company.service.spec.ts
git commit -m "feat: orchestrate cached company lookup"
```

---

### Task 12: Rota pública de consulta

**Files:**
- Create: `src/infrastructure/http/routes/company.routes.ts`
- Create: `src/infrastructure/http/schemas/company-response.schema.ts`
- Create: `test/integration/company-route.spec.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `LookupCompanyService.execute`, `parseTaxId` e envelope de erros.
- Produces: `registerCompanyRoutes(app, service): Promise<void>` e `GET /v1/companies/:cnpj`.

- [ ] **Step 1: Escrever teste de sucesso com serviço fake**

Construir `buildApp({ companyProvider: fake })` ou expor uma opção de dependências explícita. Consultar `/v1/companies/11222333000181` e comparar o corpo completo da seção 9.3 da spec.

- [ ] **Step 2: Escrever testes de fronteira HTTP**

Cobrir CNPJ inválido `400`, empresa ausente `404`, timeout `504`, payload externo inválido `502`, falha externa `502` e valor sem máscara recomendado.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/integration/company-route.spec.ts`  
Expected: FAIL com rota `404`.

- [ ] **Step 4: Criar schema de resposta**

Representar todos os campos e enums da spec com JSON Schema aceito pelo Fastify. Definir `additionalProperties: false` nos objetos do contrato público.

- [ ] **Step 5: Implementar rota e composição**

A rota chama `parseTaxId(request.params.cnpj)` antes do serviço. Não aceitar query de provider, seleção de campos ou consulta em lote. Atualizar `buildApp` para compor implementações reais por padrão e aceitar portas falsas nos testes.

- [ ] **Step 6: Verificar**

Run: `npm test -- test/integration/company-route.spec.ts && npm run typecheck && npm run build`  
Expected: PASS e contrato sem campos externos extras.

- [ ] **Step 7: Commit**

```bash
git add src/app.ts src/infrastructure/http/routes/company.routes.ts src/infrastructure/http/schemas/company-response.schema.ts test/integration/company-route.spec.ts
git commit -m "feat: expose normalized company lookup endpoint"
```

---

### Task 13: Rate limiting local

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app.ts`
- Modify: `test/integration/company-route.spec.ts`

**Interfaces:**
- Consumes: `rateLimitMax`, `rateLimitWindowSeconds` e `trustProxy`.
- Produces: resposta `429/RATE_LIMIT_EXCEEDED` por IP na rota pública.

- [ ] **Step 1: Instalar plugin compatível com a versão do Fastify**

Run: `npm install @fastify/rate-limit`

- [ ] **Step 2: Escrever teste do limite**

Configurar máximo `2`, fazer três requisições do mesmo IP e verificar que a terceira retorna:

```json
{"error":{"code":"RATE_LIMIT_EXCEEDED","message":"Limite de requisições excedido.","requestId":"...","details":null}}
```

Verificar também que `/health` permanece acessível.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/integration/company-route.spec.ts -t "rate limit"`  
Expected: FAIL porque as três chamadas passam.

- [ ] **Step 4: Registrar plugin e normalizar o erro**

Aplicar o plugin apenas ao escopo `/v1`. Usar `trustProxy` somente conforme configuração; nunca confiar em `x-forwarded-for` por padrão. Converter a rejeição do plugin para o envelope padrão.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/integration/company-route.spec.ts`  
Expected: PASS incluindo `/health` fora do limite da rota.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app.ts test/integration/company-route.spec.ts
git commit -m "feat: limit company lookup requests"
```

---

### Task 14: Logs estruturados e sanitizados

**Files:**
- Modify: `src/app.ts`
- Modify: `src/infrastructure/providers/brasil-api-company.provider.ts`
- Create: `test/integration/logging.spec.ts`

**Interfaces:**
- Consumes: logger Pino do Fastify e `requestId`.
- Produces: eventos estruturados sem payload empresarial.

- [ ] **Step 1: Escrever teste com destino de log em memória**

Executar consulta com fixture contendo e-mail, telefone e endereço marcados. Verificar que o texto dos logs contém `requestId`, `cacheStatus`, `provider` e `durationMs`, mas não contém os valores marcados nem o corpo da fixture.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- test/integration/logging.spec.ts`  
Expected: FAIL porque os eventos ainda não existem.

- [ ] **Step 3: Configurar logger e eventos**

Ativar Pino pelo Fastify conforme `logLevel`. Registrar eventos nomeados `company_lookup_completed`, `company_cache_hit`, `company_cache_miss`, `provider_request_completed` e `provider_request_failed`. Registrar o CNPJ somente mascarado, preservando os dois últimos caracteres no formato `************81`, e testar exatamente esse formato.

- [ ] **Step 4: Verificar sanitização**

Run: `npm test -- test/integration/logging.spec.ts`  
Expected: PASS e nenhuma PII da fixture nos logs.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/infrastructure/providers/brasil-api-company.provider.ts test/integration/logging.spec.ts
git commit -m "feat: add sanitized structured logging"
```

---

### Task 15: OpenAPI e documentação interativa

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/infrastructure/http/openapi.ts`
- Modify: `src/app.ts`
- Create: `test/integration/openapi.spec.ts`

**Interfaces:**
- Consumes: schemas públicos das rotas.
- Produces: `GET /docs` e `GET /docs/json` em desenvolvimento.

- [ ] **Step 1: Instalar plugins compatíveis**

Run: `npm install @fastify/swagger @fastify/swagger-ui`

- [ ] **Step 2: Escrever teste do documento**

Verificar que `/docs/json` retorna `200`, contém `/health`, `/v1/companies/{cnpj}`, respostas `200/400/404/429/502/504` e o schema de `workshop.matchedActivities`.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/integration/openapi.spec.ts`  
Expected: FAIL com `404`.

- [ ] **Step 4: Registrar OpenAPI antes das rotas**

Adicionar título, versão, descrição, aviso de inferência de CNAE e ausência de SLA do provedor. Incluir exemplos de oficina, empresa não classificada e erros. A UI deverá ser habilitada em desenvolvimento; o JSON permanecerá disponível de acordo com a configuração documentada.

- [ ] **Step 5: Verificar**

Run: `npm test -- test/integration/openapi.spec.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/infrastructure/http/openapi.ts src/app.ts test/integration/openapi.spec.ts
git commit -m "docs: publish company lookup openapi contract"
```

---

### Task 16: Processo executável e graceful shutdown

**Files:**
- Create: `src/server.ts`
- Create: `test/integration/server-lifecycle.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `loadConfig` e `buildApp`.
- Produces: `startServer()` e tratamento de `SIGINT`/`SIGTERM`.

- [ ] **Step 1: Separar função testável do entrypoint**

Planejar a assinatura:

```ts
export async function startServer(options?: {
  env?: NodeJS.ProcessEnv
  signals?: NodeJS.Process
}): Promise<{ close(): Promise<void>; address: string }>
```

O módulo só deverá iniciar automaticamente quando executado como entrypoint, não quando importado pelo teste.

- [ ] **Step 2: Escrever teste de ciclo de vida**

Iniciar em porta `0`, consultar `/health`, chamar `close()` e confirmar que o listener foi encerrado. Testar configuração inválida e garantir que nenhuma porta foi aberta.

- [ ] **Step 3: Confirmar a falha**

Run: `npm test -- test/integration/server-lifecycle.spec.ts`  
Expected: FAIL por entrypoint ausente.

- [ ] **Step 4: Implementar inicialização e sinais**

Instalar handlers únicos para `SIGINT` e `SIGTERM`. Usar uma promessa compartilhada para impedir fechamento duplicado. Em erro de inicialização, registrar mensagem sanitizada e definir `process.exitCode = 1`, sem chamar `process.exit()` no caminho normal.

- [ ] **Step 5: Verificar execução real**

Run: `npm test -- test/integration/server-lifecycle.spec.ts && npm run build`  
Expected: PASS e `dist/server.js` criado.

Executar manualmente: `PORT=3000 npm start`; consultar `curl http://localhost:3000/health`; enviar `Ctrl+C`; verificar encerramento limpo.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts test/integration/server-lifecycle.spec.ts package.json
git commit -m "feat: add server lifecycle and graceful shutdown"
```

---

### Task 17: Docker, CI, documentação e release local

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Create: `docs/architecture.md`
- Modify: `package.json`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: aplicação completa das Tasks 1–16.
- Produces: projeto reproduzível, documentado e verificável no GitHub.

- [ ] **Step 1: Configurar cobertura**

Instalar o provider compatível com a versão do Vitest, por exemplo `npm install -D @vitest/coverage-v8`, e configurar thresholds globais de 80%. Organizar suites para que domínio/aplicação atinjam 90% de linhas e branches. Não excluir arquivos apenas para aumentar artificialmente a métrica.

- [ ] **Step 2: Criar Dockerfile multi-stage**

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Se a Task 1 selecionou outra LTS ativa, substituir as duas ocorrências de `node:24-alpine` pela mesma major.

- [ ] **Step 3: Criar CI**

`.github/workflows/ci.yml` deverá executar em pull request e push para `main`, usar a mesma major do Node, `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:coverage` e `npm run build`. Não configurar credenciais nem chamadas à BrasilAPI.

- [ ] **Step 4: Escrever README executável**

Incluir os 15 itens da seção 24 da spec. Os comandos mínimos devem ser copiáveis:

```bash
npm ci
cp .env.example .env
npm run dev
curl http://localhost:3000/health
curl http://localhost:3000/v1/companies/11222333000181
npm test
docker build -t company-lookup-api .
docker run --rm -p 3000:3000 company-lookup-api
```

Explicar que o exemplo de CNPJ é apenas fixture de teste e que consultas reais dependem do provedor. Incluir diagrama simples de dependências em `docs/architecture.md` e linká-lo no README.

- [ ] **Step 5: Executar a verificação completa**

Run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
docker build -t company-lookup-api .
docker run --rm -d --name company-lookup-api-check -p 3000:3000 company-lookup-api
curl --fail http://localhost:3000/health
docker stop company-lookup-api-check
```

Expected: todos os comandos retornam sucesso; cobertura respeita thresholds; `/health` retorna `200`; container encerra normalmente.

- [ ] **Step 6: Conferir a definição de pronto**

Percorrer os 23 checkboxes da seção 26 da spec. Para cada requisito, apontar teste, arquivo ou comando que o comprova. Se um item não tiver evidência, não considerar o projeto concluído.

- [ ] **Step 7: Commit final**

```bash
git add Dockerfile .dockerignore .github README.md docs package.json package-lock.json vitest.config.ts
git commit -m "docs: prepare company lookup api for publication"
```

- [ ] **Step 8: Criar tag somente após CI verde**

```bash
git tag -a v0.1.0 -m "Company Lookup API v0.1.0"
git status --short
```

Expected: tag criada e `git status --short` sem alterações. O push e a criação do repositório remoto exigem decisão explícita do proprietário e não fazem parte deste plano local.

---

## 2. Ordem recomendada de estudo

| Bloco | Tarefas | Conceito principal |
| --- | --- | --- |
| Fundação | 1–3 | processo Node, Fastify, configuração e erros |
| Domínio | 4–5 | funções puras, tipos e contratos |
| Integração | 6–8 | runtime validation, HTTP, streams e timeout |
| Regra útil | 9 | modelagem e testes parametrizados de CNAE |
| Estado efêmero | 10–11 | cache, TTL, cópias e concorrência assíncrona |
| API pública | 12–15 | HTTP, rate limit, logs e OpenAPI |
| Operação | 16–17 | lifecycle, Docker, CI e publicação |

Não começar a tarefa seguinte enquanto o teste, typecheck e commit da tarefa atual não estiverem concluídos.

## 3. Checkpoints de revisão

Fazer uma revisão curta depois das tarefas:

- **Task 4:** conferir cuidadosamente o algoritmo e as fixtures de CNPJ alfanumérico.
- **Task 8:** procurar vazamento de payload, leitura ilimitada ou classificação errada de timeout.
- **Task 11:** revisar concorrência e remoção segura de `inFlight`.
- **Task 12:** comparar o JSON completo com o contrato da spec.
- **Task 17:** executar toda a matriz de verificação em ambiente limpo.

## 4. Resultado final esperado

Ao concluir as 17 tarefas, o repositório terá uma API pequena, utilizável e publicável. Ela aceitará um CNPJ sem máscara, validará o identificador, consultará a BrasilAPI, protegerá a leitura externa, normalizará os dados, interpretará CNAEs automotivos, utilizará cache local e devolverá um contrato estável para o futuro pré-preenchimento do CRM.

O projeto continuará deliberadamente sem banco, autenticação e tenant. Essa ausência não é dívida técnica da V1: é a fronteira aprovada do produto de estudo.
