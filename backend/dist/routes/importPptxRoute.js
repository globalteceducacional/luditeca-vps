import { writeAuditLog } from '../lib/auditLog.js';
import { requireCmsEditor } from '../plugins/auth.js';
function nodeResAdapter(reply, capture) {
    return {
        _code: 200,
        status(code) {
            this._code = code;
            return this;
        },
        json(body) {
            capture.code = this._code;
            capture.body = body;
            void reply.code(this._code).send(body);
        },
    };
}
export async function registerImportPptxRoute(app) {
    app.post('/books/import-pptx', { preHandler: requireCmsEditor }, async (request, reply) => {
        const { runImportPptxEngine } = await import('../pptx/importPptxEngine.js');
        const capture = {};
        const res = nodeResAdapter(reply, capture);
        await runImportPptxEngine(request.raw, res);
        const uid = request.user.id;
        const code = capture.code ?? reply.statusCode;
        const body = capture.body;
        const dryRun = Boolean(body?.dryRun);
        const errMsg = body && typeof body.error === 'string' ? body.error : null;
        const bookIdStr = body?.bookId != null && body.bookId !== ''
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
        }
        else if (code >= 200 && code < 300 && !dryRun && !errMsg) {
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
        }
        else {
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
    });
}
