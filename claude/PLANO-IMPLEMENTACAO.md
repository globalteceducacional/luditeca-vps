# Plano de Implementação — Roadmap de Melhorias Luditeca

> Companion técnico de [`LEVANTAMENTO-MELHORIAS.md`](./LEVANTAMENTO-MELHORIAS.md). Cada sprint abaixo é uma sequência **executável**, com sub-branches, *checklist* de tarefas, ficheiros a tocar, comandos de validação e critérios de aceitação.

**Branch raiz de trabalho:** `feat/roadmap-melhorias` (criada a partir de `main`).
**Estratégia:** uma sub-branch por issue ou par de issues afins → PR para `feat/roadmap-melhorias` → quando o conjunto da sprint estiver verde, *merge* da raiz para `main`.

**Convenções:**
- Mensagens de commit em pt-BR no imperativo: `feat(api): ...`, `fix(editor): ...`, `refactor(db): ...`, `chore(infra): ...`.
- Cada PR cita a issue do `LEVANTAMENTO-MELHORIAS.md` no título: `[ISSUE-01] feat(api): paginação e projeção em GET /books`.
- Cada PR inclui **antes/depois** mensurável (ms, KB, FPS, tamanho de bundle) sempre que fizer sentido.
- Sem `withOpacity` em código Flutter (ver regras do projeto); `debugPrint` em vez de `print`. Em PowerShell usa `;` (não `&&`).

---

## Sprint 1 — Quick wins de performance API

**Branch:** `feat/roadmap-melhorias-sprint-1` ← `feat/roadmap-melhorias`
**Objectivo:** reduzir payload e latência das rotas mais quentes sem mexer no modelo de dados.
**Issues cobertas:** 01, 02, 13, 14.

### Etapa 1.1 — Issue 01: Paginação e projeção em `GET /books` e `/books/search`

**Sub-branch:** `feat/issue-01-books-projection`

#### Pré-requisitos
- Backup da resposta atual de `GET /books` para regression test:
  ```powershell
  curl -sH "Authorization: Bearer $env:LUDITECA_TOKEN" http://localhost:4000/books > tmp/books.before.json
  ```

#### Tarefas
1. **Backend** — `backend/src/routes/bookRoutes.ts`:
   - [ ] Definir `BOOK_CARD_SELECT` (sem `pages`, `pagesV2`, `linkSlidebook`) ao topo do ficheiro.
   - [ ] Função `bookCardResponse(row)` reusando `jsonSafe`.
   - [ ] Modificar `GET /books` para aceitar `limit` (default 50, max 100) e `offset` (default 0).
   - [ ] Devolver `{ data, total, limit, skip }` em vez de array puro (manter alias `data` é array).
   - [ ] Modificar `GET /books/search` para usar mesma `BOOK_CARD_SELECT` (eliminar `stripHeavyBookFields`).
2. **Frontend** — `frontend/lib/books.js`:
   - [ ] `getBooks({ limit, offset })`. Manter retrocompatibilidade: se receber `{ data: [...] }`, usar `data`; se receber array, usar como está.
3. **Frontend** — `frontend/pages/books/index.js`:
   - [ ] Adicionar paginação cliente (botões “Carregar mais” ou paginação clássica).
4. **Tipagem** — declarar `Querystring` no `app.get<{ Querystring: ... }>` para evitar `any`.

#### Validação
```powershell
cd backend; npx tsc --noEmit
cd ..\frontend; npm run build
```
Comparar tamanho:
```powershell
curl -sH "Authorization: Bearer $env:LUDITECA_TOKEN" "http://localhost:4000/books?limit=50" > tmp\books.after.json
(Get-Item tmp\books.before.json).Length
(Get-Item tmp\books.after.json).Length
```
**Esperado:** redução >90 % no tamanho com 20+ livros.

#### Critérios de aceitação
- `GET /books` p50 < 200 ms com 100 livros (medir via `x-request-id` em `technical_logs`).
- Página `/books` continua renderizando cartões e paginação visível.
- `EVT:*` de auditoria intactos (não foi alterada lógica de mutação).

---

