# Evidências — Etapa 5.1 (banco, armazenamento e contratos de API)

**Referência de requisito:** Etapa 5 do plano — *Backend, armazenamento, busca, APIs e observabilidade*; subtarefa **5.1** — criar tabelas, serviços e contratos que alimentam portal e app; documentar entradas e saídas das APIs (catálogo, detalhe do livro, página, progresso, upload, busca, publicação).

**Repositório:** `luditeca-vps/backend` (Node + **Fastify** + **Prisma** + PostgreSQL; object storage via `lib/s3.ts` — compatível S3/MinIO/Supabase).

**Stack:** `package.json` do backend fixa versões de runtime (consultar no repositório); Prisma usa `provider = "postgresql"` em `schema.prisma`.

---

## 1. Modelo de dados (Prisma)

**Ficheiro canónico:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma).

| Modelo / enum | Tabela (`@@map`) | Função no produto |
|---------------|------------------|-------------------|
| `User` | `users` | Conta CMS/app: email, `passwordHash`, `role` (`UserRole`). |
| `PasswordResetToken` | `password_reset_tokens` | Fluxo de recuperação de senha (hash do token, expiração). |
| `AdminAuditLog` | `admin_audit_logs` | Trilha de ações (ator, `action_code`, alvo, `bookId`, metadata JSON, IP/UA). |
| `Profile` | `profiles` | Perfil aluno/professor: progresso, favoritos, histórico de leitura (JSON), permissões. |
| `Author` | `authors` | Catálogo de autores. |
| `Category` | `categories` | Catálogo de categorias. |
| `Book` | `books` | Obra: título, `pages` (JSON legado), **`pages_v2`** (editor), relações autor/categoria, `workflowStatus` (`BookWorkflowStatus`: draft → review → published → archived). |
| `MediaFile` | `media_files` | Metadados de ficheiros no storage (`filePath`, bucket, tamanho, opcional `bookId`). |

**Migrações SQL versionadas:** pasta [`backend/prisma/migrations/`](../../backend/prisma/migrations/).

| Pasta | Tema |
|-------|------|
| `20250324120000_init` | Esquema inicial (utilizadores, perfis, livros, autores, categorias, média). |
| `20260325150000_user_role_enum` | Enum de papéis. |
| `20260325170000_mediafile_bookid` | Ligação de ficheiros ao livro. |
| `20260325193000_book_pages_v2` | Coluna `pages_v2` no livro. |
| `20260427140000_admin_audit_password_reset_workflow` | Auditoria, reset de senha, workflow editorial. |

Comando típico em ambiente com base acessível: `npx prisma migrate deploy` (a partir de `backend/`).

---

## 2. Arranque do servidor e infra transversal

| Ficheiro | Conteúdo relevante |
|----------|-------------------|
| [`backend/src/server.ts`](../../backend/src/server.ts) | Fastify + **CORS** (`CORS_ORIGIN`), **multipart** (limite 500 MB por ficheiro), `bodyLimit` 600 MB; registo de plugins e rotas; **`GET /health`** (`ok`, `ts`); em `STORAGE_DRIVER=local`, **`GET /media/*`** serve ficheiros do disco (`LOCAL_STORAGE_DIR`). |
| [`backend/src/plugins/auth.ts`](../../backend/src/plugins/auth.ts) | Hook `Authorization: Bearer`; `requireAuth`, `requireAdmin`, `requireCmsEditor` (admin + editor). |
| [`backend/src/lib/prisma.ts`](../../backend/src/lib/prisma.ts) | Cliente Prisma singleton. |
| [`backend/src/lib/s3.ts`](../../backend/src/lib/s3.ts) | Abstração de storage: buckets permitidos, `putObject`, URLs assinadas, listagem, cópia/remoção. |
| [`backend/src/lib/auditLog.ts`](../../backend/src/lib/auditLog.ts) | `writeAuditLog` para `AdminAuditLog`. |
| [`backend/src/lib/jwt.ts`](../../backend/src/lib/jwt.ts) | Tokens de acesso. |
| [`backend/src/lib/password.ts`](../../backend/src/lib/password.ts) | Hash de senhas. |
| [`backend/src/lib/serialize.ts`](../../backend/src/lib/serialize.ts) | Respostas JSON seguras (BigInt, etc.). |
| [`backend/src/lib/imageProcessor.ts`](../../backend/src/lib/imageProcessor.ts) | Miniaturas no pipeline de upload. |
| [`backend/src/lib/pagesV2/migrate.ts`](../../backend/src/lib/pagesV2/migrate.ts) | Migração legado ↔ `pages_v2` (usada nas rotas de livro). |

