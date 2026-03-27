/**
 * Opcional: sobe um MinIO efemero (docker run) e inicia a API com STORAGE_DRIVER=s3.
 * Desenvolvimento normal: `npm run dev` (STORAGE_DRIVER=local, pasta backend/storage).
 * O stack Docker principal (luditeca-vps) usa apenas disco local na API, sem MinIO.
 */
import { spawn, spawnSync } from 'node:child_process';

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function isDockerAvailable() {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' });
  return r.status === 0;
}

async function waitForMinioReady(url, { retries = 40, delayMs = 500 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignora
    }
    await wait(delayMs);
  }
  throw new Error(`MinIO não ficou pronto a tempo: ${url}`);
}

const MINIO_CONTAINER = 'luditeca-minio-dev';

function dockerRunMinio() {
  spawnSync('docker', ['rm', '-f', MINIO_CONTAINER], { stdio: 'ignore' });
  const r = spawnSync(
    'docker',
    [
      'run',
      '-d',
      '--name',
      MINIO_CONTAINER,
      '-p',
      '9000:9000',
      '-p',
      '9001:9001',
      '-e',
      'MINIO_ROOT_USER=minio',
      '-e',
      'MINIO_ROOT_PASSWORD=minio12345',
      'minio/minio:latest',
      'server',
      '/data',
      '--console-address',
      ':9001',
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    throw new Error('Falha ao iniciar o contentor MinIO (docker run).');
  }
}

function startServerPlain() {
  const child = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function startServerWithS3() {
  const child = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minio',
      S3_SECRET_KEY: 'minio12345',
      S3_FORCE_PATH_STYLE: 'true',
      PUBLIC_MEDIA_BASE: process.env.PUBLIC_MEDIA_BASE || 'http://localhost:3020/media',
    },
  });
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
        'Para subir o MinIO automaticamente precisa do Docker em execução.',
        'Para desenvolvimento sem S3 use: npm run dev',
      ].join('\n'),
    );
    if (allowNoMinio) {
      startServerPlain();
      return;
    }
    process.exit(1);
  }

  dockerRunMinio();
  await waitForMinioReady('http://localhost:9000/minio/health/ready', {
    retries: 40,
    delayMs: 500,
  });

  startServerWithS3();
}

main().catch((err) => {
  console.error('[dev-with-minio]', err?.message || err);
  process.exit(1);
});