### Etapa 1.2 — Issue 02: Hidratação paralela de mídia + projeção em `GET /books/:id`

**Sub-branch:** `feat/issue-02-book-detail-parallel`

#### Tarefas
1. **Backend** — adicionar dependência `p-limit`:
   ```powershell
   cd backend; npm install p-limit
   ```
2. `backend/src/routes/bookRoutes.ts`:
   - [ ] Refactor `hydrateLegacyPagesMediaUrls` e `hydratePagesV2MediaUrls`:
     - Substituir `for (const page of next)` + `await` por `Promise.all(next.map(async (page) => { ... }))`.
     - Limitar concorrência com `pLimit(16)` para presigns.
   - [ ] Suportar query `?view=v2` (default) que **omite** `pages` legado quando `pagesV2` existir.
   - [ ] Manter `?view=legacy` para compatibilidade.
3. **Frontend** — `frontend/lib/books.js#getBook`:
   - [ ] Passar `?view=v2` por defeito.

#### Validação
```powershell
# Antes/depois com livro real:
$id = 1
Measure-Command { curl -sH "Authorization: Bearer $env:LUDITECA_TOKEN" "http://localhost:4000/books/$id" | Out-Null }
```
**Esperado:** ≥ 50 % de redução no tempo de resposta para livros com 20+ mídias.

#### Critérios de aceitação
- Editor v2 (`/books/:id/edit-v2`) abre normalmente; sem regressão visual em fundos/imagens.
- `EVIDENCIAS-ETAPA-5.1.md` será actualizado mais tarde no PR final da sprint.

---

### Etapa 1.3 — Issue 13: CORS estrito em produção

**Sub-branch:** `fix/issue-13-cors-strict`

#### Tarefas
1. `backend/src/server.ts`:
   - [ ] Substituir o default `?? true` por:
     ```typescript
     const corsOriginEnv = process.env.CORS_ORIGIN?.trim();
     if (process.env.NODE_ENV === 'production' && !corsOriginEnv) {
       throw new Error('CORS_ORIGIN obrigatório em produção (lista separada por vírgulas).');
     }
     const corsOrigin = corsOriginEnv
       ? corsOriginEnv.split(',').map((s) => s.trim()).filter(Boolean)
       : ['http://localhost:3000', 'http://localhost:8080'];
     ```
2. `docs/DEPLOY-VPS.md`:
   - [ ] Adicionar nota: “CORS_ORIGIN obrigatório em produção; sem barra final.”

#### Validação
```powershell
$env:NODE_ENV = "production"; $env:CORS_ORIGIN = ""; cd backend; npm run start
# Esperado: erro claro a abortar arranque.
$env:CORS_ORIGIN = "https://luditeca.com"
# Esperado: arranca normal.
```

#### Critérios de aceitação
- Em dev, comportamento inalterado.
- Em prod sem env, falha rápida com mensagem clara.

---

### Etapa 1.4 — Issue 14: Cache HTTP de mídia + Nginx

**Sub-branch:** `feat/issue-14-media-cache`

#### Tarefas
1. `backend/src/server.ts` — handler `GET /media/*`:
   - [ ] Adicionar cabeçalhos antes de `reply.send`:
     ```typescript
     reply.header('Cache-Control', 'public, max-age=31536000, immutable');
     reply.header('Vary', 'Accept-Encoding');
     ```
2. `nginx/nginx.conf`:
   - [ ] Adicionar `proxy_cache_path /var/cache/nginx/media levels=1:2 keys_zone=media_cache:32m max_size=2g inactive=30d use_temp_path=off;` no bloco `http`.
   - [ ] No `location /media/`: `proxy_cache media_cache; proxy_cache_valid 200 7d; add_header X-Cache-Status $upstream_cache_status;`.
3. `docker-compose.yml`:
   - [ ] Volume nomeado `nginx_cache:/var/cache/nginx/media` no serviço `nginx`.
4. `docs/DEPLOY-VPS.md`:
   - [ ] Documentar que cache de mídia agora é Nginx-side.

