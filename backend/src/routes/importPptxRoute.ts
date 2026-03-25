import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireCmsEditor } from '../plugins/auth.js';

function nodeResAdapter(reply: FastifyReply) {
  return {
    _code: 200 as number,
    status(code: number) {
      this._code = code;
      return this;
    },
    json(body: unknown) {
      void reply.code(this._code).send(body);
    },
  };
}

export async function registerImportPptxRoute(app: FastifyInstance) {
  app.post(
    '/books/import-pptx',
    { preHandler: requireCmsEditor },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { runImportPptxEngine } = await import('../pptx/importPptxEngine.js');
      const res = nodeResAdapter(reply);
      await runImportPptxEngine(request.raw, res);
    },
  );
}
