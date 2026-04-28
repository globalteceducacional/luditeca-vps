import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../lib/auditLog.js';
import { requireCmsEditor } from '../plugins/auth.js';

function nodeResAdapter(reply: FastifyReply, capture: { code?: number; body?: unknown }) {
  return {
    _code: 200 as number,
    status(code: number) {
      this._code = code;
      return this;
    },
    json(body: unknown) {
      capture.code = this._code;
      capture.body = body;
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
      const capture: { code?: number; body?: unknown } = {};
      const res = nodeResAdapter(reply, capture);
      await runImportPptxEngine(request.raw, res);

      const uid = request.user!.id;
      const code = capture.code ?? reply.statusCode;
      const body = capture.body as Record<string, unknown> | undefined;
      const dryRun = Boolean(body?.dryRun);
      const errMsg = body && typeof body.error === 'string' ? body.error : null;
      const bookIdStr =
        body?.bookId != null && body.bookId !== ''
          ? String(body.bookId)
          : null;
      const bookIdBig = bookIdStr && /^\d+$/.test(bookIdStr) ? BigInt(bookIdStr) : null;

      if (code >= 200 && code < 300 && dryRun) {
        await writeAuditLog({
          actorUserId: uid,
          actionCode: 'EVT:BOOK_IMPORT_PPTX_DRY_RUN',
          module: 'api',
          targetType: bookIdBig ? 'BOOK' : 'SYSTEM',
          targetId: bookIdBig ? `BOOK:${bookIdStr}` : null,
          bookId: bookIdBig,
          request,
          metadata: {
            totalSlidesDetected: body?.totalSlidesDetected,
          },
        });
      } else if (code >= 200 && code < 300 && !dryRun && !errMsg) {
        await writeAuditLog({
          actorUserId: uid,
          actionCode: 'EVT:BOOK_IMPORT_PPTX_OK',
          module: 'api',
          targetType: bookIdBig ? 'BOOK' : 'SYSTEM',
          targetId: bookIdBig ? `BOOK:${bookIdStr}` : null,
          bookId: bookIdBig,
          request,
          metadata: {
            totalSlides: body?.totalSlides,
            totalSlidesWithImage: body?.totalSlidesWithImage,
          },
        });
      } else {
        await writeAuditLog({
          actorUserId: uid,
          actionCode: 'EVT:BOOK_IMPORT_PPTX_FAIL',
          module: 'api',
          targetType: bookIdBig ? 'BOOK' : 'SYSTEM',
          targetId: bookIdBig ? `BOOK:${bookIdStr}` : null,
          bookId: bookIdBig,
          request,
          metadata: { statusCode: code, error: errMsg },
        });
      }
    },
  );
}