#### Validação
```powershell
docker compose up -d --build nginx
curl -sI http://localhost:8080/media/covers/<uid>/library/<uuid>-foo.png
# Esperado: header X-Cache-Status: MISS (1ª req), HIT (2ª req)
```

#### Critérios de aceitação
- Imagens carregam mais rápido na 2ª pageview.
- Sem regressão em uploads (mudanças em `/media/upload` etc. não cacheadas — só `GET`).

---

### Sprint 1 — Conclusão
- [ ] Merge das 4 sub-branches em `feat/roadmap-melhorias-sprint-1`.
- [ ] PR para `feat/roadmap-melhorias` com tabela de métricas (antes/depois).
- [ ] Tag candidata: `v1.1.0-rc.1`.

---

## Sprint 2 — Edição fluida no canvas

**Branch:** `feat/roadmap-melhorias-sprint-2` ← `feat/roadmap-melhorias`
**Objectivo:** o editor V2 não pode mais lagar em livros médios.
**Issues cobertas:** 03, 04 (curto prazo), 08, 09, 15.

### Etapa 2.1 — Issue 03: imutabilidade estrutural + undo por delta

**Sub-branch:** `refactor/issue-03-editor-state-structural`

#### Tarefas
1. `frontend/components/editor/v2/hooks/useEditorState.js`:
   - [ ] Substituir `deepClone` por `structuredClone`.
   - [ ] `patchPage` clona **só a página afectada** (shallow clone do array `pages` + nova referência da página).
   - [ ] `pushUndoSnapshot` guarda referência à página **antiga** (já congelada pela imutabilidade); não clona.
   - [ ] Limite da pilha continua 80, mas medir RAM antes/depois.
2. `frontend/components/editor/CanvasStageKonva.jsx`:
   - [ ] Throttle do drag de nó: usar `requestAnimationFrame` para coalescer `patchNode` durante `onDragMove`; `patchNode` real só em `onDragEnd` ou ao soltar.
3. **Tests:** criar `frontend/components/editor/v2/hooks/useEditorState.test.js` com Vitest:
   - [ ] `addPage`, `reorderPages`, `undo`, `redo`, `deletePage`.

#### Validação
- Editor com `pages_v2` ~3 MB: arrastar imagem deve manter ≥55 FPS (Chrome DevTools → Performance).
- `editorMetrics` (a ampliar na Issue 16) reportará ganho.

#### Critérios de aceitação
- Sem regressão em undo/redo (Ctrl+Z volta para o estado anterior do nó).
- Memória heap não cresce mais do que 1.2× após 50 edições + 50 undos.

---

### Etapa 2.2 — Issue 04 (curto prazo): remover limite 1 MB + autosave + compress

**Sub-branch:** `feat/issue-04-autosave-compress`

#### Tarefas
1. **Backend**:
   ```powershell
   cd backend; npm install @fastify/compress
   ```
   - [ ] `server.ts`: `await app.register(compress, { encodings: ['br', 'gzip'] });` antes de rotas.
2. `frontend/lib/books.js#updateBook`:
   - [ ] **Remover** o bloco `if (dataSize > 1000000) ...`.
   - [ ] Adicionar header opcional `Content-Encoding: gzip` se body > 64 KB (usar `pako`/`CompressionStream` nativo).
3. `frontend/pages/books/[id]/edit-v2.jsx`:
   - [ ] Adicionar **autosave** com debounce 5 s usando `useEffect` que reage a `isModified`:
     ```js
     useEffect(() => {
       if (!isModified) return;
       const t = setTimeout(() => { saveBookRef.current?.(); }, 5000);
       return () => clearTimeout(t);
     }, [isModified, ...]);
     ```
   - [ ] Indicador visual no header: “Guardando…” / “Salvo às HH:mm”.
   - [ ] Manter botão manual “Salvar projeto” como fallback.

#### Validação
- Livro com `pages_v2` de 4 MB salva sem erro.
- `Content-Encoding: gzip` visível em DevTools quando aplicável.
- Após edição, autosave dispara em 5 s (sem cliques extras).

