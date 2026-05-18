# Fluxo de criação de livro — Base44 (referência) × Luditeca (código atual)

Documento para alinhar o **BookEditor** do app Vite/Base44 com o CMS **Next.js + Fastify + Prisma** deste repositório.

**Decisões já fixadas na Luditeca:** ver [`DECISOES.md`](./DECISOES.md) — não portar `AdminLoginModal` / `localStorage.admin_session`; publicação via `workflow_status`; editor oficial `edit-v2`; assistente em `/books/new`.

---

## 1. Recomendação de entrega

| Opção | Quando usar |
|--------|-------------|
| **Este documento** | Alinhar equipas, QA e migração de dados — **entrega imediata**. |
| **Código espelhado (BookEditor por tipo)** | Só se o produto exigir paridade 1:1 com Base44 (`animated` / `interactive` / `digital` + `pages[]` legado). Implica migration Prisma, UI nova e possível convivência com `pages_v2`. |
| **API REST (já existe)** | Integrações e app infantil — estender schema só onde faltar (`book_type`, `quiz[]`, etc.). |

**Estado (2026-05-18):** fluxo por tipo implementado em `/books/new` + `/books/new/[bookType]` + `/books/[id]/edit-flow`. Assistente v2 e legado mantidos em paralelo (ver [`DECISOES.md`](./DECISOES.md)).

---

## 2. Fluxo EXATO — referência Base44 (`/admin/book/new`)

### 2.1 Acesso

| Camada | Regra |
|--------|--------|
| Base44 | `user.role === 'admin'` |
| UI extra | `localStorage.admin_session === 'true'` após modal (senha padrão UI `0000`; **não** confiar só no cliente) |
| Luditeca equivalente | JWT + `requireCmsEditor` → papéis `admin` \| `editor` ([`backend/src/plugins/auth.ts`](../../backend/src/plugins/auth.ts)); **sem** modal de senha local |

### 2.2 Rota e componente

- **Rota:** `/admin/book/new`
- **Componente:** `BookEditor`, `id === 'new'` → `isNew === true`

**Luditeca equivalente:**

| Passo | Rota | Componente |
|--------|------|------------|
| Assistente criação | `/books/new` | `pages/books/new.js` + hook [`useNewBookWizard.js`](../../frontend/hooks/useNewBookWizard.js) |
| Legado (não linkado) | `/books/new-legacy` | `EditorLayout` + Tailwind |
| Edição contínua | `/books/[id]/edit-v2` | `edit-v2.jsx` (Konva + `pages_v2`) |

### 2.3 Estado inicial do formulário (Base44)

```js
{
  title: '',
  description: '',
  age_range: '',
  category: 'infantil',
  pages: [],
  quiz: [],
  is_published: false,
  book_type: null,
}
```

**Luditeca no assistente (`useNewBookWizard`):**

| Campo Base44 | Luditeca hoje |
|--------------|----------------|
| `title`, `description` | Sim |
| `category` | `category_id` → relação `Category` (não enum fixo `infantil`) |
| `age_range` | Parcial: `catalog_level` (texto livre no catálogo / editor) |
| `pages[]` | Gerado após submit: legacy `pages` + `pages_v2` (capítulos ou PPTX) |
| `quiz[]` | **Não** no livro — quizzes em entidade `Activity` ou LIBRAS lesson |
| `is_published` | **`workflow_status: 'draft'`** (enum editorial) |
| `book_type` | **Não existe** no schema |

### 2.4 Seleção de tipo (obrigatória antes do editor)

Três valores **mutuamente exclusivos**, **imutáveis** após escolha no mesmo fluxo:

| `book_type` | UI |
|-------------|-----|
| `animated` | GIFs + texto + áudio/narração |
| `interactive` | Escolhas → caminhos |
| `digital` | E-book PDF ou EPUB |

**Luditeca:** não há ecrã de tipo; o modelo é **editor visual único** (`pages_v2` Konva) + import PPTX opcional no assistente. Tipos de página/atividade no canvas são outro conceito (`page_type`, atividades na app).

