# Evidências — Tarefa 3.3 (âmbito PPTX apenas)

**Referência de requisito:** item 3.3 do quadro — importação de **pacotes prontos** estruturados, validação, erros de nomenclatura/estrutura, pré-visualização e reaproveitamento de materiais.

**Âmbito deste documento:** apenas o que **já existe** no repositório para importação de ficheiros **`.pptx`** (PowerPoint OOXML). Não cobre ZIP genérico, EPUB, SCORM nem outros “pacotes estruturados”.

**Repositório:** `luditeca-vps` (API Fastify + motor em Node + CMS Next.js).

**Dependências relevantes:** o motor usa `JSZip` + parser XML sobre o conteúdo do `.pptx`; storage Supabase/MinIO no bucket `pages` (imagens por slide); Prisma para validação de livro e registo opcional em `mediaFile`.

---

## 1. Visão geral do fluxo

1. Utilizador autenticado com papel **CMS (editor/admin)** seleciona um `.pptx` (hoje no passo final do assistente em `/books/new`).
2. O browser envia **`multipart/form-data`** para `POST /books/import-pptx` com o ficheiro e metadados de contexto (`bookId`, `userId`).
3. O backend valida o pedido, abre o ZIP OOXML, percorre `ppt/slides/slide*.xml`, extrai texto/formas/imagem de fundo, faz upload de binários quando aplicável e devolve um **array de páginas** no formato legado do editor (`pages[]` com `elements`, `orientation`, etc.).
4. O CMS guarda essas páginas na criação do livro e redireciona para o editor v2 (ver evidências 3.2).

---

## 2. API e permissões

| Item | Detalhe |
|------|---------|
| **Rota** | `POST /books/import-pptx` |
| **Autorização** | `requireCmsEditor` (JWT); utilizador obtido do token no motor. |
| **Corpo** | Apenas `multipart/form-data` (campo `file` + campos `bookId`, `userId`; opcional `dryRun=true` — ver secção 5). |
| **Auditoria** | `importPptxRoute.ts` regista `EVT:BOOK_IMPORT_PPTX_OK`, `EVT:BOOK_IMPORT_PPTX_FAIL` ou `EVT:BOOK_IMPORT_PPTX_DRY_RUN` com metadados de resposta. |

Referência de permissões: [`ROTAS-E-PERMISSOES-LOGIN.md`](ROTAS-E-PERMISSOES-LOGIN.md).

---

## 3. Validações e mensagens de erro (ficheiro / estrutura)

| Situação | HTTP | Mensagem / comportamento |
|----------|------|---------------------------|
| Método ≠ POST | 405 | `Método não permitido.` |
| Sem ficheiro no multipart | 400 | `Arquivo .pptx não enviado.` |
| Nome não termina em `.pptx` | 400 | `Arquivo inválido. Envie um .pptx.` |
| Tamanho > 500 MB | 400 | `Arquivo muito grande. Limite de 500MB.` |
| `bookId` numérico e livro inexistente | 404 | `Livro não encontrado para importação.` |
| ZIP sem `ppt/slides/slideN.xml` | 400 | `Não foi possível encontrar slides no arquivo PPTX.` |
| Nenhum slide com imagem de fundo **nem** texto/formas visíveis após processamento | 422 | `Nenhum slide com imagem ou texto foi encontrado. Verifique o arquivo PPTX.` |
| Falha de autenticação / JWT | 401 | Mensagens do motor (ex.: sessão inválida). |
| Erro não tratado | 500 | `Erro interno ao processar o arquivo PPTX.` (+ `stack` só em `development`). |

**“Nomenclatura” no sentido OOXML:** o motor assume convenção PowerPoint (`ppt/slides/slide1.xml`, `slide2.xml`, …). Ficheiros corrompidos ou estruturas fora do padrão esperado tendem a cair em “sem slides” ou em slides vazios ignorados (ver diagnósticos).

