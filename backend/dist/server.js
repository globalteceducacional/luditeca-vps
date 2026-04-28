import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { registerAuth } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerBookRoutes } from './routes/bookRoutes.js';
import { registerAuthorRoutes } from './routes/authorRoutes.js';
import { registerCategoryRoutes } from './routes/categoryRoutes.js';
import { registerMediaRoutes } from './routes/mediaRoutes.js';
import { registerImportPptxRoute } from './routes/importPptxRoute.js';
import { registerUserRoutes } from './routes/userRoutes.js';
import { registerAdminAuditRoutes } from './routes/adminAuditRoutes.js';
import { assertBucket } from './lib/s3.js';
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true;
function contentTypeByExt(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.svg':
            return 'image/svg+xml';
        case '.mp3':
            return 'audio/mpeg';
        case '.wav':
            return 'audio/wav';
        case '.ogg':
            return 'audio/ogg';
        case '.mp4':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.pdf':
            return 'application/pdf';
        default:
            return 'application/octet-stream';
    }
}
async function main() {
    const app = Fastify({
        logger: true,
        bodyLimit: 600 * 1024 * 1024,
    });
    await app.register(cors, { origin: corsOrigin, credentials: true });
    await app.register(multipart, {
        limits: { fileSize: 500 * 1024 * 1024 },
    });
    registerAuth(app);
    app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
    // Servidor de arquivos local para desenvolvimento (STORAGE_DRIVER=local).
    app.get('/media/*', async (request, reply) => {
        const wildcard = String(request.params['*'] || '').replace(/^\/+/, '');
        if (!wildcard || wildcard.includes('..')) {
            return reply.code(400).send({ error: 'Caminho inválido.' });
        }
        const [bucket, ...rest] = wildcard.split('/');
        if (!bucket || rest.length === 0) {
            return reply.code(400).send({ error: 'Caminho inválido.' });
        }
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const relKey = rest.join('/');
        const localStorageDir = path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'storage'));
        const absPath = path.resolve(localStorageDir, bucket, relKey);
        if (!absPath.startsWith(path.resolve(localStorageDir))) {
            return reply.code(403).send({ error: 'Acesso negado.' });
        }
        if (!existsSync(absPath)) {
            return reply.code(404).send({ error: 'Arquivo não encontrado.' });
        }
        reply.type(contentTypeByExt(absPath));
        return reply.send(createReadStream(absPath));
    });
    await registerAuthRoutes(app);
    await registerBookRoutes(app);
    await registerAuthorRoutes(app);
    await registerCategoryRoutes(app);
    await registerMediaRoutes(app);
    await registerImportPptxRoute(app);
    await registerUserRoutes(app);
    await registerAdminAuditRoutes(app);
    await app.listen({ port, host });
    app.log.info(`API http://${host}:${port}`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
