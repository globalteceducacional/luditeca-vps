import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import path from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { registerAuth } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerBookRoutes } from './routes/bookRoutes.js';
import { registerAuthorRoutes } from './routes/authorRoutes.js';
import { registerCategoryRoutes } from './routes/categoryRoutes.js';
import { registerMediaRoutes } from './routes/mediaRoutes.js';
import { registerImportPptxRoute } from './routes/importPptxRoute.js';
import { registerUserRoutes } from './routes/userRoutes.js';
import { registerAdminAuditRoutes } from './routes/adminAuditRoutes.js';
import { registerTelemetryRoutes } from './routes/telemetryRoutes.js';
import { registerActivityRoutes } from './routes/activityRoutes.js';
import { registerLibrasLessonRoutes } from './routes/librasLessonRoutes.js';
import { registerPuzzleGameRoutes } from './routes/puzzleGameRoutes.js';
import { registerColoringPageRoutes } from './routes/coloringPageRoutes.js';
import { registerAppRoutes } from './routes/appRoutes.js';
import { registerHttpTelemetry } from './telemetry/httpTelemetry.js';
import { assertBucket } from './lib/s3.js';
/** Omissão 3020 = alinhado com `.env.example` e `frontend/.env.local.example`. Docker define `PORT` explicitamente. */
const port = Number(process.env.PORT) || 3020;
const host = process.env.HOST || '0.0.0.0';
/**
 * Faz parse da variável `CORS_ORIGIN` (lista separada por vírgulas, sem
 * barra final). Em produção é **obrigatória**: arranque é abortado com
 * mensagem clara se ausente, vazia ou mal formada. Em desenvolvimento o
 * default permissivo limita-se a `localhost:3000` e `localhost:8080`.
 *
 * Não usa `?? true` (que permitiria *qualquer* origem) — isto evita um
 * deploy permissivo silencioso caso alguém esqueça a env.
 */
