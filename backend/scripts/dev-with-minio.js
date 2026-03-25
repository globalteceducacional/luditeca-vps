import { spawn, spawnSync } from 'node:child_process';

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function isDockerAvailable() {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' });
  return r.status === 0;
}

async function waitForMinioReady(url, { retries = 30, delayMs = 500 } = {}) {
  // Node 18+ tem fetch nativo.
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignora, vamos tentar novamente
    }
    await wait(delayMs);
  }
  throw new Error(`MinIO não ficou pronto a tempo: ${url}`);
}

function dockerComposeUpMinio() {
  const r = spawnSync(
    'docker',
    ['compose', 'up', '-d', 'minio', 'minio-init'],
    {
      stdio: 'inherit',
    },
  );

  if (r.status !== 0) {
    throw new Error('Falha ao subir MinIO via docker compose.');
  }
}

function startServer() {
  const child = spawn(
    'npx',
    ['tsx', 'watch', 'src/server.ts'],
    { stdio: 'inherit', shell: true, env: process.env },
  );

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  const allowNoMinio = process.env.ALLOW_NO_MINIO === '1';

  if (!isDockerAvailable()) {
    console.error(
      [
        '[dev-with-minio] Docker não está acessível.',
        'Para subir o MinIO automaticamente você precisa do Docker Desktop aberto e rodando.',
        'Se quiser iniciar o backend mesmo assim (sem uploads), rode: $env:ALLOW_NO_MINIO="1"; npm run dev',
      ].join('\n'),
    );
    if (allowNoMinio) {
      startServer();
      return;
    }
    process.exit(1);
  }

  dockerComposeUpMinio();

  // Aguarda o MinIO aceitar conexões antes de iniciar a API.
  // health/ready existe no MinIO (comportamento padrão).
  await waitForMinioReady('http://localhost:9000/minio/health/ready', {
    retries: 40,
    delayMs: 500,
  });

  startServer();
}

main().catch((err) => {
  console.error('[dev-with-minio]', err?.message || err);
  process.exit(1);
});

