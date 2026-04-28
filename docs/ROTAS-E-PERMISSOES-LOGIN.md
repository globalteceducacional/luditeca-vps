# Rotas e permissões de login (Luditeca VPS)

Referência única para **autenticação JWT**, **papéis** (`UserRole`) e **quem pode chamar cada rota** da API Fastify.  
Ficheiros de origem: `backend/src/plugins/auth.ts`, `backend/src/lib/roles.ts`, rotas em `backend/src/routes/*.ts`.

---

## 1. Como funciona o login

| Item | Detalhe |
|------|---------|
| **Obter token** | `POST /auth/login` com JSON `{ "email", "password" }` (sem Bearer). Resposta inclui `access_token` (JWT). |
| **Chamadas autenticadas** | Cabeçalho `Authorization: Bearer <access_token>`. O hook `registerAuth` em `plugins/auth.ts` preenche `request.user` se o token for válido. |
| **Papel no token** | O JWT inclui `role` (`admin`, `editor`, `professor`, `aluno`). Papéis desconhecidos são rejeitados (não autentica). |
| **Sessão no CMS** | O frontend guarda o token (ex.: `localStorage`) e usa `apiFetch`, que anexa o Bearer automaticamente. |

---

## 2. Papéis (`UserRole`)

| Papel | Uso típico |
|-------|------------|
| **admin** | CMS completo, utilizadores, categorias/autores (escrita), auditoria, tudo o que **editor** faz. |
| **editor** | CMS: livros, média, import PPTX, leitura de autores; **não** gere utilizadores nem categorias (escrita) nem auditoria global. |
| **professor** | Área “app” no Next (`/app`); não deve usar rotas de edição CMS (o layout do CMS redireciona). |
| **aluno** | Idem professor. |

**Helpers na API** (todos exigem JWT válido exceto onde está “Público”):

| Helper | Papéis permitidos | Erro se falhar |
|--------|-------------------|----------------|
| `requireAuth` | Qualquer utilizador autenticado | **401** `Não autenticado.` |
| `requireCmsEditor` | `admin`, `editor` | **401** se não autenticado; **403** `Sem permissão.` se for `professor`/`aluno`. |
| `requireAdmin` | `admin` | **401** / **403** conforme acima. |

---

## 3. Rotas de autenticação e sessão

| Método | Rota | Autenticação | Notas |
|--------|------|--------------|--------|
| `POST` | `/auth/login` | **Pública** | Credenciais inválidas → **401**. |
| `POST` | `/auth/register` | **Pública** | Só se `ENABLE_PUBLIC_REGISTER=true` no servidor; caso contrário **403**. |
| `POST` | `/auth/forgot-password` | **Pública** | Resposta genérica `{ ok: true }` (não revela se o email existe). |
| `POST` | `/auth/reset-password` | **Pública** | Corpo `{ token, password }`; token inválido/expirado → **400**. |
| `GET` | `/auth/me` | **requireAuth** | Perfil do utilizador autenticado. |
| `PATCH` | `/auth/profile` | **requireAuth** | Nome / avatar no modelo User/Profile. |
| `POST` | `/auth/change-password` | **requireAuth** | `{ currentPassword, newPassword }`. |
| `GET` | `/me/profile` | **requireAuth** | Perfil aluno/app (JSON estendido). |
| `PATCH` | `/me/profile` | **requireAuth** | Atualiza progresso, favoritos, etc. |
| `GET` | `/me/favorites/books` | **requireAuth** | Livros favoritos do perfil. |

---

## 4. Rotas administrativas e utilizadores

| Método | Rota | Permissão |
|--------|------|-----------|
| `GET` | `/admin/audit-logs` | **requireAdmin** (query: `limit`, `offset`, `book_id`, `action_code`) |
| `GET` | `/users` | **requireAdmin** |
| `POST` | `/users` | **requireAdmin** |
| `PATCH` | `/users/:id` | **requireAdmin** |
| `DELETE` | `/users/:id` | **requireAdmin** |

---

## 5. Livros e importação

| Método | Rota | Permissão |
|--------|------|-----------|
| `GET` | `/books` | **requireAuth** (qualquer papel autenticado) |
| `GET` | `/books/:id` | **requireAuth** |
| `POST` | `/books` | **requireCmsEditor** |
| `PATCH` | `/books/:id` | **requireCmsEditor** (inclui `workflow_status` / `workflowStatus`) |
| `DELETE` | `/books/:id` | **requireCmsEditor** |
| `POST` | `/books/import-pptx` | **requireCmsEditor** |