### 2.5 Upload de mídia

- Base44: `UploadFile({ file })` → persistir `file_url`.
- Luditeca: [`uploadFile`](../../frontend/lib/storageApi.js) / `POST /media/upload` (S3/MinIO); URLs em `cover_image`, elementos das páginas, etc.

### 2.6 Comportamento por tipo (Base44)

#### `animated`

- `pages[]`: upload múltiplo; ordenar ficheiros com `localeCompare` numérico no nome.
- Por página: `image_url`, `is_gif` (MIME gif), `text`, `page_type` default `reading`, `page_number` incremental.
- Reorder / remover páginas.
- Aba `soundtrack_url`.
- Aba quiz: `{ question, options[4], correct: índice }` no **livro**.

#### `interactive`

- `pages[]` como **cenas**: `scene_id` único, `text`, `image_url`, `choices[]` `{ label, target_scene_id }`, `is_start`, `is_ending`.
- Mesma aba quiz que `animated`.

#### `digital`

- `pdf_url`, `epub_url`, capa, metadados.
- `is_pdf: !!(pdf_url || epub_url)` no create.
- Sem abas páginas/quiz no mesmo padrão.

**Luditeca:**

- Conteúdo em **`pages_v2.pages[]`** (canvas: `nodes`, `background`, `meta.chapterId`).
- Outline editorial: capítulos em `pages_v2.outline.chapters` ([`bookFlowOutline.js`](../../frontend/lib/bookFlowOutline.js)).
- Anexos PDF/DOC no outline (`attachments`) — não equivalente direto a `book_type: digital`.
- Ramificação interativa: **não** modelada como `choices` / `target_scene_id` no schema atual.

### 2.7 Guardar (create)

Base44:

1. Validar `book_type` definido e `title.trim()` não vazio.
2. Payload = spread do estado; `is_pdf` se digital; **sem** `id`.
3. `Book.create(payload)`.
4. Navegar para `/admin`.

Luditeca:

1. Assistente valida título (passo metadados + submit final).
2. `POST /books` com `title`, `author_id`, `category_id`, `description`, `cover_image`, `pages`, `pages_v2`, `workflow_status: 'draft'`, opcional `import_session_id` ([`bookRoutes.ts`](../../backend/src/routes/bookRoutes.ts)).
3. Resposta com `id` → redirect **`/books/{id}/edit-v2`** (não `/admin`).

### 2.8 Publicação

| Base44 | Luditeca |
|--------|----------|
| `is_published: false` no create | `workflow_status: draft` (default Prisma) |
| Biblioteca infantil: `is_published === true` | App: `GET /app/books` só `workflow_status = published` ([`API-APP.md`](./API-APP.md)) |
| Toggle no AdminPanel | Hub `/admin` + lista `/books` — `WorkflowStatusSelect` |

---

## 3. Fluxo Luditeca — passo a passo (implementação atual)

```mermaid
flowchart TD
  A[Login JWT] --> B{role admin ou editor?}
  B -->|Não| C[Redirect /app ou /login]
  B -->|Sim| D[/books → Novo livro]
  D --> E[/books/new — assistente Argon]
  E --> F[Passo 0 Intro]
  F --> G[Passo 1 Metadados]
  G --> H[Passo 2 Capítulos]
  H --> I[Passo 3 PPTX opcional]
  I --> J[POST /books workflow_status draft]
  J --> K[/books/id/edit-v2 editor Konva]
  K --> L[PATCH /books até published]
  L --> M[GET /app/books visível na app]
```

### 3.1 Assistente `/books/new` (4 passos)

1. **Início** — explicação do fluxo.
2. **Metadados** — título*, autor, categoria, descrição, capa (`uploadFile` bucket `covers`).
3. **Capítulos** — títulos de secção; gera uma página vazia por capítulo em `pages_v2`.
4. **Conteúdo inicial** — import PPTX opcional (`importPptxForBook`); se importado, páginas vêm do PPTX e substituem estrutura de capítulos.

