import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
        const { runImportPptxCore } = (await import('../pptx/importPptxEngine.js'));
        const capture = {};
        const res = nodeResAdapter(reply, capture);
        const uid = request.user.id;
        /** Formato compatível com formidable: cada chave → array de strings. */
        const fields = {};
        let fileMeta = null;
        let tmpPath = null;
        try {
            const parts = request.parts();
            for await (const part of parts) {
                if (part.type === 'file') {
                    if (part.fieldname === 'file') {
                        const buffer = await part.toBuffer();
                        fileMeta = {
                            buffer,
                            filename: part.filename || 'upload.pptx',
                            mimetype: part.mimetype ||
                                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        };
                    }
                    else {
                        await part.toBuffer();
                    }
                }
                else {
                    const key = part.fieldname;
                    const val = typeof part.value === 'string'
                        ? part.value
                        : part.value != null
                            ? String(part.value)
                            : '';
                    if (!fields[key])
                        fields[key] = [];
                    fields[key].push(val);
                }
            }
            if (!fileMeta) {
                await runImportPptxCore(request.raw, res, { userId: uid, fields, files: {} });
            }
            else {
                const tmpDir = path.join(os.tmpdir(), 'luditeca-pptx-import');
                await mkdir(tmpDir, { recursive: true });
                tmpPath = path.join(tmpDir, `pptx-${Date.now()}-${randomBytes(8).toString('hex')}.pptx`);
                await writeFile(tmpPath, fileMeta.buffer);
                const files = {
                    file: [
                        {
                            originalFilename: fileMeta.filename,
                            filepath: tmpPath,
                            newFilename: path.basename(tmpPath),
                            size: fileMeta.buffer.length,
                            mimetype: fileMeta.mimetype,
                        },
                    ],
                };
                await runImportPptxCore(request.raw, res, { userId: uid, fields, files });
            }
        }
        catch (err) {
            const code = err && typeof err === 'object' && 'code' in err
                ? String(err.code)
                : '';
            const tooLarge = code === 'FST_REQ_FILE_TOO_LARGE' ||
                code === 'FST_FILES_LIMIT' ||
                code === 'FST_PARTS_LIMIT';
            if (!reply.sent) {
                const status = tooLarge ? 413 : 500;
                const message = err instanceof Error
                    ? err.message
                    : 'Erro ao processar o upload do PPTX.';
                await reply.code(status).send({
                    error: tooLarge ? 'Ficheiro demasiado grande para o limite do servidor.' : message,
                });
            }
        }
        finally {
            if (tmpPath) {
                await unlink(tmpPath).catch(() => { });
            }
        }
        const code = capture.code ?? reply.statusCode;
        const body = capture.body;
        const dryRun = Boolean(body?.dryRun);
        const errMsg = body && typeof body.error === 'string' ? body.error : null;
        const bookIdStr = body?.bookId != null && body.bookId !== '' ? String(body.bookId) : null;
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
