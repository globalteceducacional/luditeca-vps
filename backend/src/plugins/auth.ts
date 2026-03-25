import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { USER_ROLES, type UserRole } from '../lib/roles.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; role: UserRole };
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
      // Se vier um role desconhecido no token, não autentica (evita bypass).
      if (!USER_ROLES.includes(p.role as UserRole)) return;
      request.user = { id: p.sub, email: p.email, role: p.role as UserRole };
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

export function requireRoles(allowed: UserRole[]) {
  return async function requireRolesHandler(request: FastifyRequest, reply: FastifyReply) {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const role = request.user?.role;
    if (!role || !allowed.includes(role)) {
      return reply.code(403).send({ error: 'Sem permissão.' });
    }
  };
}

export const requireAdmin = requireRoles(['admin']);
export const requireCmsEditor = requireRoles(['admin', 'editor']);
