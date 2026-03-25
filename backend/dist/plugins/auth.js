import { verifyAccessToken } from '../lib/jwt.js';
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
