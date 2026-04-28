# Evidências — Tarefa 3.1 (autenticação, perfis, trilha de ações)

**Referência de requisito:** item 3.1 do quadro de tarefas (portal administrativo logável, recuperação de acesso, níveis de permissão, histórico de ações sobre obras e ativos).

**Repositório:** `luditeca-vps` (CMS Next.js + API Fastify + Prisma/PostgreSQL).

**Rotas e permissões (referência completa):** [`ROTAS-E-PERMISSOES-LOGIN.md`](ROTAS-E-PERMISSOES-LOGIN.md).

---

## 1. O que foi implementado

| Área | Descrição |
|------|-----------|
| **Recuperação de acesso** | `POST /auth/forgot-password` (resposta uniforme), `POST /auth/reset-password` (token descartável, hash SHA-256 na base). UI: `/forgot-password`, `/reset-password?token=…`, link no login. |
| **Perfis / RBAC** | Mantido modelo existente (`UserRole`: admin, editor, professor, aluno). Trilha de leitura: só **admin** em `GET /admin/audit-logs`. CMS: `requireCmsEditor` / `requireAdmin` na API. |
| **Estado editorial da obra** | Campo `workflow_status` na tabela `books` (`draft` → `review` → `published` → `archived`). Atualização via `PATCH /books/:id` e seletor na grelha de livros do CMS. |
| **Trilha de auditoria** | Tabela `admin_audit_logs`, helper `writeAuditLog`, listagem paginada para admin. Eventos `EVT:*` em login, registo, alteração de senha, reset, utilizadores, livros (CRUD + mudança de workflow), import PPTX, upload de média. |
| **Portal / UI** | Página **Trilha de ações** em `/admin/audit` (admin), entradas no `Layout`. |

---

## 2. Arquivos-fonte (por módulo)

### API (backend)

| Ficheiro | Função |
|----------|--------|
| `backend/prisma/schema.prisma` | `BookWorkflowStatus`, `AdminAuditLog`, `PasswordResetToken`, campo `workflowStatus` em `Book`. |
| `backend/prisma/migrations/20260427140000_admin_audit_password_reset_workflow/migration.sql` | Migração SQL aplicável com `prisma migrate deploy`. |
| `backend/src/lib/auditLog.ts` | `writeAuditLog`, geração/hash do token de reset, `clientIp`. |
| `backend/src/routes/adminAuditRoutes.ts` | `GET /admin/audit-logs` (filtros `book_id`, `action_code`, paginação). |
| `backend/src/routes/authRoutes.ts` | Auditoria de login; `forgot-password` / `reset-password`; auditoria de alteração de senha e registo. |
| `backend/src/routes/userRoutes.ts` | Auditoria em criar/atualizar/apagar utilizador. |
| `backend/src/routes/bookRoutes.ts` | `workflow_status` no POST/PATCH; auditoria create/update/delete/workflow. |
| `backend/src/routes/importPptxRoute.ts` | Auditoria sucesso/falha/dry-run de import PPTX (captura do corpo da resposta). |
| `backend/src/routes/mediaRoutes.ts` | Auditoria `EVT:MEDIA_UPLOAD` após `mediaFile.create` em `/media/upload`. |
| `backend/src/server.ts` | Registo de `registerAdminAuditRoutes`. |

### CMS (frontend)

| Ficheiro | Função |
|----------|--------|
| `frontend/pages/forgot-password.js` | Pedido de recuperação. |
| `frontend/pages/reset-password.js` | Nova senha com token. |
| `frontend/pages/login.js` | Link “Esqueci a senha”. |
| `frontend/pages/admin/audit/index.js` | Tabela da trilha (admin). |
| `frontend/lib/auditLogs.js` | Cliente `fetchAuditLogs`. |
| `frontend/lib/apiNormalize.js` | Campo `workflow_status` no livro normalizado. |
| `frontend/pages/books/index.js` | Seletor de estado editorial por livro. |
| `frontend/components/Layout.js` | Atalho “Trilha de ações” (admin). |

### Documentação / artefacto exportado

| Ficheiro | Função |
|----------|--------|
| `docs/ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md` | Âmbito e nomenclatura (já existente). |
| `docs/artifacts/luditeca-portal-admin-scope.v1.json` | Atualizado com estado “implementado” e lista de ficheiros. |

---

## 3. Variáveis de ambiente (backend)

| Variável | Uso |
|----------|-----|
| `PASSWORD_RESET_PUBLIC_BASE_URL` | URL pública da página de reset **sem** query (ex.: `http://localhost:8080/reset-password`). O link completo é registado nos logs do servidor (`password_reset_link`). |
| `PASSWORD_RESET_TTL_MINUTES` | Validade do token (predefinido 60, máx. 24 h). |
| `PASSWORD_RESET_DEV_RETURN_TOKEN` | Se `true`, a resposta de `forgot-password` inclui `dev_reset_token` (apenas para desenvolvimento). |

Produção: integrar envio de email (SMTP ou serviço externo) com o link — não incluído neste pacote para evitar dependências e segredos no repositório.

---

## 4. Como validar (checklist rápido)

1. `cd luditeca-vps/backend` → `npx prisma migrate deploy` → `npm run dev`.
2. `cd luditeca-vps/frontend` → `npm run dev` com `NEXT_PUBLIC_API_URL` apontando para a API.
3. Login falhado → verificar evento `EVT:AUTH_LOGIN_FAIL` em `/admin/audit` (como admin).
4. Login com admin → `EVT:AUTH_LOGIN_OK`; abrir **Trilha de ações** no menu.
5. Alterar estado editorial de um livro na lista → `EVT:BOOK_WORKFLOW_CHANGE` e `EVT:BOOK_UPDATE`.
6. Pedido de recuperação em `/forgot-password` → com `PASSWORD_RESET_DEV_RETURN_TOKEN=true`, usar token em `/reset-password` → `EVT:AUTH_PASSWORD_RESET_OK`.

---

## 5. Anexo de evidência visual (quadro de tarefas)

Anexe ao dossiê do projeto uma captura do quadro da tarefa **3.1** (estado “Fazendo” / critérios de entrega), se a política de arquivo o exigir. O requisito textual foi a base da implementação acima.

**ID interno do artefacto de âmbito:** `LUD-ART-PORTAL-ADMIN-001` (ver `docs/artifacts/luditeca-portal-admin-scope.v1.json`).

---

*Documento gerado como evidência da execução da tarefa 3.1 (implementação + entregáveis em `docs`).*