#### Critérios de aceitação
- Sem perda de dados em fechar aba antes do save (rascunho local em `localStorage` continua a funcionar).
- Conflitos optimistas continuam fora de âmbito (resolvidos na Sprint 4 com versionamento por página).

---

### Etapa 2.3 — Issue 08 + 15: decompor `CanvasStageKonva` e *code-splitting* dos painéis

**Sub-branch:** `refactor/issue-08-15-editor-decompose`

#### Tarefas
1. Criar pasta `frontend/components/editor/canvas/` (já existe parcialmente).
2. **Extrair de `CanvasStageKonva.jsx`** (sequência segura):
   - [ ] `<CanvasNode>` (memo, recebe `node` + handlers).
   - [ ] `<TextNode>`, `<ImageNode>`, `<VideoNode>`, `<ShapeNode>` (sub-componentes especializados).
   - [ ] `<TransformerOverlay>` (gerência do transformer Konva).
   - [ ] Manter `<CanvasStageKonva>` como orquestrador slim (alvo: ≤ 800 linhas).
3. `frontend/pages/books/[id]/edit-v2.jsx`:
   - [ ] Trocar imports estáticos por `dynamic(...)` para painéis pesados:
     ```js
     const PropertiesInspector = dynamic(() => import('.../PropertiesInspector'), { loading: () => <PanelSkeleton /> });
     const LayerManagerPanel = dynamic(() => import('.../LayerManagerPanel'));
     const ShapeSidebar = dynamic(() => import('.../ShapeSidebar'));
     const BottomDock = dynamic(() => import('.../BottomDock'));
     ```
4. Adicionar `<PanelSkeleton>` simples (40 linhas Tailwind).

#### Validação
```powershell
cd frontend; npm run build
# Conferir o relatório de bundle do Next:
# .next\analyze\client.html (precisa @next/bundle-analyzer)
```
- Tamanho do *initial chunk* da rota `/books/[id]/edit-v2` reduzido em ≥30 %.
- FPS no canvas ≥55 durante drag de 3 imagens simultâneas.

#### Critérios de aceitação
- Visual e funcional **idênticos** ao actual; sem regressões em filtros, GIF, vídeo, áudio, transformer.
- Cada sub-componente exportado tem `displayName` para devtools.

---

### Etapa 2.4 — Issue 09: virtualização do `PageSidebar` + biblioteca

**Sub-branch:** `feat/issue-09-virtual-sidebar`

#### Tarefas
1. `cd frontend; npm install @tanstack/react-virtual`
2. `frontend/components/editor/v2/panels/PageSidebar.jsx`:
   - [ ] Virtualizar lista de páginas (estimativa de 96 px por linha).
   - [ ] Virtualizar grade da biblioteca de mídia (grid virtualization).
3. `frontend/components/editor/v2/media/MediaLibraryThumb.*`:
   - [ ] Garantir consumo de `thumbUrl` (não a imagem original) para itens com `.thumbs/`.
   - [ ] Adicionar `loading="lazy"` e `decoding="async"`.

#### Validação
- Livro com 80 páginas: scroll fluido na sidebar, RAM heap < 200 MB.

#### Critérios de aceitação
- Drag-to-reorder de páginas continua funcional.
- Filtro por capítulo continua funcional.

---

### Sprint 2 — Conclusão
- [ ] PR conjunto `feat/roadmap-melhorias-sprint-2` → `feat/roadmap-melhorias`.
- [ ] Atualizar [`EVIDENCIAS-TAREFA-3.4.md`](../docs/evidencias/EVIDENCIAS-TAREFA-3.4.md) com seção “Performance do editor”.

---

## Sprint 3 — Segurança e contratos

**Branch:** `feat/roadmap-melhorias-sprint-3` ← `feat/roadmap-melhorias`
**Issues cobertas:** 11, 12, 20.

### Etapa 3.1 — Issue 12: validação por *schema* (Zod) com tipos derivados

**Sub-branch:** `feat/issue-12-zod-schemas`

#### Tarefas
1. **Dependências:**
   ```powershell
   cd backend; npm install zod fastify-type-provider-zod
   ```
