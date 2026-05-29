const path = require('path');
const fs = require('fs');

const parentDir = path.join(__dirname, '..');
const parentLock = path.join(parentDir, 'package-lock.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Só no monorepo local (luditeca-vps/package-lock.json). No Docker o contexto é só
  // /app/frontend — sem lock no pai — para não definir tracing root como "/" e quebrar
  // o layout standalone (server.js deixa de estar na raiz copiada pelo Dockerfile).
  ...(fs.existsSync(parentLock) ? { outputFileTracingRoot: parentDir } : {}),
};

module.exports = nextConfig;
