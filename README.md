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

**Opção A — API e CMS na mesma consola** (recomendado; evita `ERR_CONNECTION_REFUSED` se só o Next estiver a correr):

```powershell
cd luditeca-vps
npm install
cd backend; npm install; npx prisma migrate dev
cd ..\frontend; npm install; cd ..
npm run dev
```

O `package.json` na raiz usa `concurrently` para subir o Fastify e o Next em paralelo. Confirme que `backend/.env` e `frontend/.env.local` usam a mesma porta (ex.: `PORT=3020` e `NEXT_PUBLIC_API_URL=http://localhost:3020`).

**Opção B — dois terminais**

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

Copie `frontend/.env.local.example` para `frontend/.env.local`. Com o backend **sem** `PORT` no `.env`, a API sobe em **http://localhost:3020** (igual ao exemplo). Com Docker, a API exposta continua a ser a da `docker-compose` (tipicamente **4000**); ajuste o `.env.local` do front em conformidade.