2. `backend/src/server.ts`:
   - [ ] `import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';`
   - [ ] `app.setValidatorCompiler(validatorCompiler); app.setSerializerCompiler(serializerCompiler);`
3. Criar `backend/src/schemas/book.ts`:
   - [ ] `bookCreateSchema`, `bookUpdateSchema`, `bookCardSchema`, `bookFullSchema`, `bookSearchQuerySchema`.
4. Aplicar incrementalmente:
   - [ ] `authRoutes.ts` (login, register, forgot-password, reset-password).
   - [ ] `bookRoutes.ts` (CRUD + search).
   - [ ] `userRoutes.ts`, `categoryRoutes.ts`, `authorRoutes.ts`.
5. **Smoke tests** com Vitest + `app.inject`:
   - [ ] `POST /auth/login` com payload inválido devolve 400 com `details`.

#### Critérios de aceitação
- Zero `as Record<string, unknown>` nas rotas migradas.
- Mensagens de erro 400 padronizadas: `{ error, details: [{ path, message }] }`.

---

### Etapa 3.2 — Issue 11: rate-limit + cookies httpOnly + CSRF

**Sub-branch:** `feat/issue-11-auth-hardening`

#### Tarefas
1. **Dependências:**
   ```powershell
   cd backend; npm install @fastify/rate-limit @fastify/cookie @fastify/csrf-protection
   ```
2. `backend/src/server.ts`:
   - [ ] Registar `@fastify/rate-limit` global com defaults (100 req/min) + override em rotas:
     - `POST /auth/login`: 10/min/IP.
     - `POST /auth/forgot-password`: 5/min/IP.
     - `POST /auth/register`: 5/h/IP.
   - [ ] Registar `@fastify/cookie` com `secret: process.env.COOKIE_SECRET`.
3. `backend/src/lib/jwt.ts`:
   - [ ] Função `setAuthCookie(reply, token)` que envia `Set-Cookie: luditeca_token=...; HttpOnly; Secure; SameSite=Lax; Max-Age=...`.
   - [ ] `clearAuthCookie(reply)`.
4. `backend/src/plugins/auth.ts`:
   - [ ] Antes de aceitar `Authorization: Bearer`, verificar cookie `luditeca_token`. Aceitar **ambos** durante transição.
5. `backend/src/routes/authRoutes.ts`:
   - [ ] Em `POST /auth/login` chamar `setAuthCookie` além de devolver `access_token` (compat).
   - [ ] Adicionar `POST /auth/logout` que limpa cookie.
6. **Frontend** — `frontend/lib/apiClient.js`:
   - [ ] `apiFetch` passa `credentials: 'include'`.
   - [ ] Para mutations, anexar header `X-CSRF-Token` (CSRF habilitado).
7. **Frontend** — `frontend/contexts/auth.js`:
   - [ ] Após sucesso de `/auth/login`, deixar de gravar `access_token` no `localStorage` em release N+1 (manter compat na release N).
8. `.env.example`:
   - [ ] Adicionar `COOKIE_SECRET=` e nota.

#### Critérios de aceitação
- Brute-force de senha bloqueado após 10 tentativas/min.
- Cookies presentes em DevTools → Application → Cookies (HttpOnly ✓).
- `/auth/me` continua a funcionar com cookie.

---

### Etapa 3.3 — Issue 20: ajuste de `.env.example`

**Sub-branch:** `chore/issue-20-env-example`

#### Tarefas
- [ ] `.env.example`: alterar `ENABLE_PUBLIC_REGISTER=true` → `false` com comentário “# Activar apenas para testes locais.”
- [ ] `env.vps.example`: revisar e alinhar.

#### Critérios de aceitação
- Trivial; passa em CI sem alterações de comportamento.

---

### Sprint 3 — Conclusão
- [ ] PR `feat/roadmap-melhorias-sprint-3` → `feat/roadmap-melhorias`.
- [ ] Documentar fluxo de auth atualizado em [`docs/ROTAS-E-PERMISSOES-LOGIN.md`](../docs/ROTAS-E-PERMISSOES-LOGIN.md).

---

## Sprint 4 — Modelo relacional + workers

