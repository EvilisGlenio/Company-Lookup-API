import fastify ,{ FastifyInstance } from "fastify";
import { registerHealthRoute } from "./infrastructure/http/routes/health.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({logger: false});
    await registerHealthRoute(app);
    return app;
}