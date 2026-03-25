# Luditeca VPS (stack Docker)

Pasta principal para **front**, **back** e orquestração na VPS.

## Estrutura

| Pasta | Conteúdo |
|--------|-----------|
| `luditeca-front` | Next.js 14 (React) — CMS |
| `luditeca-back` | Node + Fastify + Prisma — API REST |
| `nginx` | Configuração do reverse proxy |
| `docs` | Deploy na VPS e migração desde Supabase |

## Arranque rápido (local)

```powershell
cd luditeca-vps
docker compose up --build
```

- Interface: http://localhost:8080  
- API: http://localhost:4000  
- MinIO: http://localhost:9001  

Variáveis: copie `.env.example` para `.env` se precisar de overrides. No front, use `luditeca-front/.env.local` (ver `.env.local.example`).

## Desenvolvimento sem Docker

```powershell
# Terminal 1 — base e MinIO via Docker, ou Postgres/MinIO instalados localmente
cd luditeca-vps\luditeca-back
npm install
npx prisma migrate dev
npm run dev

# Terminal 2
cd luditeca-vps\luditeca-front
npm install
npm run dev
```

Defina `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_MEDIA_BASE_URL` no `.env.local` do front.