**Branch:** `feat/roadmap-melhorias-sprint-4` ← `feat/roadmap-melhorias`
**Issues cobertas:** 05, 04 (médio prazo), 07, 10.

### Etapa 4.1 — Issue 05: tabelas `book_pages` e `book_page_nodes`

**Sub-branch:** `refactor/issue-05-relational-pages`

#### Tarefas
1. `backend/prisma/schema.prisma`:
   - [ ] Adicionar `BookPage` e `BookPageNode` (esquema descrito na Issue 05 do levantamento).
   - [ ] Manter `Book.pagesV2` durante transição (campo legado).
   - [ ] Adicionar `Book.deletedAt DateTime?`.
2. Migração Prisma:
   ```powershell
   cd backend
   npx prisma migrate dev --name relational_book_pages
   ```
3. **Script de migração de dados** `backend/scripts/migrate-pages-v2-to-relational.ts`:
   - [ ] Para cada livro com `pagesV2`, popular `BookPage` + `BookPageNode`.
   - [ ] Idempotente (só insere se não existir; usa `version=1`).
4. Adaptar `backend/src/lib/pagesV2/`:
   - [ ] `loadBookFull(bookId)` → carrega via JOIN e devolve estrutura compatível com cliente.
5. Endpoints:
   - [ ] Manter `GET /books/:id` devolvendo `pages_v2` reconstituído (compat).
   - [ ] **Novos** endpoints granulares:
     - `GET /books/:id/pages?range=0-4`
     - `PATCH /books/:id/pages/:index`
     - `POST /books/:id/pages` (cria nova página)
     - `PATCH /books/:id/pages/:index/nodes/:nodeId`
     - `POST /books/:id/pages/:index/nodes`
     - `DELETE /books/:id/pages/:index/nodes/:nodeId`

#### Validação
- Script de migração rodado em DB de staging com 100+ livros sem perda.
- Editor v2 continua a abrir e salvar (modo legado mantido).

#### Critérios de aceitação
- Cobertura de testes ≥80 % para o novo módulo `pagesV2/relational.ts`.
- Coluna `pages_v2` permanece preenchida durante uma release (read-through).

---

### Etapa 4.2 — Issue 04 (médio prazo): editor consome endpoints granulares

**Sub-branch:** `feat/issue-04-granular-editor`

Depende de **4.1** estar mergeado.

#### Tarefas
1. `frontend/lib/books.js`:
   - [ ] `updatePage(bookId, index, patch)`, `updateNode(bookId, index, nodeId, patch)`.
2. `frontend/components/editor/v2/hooks/useEditorState.js`:
   - [ ] `patchPage` e `patchNode` chamam endpoints granulares **com debounce 1 s** por página.
   - [ ] Optimistic locking: enviar `version`; em conflito (409), recarregar página + reaplicar patch local.
3. `frontend/pages/books/[id]/edit-v2.jsx`:
   - [ ] Loading progressivo: `GET /books/:id` → metadata; `GET /books/:id/pages?range=0-2` para renderização inicial; `prefetch` de páginas adjacentes ao navegar.

#### Critérios de aceitação
- Editar 1 nó num livro de 50 páginas envia ~5 KB no PATCH (vs. ~3 MB hoje).
- Tempo até primeira pintura do editor ≤ 1 s em rede 3G simulada.

---

### Etapa 4.3 — Issue 10: fila assíncrona com `pg-boss` (PPTX + outras)

**Sub-branch:** `feat/issue-10-pg-boss-jobs`

#### Tarefas
1. **Dependências:**
   ```powershell
   cd backend; npm install pg-boss
   ```
2. `backend/src/lib/jobs.ts`:
   - [ ] Singleton `bossPromise` (PgBoss conectado a `DATABASE_URL`).
   - [ ] Tipos: `JobName = 'pptx_import' | 'book_purge' | 'search_reindex'`.
3. `backend/src/workers/pptxImport.ts`:
   - [ ] Subscriber para `pptx_import`. Move o conteúdo de `runImportPptxEngine` para cá; o pedido HTTP só faz upload + enqueue.