**Cliente (`frontend/lib/pptxImport.js`):** valida `.pptx`, limite 500 MB, token presente, timeout 45 min; trata 413 (Nginx), rede e JSON de erro com `error` devolvido pela API.

---

## 4. Pré-visualização e feedback na UI

| Onde | O quê |
|------|--------|
| **`/books/new` (passo PPTX)** | Overlay de progresso durante upload (`XMLHttpRequest.upload`) e fase “Processando…”. |
| **Após resposta 200** | Loop que atualiza mensagem por slide: `Carregando slide i/total` + resumo textual (`summarizeSlide`: contagens de texto/imagem/fundo). |
| **Avisos** | Se `payload.warnings.length > 0`, toast indica importação com avisos e quantidade de páginas a rever. |

Isto é **pré-visualização operacional** (progresso + resumo por slide), não um renderizador WYSIWYG do `.pptx` antes de gravar.

---

## 5. Modo dry-run (só API)

O campo multipart `dryRun=true` faz o motor **detetar slides** e devolver resumo (`slides`, `totalSlidesDetected`, `diagnostics`) **sem** upload ao storage.

**Nota:** o CMS atual **não** chama `dryRun` no código do assistente; a capacidade existe para integração futura ou testes manuais (Postman/cURL).

---

## 6. Reaproveitamento de materiais

| Mecanismo | Detalhe |
|-----------|---------|
| **Caminhos no storage** | Com `bookId` numérico: `{userId}/books/{bookId}/ativos-importacao/pptx-{importStamp}/slide-XXX.ext`. Com ID temporário (`new-book`, etc.): `{userId}/imports/{importSessionId}/...`. |
| **Upload** | `upsert: true` no upload Supabase — reenvio para a mesma chave substitui o objeto. |
| **Registo `mediaFile`** | Tentativa de criar registo por imagem de slide; falhas são **não bloqueantes** (import continua). |
| **Deduplicação por hash global** | **Não implementada:** cada importação usa um `importStamp` (timestamp) novo; não há dedupe automático entre importações distintas. |

Ou seja: o reaproveitamento limita-se a **URLs/paths estáveis por sessão de import** e a **não bloquear** se o registo em base falhar; não há hoje deteção de “este asset já existe no catálogo”.

---

## 7. Ficheiros-fonte (mapa rápido)

| Ficheiro | Papel |
|----------|--------|
| `backend/src/routes/importPptxRoute.ts` | Registo da rota, adaptador de resposta, auditoria. |
| `backend/src/pptx/importPptxEngine.js` | Parsing OOXML, slides, uploads, warnings, dry-run, resposta JSON. |
| `frontend/lib/pptxImport.js` | Cliente XHR + `FormData`, progresso, erros. |
| `frontend/pages/books/new.js` | Passo de importação PPTX antes de criar o livro (`bookId: 'new-book'`). |
| `frontend/lib/pagesV2/migrate.js` | Migração de spans/estruturas vindas do PPTX para o modelo v2 (quando o fluxo grava `pages_v2`). |

---

## 8. Lacunas face ao enunciado completo da 3.3

- **Pacote estruturado** além de `.pptx`: não suportado.
- **Validação de nomenclatura editorial** (ex.: convenções de nomes de capítulo ficheiro a ficheiro): não há regras de negócio dedicadas; só validação de extensão e estrutura OOXML mínima.
- **Pré-visualização gráfica** antes de confirmar: não há; só progresso e resumo textual pós-resposta.
- **Reaproveitamento inteligente** (hash / dedupe entre livros): não implementado.

---

## 9. Checklist manual sugerido

1. Login como editor no CMS.
2. `/books/new` → avançar até ao passo PPTX → enviar `.pptx` válido → ver overlay e toast de sucesso; confirmar páginas no editor após criar livro.
3. Enviar ficheiro `.pdf` renomeado para `.pptx` → esperar erro de extensão ou falha de parsing.
4. (Opcional) `POST /books/import-pptx` com `dryRun=true` e mesmo multipart → resposta só com contagens/diagnósticos.
