# Evidências — Etapa 5.2 (indexação de catálogo e busca)

**Referência de requisito:** Etapa 5 — *Backend, armazenamento, busca, APIs e observabilidade*; subtarefa **5.2** — implementar indexação de catálogo e busca: por **título**, **personagem**, **coleção**, **palavra-chave** e **nível**; **atualizar o índice** sempre que um livro for **publicado** ou **alterado** (no modelo atual: em cada gravação relevante na API de livros).

**Repositório:** `luditeca-vps` (API Fastify + Prisma/PostgreSQL + CMS Next.js).

**Documentação relacionada:** [EVIDENCIAS-ETAPA-5.1.md](./EVIDENCIAS-ETAPA-5.1.md) (contratos gerais e modelo `Book` base).

---

## 1. Modelo de dados (extensão ao `Book`)

**Ficheiro:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) (modelo `Book`).

| Campo Prisma | Coluna SQL | Função |
|---------------|------------|--------|
| `catalogCharacters` | `catalog_characters` (JSONB) | Lista de **personagens** (array de strings). |
| `catalogCollection` | `catalog_collection` (TEXT) | Nome da **coleção** editorial. |
| `catalogKeywords` | `catalog_keywords` (JSONB) | **Palavras-chave** (array de strings). |
| `catalogLevel` | `catalog_level` (TEXT) | **Nível** / faixa (texto livre, ex.: “6º ano”). |
| `searchIndex` | `search_index` (TEXT, NOT NULL, default `''`) | **Índice denormalizado** (minúsculas): concatenação controlada pela aplicação para busca por subcadeia. |

O **título** e a **descrição** entram no índice via `buildSearchIndexText`, bem como o nome do **autor** (`authorRel`) e da **categoria** (`categoryRel`) no momento da persistência do índice.

---

## 2. Migração SQL e índice físico

**Pasta:** [`backend/prisma/migrations/20260428120000_book_catalog_search_index/`](../../backend/prisma/migrations/20260428120000_book_catalog_search_index/).

| Passo | Descrição |
|-------|-----------|
| `ALTER TABLE` | Cria as colunas acima. |
| `UPDATE` | Pré-preenche `search_index` a partir de `title` + `description` para linhas existentes com índice vazio. |
| `pg_trgm` | `CREATE EXTENSION IF NOT EXISTS pg_trgm` (trigramas para pesquisa por similaridade/subcadeia). |
| Índice GIN | `books_search_index_trgm_idx` em `search_index` com `gin_trgm_ops`. |

**Deploy:** a partir de `luditeca-vps/backend`, `npx prisma migrate deploy` (ou `migrate dev` em desenvolvimento). Em ambientes onde a extensão não puder ser criada pela aplicação, um DBA pode criar `pg_trgm` uma vez manualmente.

---

## 3. Lógica de indexação (atualização do índice)

**Ficheiro:** [`backend/src/lib/bookSearchIndex.ts`](../../backend/src/lib/bookSearchIndex.ts).

| Função | Papel |
|--------|--------|
| `buildSearchIndexText` | Monta o texto único em minúsculas a partir de título, descrição, autor, categoria, coleção, nível, personagens e palavras-chave. |
| `parseCatalogStringArrayFromBody` | Normaliza corpo JSON (array, string com vírgulas/ponto-e-vírgula) para arrays de strings nos handlers. |
| `persistBookSearchIndex(bookId)` | Lê o livro com `authorRel` e `categoryRel`, calcula o texto e faz `UPDATE` só do campo `searchIndex`. |

**Quando o índice é recalculado**

| Evento | Onde |
|--------|------|
| Criação de livro | Após `POST /books` (incluindo fluxo com `import_session_id` que atualiza páginas), **antes** da auditoria `EVT:BOOK_CREATE`. |
| Alteração de livro | Após `PATCH /books/:id` com `data` não vazio, **antes** da auditoria `EVT:BOOK_UPDATE`. |

Isto cumpre a regra de atualizar o índice em **qualquer alteração** persistida pelo PATCH (incluindo mudança para **publicado** via `workflow_status`) e na **criação**.

---

## 4. API de busca e contratos de escrita

### 4.1 `GET /books/search`

**Ficheiro:** [`backend/src/routes/bookRoutes.ts`](../../backend/src/routes/bookRoutes.ts) — registo **antes** de `GET /books/:id` para não capturar `id = "search"`.

**Autenticação:** `requireAuth` (mesmo nível que a listagem de livros).

**Query (todos opcionais exceto combinação livre):**

| Parâmetro | Efeito |
|-----------|--------|
| `q` | Palavras (separadas por espaço): cada token deve aparecer em `searchIndex` **ou** em `title` (AND entre tokens). |
| `character` | Subcadeia em `search_index` (personagens e resto do índice). |
| `collection` | `catalog_collection` **ou** `search_index` (contains, case insensitive). |
| `keyword` | Subcadeia em `search_index`. |
| `level` | `catalog_level` **ou** `search_index`. |
| `limit` | Máximo 100, default 50. |
| `offset` | Paginação. |

**Resposta:** `{ data, total, limit, skip }` — cada item em `data` é o mesmo formato “cartão” que `bookResponse`, **sem** `pages` / `pages_v2` (listagem leve).

### 4.2 `POST` / `PATCH` `/books`

Aceita (snake_case ou camelCase espelhado no corpo):

- `catalog_characters` / `catalogCharacters`
- `catalog_keywords` / `catalogKeywords`
- `catalog_collection` / `catalogCollection`
- `catalog_level` / `catalogLevel`

Valores `null` nos campos de catálogo limpam JSON/texto conforme o handler.

---

## 5. CMS (frontend)

| Ficheiro | Função |
|----------|--------|
| [`frontend/lib/books.js`](../../frontend/lib/books.js) | `searchBooks(params)` → `GET /books/search?…`. |
| [`frontend/lib/apiNormalize.js`](../../frontend/lib/apiNormalize.js) | `normalizeBook`: `catalog_*`, `category`. |
| [`frontend/pages/books/index.js`](../../frontend/pages/books/index.js) | Debounce ~400 ms: sem filtros usa `getBooks()`; com texto ou filtros avançados usa `searchBooks()`; UI de filtros (personagem, coleção, palavra-chave, nível). |
| [`frontend/pages/books/[id]/edit-v2.jsx`](../../frontend/pages/books/[id]/edit-v2.jsx) | Aba **Informações** → bloco “Catálogo e busca”; envio no `PATCH` via `updateBook`; rascunho local inclui os mesmos campos. |

---

## 6. Checklist manual

1. Aplicar migrações na base PostgreSQL.
2. No CMS, abrir um livro → **Informações** → preencher coleção, nível, palavras-chave e personagens → **Salvar projeto**.
3. Em **Gerenciar livros**, usar a barra de busca e/ou filtros avançados e confirmar que o livro aparece conforme os termos.
4. Alterar `workflow_status` para **Publicado** e guardar; repetir busca (o índice deve refletir título/descrição/campos de catálogo inalterados ou atualizados).
5. (Opcional) `curl`/Insomnia com `GET /books/search?q=…&character=…` e token JWT.

---

## 7. Limitações e melhorias futuras

- A busca por `q` usa operadores Prisma `contains` + `mode: insensitive` (compatível com o índice trigram em PostgreSQL; não é full-text `tsvector` com ranking).
- **Personagem** como filtro dedicado usa subcadeia no `search_index` (não há coluna invertida só para personagens).
- Livros alterados **fora** desta API (SQL direto) não atualizam o índice até ao próximo `PATCH`/`POST` pela API ou job de manutenção.