4. `backend/src/routes/importPptxRoute.ts`:
   - [ ] POST grava ficheiro em `imports/{sessionId}/source.pptx`, enfileira job, devolve `202 { jobId }`.
5. **Novo endpoint** `GET /import-jobs/:id` (`requireCmsEditor`):
   - [ ] Devolve `{ status, progress, error?, totalSlides? }` lido de `import_jobs`.
6. **Frontend** — `frontend/lib/pptxImport.js`:
   - [ ] Polling 2 s em `/import-jobs/:id` até status `completed`/`failed`.
7. **Worker process**: novo `package.json` script `worker:start` e Dockerfile dedicado (ou mesmo container com lifecycle separado).
8. **docker-compose.yml**: novo serviço `worker` reutilizando imagem do `api` com `command: node dist/workers/index.js`.

#### Critérios de aceitação
- Importação de PPTX 200 MB não afecta latência de outros endpoints.
- Falha do worker → job marcado como `failed`; admin vê em `/admin/audit` e `/admin/telemetry`.

---

### Etapa 4.4 — Issue 07: soft-delete + worker `book_purge`

**Sub-branch:** `feat/issue-07-soft-delete-purge`

#### Tarefas
1. `backend/src/routes/bookRoutes.ts`:
   - [ ] `DELETE /books/:id` agora faz transacionalmente `book.update({ deletedAt: new Date() })` + auditoria + `boss.send('book_purge', { bookId })`.
   - [ ] `GET /books*`: adicionar `where: { deletedAt: null }` em todos os `findMany`.
2. `backend/src/workers/bookPurge.ts`:
   - [ ] Lê `mediaFile` por `bookId`, apaga em paralelo (batches de 16).
   - [ ] Após sucesso, `prisma.book.delete`.
   - [ ] Em caso de erro: re-tenta até 3× com backoff.
3. **Cron** `daily_purge_retry` (pg-boss schedule):
   - [ ] Lista livros com `deletedAt < now() - 1d` e ainda existentes; re-enfileira `book_purge`.

#### Critérios de aceitação
- DELETE devolve 204 em <500 ms.
- Pasta do livro removida em background; se worker cair, retry automático.

---

### Sprint 4 — Conclusão
- [ ] Tag candidata: `v1.2.0-rc.1` (mudanças de modelo de dados).
- [ ] Atualizar [`EVIDENCIAS-ETAPA-5.1.md`](../docs/evidencias/EVIDENCIAS-ETAPA-5.1.md) e [`EVIDENCIAS-ETAPA-5.4.md`](../docs/evidencias/EVIDENCIAS-ETAPA-5.4.md).
- [ ] Plano de rollback documentado (manter `pages_v2` por 1 release).

---

## Sprint 5 — Robustez e qualidade

**Branch:** `feat/roadmap-melhorias-sprint-5` ← `feat/roadmap-melhorias`
**Issues cobertas:** 06, 16, 17, 18, 19.

### Etapa 5.1 — Issue 06: reindex de busca em renames de Author/Category

**Sub-branch:** `fix/issue-06-search-reindex`

#### Tarefas
1. `backend/src/routes/authorRoutes.ts` e `categoryRoutes.ts`:
   - [ ] Após `PATCH`/`DELETE`, enfileirar `search_reindex` com `{ type: 'author'|'category', id }`.
2. `backend/src/workers/searchReindex.ts`:
   - [ ] Para `author`, `prisma.book.findMany({ where: { authorId: id }, select: { id: true } })` → `Promise.all(persistBookSearchIndex(b.id))`.
   - [ ] Idem para categoria.
3. **Comando manual** `backend/scripts/reindex-all.ts`:
   - [ ] CLI para reconstruir todo o `search_index`.

#### Critérios de aceitação
- Renomear autor → busca atualizada em < 30 s para 1 000 livros.

---

### Etapa 5.2 — Issue 16: telemetria avançada do editor

**Sub-branch:** `feat/issue-16-editor-telemetry`

