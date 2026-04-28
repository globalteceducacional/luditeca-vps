import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Início do pedido (ms) para calcular duração em onResponse. */
    luditecaRequestStartMs?: number;
    /** Identificador de correlação (eco em `x-request-id` na resposta). */
    luditecaRequestId?: string;
  }
}
