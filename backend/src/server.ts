import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerAuth } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerBookRoutes } from './routes/bookRoutes.js';
import { registerAuthorRoutes } from './routes/authorRoutes.js';
import { registerCategoryRoutes } from './routes/categoryRoutes.js';
import { registerStorageRoutes } from './routes/storageRoutes.js';
import { registerMediaRoutes } from './routes/mediaRoutes.js';
import { registerImportPptxRoute } from './routes/importPptxRoute.js';

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true;

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

  await registerAuthRoutes(app);
  await registerBookRoutes(app);
  await registerAuthorRoutes(app);
  await registerCategoryRoutes(app);
  await registerStorageRoutes(app);
  await registerMediaRoutes(app);
  await registerImportPptxRoute(app);

  await app.listen({ port, host });
  app.log.info(`API http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
