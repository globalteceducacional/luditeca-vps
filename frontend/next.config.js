const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Evita que o Next suba até outro `package-lock.json` (ex.: pasta home) e avise workspace root incorreto.
  outputFileTracingRoot: path.join(__dirname, '..'),
};

module.exports = nextConfig;
