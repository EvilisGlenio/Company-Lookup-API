import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'

describe('GET /health', () => {
    // Espera o retorno do tipo de buildApp, que é uma Promise que resolve para um objeto do tipo FastifyInstance
  const apps: Awaited<ReturnType<typeof buildApp>>[] = []

  // Executa após cada 'it' para fechar todas as instâncias do aplicativo criadas durante os testes, 
  // garantindo que não haja vazamentos de recursos.
  // Como close é uma função assíncrona, usamos Promise.all para aguardar o fechamento de todas as instâncias do aplicativo.
  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()))
    apps.length = 0
  })

  it('reports that the process is available', async () => {
    // Arrange - Preparar
    const app = await buildApp()
    // Adiciona a instância do aplicativo à lista de aplicativos para que possa ser fechada após o teste
    apps.push(app)

    // Act - Executar
    // Faz uma requisição GET para a rota /health usando o método inject do Fastify, 
    // que simula uma requisição HTTP sem realmente iniciar um servidor.
    const response = await app.inject({ method: 'GET', url: '/health' })

    // Assert - Verificar
    expect(response.statusCode).toBe(200)// Espera que o valor recebido seja 200, indicando que a requisição foi bem-sucedida
    expect(response.json()).toMatchObject({ status: 'ok' }) // Verifica se o corpo da resposta JSON contém um objeto com a propriedade status igual a 'ok'
    expect(response.json().timestamp).toEqual(expect.any(String)) // Verifica se o campo timestamp é uma string
  })
})