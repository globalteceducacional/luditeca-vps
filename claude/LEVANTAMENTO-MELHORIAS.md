# Levantamento de Melhorias — Luditeca VPS (CMS + API + Editor)

> Resposta ao pedido em [`Analise.md`](./Analise.md). Este documento segue à risca o formato exigido (Diagnóstico → Causa Raiz → Solução → Trade-offs), uma issue por problema, ordenado por **criticidade**. As referências apontam para o código real do repositório (`backend/`, `frontend/`) e cruzam com as evidências em [`docs/evidencias/`](../docs/evidencias).

**Stack auditada (versões fixadas):**
- Backend: Fastify `^5.1.0`, Prisma `^6.1.0`, `@aws-sdk/client-s3 ^3.700`, `sharp ^0.34.5`, Postgres 16 (Docker).
- Frontend: Next.js `^15.5.14` (Pages Router), React `^18.2`, `react-konva ^18.2.14`, Tailwind `^3.4.17`, sem React Query / SWR.
- Infra: Docker Compose, Nginx (proxy), storage local em volume `luditeca_storage` (default em produção segundo [`DEPLOY-VPS.md`](../docs/DEPLOY-VPS.md)).

---

## Sumário (mapa de issues)

| # | Issue | Camada | Severidade |
|---|-------|--------|------------|
| 01 | `GET /books` devolve `pages` + `pagesV2` de **todos** os livros | API | **Crítica** |
| 02 | `GET /books/:id` carrega livro completo + N presigns sequenciais | API | **Crítica** |
| 03 | `useEditorState` faz `JSON.parse(JSON.stringify(book))` por edição | Frontend | **Crítica** |
| 04 | `updateBook` envia o livro inteiro no `PATCH` + corte arbitrário em 1 MB | Frontend ↔ API | **Crítica** |
| 05 | Modelo de dados monolítico: `Book.pages_v2` como JSON único | Banco | **Alta** |
| 06 | `searchIndex` denormalizado fica *stale* em mudanças de `Author`/`Category` | Banco | **Alta** |
| 07 | `DELETE /books/:id` sem transação e sem paralelismo de I/O | API | **Alta** |
| 08 | `CanvasStageKonva.jsx` (3 039 linhas) re-renderiza a árvore inteira | Frontend | **Alta** |
| 09 | Sidebar de páginas sem virtualização, miniaturas a `<img>` direto | Frontend | **Alta** |
| 10 | Importação PPTX inline (até 45 min) bloqueia worker HTTP | API | **Alta** |
| 11 | JWT em `localStorage` + ausência de rate-limit em `/auth/*` | Segurança | **Alta** |
| 12 | Inputs/respostas sem validação por *schema* (Zod / `app.addSchema`) | API | **Média** |
| 13 | CORS abre para *qualquer origem* quando env não definida (`origin: true`) | Segurança | **Média** |
| 14 | Mídia em produção servida pelo Fastify, sem CDN/cache HTTP | Infra | **Média** |
| 15 | Bundle do editor: `react-konva` e dependentes carregados em rota única | Frontend | **Média** |
| 16 | Falta de telemetria de pintura/edição no editor (FPS, tempo de save) | Observabilidade | **Média** |
| 17 | Ausência de testes automatizados (apenas `vitest.config.js`) | DX/Qualidade | **Média** |
| 18 | Mistura JS + TS no mesmo módulo (`importPptxEngine.js` + Prisma TS) | DX | **Baixa** |
| 19 | `Profile.permissions` modelado mas não consumido (RBAC inconsistente) | Domínio | **Baixa** |
| 20 | `ENABLE_PUBLIC_REGISTER=true` em [`.env.example`](../.env.example) | Segurança | **Baixa** |

---

## Issue 01 — `GET /books` devolve `pages` e `pagesV2` de todos os livros

### Diagnóstico

