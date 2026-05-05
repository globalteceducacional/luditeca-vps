# Deploy Luditeca (CMS + API) na VPS

## Componentes

- **PostgreSQL 16**: volume persistente para dados.
- **Armazenamento de ficheiros**: disco local na API (`STORAGE_DRIVER=local`, volume Docker `luditeca_storage` em `/app/storage`). Pastas por bucket (`covers`, `pages`, etc.) criadas automaticamente nos uploads.
- **backend** (`./backend`, Docker): Node 20, Fastify, Prisma (`JWT_SECRET`, `DATABASE_URL`, `PUBLIC_MEDIA_BASE`, `CORS_ORIGIN`).
- **frontend** (`./frontend`, Docker): Next.js 14 `output: 'standalone'`, variáveis `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_MEDIA_BASE_URL` **no momento do build**.
- **Nginx**: TLS, `client_max_body_size 600m`, proxy `/api/` → API, `/media/` → API (ficheiros locais, com `proxy_cache` em disco), `/` → Next.

### Cache de mídia (Issue 14)

Para evitar que cada `GET /media/...` chegue à API (que faz `existsSync` + `createReadStream` em disco a cada pedido), o Nginx mantém um cache em disco:

- Definido em `nginx/nginx.conf` (`proxy_cache_path /var/cache/nginx/media ... max_size=2g inactive=30d`).
- Persistido pelo volume Docker `nginx_cache` (em `docker-compose.yml`).
- TTL de 7 dias para `200`, 5 minutos para `404`. Em **produção** (`NODE_ENV=production`) a API envia `Cache-Control: public, max-age=31536000, immutable` (paths são imutáveis por desenho — UUID/timestamp no nome).
- Em **desenvolvimento** a API envia `Cache-Control: no-store`. Razão: sem Nginx em frente, o Chrome tenta gravar tudo no disk cache; ficheiros >1.5 MB batem no limite single-entry e dão `ERR_CACHE_WRITE_FAILURE`, abortando a request. Pior, o Chrome partilhava entradas de cache entre `<img>` (sem CORS) e `fetch(..., { mode: 'cors' })`, fazendo a segunda falhar com `No 'Access-Control-Allow-Origin' header`. Em dev o cache é contraproducente (estamos a iterar); em prod o Nginx absorve a carga.
- A API envia também `Vary: Accept-Encoding, Origin` em ambos os ambientes. **`Origin` é defesa em profundidade**: caches partilhados (corp proxies, edge networks) podem ignorar `no-store` mas respeitam `Vary`, segregando entradas por-origem. Este foi o bug identificado em 2026-05-05 com GIFs no editor V2 (após `gifPlaybackUtils` ter passado a usar `useGifManualCanvas` para todos os GIFs).
- Cada resposta carrega `X-Cache-Status: MISS|HIT|EXPIRED|...` (auditoria). Cliente:
  ```bash
  curl -sI https://seu-dominio/media/covers/<uid>/library/<uuid>-foo.png | grep -i x-cache
  ```
- Limpar cache (raro, ex.: emergência):
  ```bash
  docker compose exec nginx sh -c 'rm -rf /var/cache/nginx/media/* && nginx -s reload'
  ```

## Preparar o pacote (Windows)

Na pasta `luditeca-vps`:

```powershell
.\scripts\pack-for-vps.ps1
```

Gera `luditeca-vps-deploy.tgz` na pasta pai (ex.: `Desktop\apps\`). Envie para a VPS:

```powershell
scp ..\luditeca-vps-deploy.tgz utilizador@IP_DA_VPS:/opt/
```

Na VPS:

```bash
cd /opt
sudo tar -xzf luditeca-vps-deploy.tgz
cd luditeca-vps
cp env.vps.example .env
nano .env   # dominio, JWT, senhas
docker compose up -d --build
```

O ficheiro `.env` na raiz de `luditeca-vps` alimenta o `docker-compose.yml` (Postgres, URLs publicas, build do Next).

## TLS e domínio

1. Aponte o DNS para a VPS.
2. Use **Certbot** (Let’s Encrypt) ou **Traefik** para HTTPS.
3. Em produção defina:
   - `NEXT_PUBLIC_API_URL=https://seu-dominio/api`
   - `NEXT_PUBLIC_MEDIA_BASE_URL=https://seu-dominio/media`
   - `PUBLIC_MEDIA_BASE` na API igual a `NEXT_PUBLIC_MEDIA_BASE_URL` (URL que o browser e a API usam para links públicos).
   - `CORS_ORIGIN=https://seu-dominio` (sem barra final).

> ⚠️ **`CORS_ORIGIN` é obrigatório quando `NODE_ENV=production`.** Se a variável não estiver definida (ou estiver vazia / mal formada), a API aborta o arranque com mensagem clara — ver `parseCorsOrigin()` em `backend/src/server.ts`. Cada entrada deve ser `http(s)://host[:port]` sem barra final ou caminho. Múltiplas origens são separadas por vírgula:
>
> ```env
> CORS_ORIGIN="https://luditeca.com,https://www.luditeca.com,https://staging.luditeca.com"
> ```
>
> Em desenvolvimento, sem `CORS_ORIGIN` definido, o default é `http://localhost:3000,http://localhost:8080`.

Guia passo a passo (DNS Hostinger + Nginx no host + Certbot): **`docs/DOMINIO-HOSTINGER.md`**.

## Segredos

- Gere `JWT_SECRET` forte (32+ caracteres aleatórios).
- Não exponha `DATABASE_URL` nem `JWT_SECRET` ao cliente; só variáveis `NEXT_PUBLIC_*` vão para o front.

## Primeiro utilizador

Com a API a correr e a base migrada:

```bash
cd luditeca-vps/backend
npx tsx scripts/create-admin.ts admin@exemplo.pt "SenhaForte"
```

Ou, a partir da pasta `luditeca-vps`: `docker compose exec api npx tsx scripts/create-admin.ts admin@exemplo.pt "SenhaForte"`

Opcional: `ENABLE_PUBLIC_REGISTER=true` na API para `POST /auth/register` (desligado por defeito).

## Backups

- Faça dump periódico do volume PostgreSQL (`pg_dump`) e cópia do volume de ficheiros **`luditeca_storage`** (midia do CMS).
- Mantenha firewall só com 22, 80 e 443 (e portas internas fechadas ao exterior).

## Build do CMS em produção

O Next embute `NEXT_PUBLIC_*` no build. Após alterar URL pública, volte a construir a imagem `web`:

```bash
cd luditeca-vps
docker compose build --no-cache web
```