#### Tarefas
1. `frontend/components/editor/v2/lib/editorMetrics.js`:
   - [ ] Expor `recordSave(durationMs, payloadKB)`, `recordFps(value)`, `recordLongTask(durationMs)`.
   - [ ] Buffer interno; flush a cada 60 s via `reportClientTelemetry`.
2. `frontend/components/editor/CanvasStageKonva.jsx`:
   - [ ] Iniciar `PerformanceObserver({ entryTypes: ['longtask'] })`.
   - [ ] FPS via `requestAnimationFrame`.
3. `frontend/pages/admin/telemetry/index.js`:
   - [ ] Adicionar separador “Editor” com gráfico simples (média/p95).

#### Critérios de aceitação
- Dashboard mostra distribuição de FPS por usuário/dia.

---

### Etapa 5.3 — Issue 17: testes automatizados (CI)

**Sub-branch:** `chore/issue-17-tests-ci`

#### Tarefas
1. **Backend** — `backend/vitest.config.ts`:
   - [ ] Setup com `app.inject` e DB SQLite local (ou Docker Postgres no CI).
   - [ ] Suites mínimas: `auth`, `books`, `media`.
2. **Frontend** — usar `vitest.config.js` existente:
   - [ ] `useEditorState.test.js`, `bookFlowOutline.test.js`.
3. **GitHub Actions** — `.github/workflows/ci.yml`:
   - [ ] Job `lint-and-test` (Node 20).
   - [ ] Job `build-frontend` (Next).
   - [ ] Job `prisma-validate` (`npx prisma validate`).

#### Critérios de aceitação
- CI verde em PRs futuros.
- Cobertura mínima 50 % na sprint, alvo 70 % até final do roadmap.

---

### Etapa 5.4 — Issue 18: migrar `importPptxEngine.js → .ts`

**Sub-branch:** `refactor/issue-18-pptx-engine-ts`

#### Tarefas
1. Renomear `backend/src/pptx/importPptxEngine.js` → `.ts`.
2. Adicionar tipos progressivamente (começar `unknown`).
3. Eliminar `new PrismaClient()` paralelo; usar singleton de `lib/prisma.ts`.

---

### Etapa 5.5 — Issue 19: decisão de RBAC

**Sub-branch:** `chore/issue-19-rbac-decision`

#### Tarefas
- [ ] **Decisão a tomar pelo time:** A) Remover `Profile.permissions` ou B) Implementar ABAC.
- [ ] Documentar decisão em [`docs/ARTEFATO-PORTAL-ADMIN-TRILHA.v2.md`](../docs/ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md).
- [ ] Migração SQL conforme decisão.

---

## Critérios globais de aceitação do roadmap

Ao final das 5 sprints:

- [ ] `GET /books` p50 < 200 ms; `GET /books/:id` p50 < 500 ms (com cache de presigns).
- [ ] Editor: 60 FPS estável em livro de 30 páginas no Chrome desktop e ≥ 30 FPS no iPad Air 4.
- [ ] Bundle inicial da rota `/books/[id]/edit-v2` ≤ 600 KB gzip.
- [ ] Cobertura de testes ≥ 70 %; CI obrigatório em PRs.
- [ ] Auth: cookies httpOnly + rate-limit + CSRF activos.
- [ ] PPTX: importação assíncrona via `pg-boss`.
- [ ] Modelo relacional para páginas e nós (legado mantido por 1 release).
- [ ] Documentação atualizada (evidências 3.x e 5.x refletem estado novo).

---

## Quick reference (PowerShell, Windows)

```powershell
# Trabalhar na branch raiz
git checkout feat/roadmap-melhorias

# Criar sub-branch para uma etapa
git checkout -b feat/issue-01-books-projection

# Validar backend
cd backend; npm run build; npx prisma validate

# Validar frontend
cd ..\frontend; npm run build; npm test

# Voltar para a branch raiz e merge da sub-branch
git checkout feat/roadmap-melhorias
git merge --no-ff feat/issue-01-books-projection

# Push da branch raiz para origem (quando autorizado)
git push -u origin feat/roadmap-melhorias
```

---

*Plano gerado em 2026-05-05; revisar mensalmente conforme progresso real.*
