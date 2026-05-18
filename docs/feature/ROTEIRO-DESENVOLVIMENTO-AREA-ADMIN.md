# Roteiro de desenvolvimento — Área do Administrador (Luditeca VPS)

> Integração da spec em [`Feature1`](./Feature1) / [`INTEGRACAO-AREA-ADMIN.md`](../INTEGRACAO-AREA-ADMIN.md) no stack **Next.js + Fastify + Prisma**.  
> Comando do agente: [`commands/integrar-area-admin.md`](./commands/integrar-area-admin.md) · Regras: [`rules/admin-area-integracao.mdc`](./rules/admin-area-integracao.mdc)  
> Portal/auditoria já existente: [`ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md`](../ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md)

**Branch raiz sugerida:** `feat/area-admin-conteudo` (a partir de `feat/roadmap-melhorias` ou `main`, conforme o que estiver estável).

**Convenções (iguais ao resto do repo):**
- Commits em pt-BR, imperativo: `feat(admin): ...`, `feat(api): ...`, `fix(cms): ...`
- PRs citam sprint/etapa: `[ADMIN-S2] feat(api): CRUD puzzle-games`
- PowerShell: `;` entre comandos
- **Não** portar `AdminLoginModal` nem senha em `localStorage` — auth só JWT + roles no backend

---

## Visão em uma página

| Sprint | Foco | Entrega visível |
|--------|------|-----------------|
| **S0** | Fundação | Migração Prisma, convenções, shell `/admin` |
| **S1** | API CMS — Puzzle + Pinturas | CRUD + publish + audit |
| **S2** | API CMS — Atividades + LIBRAS | CRUD + editores mínimos |
| **S3** | Hub admin + Livros | Painel com abas; livros ligados ao editor v2 |
| **S4** | API app (leitura) | Rotas públicas/autenticadas para app infantil |
| **S5** | App infantil (opcional neste repo) | Library, activities, puzzle, coloring |
| **S6** | Qualidade e ops | Testes, CSV audit, SMTP reset, docs |

**Dependência externa a decidir no kickoff S0:** a app criança corre neste monorepo (`/app/*`) ou noutro projeto (ex. Mundo Lúdico Vite)? Isso define o escopo de S4–S5.

---

## Mapa origem → destino

| Módulo (Feature1) | Entidade Base44 | Destino Luditeca | Editor |
|-------------------|-----------------|------------------|--------|
| Livros | `Book` | `Book` (Prisma) — **já existe** | `/books/[id]/edit-v2` (não portar `BookEditor` Vite) |
| Atividades | `Activity` | `Activity` (novo) | `/admin/activities/[id]/edit` |
| LIBRAS | `LibrasLesson` | `LibrasLesson` (novo) | `/admin/libras/[id]/edit` |
| Quebra-cabeça | `PuzzleGame` | `PuzzleGame` (novo) | `/admin/puzzle` (CRUD inline) |
| Pinturas | `ColoringPage` | `ColoringPage` (novo) | `/admin/coloring` |

**Publicação:** `is_published` nas novas entidades; livros usam `workflow_status` (`published` = visível na app).

---

## Sprint 0 — Fundação (estimativa: 2–3 dias)

**Branch:** `feat/admin-s0-fundacao`

### Objetivos
- Modelos Prisma e migração aplicada
- Rotas registadas no `server.ts` (esqueleto)
- Shell `/admin` com navegação por abas (vazio ou placeholders)
- Taxonomia `EVT:*` documentada para novos módulos

### Tarefas

#### S0.1 — Prisma
- [ ] Adicionar modelos em `backend/prisma/schema.prisma`:
  - `Activity`, `LibrasLesson`, `PuzzleGame`, `ColoringPage` (campos conforme Feature1 §6)
  - Relação opcional `Activity.bookId` → `Book`
- [ ] Criar migração: `npx prisma migrate dev --name admin_content_entities`
- [ ] `npx prisma generate`

#### S0.2 — Convenções API
- [ ] Ficheiro `backend/src/lib/contentTypes.ts` (enums: activity types, piece counts, validação)
- [ ] Padrão de resposta lista: `{ data, total, limit, skip }`
- [ ] Padrão publish: `PATCH /:id` com `{ is_published }` ou rota `PATCH /:id/publish`