**Motor PPTX (processamento, não é `.ts`):** [`backend/src/pptx/importPptxEngine.js`](../../backend/src/pptx/importPptxEngine.js) — invocado por `importPptxRoute.ts`.

---

## 3. Inventário de rotas HTTP (`backend/src/routes`)

Prefixo base da API conforme deploy (ex.: `http://host:4000`). Todas as rotas abaixo são registadas em `server.ts` exceto `/health` e `/media/*` (local).

### 3.1 Autenticação e perfil — `authRoutes.ts`

| Método | Caminho | Auth | Resumo |
|--------|---------|------|--------|
| `POST` | `/auth/register` | Público | Registo (com regras de validação no handler). |
| `POST` | `/auth/login` | Público | Login; devolve token e dados do utilizador. |
| `POST` | `/auth/forgot-password` | Público | Pedido de reset (resposta uniforme). |
| `POST` | `/auth/reset-password` | Público | Consumo de token de reset. |
| `GET` | `/auth/me` | `requireAuth` | Sessão atual. |
| `PATCH` | `/auth/profile` | `requireAuth` | Atualização de perfil (nome, etc.). |
| `POST` | `/auth/change-password` | `requireAuth` | Alteração de senha autenticada. |
| `GET` | `/me/profile` | `requireAuth` | Perfil estendido (`Profile`). |
| `PATCH` | `/me/profile` | `requireAuth` | Atualização de `Profile` (progresso, favoritos, etc.). |
| `GET` | `/me/favorites/books` | `requireAuth` | Lista de livros favoritos do utilizador. |

### 3.2 Livros (catálogo, detalhe, páginas, publicação editorial) — `bookRoutes.ts`

| Método | Caminho | Auth | Resumo |
|--------|---------|------|--------|
| `GET` | `/books` | `requireAuth` | Lista de livros (ordenado por data); inclui relação autor. |
| `GET` | `/books/:id` | `requireAuth` | Detalhe: `pages`, `pages_v2` com **URLs assinadas** para média embutida; `needsMigration` / `pages_v2_suggested` se só existir legado. |
| `POST` | `/books` | `requireCmsEditor` | Criação; aceita `pages`, `pages_v2`, `workflow_status`, `import_session_id` (finalização de assets de import PPTX). |
| `PATCH` | `/books/:id` | `requireCmsEditor` | Atualização parcial (metadados, páginas, workflow). |
| `DELETE` | `/books/:id` | `requireCmsEditor` | Remoção da obra (e limpeza associada no handler). |

**Contrato de “página”:** persistida dentro de `Book.pages` (legado) e/ou `Book.pagesV2` (JSON versionado 2 — canvas, nós, outline no cliente).

### 3.3 Autores e categorias (catálogo CMS)

**`authorRoutes.ts`**

| Método | Caminho | Auth |
|--------|---------|------|
| `GET` | `/authors` | `requireCmsEditor` |
| `GET` | `/authors/:id` | `requireCmsEditor` |
| `POST` | `/authors` | `requireAdmin` |
| `PATCH` | `/authors/:id` | `requireAdmin` |
| `DELETE` | `/authors/:id` | `requireAdmin` |

**`categoryRoutes.ts`**

| Método | Caminho | Auth |
|--------|---------|------|
| `GET` | `/categories` | `requireAuth` |
| `GET` | `/categories/:id` | `requireAuth` |
| `POST` | `/categories` | `requireAdmin` |
| `PATCH` | `/categories/:id` | `requireAdmin` |
| `DELETE` | `/categories/:id` | `requireAdmin` |

### 3.4 Utilizadores (administração) — `userRoutes.ts`

| Método | Caminho | Auth |
|--------|---------|------|
| `GET` | `/users` | `requireAdmin` |
| `POST` | `/users` | `requireAdmin` |
| `PATCH` | `/users/:id` | `requireAdmin` |
| `DELETE` | `/users/:id` | `requireAdmin` |

