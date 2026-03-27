#!/bin/sh
set -e
npx prisma migrate deploy
if [ "${SKIP_AUTO_SEED:-}" != "1" ]; then
  npx tsx scripts/seed-if-empty.ts
fi
exec node dist/server.js