#### S0.3 — Auditoria
- [ ] Estender `docs/artifacts/luditeca-portal-admin-scope.v1.json` com `EVT:ACTIVITY_*`, `EVT:LIBRAS_*`, `EVT:PUZZLE_*`, `EVT:COLORING_*`
- [ ] Helper `writeContentAudit(app, request, { actionCode, targetType, targetId, bookId? })` se fizer sentido unificar com `auditLog.ts`

#### S0.4 — Frontend shell
- [ ] `frontend/pages/admin/index.js` — layout com abas: Livros | LIBRAS | Atividades | Puzzle | Pinturas
- [ ] Guard: `admin` ou `editor` (redirecionar outros para `/books` ou `/app`)
- [ ] Link no `frontend/components/Layout.js`: **Área Admin** → `/admin`
- [ ] Placeholder por aba (“Em construção — Sprint N”)

#### S0.5 — Decisões registadas (README curto em `docs/feature/DECISOES.md`)
- [ ] Onde corre a app infantil (este repo vs externo)
- [ ] Coloring: merge de SVGs no **backend** vs **frontend**
- [ ] Activity `matching`: incluir na v1 ou adiar

### Validação S0
```powershell
cd backend; npx prisma migrate status
cd ..\frontend; npm run build
```
- [ ] `/admin` abre com utilizador `editor`
- [ ] Migração aplicada sem erro

### Critérios de aceitação S0
- Schema migrado; shell navegável; nenhuma regressão em login/livros existentes

---

## Sprint 1 — API + CMS: Puzzle e Pinturas (estimativa: 4–5 dias)

**Branch:** `feat/admin-s1-puzzle-coloring` ← `feat/admin-s0-fundacao`

**Porquê primeiro:** poucos campos, valida upload + `is_published` + audit antes dos editores complexos.

### S1.1 — Backend Puzzle
- [ ] `backend/src/routes/puzzleGameRoutes.ts`
  - `GET /puzzle-games` (CMS, `requireCmsEditor`)
  - `POST /puzzle-games` — obrigatório `title`, `image_url`
  - `GET /puzzle-games/:id`
  - `PATCH /puzzle-games/:id`
  - `DELETE /puzzle-games/:id`
  - `piece_count` ∈ {15, 30, 60, 120, 240}
- [ ] Registar em `server.ts`
- [ ] `writeAuditLog` em create/update/delete/publish

### S1.2 — Backend Coloring
- [ ] `backend/src/routes/coloringPageRoutes.ts` (mesmo padrão)
- [ ] “Excluir” padrão embutido = `is_published: false` + `default_id` (Feature1 §6.5)
- [ ] Opcional S1: endpoint `GET /coloring-pages/merged` que devolve defaults + DB (ou adiar merge para S5)

### S1.3 — Frontend libs
- [ ] `frontend/lib/puzzleGames.js`
- [ ] `frontend/lib/coloringPages.js`
- [ ] Normalizers em `apiNormalize.js` se necessário

### S1.4 — UI admin
- [ ] `frontend/pages/admin/puzzle/index.js` — lista + modal criar/editar (portar lógica de `PuzzleGameManager.jsx`)
- [ ] `frontend/pages/admin/coloring/index.js` — lista + modal (portar `ColoringPagesManager.jsx`)
- [ ] Upload via `uploadFile` / `storageApi` existente; bucket sugerido: `puzzles`, `coloring`

### Validação S1
```powershell
# Com token editor
curl -sH "Authorization: Bearer $env:TOKEN" http://localhost:3020/puzzle-games
```
- [ ] Ciclo manual: criar puzzle → upload imagem → publicar → ver na lista
- [ ] Linha em `/admin/audit` com `EVT:PUZZLE_CREATE` (ou equivalente)

### Critérios de aceitação S1
- CRUD completo puzzle + coloring no CMS; audit em mutações; sem senha local admin

---

## Sprint 2 — API + CMS: Atividades e LIBRAS (estimativa: 5–7 dias)

**Branch:** `feat/admin-s2-activity-libras` ← após S1 merged

