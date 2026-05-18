# API da app infantil (`/app/*`)

Contratos de leitura para alunos e professores. Autenticação: `Authorization: Bearer <JWT>` com papel `aluno`, `professor` (ou `admin`/`editor` para testes).

Base URL: mesma da API CMS (`NEXT_PUBLIC_API_URL`, ex. `http://localhost:3020`).

## Autorização

| Helper | Papéis |
|--------|--------|
| `requireAppUser` | `aluno`, `professor`, `admin`, `editor` |

Rotas de escrita CMS (`PATCH /books`, `/activities`, etc.) continuam a exigir `requireCmsEditor` → token de aluno recebe **403**.

## Livros

### `GET /app/books`

Lista livros com `workflow_status = published`. Projeção leve (sem `pages_v2`).

| Query | Tipo | Default |
|-------|------|---------|
| `limit` | number | 50 (máx. 100) |
| `offset` | number | 0 |

**Resposta:** `{ data: BookCard[], total, limit, skip }`

### `GET /app/books/:id`

Detalhe para leitura. **404** se o livro não existir ou não estiver publicado.

| Query | Valores | Default |
|-------|---------|---------|
| `view` | `v2`, `legacy`, `both` | `v2` |

Mídia em `pages_v2` / `pages` vem com URLs presignadas (igual ao CMS).

## Atividades

### `GET /app/activities`

Só `is_published = true`. Ordenação: `sort_order`, `updated_at`.

Paginação: `limit` (default 50), `offset` (default 0).

### `GET /app/activities/:id`

Payload completo incluindo `questions[]`. **404** se não publicada.

## LIBRAS

### `GET /app/libras-lessons`

Todas as lições, ordenadas por `sort_order`.

## Puzzle e pinturas

### `GET /app/puzzle-games`

Só `is_published = true`.

### `GET /app/coloring-pages`

Só `is_published = true`. Merge de SVGs default permanece no frontend ([`DECISOES.md`](./DECISOES.md)).

## Frontend (Next.js)

| Página | Lib |
|--------|-----|
| `/app` | hub |
| `/app/library`, `/app/library/[id]` | `lib/appContent.js` → `listAppBooks`, `getAppBook` |
| `/app/activities`, `/app/activities/[id]` | `listAppActivities`, `getAppActivity` |
| `/app/libras` | `listAppLibrasLessons` |
| `/app/puzzle`, `/app/coloring` | `listAppPuzzleGames`, `listAppColoringPages` |

## Validação manual

```powershell
# Login aluno (ajustar credenciais)
$r = Invoke-RestMethod -Method POST -Uri http://localhost:3020/auth/login -ContentType application/json -Body '{"email":"aluno@exemplo.com","password":"..."}'
$h = @{ Authorization = "Bearer $($r.access_token)" }

Invoke-RestMethod -Uri http://localhost:3020/app/books -Headers $h
# PATCH CMS deve falhar:
Invoke-RestMethod -Method PATCH -Uri http://localhost:3020/puzzle-games/ID -Headers $h -Body '{}' 
# → 403
```

---

*Ver também [`../ROTAS-E-PERMISSOES-LOGIN.md`](../ROTAS-E-PERMISSOES-LOGIN.md).*
