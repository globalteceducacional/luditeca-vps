# Deploy Luditeca (CMS + API) na VPS

## Componentes

- **PostgreSQL 16**: volume persistente para dados.
- **MinIO**: armazenamento compatível com S3 (buckets `covers`, `pages`, `presentations`, etc.).
- **luditeca-back**: Node 20, Fastify, Prisma (`JWT_SECRET`, `DATABASE_URL`, `S3_*`, `PUBLIC_MEDIA_BASE`, `CORS_ORIGIN`).
- **luditeca-front**: Next.js 14 `output: 'standalone'`, variáveis `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_MEDIA_BASE_URL` **no momento do build**.
- **Nginx**: TLS, `client_max_body_size 600m`, proxy `/api/` → API, `/media/` → MinIO, `/` → Next.

## TLS e domínio

1. Aponte o DNS para a VPS.
2. Use **Certbot** (Let’s Encrypt) ou **Traefik** para HTTPS.
3. Em produção defina:
   - `NEXT_PUBLIC_API_URL=https://seu-dominio/api`
   - `NEXT_PUBLIC_MEDIA_BASE_URL=https://seu-dominio/media`
   - `PUBLIC_MEDIA_BASE` na API igual a `NEXT_PUBLIC_MEDIA_BASE_URL` (URL que o browser e a API usam para links públicos).
   - `CORS_ORIGIN=https://seu-dominio` (sem barra final).

## Segredos

- Gere `JWT_SECRET` forte (32+ caracteres aleatórios).
- Não exponha `DATABASE_URL` nem `JWT_SECRET` ao cliente; só variáveis `NEXT_PUBLIC_*` vão para o front.

## Primeiro utilizador

Com a API a correr e a base migrada:

```bash
cd luditeca-vps/luditeca-back
npx tsx scripts/create-admin.ts admin@exemplo.pt "SenhaForte"
```

Ou, a partir da pasta `luditeca-vps`: `docker compose exec api npx tsx scripts/create-admin.ts ...`

Opcional: `ENABLE_PUBLIC_REGISTER=true` na API para `POST /auth/register` (desligado por defeito).

## Backups

- Faça dump periódico do volume PostgreSQL (`pg_dump`) e, se necessário, do volume MinIO.
- Mantenha firewall só com 22, 80 e 443 (e portas internas fechadas ao exterior).

## Build do CMS em produção

O Next embute `NEXT_PUBLIC_*` no build. Após alterar URL pública, volte a construir a imagem `web`:

```bash
cd luditeca-vps
docker compose build --no-cache web
```