### S2.1 — Backend Activity
- [ ] `activityRoutes.ts` — CRUD + filtro `is_published`
- [ ] Validar `type` e estrutura `questions[]` (Zod ou validação manual)
- [ ] Tipos UI v1: `quiz`, `trueFalse`, `fillBlank`, `flashcard` (matching adiado se decidido em S0)

### S2.2 — Backend LIBRAS
- [ ] `librasLessonRoutes.ts` — CRUD; listagem ordenada por `sort_order`
- [ ] `PATCH /libras-lessons/reorder` — body `{ ids: string[] }` (opcional mas útil)

### S2.3 — Frontend
- [ ] `frontend/lib/activities.js`, `frontend/lib/librasLessons.js`
- [ ] `frontend/pages/admin/activities/index.js` + `[id]/edit.js`
- [ ] `frontend/pages/admin/libras/index.js` + `[id]/edit.js`
- [ ] Portar/adaptar `ActivityEditor.jsx` e `LibrasEditor.jsx` (React Router → Next; Base44 → `apiFetch`)

### Validação S2
- [ ] Criar atividade quiz com 3 perguntas → guardar → reabrir editor
- [ ] Criar lição LIBRAS → alterar `sort_order` → ordem refletida na lista

### Critérios de aceitação S2
- Editores funcionais para create (`id=new`) e edit; publish toggle nas listagens

---

## Sprint 3 — Hub admin e integração Livros (estimativa: 3–4 dias)

**Branch:** `feat/admin-s3-hub-livros` ← após S2

### S3.1 — Hub unificado
- [ ] Completar `frontend/pages/admin/index.js`:
  - Aba **Livros**: tabela resumida (título, workflow, autor) + links `edit-v2` + toggle publicar (`workflow_status`)
  - Abas restantes: embed ou redirect para `/admin/puzzle`, etc.
- [ ] Ações globais: **sem** “alterar senha local”; link para perfil `/profile` ou change-password API

### S3.2 — Livros no hub
- [ ] Reutilizar `getBooks` / `updateBook` de `lib/books.js`
- [ ] Atalhos: Novo livro → `/books/new`; Editar → `/books/[id]/edit-v2`
- [ ] Publicar = `workflow_status: 'published'` (alinhado a Feature1 “publicado na library”)

### S3.3 — Permissões
- [ ] `editor`: todas as abas de conteúdo
- [ ] `admin`: + utilizadores/audit (já em `/admin/users`, `/admin/audit`)
- [ ] Documentar em `docs/ROTAS-E-PERMISSOES-LOGIN.md` as novas rotas

### Validação S3
- [ ] Um único ponto de entrada `/admin` para gestão de conteúdo
- [ ] Publicar livro no hub → `workflow_status` atualizado na API

### Critérios de aceitação S3
- Hub substitui necessidade de navegar só por `/books` para tarefas admin do dia-a-dia

---

## Sprint 4 — API de leitura para app infantil (estimativa: 3–5 dias)

**Branch:** `feat/admin-s4-app-api` ← após S3

**Pré-requisito:** decisão S0 sobre onde corre a app.

### S4.1 — Rotas `/app/*` (ou prefixo acordado)
- [ ] `GET /app/books` — `workflow_status = published`; projeção leve (sem `pages_v2` completo na lista)
- [ ] `GET /app/books/:id` — detalhe para leitura (view=v2, hidratação mídia como hoje)
- [ ] `GET /app/activities` — `is_published = true`
- [ ] `GET /app/activities/:id` — player payload
- [ ] `GET /app/libras-lessons` — ordenado
- [ ] `GET /app/puzzle-games` — publicados
- [ ] `GET /app/coloring-pages` — publicados (+ merge defaults se política S0 = backend)

### S4.2 — Autorização
- [ ] `requireAuth` com roles `aluno` | `professor` (e opcionalmente `editor` para testes)
- [ ] Garantir que rotas CMS **não** são acessíveis com token de aluno (403)

### S4.3 — Frontend (mínimo se app neste repo)
- [ ] `frontend/lib/appContent.js` — wrappers dos endpoints
- [ ] Esqueleto em `/app` com links para library / activities (se S5 for aqui)

### Validação S4
- [ ] Token `aluno`: lista só conteúdo publicado
- [ ] Token `aluno`: `PATCH /puzzle-games` → 403

