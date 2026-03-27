/// <reference types="node" />
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { prisma } from '../dist/lib/prisma.js';

/**
 * Chamado no arranque do contentor: só corre o seed se a base não tiver utilizadores.
 * Idempotente com deploys seguintes (count > 0 → ignora).
 */
async function main() {
  if (process.env.SKIP_AUTO_SEED === '1') {
    console.log('[seed-if-empty] SKIP_AUTO_SEED=1, a ignorar.');
    return;
  }

  const count = await prisma.user.count();
  if (count > 0) {
    console.log('[seed-if-empty] Já existem utilizadores na base; seed automático não executado.');
    return;
  }

  console.log('[seed-if-empty] Base sem utilizadores; a executar seed...');
  execSync('npx tsx scripts/seed.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
}

main()
  .catch((e) => {
    console.error('[seed-if-empty]', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
