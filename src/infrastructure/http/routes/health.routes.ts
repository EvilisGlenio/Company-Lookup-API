import { FastifyInstance } from "fastify";

// Quando alguém fizer uma requisição GET para a rota /health, o servidor responderá com um objeto JSON.
export async function registerHealthRoute(app: FastifyInstance) {
    app.get('/health', async () => ({
        status: 'ok', // indica que o serviço está funcionando corretamente
        uptimeSeconds: Math.floor(process.uptime()),// mostra há quantos segundos o processo Node está rodando
        timestamp: new Date().toISOString(),// mostra o momento em que a resposta foi gerada, no formato ISO 8601
    }))
}