### Critérios de aceitação S4
- Contratos estáveis documentados (OpenAPI ou tabela em `docs/feature/API-APP.md`)

---

## Sprint 5 — App infantil no CMS (opcional, 7–14 dias)

**Branch:** `feat/admin-s5-app-ui` — só se app for neste monorepo

### Tarefas (paralelo ao Mundo Lúdico se existir repo separado)
- [ ] `/app/library` — livros publicados
- [ ] `/app/activities` + `/app/activity/[id]` — player (portar `ActivityPlayer`)
- [ ] `/app/puzzle` + `/app/coloring` — portar páginas de atividade
- [ ] LIBRAS em atividade dedicada + suporte em páginas de livro (`activity_type: libras` no v2 — alinhamento futuro com `pages_v2`)

### Critérios de aceitação S5
- Ciclo ponta-a-ponta: admin publica → utilizador aluno vê na app

---

## Sprint 6 — Qualidade, segurança e operações (estimativa: 3–5 dias, contínuo)

**Branch:** `feat/admin-s6-qualidade`

### S6.1 — Testes
- [ ] Vitest: validadores de payload Activity/Puzzle
- [ ] Testes de integração API (supertest ou scripts curl documentados)
- [ ] Checklist manual em `docs/feature/CHECKLIST-QA-AREA-ADMIN.md` (derivado do Feature1 §9)

### S6.2 — Lacunas do portal (artefato 3.1)
- [ ] SMTP para email de reset ([`RES-SMTP-RESET`](../artifacts/luditeca-portal-admin-scope.v1.json))
- [ ] `pageRef` no editor v2 ao gravar página ([`RES-PAGEREF-EDITOR`])
- [ ] Export CSV `/admin/audit` ([`RES-AUDIT-CSV-RETENTION`])

### S6.3 — Segurança
- [ ] Rate limit em upload (se ainda não existir)
- [ ] Revisão: nenhuma rota de escrita sem `requireCmsEditor` / `requireAdmin`
- [ ] Revisão CORS e tamanho de body para payloads de atividades (JSON)

### S6.4 — Documentação final
- [ ] Atualizar `INTEGRACAO-AREA-ADMIN.md` com secção “Implementado em luditeca-vps”
- [ ] Atualizar `ROTAS-E-PERMISSOES-LOGIN.md`

---

## Cronograma sugerido (referência)

| Semana | Sprint | Entregável principal |
|--------|--------|----------------------|
| 1 | S0 + início S1 | Prisma + shell `/admin` + API puzzle |
| 2 | S1 + S2 | Coloring + activities/libras API+UI |
| 3 | S3 + S4 | Hub completo + API `/app/*` |
| 4 | S5–S6 | App infantil (se aplicável) + QA/docs |

_Ajustar conforme tamanho da equipa (1 dev ≈ 4 semanas; 2 devs podem paralelizar S1 backend + S1 frontend)._

---

## Checklist de merge para `main`

- [ ] Todas as migrações Prisma aplicadas em staging
- [ ] `npm run build` (frontend) e build backend OK
- [ ] Sem regressão: login, `/books`, `edit-v2`, import PPTX
- [ ] Audit logs gerados nas mutações novas
- [ ] `.env.example` atualizado se novos buckets ou flags
- [ ] Sem segredos nem senha admin em `localStorage`

---

## Referências rápidas

| Documento | Uso |
|-----------|-----|
| [`Feature1`](./Feature1) | Spec funcional e schemas Base44 |
| [`commands/integrar-area-admin.md`](./commands/integrar-area-admin.md) | Instruções para agente Cursor |
| [`../ROTAS-E-PERMISSOES-LOGIN.md`](../ROTAS-E-PERMISSOES-LOGIN.md) | JWT e roles actuais |
| [`../ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md`](../ARTEFATO-PORTAL-ADMIN-TRILHA.v1.md) | Audit + users já feitos |
| [`../../claude/PLANO-IMPLEMENTACAO.md`](../../claude/PLANO-IMPLEMENTACAO.md) | Roadmap performance/editor (paralelo, outra branch) |

---

*Última atualização: roteiro inicial para integração da Área do Administrador. Ajustar datas após kickoff S0.*