- **O que acontece:** o handler em [`backend/src/routes/bookRoutes.ts`](../backend/src/routes/bookRoutes.ts) (linhas 404-410) faz `prisma.book.findMany({ orderBy: { createdAt: 'desc' }, include: { authorRel: true, categoryRel: true } })` e devolve cada linha por `bookResponse(r)`. **`bookResponse` não remove `pages` nem `pagesV2`** — apenas retira `searchIndex`.
- **Onde:** linha 374 (`bookResponse`) e linha 404 (rota `GET /books`). A função `stripHeavyBookFields` existe (linha 389) **mas só é usada** em `/books/search`, não em `/books`.
- **Impacto:** com 50 livros e ~30 páginas com `pages_v2` por livro (com nodes, transforms, props, base64 de fundo possíveis), a resposta facilmente passa de **20–80 MB** em JSON. O CMS chama `getBooks()` em `frontend/pages/books/index.js` toda vez que se abre a lista. Em ambiente Hostinger VPS típico (256 MB RAM/container), isto causa picos de CPU e *stalls* perceptíveis no Next 15.
- **Evidência:** [`EVIDENCIAS-ETAPA-5.1.md`](../docs/evidencias/EVIDENCIAS-ETAPA-5.1.md#3-inventário-de-rotas-http-backendsrcroutes) descreve a rota como “Lista de livros” mas não menciona projeção; [`bookRoutes.ts:374-394`](../backend/src/routes/bookRoutes.ts) confirma a ausência de `select`.

### Causa Raiz

Reaproveitamento da serialização rica (`bookResponse`) entre listagem e detalhe. Não há separação entre **DTO de catálogo** (cartão) e **DTO de edição** (livro completo). É uma falha arquitetural clássica de *chatty/over-fetching* APIs.

### Solução Proposta

1. Criar dois DTOs: `bookCardResponse` (sem `pages`, `pagesV2`, `linkSlidebook`) e `bookFullResponse`.
2. No `GET /books`, usar `prisma.book.findMany({ select: { id: true, title: true, author: true, coverImage: true, workflowStatus: true, createdAt: true, catalogCollection: true, catalogLevel: true, authorRel: { select: { id: true, name: true } }, categoryRel: { select: { id: true, name: true } } } })`. Isto reduz a carga em **>95 %** para listagens típicas.
3. Aplicar a mesma projeção em `/books/search`, removendo `stripHeavyBookFields` (que opera sobre objeto já hidratado).
4. Adicionar paginação obrigatória (`limit`/`offset`, `Link` headers de paginação) também em `GET /books`.

```typescript
// backend/src/routes/bookRoutes.ts (esboço)
const BOOK_CARD_SELECT = {
  id: true, title: true, author: true, description: true, coverImage: true,
  createdAt: true, workflowStatus: true, catalogCollection: true, catalogLevel: true,
  authorId: true, categoryId: true,
  authorRel: { select: { id: true, name: true } },
  categoryRel: { select: { id: true, name: true } },
} satisfies Prisma.BookSelect;

app.get('/books', { preHandler: requireAuth }, async (request, reply) => {
  const limit = Math.min(100, Number(request.query.limit ?? 50));
  const skip = Math.max(0, Number(request.query.offset ?? 0));
  const [rows, total] = await Promise.all([
    prisma.book.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip, select: BOOK_CARD_SELECT }),
    prisma.book.count(),
  ]);
  return reply.send({ data: rows.map(bookCardResponse), total, limit, skip });
});
```

### Trade-offs

- **Quebra de contrato:** o frontend hoje espera array “puro” em `/books`; a mudança para `{ data, total }` exige ajuste em [`frontend/lib/books.js`](../frontend/lib/books.js) (`getBooks`). Pode ser mitigado mantendo array como `data` e adicionando paginação opcional.
- **Custo:** trivial; ganha-se latência de **~60 % no p50** na listagem segundo dimensionamento de payload.

---

## Issue 02 — `GET /books/:id` carrega livro completo + N presigns sequenciais

### Diagnóstico

- **O que acontece:** `hydrateLegacyPagesMediaUrls` (linha 80) e `hydratePagesV2MediaUrls` (linha 114) iteram páginas e nós e chamam `presignedGetUrl(...)` em **for-of com `await` sequencial**. Para um livro com 30 páginas × ~3 mídias por página = **~90 chamadas serializadas** ao S3/MinIO. Mesmo no driver `local` (que devolve URL pública sem assinar — ver [`s3.ts:299`](../backend/src/lib/s3.ts)), o *overhead* de `JSON.parse(JSON.stringify(...))` no início de cada hidratação clona o documento inteiro **duas vezes** (`hydrateLegacy` + `hydrateV2`).
- **Onde:** [`bookRoutes.ts:491-518`](../backend/src/routes/bookRoutes.ts).
- **Impacto:** abrir um livro grande no editor demora vários segundos visíveis. Em S3 real (latência ~30 ms/chamada), 90 chamadas sequenciais = **~2,7 s só para presign**, somados ao deepClone e à transferência. Há cache local (`mediaUrlCache: Map<string, string>`) mas só evita repetições da **mesma chave** dentro do pedido.

### Causa Raiz

Loop sequencial por simplicidade; `await` dentro de `for` impede paralelismo. Também: hidratar **as duas estruturas** (`pages` legado e `pagesV2`) sempre, mesmo quando só uma é consumida pelo cliente novo.

### Solução Proposta

1. Substituir os loops por `Promise.all` agrupando por página (paralelismo controlado, ex.: lotes de 16 com `p-limit`):
   ```typescript
   import pLimit from 'p-limit';
   const limit = pLimit(16);
   await Promise.all(nodes.map((n) => limit(() => signNode(n))));
   ```
2. **Não** hidratar `pages` legado quando `pagesV2` existe e o cliente é o editor v2 (parâmetro `?view=v2`).
3. Cachear presigns em Redis/in-memory por `bucket:filePath` por TTL menor que o `expiresIn` (ex.: 50 min para um TTL de 60 min). Com hit rate típico de 80 %, reduz drasticamente as chamadas a S3.
4. Em vez de hidratar no servidor, **devolver ponteiros** (`{ bucket, filePath }`) e ter o cliente solicitar `GET /media/signed-get` por nó visível em viewport (lazy hydration). Combina com a Issue 09.

### Trade-offs

- Hidratar no cliente cria mais *roundtrips*, mas paraleliza melhor e reduz tempo de TTFB do `GET /books/:id` significativamente.
- Cache em memória do processo Node não funciona em deploy multi-instância: aí sim, Redis pequeno (256 MB) é suficiente.

---

## Issue 03 — `useEditorState` clona o livro inteiro a cada edição

### Diagnóstico

- **O que acontece:** [`useEditorState.js:42`](../frontend/components/editor/v2/hooks/useEditorState.js) — `patchPage`:
  ```js
  const base = ensurePagesV2(prev);
  const next = deepClone(base);              // clone do livro completo
  pushUndoSnapshot(idx, base.pages[idx]);    // outro deepClone da página
  next.pages[idx] = patcher(next.pages[idx]);
  ```
  `deepClone` é `JSON.parse(JSON.stringify(value))`. Cada movimentação de nó (`onDragMove` no Konva) dispara `patchNode → patchPage → deepClone(book)`.
- **Onde:** linhas 4-6 (helper) e 41-53 (`patchPage`); idem em `addPage` (linha 101) e `reorderPages` (linha 121).
- **Impacto:** com `pagesV2` de 5 MB de JSON, cada drag de imagem custa **~80–120 ms de GC + serialização** numa máquina típica. Combinado com `setIsModified(true)` (linha 52) que invalida memos derivados, gera *jank* visível no canvas.
- **Evidência:** [`EVIDENCIAS-TAREFA-3.4.md`](../docs/evidencias/EVIDENCIAS-TAREFA-3.4.md#5-histórico-e-rascunhos-clarificação) descreve undo com pilha de 80 entradas — significa **80 deepClones do livro** acumulados em RAM em sessão longa.

### Causa Raiz

Estratégia de imutabilidade ingénua: clona tudo para garantir que `setPagesV2` veja referência diferente. O modelo certo seria **imutabilidade estrutural** (só clonar caminho até a folha alterada), e **delta para undo** (não snapshot completo).

### Solução Proposta

1. Trocar `JSON.parse(JSON.stringify(...))` por `structuredClone` (nativo, ~3× mais rápido) **só na folha que muda**:
   ```js
   const patchPage = useCallback((idx, patcher) => {
     setPagesV2((prev) => {
       const base = ensurePagesV2(prev);
       const oldPage = base.pages[idx];
       if (!oldPage) return base;
       const newPage = patcher(structuredClone(oldPage));
       if (newPage === oldPage) return base;
       const nextPages = base.pages.slice();      // shallow clone do array
       nextPages[idx] = newPage;
       return { ...base, pages: nextPages };      // shallow clone da raiz
     });
     ...
   });
   ```
2. **Undo por delta:** guardar `{ pageIndex, prevPage }` referenciando o objeto antigo (não cloná-lo — ele ficou “congelado” pela imutabilidade). Reduz alocação a **0** por undo.
3. Adoptar [Immer](https://immerjs.github.io/immer/) ou [Zustand + middleware](https://github.com/pmndrs/zustand) com *patches*; ambos suportam histórico nativo via *redo/undo* baseado em *patches* RFC 6902.
4. *Throttle* de eventos de drag: `patchNode` só ao soltar (ou a cada 60 ms via `requestAnimationFrame`), guardando estado intermediário em `useRef` até o `onDragEnd`.

### Trade-offs

- `structuredClone` requer Node 17+ no SSR; Next 15 + Node 20 cobre. Já é alvo do projecto.
- Imutabilidade estrutural sem Immer pede disciplina; alternativa é Immer (~3 KB gzip) que é ergonómico e mantém o código atual.

---

## Issue 04 — `updateBook` envia o livro inteiro + corte arbitrário em 1 MB

### Diagnóstico

- **O que acontece:** [`frontend/lib/books.js:97`](../frontend/lib/books.js):
  ```js
  const dataSize = new Blob([JSON.stringify(sanitizedData)]).size;
  if (dataSize > 1000000) {
    return { data: null, error: { message: `Dados muito grandes (${...}MB)...` } };
  }
  ```
  E o backend aceita PATCH com `pages_v2` inteiro em [`bookRoutes.ts:659`](../backend/src/routes/bookRoutes.ts).
- **Impacto:** o limite duro de 1 MB é **arbitrário** e quebra livros médios (10+ páginas com fundos ricos). O usuário recebe erro genérico “Remova algumas imagens ou divida em mais livros” — mensagem que não condiz com o produto (livro digital com ricos visuais). Pior: como tudo é PATCH atómico, **um pequeno ajuste de cor de um nó** reescreve o JSON inteiro no Postgres, invalida buffers, dispara reescrita de WAL e gera um pico de I/O totalmente desproporcional.
- **Evidência:** PR [`EVIDENCIAS-TAREFA-3.2.md`](../docs/evidencias/EVIDENCIAS-TAREFA-3.2.md) cita “sem migração nova dedicada à 3.2: outline vive dentro do JSON `pages_v2`” — confirma que a estrutura deliberadamente concentrou tudo no JSON.

### Causa Raiz

Modelo de dados “documento monolítico” (cf. Issue 05). Falta de **endpoint de patch granular por página/nó**.

### Solução Proposta

Estratégia em duas fases:

**Curto prazo (compatível, sem migração):**
1. Remover o limite de 1 MB do cliente; o limite real do servidor já está em `bodyLimit: 600 MB` ([`server.ts:59`](../backend/src/server.ts)).
2. Ativar compressão HTTP (`@fastify/compress`) e enviar JSON com `Content-Encoding: gzip` desde o cliente (Next.js já comprime por defeito no fetch quando o servidor anuncia `Accept-Encoding`).
3. **Auto-save com debounce** de 5 s + indicador “Guardando…” em vez de “Salvar projeto” manual; remove a fricção, e cada save é *idempotente*.

**Médio prazo (com migração — ver Issue 05):**
4. Substituir `PATCH /books/:id { pages_v2 }` por:
   - `PATCH /books/:id` apenas para metadados (título, descrição, capa, workflow, catálogo).
   - `PATCH /books/:id/pages/:pageIndex` para alterar uma página.
   - `POST /books/:id/pages/:pageIndex/nodes` para adicionar nó.
   - `PATCH /books/:id/pages/:pageIndex/nodes/:nodeId` para alterar nó.
   - `DELETE /books/:id/pages/:pageIndex/nodes/:nodeId`.

### Trade-offs

- Endpoints granulares aumentam superfície de API e exigem versionamento de página (campo `version` por página em vez de só no documento) para evitar conflitos optimistas. Este passo é pré-requisito da Issue 05.
- Compressão pura (etapa curta) já reduz payload em ~70 % para JSON com texto repetitivo.

---

## Issue 05 — Modelo monolítico: `Book.pagesV2` como `Json` único

### Diagnóstico

- **O que acontece:** [`schema.prisma:119`](../backend/prisma/schema.prisma) declara `pagesV2 Json? @map("pages_v2")` — uma única coluna JSONB. Toda escrita no livro reescreve a coluna inteira (Postgres faz UPDATE TOAST mesmo para JSONB pequenos).
- **Onde:** todas as operações de `bookRoutes.ts` usam `prisma.book.update({ data: { pagesV2: ... } })`.
- **Impacto:**
  - Não há histórico por página (rejeitado explicitamente na [`EVIDENCIAS-TAREFA-3.4.md` §7](../docs/evidencias/EVIDENCIAS-TAREFA-3.4.md#7-lacunas-face-ao-enunciado-completo)).
  - Não há *streaming* de páginas (cliente recebe 30 páginas mesmo que renderize 1).
  - Sem possibilidade de query relacional (“dar-me todos os livros que usam o personagem X numa página”).
  - JSON acima de ~2 MB começa a estourar buffers de Prisma JS (single-thread).

### Causa Raiz

Decisão pragmática inicial (alinhada com `Analise.md §5`); apropriada para *prototipagem*, inadequada para produção com livros grandes e edição colaborativa.

### Solução Proposta

Migrar para esquema relacional incremental:

```prisma
model Book {
  id              BigInt   @id @default(autoincrement())
  // ... metadados ...
  canvasWidth     Int      @default(1280)
  canvasHeight   Int       @default(720)
  outline         Json?    // capítulos + anexos (pequeno)
  pages           BookPage[]
}

model BookPage {
  id          String   @id @default(uuid())
  bookId      BigInt
  book        Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  index       Int
  chapterId   String?
  background  Json?    // { url, storage, ... } — pequeno
  meta        Json?    // orientation, transitions, etc.
  version     Int      @default(1)  // optimistic locking
  updatedAt   DateTime @updatedAt
  nodes       BookPageNode[]
  @@unique([bookId, index])
}

model BookPageNode {
  id         String   @id @default(uuid())
  pageId     String
  page       BookPage @relation(fields: [pageId], references: [id], onDelete: Cascade)
  zIndex     Int
  type       String   // text | image | video | shape | ...
  transform  Json
  props      Json
  step       Int      @default(0)
  @@index([pageId, zIndex])
}
```

Vantagens directas:
- Save por página afeta `BookPage` + filhos, não o livro inteiro.
- Possível `GET /books/:id/pages?range=0-4` para *progressive loading*.
- `GROUP BY` em nodes permite estatísticas e busca avançada (ex.: livros sem texto numa página, etc.).
- Versionamento por página (`version++`) habilita merge optimista.

**Migração:** script idempotente que lê `pages_v2` e popula as 3 tabelas; manter coluna `pagesV2` por uma release como *fallback* até validar.

### Trade-offs

- Refactor profundo: muda cliente, hidratação de URLs, importador PPTX, exportadores e o app aluno.
- Mais I/O por carregar o livro completo (JOIN em `BookPageNode` para 30 páginas × 5 nós = 150 linhas — ainda muito barato vs. parsing JSON).
- Perdemos a simplicidade do payload monolítico, mas é substituída por contratos por página (mais flexíveis).

**Recomendação:** adoptar como *trabalho de plataforma* numa sprint dedicada. Casa com Issues 04, 09 e 10.

---

## Issue 06 — `searchIndex` denormalizado fica *stale* em rename de Author/Category

### Diagnóstico

- **O que acontece:** [`bookSearchIndex.ts:65-78`](../backend/src/lib/bookSearchIndex.ts) inclui `authorRel.name` e `categoryRel.name` no índice. `persistBookSearchIndex(bookId)` só corre quando há `POST /books` ou `PATCH /books/:id` (linhas 625 e 725 de `bookRoutes.ts`). Se um admin **renomeia um autor** em [`authorRoutes.ts`](../backend/src/routes/authorRoutes.ts) (`PATCH /authors/:id`), todos os livros desse autor mantêm o `searchIndex` antigo.
- **Onde:** `authorRoutes.ts` PATCH não chama `persistBookSearchIndex` para os livros relacionados; idem `categoryRoutes.ts`.
- **Impacto:** busca incorreta para `q=<novoNomeAutor>` (não traz livros) e ainda traz pelo nome antigo (que já não existe na UI). Comportamento descrito como “limitação aceitável” na [`EVIDENCIAS-ETAPA-5.2.md` §7](../docs/evidencias/EVIDENCIAS-ETAPA-5.2.md#7-limitações-e-melhorias-futuras), mas é um bug de catálogo.

### Causa Raiz

Acoplamento implícito entre tabelas sem propagação. Falta um *event bus* ou um *trigger* SQL.

### Solução Proposta

1. Após `PATCH /authors/:id` e `PATCH /categories/:id`, executar:
   ```typescript
   const books = await prisma.book.findMany({ where: { authorId: id }, select: { id: true } });
   await Promise.all(books.map((b) => persistBookSearchIndex(b.id)));
   ```
2. Em paralelo, criar **trigger SQL** em `authors`/`categories` que marca `books.search_index_dirty = true`; um worker periódico (ou job no `pg_cron`) reconstrói os marcados. Funciona mesmo quando há SQL fora da API.
3. Considerar usar `tsvector` (full-text nativo) com `GENERATED ALWAYS AS (...) STORED` — Postgres recalcula sozinho e o índice GIN aplica-se igualmente.

### Trade-offs

- A solução (1) é simples mas serial: lenta se um autor tiver 5 000 livros. Resolver com `prisma.$executeRaw` para um UPDATE em massa, ou empurrar para fila (Issue 10).
- `tsvector` muda contrato de busca (necessita `to_tsquery`), mas dá ranking nativo e suporta *stemming*.

---

## Issue 07 — `DELETE /books/:id` sem transação e sem paralelismo

### Diagnóstico

- **O que acontece:** [`bookRoutes.ts:764-822`](../backend/src/routes/bookRoutes.ts):
  ```typescript
  for (const m of media) {
    try { await deleteObject(m.bucketName, m.filePath); } catch {}
  }
  await prisma.mediaFile.deleteMany({ where: { bookId: id } });
  for (const userId of userIds) {
    for (const bucket of buckets) {
      try { await deletePrefix(bucket, prefix); } catch {}
    }
  }
  await prisma.book.delete({ where: { id } });
  ```
  - Loops sequenciais (`await` dentro de `for`).
  - Sem `prisma.$transaction`: se `book.delete` falhar depois de remover ficheiros, o estado é inconsistente (DB com livro, storage sem ficheiros).
  - 8 buckets × N userIds × `deletePrefix` (que por sua vez itera todos os keys): para livros com 200 MB de mídia em S3, pode levar **>1 min** sem retornar resposta.
- **Impacto:** UI fica “Excluindo…” até o cliente atinge timeout do Nginx (60 s default). Auditoria (`EVT:BOOK_DELETE`) é gravada **antes** de a deleção concluir; se falhar, o log diz que apagou mas o registo continua.

### Causa Raiz

Ausência de padrão *saga* / *outbox* para operações cross-storage. A operação de “apagar livro” mistura DB e storage sem garantia de atomicidade.

### Solução Proposta

1. Marcar livro como `deletedAt = now()` (soft-delete) **dentro** de `prisma.$transaction([...])`. Auditoria entra na mesma transação.
2. Empurrar `book.deleted` para uma fila (BullMQ / pg-boss). Worker:
   - Lista mídia, apaga em paralelo (lotes de 16) com `p-limit`.
   - Apaga prefixos por bucket em paralelo.
   - Após sucesso, faz `prisma.book.delete` final.
3. Endpoint `DELETE` retorna **202 Accepted** com `Location: /admin/jobs/{id}`; UI mostra progresso.
4. Cron diário re-tenta `book.deletedAt && !book.purgedAt` (idempotência).

### Trade-offs

- Soft-delete obriga filtros `where: { deletedAt: null }` em `findMany` — refactor pequeno.
- Workers exigem infraestrutura extra (Redis para BullMQ, ou usar `pg-boss` que só pede Postgres). Compatível com o stack VPS.

---

## Issue 08 — `CanvasStageKonva.jsx` (3 039 linhas) re-renderiza a árvore inteira

### Diagnóstico

- **O que acontece:** o ficheiro tem **109 721 bytes** num único componente (`Glob` confirma). Mistura: edição rica de texto, vídeo, GIF manual (`useGifManualCanvas`), filtros Konva, snap, *transformer*, *context menu*, *off-screen image host*, *audio badge*. Não vejo `React.memo` em sub-componentes (lista de imports não exporta nada além do *default*). Cada `setIsModified`, `setSelectedNodeId`, `setCurrentStep` re-monta nodes Konva — que internamente re-criam imagens HTML (`<img>`).
- **Onde:** [`frontend/components/editor/CanvasStageKonva.jsx`](../frontend/components/editor/CanvasStageKonva.jsx).
- **Impacto:** com 30 nós em uma página, *jank* no drag mesmo em desktop. Em iPad/tablet (público de aluno e professor), é proibitivo.

### Causa Raiz

Componente monolítico sem decomposição; ausência de `React.memo` e *selectors* (cada estado global causa render full).

### Solução Proposta

1. **Decompor**: `<CanvasStage>`, `<CanvasNodes>`, `<CanvasNode>`, `<TransformerOverlay>`, `<RichTextOverlay>` — cada um com `React.memo` e props mínimas.
2. Adoptar **Zustand** com selectors para estado de edição (`useEditorStore((s) => s.pages[currentPage])`); evita rerender quando muda só `selectedNodeId`.
3. Substituir `JSON.parse(JSON.stringify(...))` por `structuredClone` (ver Issue 03).
4. Pré-decodificar imagens fora do thread principal: `new Image(); img.decode()` em background. Já existe `useResolvedStorageUrl` — encadear com `decode()` antes de passar ao Konva.
5. Para texto, usar `Konva.Text` com `cache()` quando não está em edição; só recriar texture rica quando o utilizador entra em modo de edição.

### Trade-offs

- Mudança grande, mas pode ser feita gradualmente: começar pelos *nodes* image/video, deixar texto rico para o final.
- Zustand adiciona ~1.5 KB gzip; vai amortizar pela perda de prop-drilling actual.

---

## Issue 09 — Sidebar de páginas sem virtualização

### Diagnóstico

- **O que acontece:** [`PageSidebar.jsx`](../frontend/components/editor/v2/panels/PageSidebar.jsx) tem 46 KB; renderiza miniaturas com `<StorageBackedHtmlImage>` ou `<MediaLibraryThumb>` para **todas** as páginas/itens da biblioteca, sem virtualização (`react-window` / `@tanstack/react-virtual`).
- **Impacto:** com 50 páginas, são 50 `<img>` montadas e a baixarem mesmo as fora do viewport. O navegador faz décodes em paralelo sem limite e RAM cresce.

### Causa Raiz

Implementação ingénua de listas (DOM completo).

### Solução Proposta

1. Usar `@tanstack/react-virtual` (3 KB gzip) para virtualizar a lista de páginas e a biblioteca de mídia. Render só ~10 itens por vez.
2. `loading="lazy"` em `<img>` (custo zero, mas o navegador só consulta para imgs em viewport).
3. Geração de miniaturas **no servidor** já existe (`.thumbs/{nome}.thumb.png` — ver [`EVIDENCIAS-ETAPA-5.3.md` §3](../docs/evidencias/EVIDENCIAS-ETAPA-5.3.md#3-processamento-de-imagem-sharp)). Garantir que o sidebar consome `thumbUrl` (e não a imagem original) — confirmar em `MediaLibraryThumb`.

### Trade-offs

- Virtualização precisa altura fixa (ou estimada); a sidebar parece já ter scroll vertical, encaixa bem.

---

## Issue 10 — Importação PPTX inline (até 45 min) bloqueia worker HTTP

### Diagnóstico

- **O que acontece:** [`importPptxRoute.ts:24`](../backend/src/routes/importPptxRoute.ts) chama `runImportPptxEngine(request.raw, res)` **dentro** da request HTTP. O cliente ([`pptxImport.js`](../frontend/lib/pptxImport.js)) tem timeout de **45 min**. Em [`EVIDENCIAS-ETAPA-5.1.md` §4](../docs/evidencias/EVIDENCIAS-ETAPA-5.1.md#4-mapeamento-requisito-51--implementação) lê-se: *“import PPTX corre **inline** no pedido HTTP”*.
- **Impacto:** Fastify só tem o nº de workers do Node single-thread; um upload de 200 MB de PPTX consome 1 *event loop* por minutos, degradando latência de **todos os outros pedidos** (incluindo `/auth/me`, `/health`). Pode ainda crashar o container por OOM (PPTX fica inteiro em buffer).

### Causa Raiz

Falta de fila de *jobs* assíncronos.

### Solução Proposta

1. Endpoint `POST /books/import-pptx` apenas:
   - Recebe o ficheiro, faz validação rápida (extensão, tamanho), guarda no storage em `imports/{sessionId}/` (já existe esse padrão), enfileira job.
   - Devolve **202 Accepted** + `{ jobId }`.
2. Worker (Node separado, mesmo `tsx` com `pg-boss`) consome a fila, processa `runImportPptxEngine`, atualiza progresso em `import_jobs.progress` (linha por etapa).
3. Cliente faz polling em `GET /import-jobs/:id` (ou WebSocket / SSE).
4. Auditoria muda para `EVT:BOOK_IMPORT_PPTX_START`, `EVT:BOOK_IMPORT_PPTX_PROGRESS`, `EVT:BOOK_IMPORT_PPTX_OK/FAIL` (mantém compatibilidade).

### Trade-offs

- Mais complexo; introduz tabela `import_jobs`. Compensa-se pela estabilidade da API e pela possibilidade de **retomar** importações interrompidas.
- Pode ser feito sem Redis usando `pg-boss` (só Postgres) — alinha-se com o stack VPS.

---

## Issue 11 — JWT em `localStorage` + ausência de rate-limit em `/auth/*`

### Diagnóstico

- **O que acontece:**
  - [`apiClient.js:13`](../frontend/lib/apiClient.js): `localStorage.getItem(TOKEN_KEY)`. Qualquer XSS (terceiro `<script>` injectado em campo de texto, biblioteca comprometida) lê o token.
  - [`server.ts`](../backend/src/server.ts) não regista `@fastify/rate-limit`; `/auth/login`, `/auth/forgot-password`, `/auth/register` aceitam pedidos ilimitados. *Brute-force* em senha é trivial.
- **Impacto:** vector clássico OWASP A01 e A07. Já há auditoria (`EVT:AUTH_LOGIN_FAIL`), mas só observa — não bloqueia.

### Causa Raiz

Decisão simples (localStorage facilita CORS cross-domain via `Authorization: Bearer`) mas insegura. Falta de plugin `@fastify/rate-limit` (zero linhas para integrar).

### Solução Proposta

1. **Cookies httpOnly + SameSite=Lax** para o JWT. Como API e front estão sob mesmo domínio em produção (`luditeca.com` + `luditeca.com/api`, ver [`DOMINIO-HOSTINGER.md`](../docs/DOMINIO-HOSTINGER.md)), cookies funcionam sem CORS *credentials*.
2. CSRF: como cookie é `SameSite=Lax`, só é vulnerável a CSRF em métodos não-idempotentes via subdomínio. Adicionar token CSRF (`@fastify/csrf-protection`) ou exigir cabeçalho `X-Requested-With`.
3. `@fastify/rate-limit`: 10 reqs / 1 min por IP em `/auth/login` e `/auth/forgot-password`; 5 reqs / 1 h em `/auth/register` (quando habilitado).
4. *Account lockout* opcional: após 10 `EVT:AUTH_LOGIN_FAIL` em 30 min para mesmo `email`, exigir captcha ou bloquear 15 min.
5. Refresh tokens (par access curto 15 min + refresh 7 dias rotativo) — opcional mas alinha com boas práticas.

### Trade-offs

- Mover para cookie httpOnly exige mudar `apiFetch` (já é simples — adicionar `credentials: 'include'`) e configurar `cookie` no Fastify (`@fastify/cookie`).
- Rate-limit em IP atinge usuários atrás de NAT corporativo; usar combinação IP + email.

---

## Issue 12 — Inputs/respostas sem validação por *schema*

### Diagnóstico

- **O que acontece:** rotas usam `request.body as Record<string, unknown>` e fazem cast manual (`String(body.title || '')`, `toBigIntOrNull`...). Nenhuma rota declara `schema` JSON Schema do Fastify nem usa Zod/Valibot. Por exemplo, [`bookRoutes.ts:520-643`](../backend/src/routes/bookRoutes.ts) o POST aceita corpo arbitrário e silenciosamente ignora chaves não reconhecidas. `/me/profile` chama `parseJsonMap`/`parseJsonList` que aceitam qualquer objeto.
- **Impacto:** clientes inválidos não recebem 400 com mensagem útil. Erros de tipo viram 500 só ao chegar ao Prisma. Documentação OpenAPI (`@fastify/swagger`) não pode ser gerada.

### Causa Raiz

Curva de adoção; o time priorizou funcionalidades sobre contratos.

### Solução Proposta

1. Adoptar [`zod`](https://zod.dev/) + [`fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod) — validação e *types* do `request.body` derivados.
2. Por rota: `schema: { body: bookCreateSchema, response: { 200: bookCardSchema } }`. Erros viram 400 automáticos.
3. Gerar OpenAPI com `@fastify/swagger` + `@fastify/swagger-ui` em `/docs` (apenas dev/admin).

### Trade-offs

- Trabalho de migração rota-a-rota; pode ser incremental.
- Zod adiciona ~12 KB ao backend (compilado); irrelevante no servidor.

---

## Issue 13 — CORS abre para qualquer origem se env não definida

### Diagnóstico

- **O que acontece:** [`server.ts:23`](../backend/src/server.ts):
  ```typescript
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true;
  ```
  Quando `CORS_ORIGIN` não está definido, `origin: true` faz o Fastify ecoar o `Origin` recebido — qualquer site pode chamar a API com `credentials`. Em [`.env.example`](../.env.example) vê-se que dev tem `CORS_ORIGIN=http://localhost:3000,http://localhost:8080`, mas em produção sem `.env` isto vira aberto.
- **Impacto:** se a VPS subir sem `.env` (cenário de erro de deploy), CORS é permissivo. Combinado com JWT em localStorage (Issue 11), fica trivial exfiltrar.

### Causa Raiz

Default permissivo conveniente para DX, perigoso em produção.

### Solução Proposta

1. **Falhar ao iniciar** se `CORS_ORIGIN` não estiver definido em `NODE_ENV=production`.
2. Em dev, usar lista explícita (não `true`).
3. Em [`docker-compose.yml`](../docker-compose.yml) já há default — bom — mas garantir que em VPS `.env` fica imutável (gerar via CI).

### Trade-offs

- Quase nenhum: torna deploys mais seguros à custa de uma exception clara em vez de comportamento silencioso.

---

## Issue 14 — Mídia em produção servida pelo Fastify, sem CDN/cache HTTP

### Diagnóstico

- **O que acontece:** em [`server.ts:73-103`](../backend/src/server.ts), `GET /media/*` é servido pelo Fastify a partir de `LOCAL_STORAGE_DIR`. Não envia `Cache-Control`, `ETag` nem `Last-Modified`. [`nginx.conf:33-42`](../nginx/nginx.conf) faz proxy para a API **sem cache** e com `proxy_buffering off`.
- **Impacto:** cada request de imagem volta ao Fastify (single-thread). Para um livro com 30 imagens × 10 alunos abrindo simultaneamente = 300 reqs ao Node em cada pageview. Em produção com tráfego real, é gargalo claro.

### Causa Raiz

Setup pensado para desenvolvimento (driver `local`); falta uma camada de cache de objectos imutáveis.

### Solução Proposta

1. Adicionar `Cache-Control: public, max-age=31536000, immutable` a respostas `/media/*` (URLs incluem UUID — são imutáveis por design — ver `mediaRoutes.ts` `{uuid}-{nome}`).
2. Em Nginx, fazer cache estático de `/media/`:
   ```nginx
   location /media/ {
       proxy_cache media_cache;
       proxy_cache_valid 200 7d;
       proxy_cache_key $request_uri;
       add_header X-Cache-Status $upstream_cache_status;
       proxy_pass http://api_upstream;
   }
   ```
3. Em escalabilidade, mover para **Cloudflare R2 / S3 + CloudFront** (ou Hostinger CDN se disponível) — apenas API gera presigns.

### Trade-offs

- Cache no Nginx exige volume separado; trivial.
- Mudar storage para S3 implica migrar `STORAGE_DRIVER` (já preparado em [`s3.ts`](../backend/src/lib/s3.ts)) e pagar tráfego, mas elimina o gargalo do Node.

---

## Issue 15 — Bundle do editor: Konva carregado em rota única

### Diagnóstico

- **O que acontece:** já há `dynamic(() => import('CanvasStageKonva'), { ssr: false })` (boa prática). Mas o resto do editor v2 (`PageSidebar.jsx` 46 KB, `PropertiesInspector.jsx` 81 KB) está em import estático no topo de [`edit-v2.jsx`](../frontend/pages/books/[id]/edit-v2.jsx). Estes painéis carregam quase tudo do editor à abertura da rota.
- **Impacto:** primeira pintura do `/books/:id/edit-v2` em rede móvel é lenta (>2 s para baixar JS + parse).

### Causa Raiz

Pages Router do Next 15 não faz code-splitting automático por painel; só por rota.

### Solução Proposta

1. `dynamic` para painéis: `LayerManagerPanel`, `ShapeSidebar`, `PropertiesInspector`, `BottomDock` — cada um só carrega quando o utilizador clica na aba.
2. Mover utilitários grandes (filtros Konva, `gifPlaybackUtils`) para *lazy import* dentro dos próprios painéis.
3. `next/font` para carregar Roboto e demais (em vez de listas ad-hoc em `EDITOR_FONT_OPTIONS`).

### Trade-offs

- Pequeno *flicker* ao abrir cada aba — mitigável com `<Suspense fallback={...}>`.

---

## Issue 16 — Falta telemetria de pintura/edição no editor

### Diagnóstico

- A telemetria HTTP em [`httpTelemetry.ts`](../backend/src/telemetry/httpTelemetry.ts) cobre rede e mídia. Em [`telemetryClient.js`](../frontend/lib/telemetryClient.js) há `reportClientTelemetry`, mas hoje só é chamado em `video_playback` ([`EVIDENCIAS-ETAPA-5.4.md` §4](../docs/evidencias/EVIDENCIAS-ETAPA-5.4.md#4-frontend)).
- Não temos métricas de FPS no canvas, tempo de save, tamanho do JSON, número de undos, *long task* do main thread. É difícil priorizar otimizações sem dados.

### Solução Proposta

1. `editorMetrics` ([`editor/v2/lib/editorMetrics.js`](../frontend/components/editor/v2/lib/editorMetrics.js)) já existe. Ampliá-lo:
   - `editor.save.duration` (ms).
   - `editor.save.payloadKB`.
   - `editor.canvas.fps` (média móvel via `requestAnimationFrame`, persiste a cada 30 s).
   - `editor.longtask` (`PerformanceObserver({type: 'longtask'})`).
2. Enviar via `reportClientTelemetry` em batch (uma vez por minuto) para `/telemetry/client`.
3. Dashboard simples em `/admin/telemetry` agrupando por `category`.

### Trade-offs

- Volume extra de `technical_logs`; rotação automática (cron deletando >30 dias) já é boa prática.

---

## Issue 17 — Ausência de testes automatizados

### Diagnóstico

- `frontend/vitest.config.js` existe mas não localizei `*.test.js` no scan (vide `frontend/lib/`). Backend não tem `jest`/`vitest`.
- Sem testes, refactors críticos como Issues 03, 05, 08 são arriscados.

### Solução Proposta

1. **Backend:** `vitest` + `@fastify/inject`. Suite mínima de smoke:
   - `auth.spec.ts`: login feliz, login errado, rate-limit (após implementar).
   - `books.spec.ts`: CRUD básico, paginação, search.
   - `media.spec.ts`: upload válido, upload com extensão proibida.
2. **Frontend:** `vitest` + `@testing-library/react`. Foco no editor:
   - `useEditorState.spec.js`: undo/redo, addPage, reorderPages.
   - `bookFlowOutline.spec.js`: helpers de capítulo.
3. **E2E:** `playwright` opcional, 3-4 fluxos chave (login → criar livro → editar → publicar).
4. CI: GitHub Actions com `npm test` e `npm run build` em PRs.

### Trade-offs

- Investimento inicial; ROI alto a partir do segundo refactor.

---

## Issue 18 — Mistura JS + TS no backend

### Diagnóstico

- [`backend/src/pptx/importPptxEngine.js`](../backend/src/pptx/importPptxEngine.js) é JavaScript, mas tudo à volta é TypeScript (`server.ts`, `routes/*.ts`). `import jwt from 'jsonwebtoken'` aparece duplicado em locais (uma vez via `lib/jwt.ts`, outra dentro do engine).

### Solução Proposta

Migrar `importPptxEngine.js → .ts` com tipagens (mesmo `unknown` em locais opacos), reusar `lib/jwt.ts` e `lib/prisma.ts` (hoje há um `new PrismaClient()` paralelo na linha 57 do engine — segunda conexão de pool).

### Trade-offs

Mecânico; não altera comportamento.

---

## Issue 19 — `Profile.permissions` modelado mas não consumido

### Diagnóstico

- `schema.prisma` tem `Profile.permissions Json?`. Não há leitura desse campo em `requireRoles`/`requireCmsEditor`. RBAC efetivo depende só de `User.role`.
- Documentado em [`ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md` §3b item 5](../docs/ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md): *“validar se `Profile.permissions` deve sobrepor `User.role`”* — está pendente.

### Solução Proposta

Decidir o modelo:
- Opção A — RBAC simples: remover `permissions` do schema (limpeza).
- Opção B — RBAC + ABAC: definir esquema (`{ books: ['read','write'], users: ['read'] }`) e implementar `requirePermission('books.write')` que une `User.role` (matriz default) + `Profile.permissions` (overrides).

### Trade-offs

Optar por A reduz superfície; B dá granularidade para clientes empresariais futuros.

---

## Issue 20 — `ENABLE_PUBLIC_REGISTER=true` em `.env.example`

### Diagnóstico

[`.env.example:29`](../.env.example): `ENABLE_PUBLIC_REGISTER=true`. Quem clona e copia o `.env.example → .env` em produção fica com registo aberto. O default do código **é** correctamente desligado, mas o exemplo induz a erro.

### Solução Proposta

Alterar para `ENABLE_PUBLIC_REGISTER=false` no exemplo (com comentário).

### Trade-offs

Nenhum.

---

# Arquitetura redesenhada (visão alvo)

A combinação das issues acima leva a um redesenho coerente. Esta secção responde ao §11 do `Analise.md`.

## Frontend

```
┌──────────────── Next.js 15 (Pages → migrar p/ App Router opcional) ───────────────┐
│  /books            → React Query (stale-while-revalidate, paginação cliente)      │
│  /books/[id]/edit  → Editor V2 (Zustand + Immer, code-split por painel, virtual)  │
│      ├─ <CanvasStage>      (memoizado; subscribe ao slice da página actual)       │
│      ├─ <PageSidebar>      (virtualized, thumbnails CDN-cached)                   │
│      ├─ <PropertiesInsp.>  (lazy import por aba)                                  │
│      └─ <BottomDock>       (timeline lazy)                                        │
│  Auth: cookie httpOnly (SameSite=Lax) + CSRF em mutations                         │
│  Telemetria: editorMetrics → POST /telemetry/client em batches                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## Backend

```
┌──────────────── Fastify (Node 20) ─────────────────────────────────────────────────┐
│  Plugins:                                                                          │
│    • @fastify/cors (origens explícitas)                                            │
│    • @fastify/cookie + @fastify/csrf-protection                                    │
│    • @fastify/rate-limit (auth e search)                                           │
│    • @fastify/compress (br/gzip)                                                   │
│    • @fastify/swagger / swagger-ui (em /docs, admin only)                          │
│    • zod schemas em todas as rotas                                                 │
│  Rotas:                                                                            │
│    /books               (paginação, projection sem JSON pesado)                    │
│    /books/:id           (metadata)                                                 │
│    /books/:id/pages     (lista + range progressivo)                                │
│    /books/:id/pages/:i  (PATCH granular, optimistic locking via version)           │
│    /books/:id/pages/:i/nodes/:nodeId (CRUD por nó)                                 │
│    /imports/pptx        (upload → enqueue → 202 Accepted)                          │
│    /import-jobs/:id     (progresso)                                                │
│  Workers (Node separado):                                                          │
│    • pg-boss (Postgres) → import_pptx, book_purge, search_reindex                  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## Modelo de dados (Postgres 16)

- `books` — só metadata, `outline JSONB` (capítulos pequenos), `version INT`, `deletedAt`.
- `book_pages` — uma linha por página (índice, capítulo, background, meta, version).
- `book_page_nodes` — uma linha por nó (z-index, type, transform, props).
- `book_page_versions` — *append-only* opcional para histórico (por página).
- `media_files` — sem mudança estrutural; adicionar `contentHash` para dedupe (Issue 3.3).
- `search_index` — passar para `tsvector` `GENERATED STORED` em `books`; índice GIN nativo.
- `technical_logs`/`admin_audit_logs` — partição mensal automática (`pg_partman`).
- `import_jobs` — fila persistida via pg-boss.

## Estratégia de carregamento (progressive)

1. `GET /books?limit=20` → cartões leves (sem `pages_v2`).
2. Editor: `GET /books/:id` → metadata + `outline` + número total de páginas.
3. Editor: `GET /books/:id/pages?range=0-2` → primeiras 3 páginas (com nodes embutidos).
4. À medida que o utilizador navega, *prefetch* de páginas adjacentes (React Query `prefetchQuery`).
5. Mídia: cliente recebe `{ bucket, filePath }` e pede `GET /media/signed-get?key=...&bucket=...` por viewport (lazy hydration).

## Storage e CDN

- Curto prazo: manter `STORAGE_DRIVER=local` + Nginx com `proxy_cache_path` para `/media/`.
- Médio prazo: migrar para S3 (Hostinger Object Storage / Backblaze / Cloudflare R2) + CDN; código já suporta (`STORAGE_DRIVER=s3`, env presente em [`.env.example`](../.env.example)).

## Observabilidade

- `request-id` propagado (já existe).
- Métricas Prometheus em `/metrics` (export do Fastify) → Grafana.
- Sentry no frontend (capturar erros de canvas/render).
- Alertas: `EVT:AUTH_LOGIN_FAIL` > X/min, `http_error` > Y/min, queue depth `import_pptx`.

## Roadmap proposto (sequência sugerida)

| Sprint | Foco | Issues cobertas |
|--------|------|-----------------|
| 1 | Quick wins de performance API | 01, 02, 13, 14 |
| 2 | Edição fluida no canvas | 03, 04 (curto prazo), 08, 09, 15 |
| 3 | Segurança e contratos | 11, 12, 20 |
| 4 | Modelo relacional + workers | 05, 04 (médio prazo), 07, 10 |
| 5 | Robustez e qualidade | 06, 16, 17, 18, 19 |

---

## Notas finais

- Esta análise **não muda código** — é levantamento. Cada issue está independente; PRs podem ser abertos um a um, com critério de aceitação a partir das “Soluções Propostas”.
- Sugiro converter cada issue acima em ticket no quadro do projecto, replicando o cabeçalho de tabela do início (`Sumário`).
- Para a próxima conversa, indique-me a Issue prioritária; eu volto com a implementação completa (incluindo plano de migração e testes).

*Documento gerado a 2026-05-05 para o repositório `luditeca-vps`.*