### 3.5 Média e armazenamento — `mediaRoutes.ts`

Todas com `requireCmsEditor` salvo indicação em contrário.

| Método | Caminho | Função |
|--------|---------|--------|
| `GET` | `/media/list` | Lista “filesystem” do utilizador por bucket/tipo (`mediaType`, `path`, `root`, `bookId`, `recursive`); modo livro lista `media_files` do `bookId`. |
| `GET` | `/media/signed-get` | URL assinada para leitura de uma `key` (próprio utilizador ou objeto ligado a livro). |
| `POST` | `/media/upload` | Multipart `file`; gera chave única; miniatura para imagens; registo em `media_files`; auditoria `EVT:MEDIA_UPLOAD`. |
| `POST` | `/media/replace` | Substitui bytes mantendo caminho (referências estáveis). |
| `POST` | `/media/folder` | Marcador de pasta lógica. |
| `DELETE` | `/media/object` | Apaga objeto e metadados associados. |
| `POST` | `/media/rename` | Renomeia registo (`fileName`) em `media_files`. |
| `POST` | `/media/move` | Move objeto no storage + atualiza `media_files`. |
| `POST` | `/media/presign` | URL **PUT** assinada para upload direto ao storage. |

Buckets lógicos: `covers`, `audios`, `videos`, `pages`, `categories`, `autores`, `avatars`, `presentations` (mapeamento `MEDIA_BUCKET_MAP` no mesmo ficheiro).

### 3.6 Importação e auditoria

| Método | Caminho | Ficheiro | Auth |
|--------|---------|----------|------|
| `POST` | `/books/import-pptx` | `importPptxRoute.ts` | `requireCmsEditor` — multipart; corpo processado por `importPptxEngine.js`; auditoria OK/FAIL/DRY_RUN. |
| `GET` | `/admin/audit-logs` | `adminAuditRoutes.ts` | `requireAdmin` — query: `limit`, `offset`, `book_id`, `actor_user_id`, `action_code`. |

---

## 4. Mapeamento requisito 5.1 → implementação

| Requisito (enunciado) | Onde está coberto |
|------------------------|-------------------|
| Tabelas / banco | `schema.prisma` + migrações em `prisma/migrations/`. |
| Catálogo de livros | `GET /books` (+ filtros no cliente CMS, se aplicável). |
| Detalhe do livro | `GET /books/:id` com hidratação de URLs. |
| Páginas / conteúdo | Campos JSON `pages` e `pages_v2` no `PATCH/POST /books`. |
| Progresso / favoritos (app) | `Profile` + `GET/PATCH /me/profile`, `GET /me/favorites/books`. |
| Upload | `/media/upload`, `/media/replace`, `/media/presign`, listagem `/media/list`. |
| Publicação (estado editorial) | `workflow_status` / `workflowStatus` em `Book` + `PATCH /books/:id`. |
| Busca dedicada (full-text, índice) | **Não** há endpoint específico de busca textual no backend nesta entrega; catálogo é servido por listagens e pesquisa no frontend. |
| Filas de processamento | **Não** há worker de filas separado no `src/`; import PPTX corre **inline** no pedido HTTP. |
| Logs / observabilidade | **Logger Fastify** (`logger: true`); trilha persistida em **`admin_audit_logs`**; health check **`/health`**. |

---

## 5. Documentação complementar no repositório

- Permissões e rotas resumidas: [`docs/ROTAS-E-PERMISSOES-LOGIN.md`](../ROTAS-E-PERMISSOES-LOGIN.md) (se existir na cópia local).
- Evidências de portal/admin e fluxos anteriores: mesma pasta [`docs/evidencias/`](./).

---

## 6. Checklist operacional rápido

1. `DATABASE_URL` definido; `npx prisma migrate deploy` em `backend/`.
2. Variáveis de storage (`STORAGE_DRIVER`, credenciais S3 ou caminho local) alinhadas com `lib/s3.ts`.
3. `GET /health` retorna `ok`.
4. Login → `GET /books` com `Authorization: Bearer …`.
5. Upload de teste → `POST /media/upload` com editor autenticado e cabeçalho/query `bookId` se for média do livro.
