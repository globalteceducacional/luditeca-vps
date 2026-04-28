import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { writeTechnicalLog } from '../lib/technicalLog.js';
import { clientIp } from '../lib/auditLog.js';

const SLOW_MS = Math.max(500, Number(process.env.TELEMETRY_SLOW_MS || 3000) || 3000);

export function registerHttpTelemetry(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    request.luditecaRequestStartMs = Date.now();
    const incoming = request.headers['x-request-id'];
    request.luditecaRequestId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim().slice(0, 64)
        : randomUUID();
    void reply.header('x-request-id', request.luditecaRequestId);
  });

  app.addHook('onResponse', async (request, reply) => {
    const pathOnly = request.url.split('?')[0];
    const status = reply.statusCode;
    if (pathOnly === '/health') return;
    // Telemetria do cliente já grava em `technical_logs` no handler; evitar duplicar pedidos 200 OK.
    if (pathOnly === '/telemetry/client' && status < 400) return;

    const start = request.luditecaRequestStartMs;
    const durationMs = typeof start === 'number' ? Math.max(0, Date.now() - start) : undefined;
    const isMedia = pathOnly.startsWith('/media');
    const persistSlow = durationMs != null && durationMs >= SLOW_MS;
    const persistError =
      status >= 500 || status === 429 || (status >= 400 && isMedia) || (status >= 400 && pathOnly === '/telemetry/client');

    if (!persistSlow && !persistError) return;

    const level: 'error' | 'warn' | 'info' =
      status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    await writeTechnicalLog({
      level,
      category: 'http',
      message: `${request.method} ${pathOnly} → ${status}`,
      metadata: {
        statusCode: status,
        durationMs,
        slow: Boolean(persistSlow),
        media: isMedia,
      },
      requestId: request.luditecaRequestId,
      route: pathOnly.slice(0, 512),
      method: request.method.slice(0, 16),
      statusCode: status,
      durationMs: durationMs ?? null,
      userId: request.user?.id ?? null,
      request,
      userAgent:
        typeof request.headers['user-agent'] === 'string'
          ? request.headers['user-agent'].slice(0, 500)
          : null,
      ip: clientIp(request),
    });
  });

  app.addHook('onError', async (request, reply, error) => {
    try {
      const pathOnly = request.url.split('?')[0];
      await writeTechnicalLog({
        level: 'error',
        category: 'http_error',
        message: truncateErr(error),
        metadata: {
          code: (error as NodeJS.ErrnoException)?.code,
          name: error?.name,
          path: pathOnly,
        },
        requestId: request.luditecaRequestId,
        route: pathOnly.slice(0, 512),
        method: (request.method || 'GET').slice(0, 16),
        statusCode: reply.statusCode || null,
        durationMs: null,
        userId: request.user?.id ?? null,
        request,
        userAgent:
          typeof request.headers['user-agent'] === 'string'
            ? request.headers['user-agent'].slice(0, 500)
            : null,
        ip: clientIp(request),
      });
    } catch {
      /* ignore */
    }
  });
}

function truncateErr(error: unknown): string {
  const m = error instanceof Error ? error.message : String(error);
  return m.length > 500 ? `${m.slice(0, 498)}…` : m;
}