function parseCorsOrigin() {
    const raw = process.env.CORS_ORIGIN?.trim();
    const isProd = process.env.NODE_ENV === 'production';
    if (!raw) {
        if (isProd) {
            throw new Error('CORS_ORIGIN obrigatório em produção. Defina lista de origens separadas ' +
                'por vírgula, sem barra final. ' +
                'Ex.: CORS_ORIGIN="https://luditeca.com,https://www.luditeca.com"');
        }
        return [
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
        ];
    }
    const list = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (list.length === 0) {
        throw new Error('CORS_ORIGIN definida mas vazia após parsing (apenas vírgulas?).');
    }
    // Cada entrada deve ser `http(s)://host[:port]` sem barra final ou path.
    for (const origin of list) {
        if (!/^https?:\/\/[^/]+$/.test(origin)) {
            throw new Error(`CORS_ORIGIN entrada inválida: "${origin}". ` +
                'Deve ser http(s)://host[:port] sem barra final ou caminho.');
        }
    }
    return list;
}
const corsOrigin = parseCorsOrigin();
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
    await app.register(cors, {
        origin: corsOrigin,
        credentials: true,
        // Permite `Content-Encoding: gzip` no corpo (apiFetch / Issue 04).
        allowedHeaders: [
            'Authorization',
            'Content-Type',
            'Content-Encoding',
            'Accept',
            'X-Requested-With',
        ],
    });
    // Issue 04 — descomprimir JSON gzip enviado pelo CMS (apiFetch) antes do parser.
    // O Content-Length original refere-se ao stream comprimido; removemos para o
    // limite `bodyLimit` aplicar ao JSON já expandido.
    app.addHook('preParsing', async (request, _reply, payload) => {
        const rawEnc = request.headers['content-encoding'];
        const enc = typeof rawEnc === 'string' ? rawEnc.toLowerCase().split(',')[0].trim() : '';
        if (enc !== 'gzip')
            return payload;
        const rawCt = request.headers['content-type'];
        const ct = typeof rawCt === 'string' ? rawCt.toLowerCase() : '';
        if (!ct.includes('application/json'))
            return payload;
        delete request.headers['content-encoding'];
        delete request.headers['content-length'];
        const gunzip = createGunzip();
        payload.pipe(gunzip);
        return gunzip;
    });
    // Issue 04 — compressão de respostas. Reduz drasticamente o tamanho de
    // payloads grandes (`/books/:id` com pages_v2, listagens, etc.).
    // - threshold 1 KB evita overhead em respostas pequenas.
    // - encodings em ordem de preferência: brotli (melhor rácio) > gzip > deflate.
    // - rotas binárias (`/media/*`) são excluídas via `customTypes` para não
    //   sobrecarregar a CPU comprimindo imagens/vídeos já comprimidos.
    await app.register(compress, {
        global: true,
        threshold: 1024,
        encodings: ['br', 'gzip', 'deflate'],
        customTypes: /^(?:application\/json|text\/|application\/javascript)/,
    });
    await app.register(multipart, {
        limits: { fileSize: 500 * 1024 * 1024 },
    });
    registerAuth(app);
    registerHttpTelemetry(app);
    app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
    // Servidor de arquivos local para desenvolvimento (STORAGE_DRIVER=local).
    // `compress: false` — o hook global do @fastify/compress não deve tocar neste
    // stream binário; em alguns casos interferia com a cadeia `onSend` do CORS e
    // o Chrome recebia resposta sem `Access-Control-Allow-Origin` em `fetch()`.
    app.get('/media/*', { compress: false }, async (request, reply) => {
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
        // Estratégia de Cache-Control depende do ambiente:
        //
        // PROD (NODE_ENV=production):
        //   `public, max-age=31536000, immutable` — paths são imutáveis por desenho
        //   (UUID/timestamp no nome). O Nginx em frente (proxy_cache em disco, ver
        //   nginx/nginx.conf) absorve a maioria dos hits, e o browser do utilizador
        //   final cacheia agressivamente porque o reverse proxy gere bem a response.
        //
        // DEV (qualquer outro NODE_ENV):
        //   `no-store` — desactiva cache do browser. Sem Nginx em frente, o Chrome
        //   tenta gravar tudo na cache de disco; ficheiros grandes (>1.5 MB) batem
        //   no limite single-entry e devolvem `ERR_CACHE_WRITE_FAILURE`, abortando
        //   a request. Ainda pior: o Chrome cacheia respostas de `<img>` sem CORS
        //   e devolve-as a `fetch(..., { mode: 'cors' })`, dando "No
        //   Access-Control-Allow-Origin" mesmo com o servidor a enviar o header.
        //   Em dev o ganho de cache é nulo (estamos a iterar) e o custo é alto.
        //
        // `Vary` mantém `Origin` mesmo em dev: além de o `no-store` cobrir o caso
        // do Chrome, alguns proxies/edge caches (corp networks) podem ignorar
        // `no-store` e continuar a partilhar entradas — o `Vary: Origin` é defesa
        // em profundidade.
        const isProd = process.env.NODE_ENV === 'production';
        reply.header('Cache-Control', isProd ? 'public, max-age=31536000, immutable' : 'no-store');
        reply.header('Vary', 'Accept-Encoding, Origin');
        reply.type(contentTypeByExt(absPath));
        // CORS explícito: garante `Access-Control-Allow-Origin` mesmo que o hook
        // global do @fastify/cors não corra como esperado em `reply.send(stream)`.
        const reqOrigin = request.headers.origin;
        if (typeof reqOrigin === 'string' && reqOrigin && corsOrigin.includes(reqOrigin)) {
            reply.header('Access-Control-Allow-Origin', reqOrigin);
            reply.header('Access-Control-Allow-Credentials', 'true');
        }
        return reply.send(createReadStream(absPath));
    });
    await registerAuthRoutes(app);
    await registerBookRoutes(app);
    await registerAuthorRoutes(app);
    await registerCategoryRoutes(app);
    await registerMediaRoutes(app);
    await registerImportPptxRoute(app);
    await registerUserRoutes(app);
    await registerTelemetryRoutes(app);
    await registerAdminAuditRoutes(app);
    await registerActivityRoutes(app);
    await registerLibrasLessonRoutes(app);
    await registerPuzzleGameRoutes(app);
    await registerColoringPageRoutes(app);
    await registerAppRoutes(app);
    await app.listen({ port, host });
    app.log.info(`API http://${host}:${port}`);
    app.log.info({ corsOrigin }, 'CORS origins permitidas');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
