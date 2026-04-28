# Evidências — Etapa 5.4 (logs, métricas e rastreabilidade técnica)

**Referência de requisito:** Etapa 5 — subtarefa **5.4** — *registar erros, tempo de resposta, falhas de upload, falhas de reprodução e eventos importantes* para manutenção e melhoria contínua.

**Repositório:** `luditeca-vps` (API Fastify + Prisma; CMS Next.js).

**Relação com outras evidências:** [EVIDENCIAS-ETAPA-5.3.md](./EVIDENCIAS-ETAPA-5.3.md) (mídia; falhas de upload aparecem como respostas HTTP em rotas `/media/*`).

---

## 1. Modelo de dados

| Tabela | Ficheiro |
|--------|----------|
| `technical_logs` | Modelo `TechnicalLog` em [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma); migração em `backend/prisma/migrations/20260428140000_technical_logs/migration.sql`. |

Campos principais: `level`, `category`, `message`, `metadata` (JSON), `requestId`, `route`, `method`, `statusCode`, `durationMs`, `userId`, `ip`, `userAgent`, `createdAt`.

**Deploy:** em cada ambiente, após atualizar o código, executar `npx prisma migrate deploy` (e `npx prisma generate` no build, se aplicável).

---

## 2. Telemetria HTTP (servidor)

**Ficheiro:** [`backend/src/telemetry/httpTelemetry.ts`](../../backend/src/telemetry/httpTelemetry.ts), registado em [`backend/src/server.ts`](../../backend/src/server.ts) via `registerHttpTelemetry(app)`.

| Comportamento | Detalhe |
|---------------|---------|
| **Rastreio de pedido** | `onRequest`: tempo inicial (`luditecaRequestStartMs`); `x-request-id` (reutiliza cabeçalho de entrada ou gera UUID); cabeçalho devolvido na resposta. |
| **Tempo de resposta** | `onResponse`: calcula `durationMs`; persiste quando relevante (ver abaixo). |
| **Erros HTTP** | Grava linha com `category: http` para `status >= 500`, `429`, qualquer **4xx** em rotas que começam por **`/media`** (inclui falhas de validação/upload), **4xx** em **`/telemetry/client`**, ou quando `durationMs >= TELEMETRY_SLOW_MS` (default **3000** ms). |
| **Exclusões** | `GET /health`; `POST /telemetry/client` com **2xx** (o handler já grava o evento do cliente — evita duplicar). |
| **Excepções não tratadas** | `onError`: `category: http_error`, nível `error`. |

**Biblioteca:** [`backend/src/lib/technicalLog.ts`](../../backend/src/lib/technicalLog.ts) — `writeTechnicalLog()` encapsula `prisma.technicalLog.create`; falhas de escrita são capturadas e registadas em consola sem rebentar o pedido.

**Tipos Fastify:** [`backend/src/types/fastify-augment.d.ts`](../../backend/src/types/fastify-augment.d.ts) — `luditecaRequestStartMs`, `luditecaRequestId`.

---

## 3. API de telemetria do cliente e consulta admin

**Ficheiro:** [`backend/src/routes/telemetryRoutes.ts`](../../backend/src/routes/telemetryRoutes.ts).

| Método e rota | Autenticação | Função |
|---------------|--------------|--------|
| `POST /telemetry/client` | `requireAuth` | Corpo: `category`, `message`, `meta` (objeto), opcional `bookId`. Grava com `category` prefixada por `client:` e nível `warn`. |
| `GET /admin/technical-logs` | `requireAdmin` | Query: `limit`, `offset`, `level`, `category`, `user_id`. Resposta: `{ data, total, take, skip }`. |

---

## 4. Frontend

| Ficheiro | Função |
|----------|--------|
| [`frontend/lib/telemetryClient.js`](../../frontend/lib/telemetryClient.js) | `reportClientTelemetry({ category, message, meta })` → `POST /telemetry/client` (falhas silenciosas). |
| [`frontend/lib/technicalLogs.js`](../../frontend/lib/technicalLogs.js) | `fetchTechnicalLogs` para a página admin. |
| [`frontend/pages/admin/telemetry/index.js`](../../frontend/pages/admin/telemetry/index.js) | Listagem com filtros básicos. |
| [`frontend/components/Layout.js`](../../frontend/components/Layout.js) | Link admin **Telemetria** → `/admin/telemetry`. |
| [`frontend/components/editor/CanvasStageKonva.jsx`](../../frontend/components/editor/CanvasStageKonva.jsx) | No preview de vídeo (`onError`), chama `reportClientTelemetry` com `category: video_playback` e meta (`code`, `srcHost`, `nodeId`). |

**Falhas de reprodução:** cobertura explícita no preview de vídeo do editor (Konva). Outros players (ex.: áudio noutros ecrãs) podem ser alinhados no mesmo padrão com `reportClientTelemetry` quando necessário.

**Falhas de upload:** cobertura no servidor para **4xx** em **`/media/*`** (telemetria HTTP), sem segundo registo obrigatório no cliente.

---

## 5. Validação local (referência)

- Backend: `npx prisma generate` ; `npx tsc --noEmit`.
- Frontend: `npm run build`.

---

## 6. Variáveis de ambiente

| Variável | Efeito |
|----------|--------|
| `TELEMETRY_SLOW_MS` | Limiar em ms para gravar pedido lento como evento `info`/`warn` (junto com metadados `slow: true`). Mínimo efectivo 500 ms no código. |
