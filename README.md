# Luditeca VPS (stack Docker)

Pasta principal para **front**, **back** e orquestração na VPS.

## Estrutura

| Pasta | Conteúdo |
|--------|-----------|
| `frontend` | Next.js 14 (React) — CMS |
| `backend` | Node + Fastify + Prisma — API REST |
| `nginx` | Configuração do reverse proxy |
| `docs` | Deploy na VPS e migração desde Supabase |

## Arranque rápido (local)

```powershell
cd luditeca-vps
docker compose up --build
```

- Interface: http://localhost:8080  
- API: http://localhost:4000  
- Midia (local): servida em `http://localhost:8080/media/...` (API + Nginx; volume `luditeca_storage`).

Variáveis: copie `.env.example` para `.env` se precisar de overrides. No front, use `frontend/.env.local` (ver `frontend/.env.local.example`). Para deploy na VPS, veja `env.vps.example` e `docs/DEPLOY-VPS.md`.

## Desenvolvimento sem Docker

```powershell
# Terminal 1 — Postgres local (ou via Docker só a base); ficheiros em disco (`STORAGE_DRIVER=local`)
cd luditeca-vps\backend
npm install
npx prisma migrate dev
npm run dev

# Terminal 2
cd luditeca-vps\frontend
npm install
npm run dev
```

Defina `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_MEDIA_BASE_URL` no `.env.local` do front.
