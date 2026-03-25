import { verifyAccessToken } from '../lib/jwt.js';
import { USER_ROLES } from '../lib/roles.js';
export function registerAuth(app) {
    app.addHook('onRequest', async (request) => {
        const h = request.headers.authorization;
        if (!h?.toLowerCase().startsWith('bearer '))
            return;
        const token = h.slice(7).trim();
        if (!token)
            return;
        try {
            const p = verifyAccessToken(token);
            // Se vier um role desconhecido no token, não autentica (evita bypass).
            if (!USER_ROLES.includes(p.role))
                return;
            request.user = { id: p.sub, email: p.email, role: p.role };
        }
        catch {
            /* token inválido */
        }
    });
}
export async function requireAuth(request, reply) {
    if (!request.user?.id) {
        return reply.code(401).send({ error: 'Não autenticado.' });
    }
}
export function requireRoles(allowed) {
    return async function requireRolesHandler(request, reply) {
        await requireAuth(request, reply);
        if (reply.sent)
            return;
        const role = request.user?.role;
        if (!role || !allowed.includes(role)) {
            return reply.code(403).send({ error: 'Sem permissão.' });
        }
    };
}
export const requireAdmin = requireRoles(['admin']);
export const requireCmsEditor = requireRoles(['admin', 'editor']);