Hook partilhado: [`frontend/hooks/useNewBookWizard.js`](../../frontend/hooks/useNewBookWizard.js).

### 3.2 API `POST /books`

**Auth:** `Authorization: Bearer` + `requireCmsEditor`.

**Corpo (exemplo):**

```json
{
  "title": "Meu livro",
  "author_id": "1",
  "category_id": "2",
  "description": "…",
  "cover_image": "https://…/covers/…",
  "workflow_status": "draft",
  "pages": [ … legacy … ],
  "pages_v2": { "version": 2, "pages": [ … ], "outline": { "chapters": [ … ] } },
  "import_session_id": "opcional-se-pptx"
}
```

**Resposta:** livro criado com `id`; frontend redireciona para o editor v2.

### 3.3 Editor `/books/[id]/edit-v2`

- Canvas Konva, painéis v2, workflow, catálogo (personagens, coleção, keywords, nível).
- Publicação: alterar `workflow_status` para `published` (não `is_published`).

### 3.4 Leitura na app infantil

- `GET /app/books` — só `workflow_status = published`.
- `GET /app/books/:id` — 404 se não publicado.

---

## 4. Matriz de gaps (Base44 → Luditeca)

| Requisito Base44 | Estado Luditeca | Notas |
|------------------|-----------------|--------|
| `/admin/book/new` | `/books/new` | Rotas diferentes; mesmo papel CMS |
| Modal senha `admin_session` | Não portado | Decisão explícita |
| `book_type` imutável | Ausente | Requer enum + UI + migração |
| `pages[]` leitura/GIF/cenas | `pages` legacy + `pages_v2` | Modelos diferentes |
| Quiz no livro (`quiz[]`) | Atividades `/admin/activities` | Entidade separada |
| `soundtrack_url` | Não no Book | Poderia ir em JSON ou campo novo |
| `pdf_url` / `epub_url` / `is_pdf` | Anexos no outline | Parcial |
| `is_published` | `workflow_status` | Mapear `published` ↔ true |
| Redirect pós-create `/admin` | `/books/{id}/edit-v2` | Melhor para edição imediata |
| Filtro app `is_published` | `workflow_status = published` | Equivalente funcional |

---

## 5. API REST equivalente (hoje)

| Base44 | Luditeca |
|--------|----------|
| `Book.create` | `POST /books` |
| `Book.update` | `PATCH /books/:id` |
| `Book.list` / filter | `GET /books` (+ busca catálogo) |
| `UploadFile` | `POST /media/upload` (ver [`storageApi.js`](../../frontend/lib/storageApi.js)) |
| Listagem app | `GET /app/books`, `GET /app/books/:id` |

Papéis: ver [`ROTAS-E-PERMISSOES-LOGIN.md`](../ROTAS-E-PERMISSOES-LOGIN.md).

---

## 6. Se for necessário paridade Base44 (backlog técnico)

Ordem sugerida:

1. **Prisma:** `BookType` enum (`animated`, `interactive`, `digital`); campos opcionais `quiz` Json, `soundtrack_url`, `pdf_url`, `epub_url`, `is_pdf`, `age_range`, `category` enum ou manter FK `category_id`.
2. **API:** validar `book_type` no `POST /books`; rejeitar alteração de `book_type` no `PATCH` (imutável).
3. **UI:** ecrã de seleção de tipo antes do assistente ou substituir passo 0 de `/books/new`; ramificar editores ou abas conforme tipo.
4. **Migração:** livros existentes → `book_type: animated` + converter `pages_v2` apenas onde fizer sentido.

Até lá, usar **secção 3** como contrato oficial deste repositório.

---

## 7. Schema de referência Base44 (não persistido tal qual na Luditeca)

Entidade `Book` (Base44): `book_type`, `category` enum, `pages[]` com `page_type` (`reading`|`activity`|`painting`), `activity_type` opcional, `quiz[]` ao nível do livro.

Modelo Prisma atual: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) — modelo `Book` sem `book_type`; `pages` / `pages_v2` Json; `workflowStatus` enum editorial.
