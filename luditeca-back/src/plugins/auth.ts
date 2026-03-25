import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; role: string };
  }
}

export function registerAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const h = request.headers.authorization;
    if (!h?.toLowerCase().startsWith('bearer ')) return;
    const token = h.slice(7).trim();
    if (!token) return;
    try {
      const p = verifyAccessToken(token);
      request.user = { id: p.sub, email: p.email, role: p.role };
    } catch {
      /* token inválido */
    }
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.id) {
    return reply.code(401).send({ error: 'Não autenticado.' });
  }
}
