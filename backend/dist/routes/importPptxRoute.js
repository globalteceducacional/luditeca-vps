import { requireCmsEditor } from '../plugins/auth.js';
function nodeResAdapter(reply) {
    return {
        _code: 200,
        status(code) {
            this._code = code;
            return this;
        },
        json(body) {
            void reply.code(this._code).send(body);
        },
    };
}
export async function registerImportPptxRoute(app) {
    app.post('/books/import-pptx', { preHandler: requireCmsEditor }, async (request, reply) => {
        const { runImportPptxEngine } = await import('../pptx/importPptxEngine.js');
        const res = nodeResAdapter(reply);
        await runImportPptxEngine(request.raw, res);
    });
}