---

## 6. Autores e categorias

| Método | Rota | Permissão |
|--------|------|-----------|
| `GET` | `/authors` | **requireCmsEditor** |
| `GET` | `/authors/:id` | **requireCmsEditor** |
| `POST` | `/authors` | **requireAdmin** |
| `PATCH` | `/authors/:id` | **requireAdmin** |
| `DELETE` | `/authors/:id` | **requireAdmin** |
| `GET` | `/categories` | **requireAuth** |
| `GET` | `/categories/:id` | **requireAuth** |
| `POST` | `/categories` | **requireAdmin** |
| `PATCH` | `/categories/:id` | **requireAdmin** |
| `DELETE` | `/categories/:id` | **requireAdmin** |

---

## 7. Média (prefixo `/media/*`)

Todas as rotas abaixo usam **requireCmsEditor** (`admin` ou `editor`):

| Método | Rota |
|--------|------|
| `GET` | `/media/list` |
| `GET` | `/media/signed-get` |
| `POST` | `/media/upload` |
| `POST` | `/media/replace` |
| `POST` | `/media/folder` |
| `DELETE` | `/media/object` |
| `POST` | `/media/rename` |
| `POST` | `/media/move` |
| `POST` | `/media/presign` |

> **Nota:** ficheiros estáticos locais `GET /media/*` (storage) são servidos pelo próprio servidor Fastify para desenvolvimento; regras diferentes do proxy em produção (Nginx).

---

## 8. Outros

| Método | Rota | Permissão |
|--------|------|-----------|
| `GET` | `/health` | **Pública** |

---

## 9. Portal Next.js (CMS) — rotas de página e quem acede

Comportamento resumido (ver `frontend/pages/*`, `frontend/components/Layout.js`, `frontend/lib/roles.js`):

| Rota | Acesso |
|------|--------|
| `/login`, `/forgot-password`, `/reset-password` | Qualquer visitante. |
| `/`, `/books`, `/books/new`, `/books/[id]/edit`, `/books/[id]/edit-v2`, `/profile` | Utilizador autenticado com papel **admin** ou **editor** (CMS). |
| `/authors`, `/authors/*`, `/categories`, `/categories/*` | Só **admin** (links no layout). |
| `/admin/users`, `/admin/audit` | Só **admin**. |
| `/app` | **aluno** ou **professor** (área do app; não é CMS de livros). |

Se um **aluno** ou **professor** aceder a rotas do CMS, o `Layout` redireciona para `/app`.

---

## 10. Resumo visual (matriz rápida)

Legenda por coluna: **books GET** = `GET /books` e `GET /books/:id` (`requireAuth`); **books escrita** = `POST|PATCH|DELETE /books` (`requireCmsEditor`).

```
                    │ login │ registo* │ forgot/reset │ auth/me+ │ books GET │ books escrita │ media │ authors GET │ authors escrita │ cat. GET │ cat. escrita │ users │ audit │
────────────────────┼───────┼──────────┼────────────────┼──────────┼───────────┼─────────────────┼───────┼───────────────┼─────────────────┼──────────┼──────────────┼───────┼───────│
Público             │  ✓   │   ✓*     │       ✓        │    ✗     │     ✗     │        ✗        │  ✗    │       ✗       │        ✗        │    ✗     │      ✗       │  ✗    │  ✗    │
professor / aluno   │  —   │    —     │       —        │    ✓     │     ✓     │        ✗        │  ✗    │       ✗       │        ✗        │    ✓     │      ✗       │  ✗    │  ✗    │
editor              │  —   │    —     │       —        │    ✓     │     ✓     │        ✓        │  ✓    │       ✓       │        ✗        │    ✓     │      ✗       │  ✗    │  ✗    │
admin               │  —   │    —     │       —        │    ✓     │     ✓     │        ✓        │  ✓    │       ✓       │        ✓        │    ✓     │      ✓       │  ✓    │  ✓    │
```

\*Registo só se `ENABLE_PUBLIC_REGISTER=true`.

---

*Última atualização alinhada ao código em `luditeca-vps/backend` e `frontend`.*
