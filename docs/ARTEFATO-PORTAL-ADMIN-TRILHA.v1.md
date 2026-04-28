# Artefato: Portal web administrativo, autenticação, perfis e trilha de ações

| Campo | Valor |
|--------|--------|
| **ID** | `LUD-ART-PORTAL-ADMIN-001` |
| **Versão** | 1.1.0 (implementação base tarefa 3.1 — ver evidências) |
| **Módulo** | `luditeca-vps` (frontend Next.js + API Fastify) |
| **Exportação máquina** | [`artifacts/luditeca-portal-admin-scope.v1.json`](artifacts/luditeca-portal-admin-scope.v1.json) |
| **Evidências execução 3.1** | [`EVIDENCIAS-TAREFA-3.1.md`](EVIDENCIAS-TAREFA-3.1.md) |

Este documento consolida o **estado atual do código**, as **lacunas** para um portal administrativo completo com **trilha de auditoria**, e a **nomenclatura** para a atividade seguinte (implementação).

---

## 1. O que já existe (arquivo-fonte)

### 1.1 API (Node + Fastify + Prisma)

| Área | Ficheiro-fonte | Função |
|------|----------------|--------|
| Modelo de dados / perfis | `backend/prisma/schema.prisma` | `User` (`UserRole`: admin, editor, professor, aluno), `Profile` (JSON `permissions`, etc.), `Book` (`pages`, `pages_v2`). **Não existe** modelo de auditoria. |
| Autenticação JWT | `backend/src/plugins/auth.ts` | Anexa `request.user` a partir do Bearer; `requireAuth`, `requireRoles`, `requireAdmin`, `requireCmsEditor`. |
| Login / registo / me | `backend/src/routes/authRoutes.ts` | `POST /auth/login`, `POST /auth/register` (flag env), `GET /auth/me`, atualização de perfil. |
| Livros | `backend/src/routes/bookRoutes.ts` | CRUD e media; edição CMS via `requireCmsEditor` nas mutações relevantes. |
| Importação | `backend/src/routes/importPptxRoute.ts` | `POST /books/import-pptx` com `requireCmsEditor`. |
| Utilizadores admin | `backend/src/routes/userRoutes.ts` | Operações restritas a admin (criação/listagem/etc., conforme implementação). |

### 1.2 Portal web (Next.js — CMS)

| Área | Ficheiro-fonte | Função |
|------|----------------|--------|
| Login | `frontend/pages/login.js` | Portal **logável**; após sucesso redireciona para `/`. |
| Entrada | `frontend/pages/index.js` | `admin`/`editor` → `/books`; `aluno`/`professor` → `/app`; sem sessão → `/login`. |
| Sessão | `frontend/contexts/auth.js` | Token + `GET /auth/me`. |
| Papéis | `frontend/lib/roles.js` | `CMS_ROLES`, `ADMIN_ONLY`, `isRole`. |
| Admin utilizadores | `frontend/pages/admin/users/index.js` | **Portal administrativo** parcial: só `role === admin`. |
| Livros | `frontend/pages/books/index.js`, `new.js`, `[id]/edit.js`, `[id]/edit-v2.jsx` | Listar, criar, editar (legado e **v2** — produção de livro). |

**Conclusão:** já há **portal web logável**, **perfis** (`UserRole` + `Profile`), e fluxos de **importar** (PPTX na API) e **produzir** (editor v2). Falta, para o pedido explícito, uma **trilha de ações** persistida e consultável (auditoria), e opcionalmente um **shell** `/admin` unificado (navegação + importação na UI).

---

## 2. Identificação padronizada de alvo (módulo, livro, página)

Use estes identificadores em logs, tickets e payloads de auditoria:

| Prefixo | Formato | Exemplo |
|---------|---------|---------|
| `MOD:` | módulo lógico | `MOD:cms`, `MOD:api` |
| `BOOK:` | id numérico Prisma | `BOOK:42` |
| `PAGE:` | livro legado + índice 0-based no array `pages` | `PAGE:42:3` |
| `PAGEV2:` | livro + id/slug da página no JSON `pages_v2` | `PAGEV2:42:slide-7` |
| `USER:` | UUID utilizador | `USER:550e8400-e29b-41d4-a716-446655440000` |
| `MEDIA:` | UUID `MediaFile` | `MEDIA:…` |
| `EVT:` | código de evento (ver JSON exportado) | `EVT:BOOK_IMPORT_PPTX_OK` |

**Livro ou página afetada:** em cada evento, preencher `bookId` (quando aplicável) e `pageRef` como `PAGE:…` ou `PAGEV2:…` ou `null` para ações globais (ex.: `EVT:USER_CREATE`).

---

## 3. Estado da implementação (tarefa 3.1)

Implementado na API e no CMS: modelo `AdminAuditLog`, `PasswordResetToken`, `Book.workflowStatus`, migração `20260427140000_admin_audit_password_reset_workflow`, rotas de reset de senha, `GET /admin/audit-logs`, instrumentação nas rotas indicadas no ficheiro de evidências, páginas `/forgot-password`, `/reset-password`, `/admin/audit`.

**Pendências sugeridas:** envio de email (SMTP) para o link de reset; `pageRef` por gravação no editor v2; export CSV e retenção de logs. Detalhe em [`EVIDENCIAS-TAREFA-3.1.md`](EVIDENCIAS-TAREFA-3.1.md).

---

## 3b. Lacunas históricas (documento original — maior parte resolvida)

1. ~~**Modelo e migração**~~ — feito.
2. ~~**Instrumentação API**~~ — feito (extensível).
3. ~~**API de leitura**~~ — `GET /admin/audit-logs` (admin).
4. ~~**UI**~~ — `/admin/audit`.
5. **Política de perfis** — validar se `Profile.permissions` deve sobrepor `User.role` no CMS; hoje o CMS usa sobretudo `User.role`.

---

## 4. Versão exportada (para tooling)

Ficheiro JSON com inventário de fontes, lacunas, taxonomia de `EVT:*` e checklist:

- **`docs/artifacts/luditeca-portal-admin-scope.v1.json`**

Pode ser importado por tarefas automatizadas, geradores de código ou issues (campo `artifact.id` = `LUD-ART-PORTAL-ADMIN-001`).

---

## 5. Dependências de ambiente (contexto)

- API: ver `luditeca-vps/README.md` (Docker: API típica em porta **4000**; variáveis `.env`).
- JWT: `JWT_SECRET` no backend (já usado em login e import PPTX).

---

*Documento gerado como artefato de âmbito para implementação do portal administrativo e da trilha de auditoria; alinhado ao repositório Luditeca na data de entrega.*
