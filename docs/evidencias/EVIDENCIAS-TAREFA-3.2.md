# Evidências — Tarefa 3.2 (cadastro e edição de livros)

**Referência de requisito:** item 3.2 do quadro de tarefas — fluxo para abrir uma obra, preencher metadados, criar capítulos e páginas, ordenar conteúdo, anexar documentos e controlar estado editorial, com UX acessível a editores sem conhecimento técnico profundo.

**Repositório:** `luditeca-vps` (CMS Next.js + API Fastify + Prisma/PostgreSQL).

**Estado editorial (contexto 3.1):** campo `workflow_status` em `books`; continua editável na lista de livros e na ficha do editor v2.

---

## 1. O que foi implementado

| Área | Descrição |
|------|-----------|
| **Assistente de novo livro** | Página `/books/new` em passos: boas-vindas → metadados e capa → capítulos (títulos) → importação opcional de PPTX. Criação com `workflow_status: draft` e redirecionamento para `/books/[id]/edit-v2`. |
| **Estrutura editorial em `pages_v2`** | `outline.chapters[]` e `outline.attachments[]`; `meta.chapterId` por página; helpers em `lib/bookFlowOutline.js` (`ensureBookOutlineOnV2`, `buildInitialV2FromChapters`, etc.). |
| **Editor v2** | Aba **Informações**: estado editorial, capítulos (adicionar/renomear), anexos (upload para biblioteca do livro), persistência com o livro. **Sidebar de páginas**: filtro por capítulo, mover página para cima/baixo, título do capítulo por página. |
| **Modelo de dados** | Sem migração nova dedicada à 3.2: outline vive dentro do JSON `pages_v2` já suportado pela API de livros. |

---

## 2. Arquivos-fonte (principais)

### CMS (frontend)

| Ficheiro | Função |
|----------|--------|
| `frontend/lib/bookFlowOutline.js` | Outline (capítulos + anexos), IDs, garantia de outline em v2, construção inicial a partir de títulos de capítulos. |
| `frontend/pages/books/new.js` | Assistente multi-passo; envio de `pages` / `pages_v2` com outline ou resultado de import PPTX. |
| `frontend/pages/books/[id]/edit-v2.jsx` | Carregar/guardar livro com outline; anexos; workflow; integração com sidebar e capítulos. |
| `frontend/components/editor/v2/panels/PageSidebar.jsx` | Capítulos, reordenação de páginas, rótulos por capítulo. |
| `frontend/components/editor/v2/hooks/useEditorState.js` | `addPage` com `chapterId`, `reorderPages`. |
| `frontend/lib/storageApi.js` | `uploadFile` com `opts.headers` (ex.: `x-book-id`) e `opts.root` para anexos na biblioteca do livro. |
| `frontend/lib/books.js` | `createBook` aceita `workflow_status` quando presente. |
| `frontend/pages/books/index.js` | Lista de obras; texto de contexto sobre o assistente (quando aplicável na revisão). |

### API (backend)

| Ficheiro | Função |
|----------|--------|
| `backend/src/routes/mediaRoutes.ts` | `parseBookId` a partir de query `bookId` ou cabeçalho `x-book-id` para uploads na pasta do livro. |
| `backend/src/routes/bookRoutes.ts` | POST/PATCH de livro com `pages_v2` e `workflow_status` (já alinhado com 3.1). |

---

## 3. Como validar (checklist manual)

1. **CMS** com utilizador editor/admin autenticado.
2. **Novo livro sem PPTX:** `/books/new` → concluir passos 1–2 → saltar PPTX → confirmar criação → abre `edit-v2` com uma página por capítulo e outline coerente.
3. **Novo livro com PPTX:** passo final com ficheiro válido → páginas importadas; rever outline/capítulos conforme comportamento atual do import.
4. **Edição:** na aba Informações, alterar estado editorial, renomear/adicionar capítulo, enviar anexo; guardar e recarregar.
5. **Sidebar:** filtrar por capítulo; mover páginas; adicionar página (fica no capítulo ativo quando aplicável).

---

## 4. Limitações conhecidas

- Importação PPTX na criação pode **substituir** a estrutura só-capítulos (comportamento herdado do fluxo de import); alinhar capítulos a slides importados é melhoria futura.
- Anexos são referências na outline (URLs/storage); não há leitor PDF embutido no CMS nesta entrega.

---

## 5. Referências externas (requisito da tarefa)

Inspiração de UX citada no quadro: Book Creator, Kotobee Author/Publisher — aqui aplicada de forma enxuta (passos claros, linguagem não técnica, organização por capítulos e anexos).
