# Evidências — Tarefa 3.4 (produção interna no portal — editor)

**Referência de requisito:** item 3.4 do quadro — produção interna no portal: texto na plataforma, artes e prompts, vídeo/áudio/GIF/pop-ups, histórico por página, visão consolidada do livro; referências de UX (Book Creator, Kotobee Academy, criador de PDF interativo).

**Âmbito deste documento:** o que **está implementado** no CMS Luditeca em torno do **editor de livros** (modelo `pages_v2`, canvas Konva, painéis v2). As referências externas servem de **contexto de produto**; não há integração técnica com esses sites.

**Repositório:** `luditeca-vps` (Next.js 15 no `frontend/`).

**Entrada principal:** `GET /books/[id]/edit-v2` (a rota `edit.js` apenas reexporta `edit-v2.jsx`).

---

## 1. Mapa do fluxo de produção

| Etapa | Onde no código / UI |
|--------|---------------------|
| Abrir obra | Lista de livros → editar → `/books/{id}/edit-v2`. |
| Área de desenho | `CanvasStageKonva.jsx` — stage Konva, nós, seleção, grelha/réguas opcionais. |
| Organização | Painel **Páginas** / **Mídia** em `PageSidebar.jsx` (miniaturas, capítulos quando existir outline, biblioteca por tipo). |
| Propriedades e camadas | `PropertiesInspector.jsx`, `LayerManagerPanel.jsx`. |
| Tempo / animação | `BottomDock.jsx` + `ProTimeline.js` — passos da timeline por nó e reprodução. |
| Guardar | `updateBook` com `pages_v2` + migração para `pages` legado; rascunho local em `localStorage` (chave `luditeca:editor:v2:draft:{id}`). |
| Ficha da obra | Aba **Informações** no mesmo ecrã: metadados, capa, estado editorial, anexos (`outline.attachments`). |

Documentação interna do módulo: [`frontend/components/editor/README.md`](../frontend/components/editor/README.md), [`frontend/components/editor/v2/README.md`](../frontend/components/editor/v2/README.md).

---

## 2. Requisito × implementação (matriz honesta)

| Requisito (3.4) | Estado | Notas |
|-----------------|--------|--------|
| Escrever texto na plataforma | **Sim** | Nós `type: 'text'` com edição rica (`RichTextNode` em `CanvasStageKonva.jsx`); ferramenta “Texto” na barra lateral em `edit-v2.jsx` (`makeTextNode`). |
| Subir artes (imagens, etc.) | **Sim** | Upload para bucket `pages` com contexto de livro; biblioteca em separadores; arrastar para o canvas (`handleCanvasDrop` / payload `application/x-luditeca-media`). |
| Registar prompts | **Não** (IA) | Não existe fluxo de “prompts” para geração de conteúdo; apenas `window.prompt` nativo para nome de capítulo. |
| Vídeo | **Sim** | Biblioteca `videos`, nós de vídeo, `VideoEditorPanel` / metadados de reprodução (`editorMeta.video`); inspector com pré-visualização. |
| Áudio | **Sim** | Listagem `audios`, `AudioLibraryPickModal`, badges de áudio ligados a nós no canvas. |
| GIF | **Sim** | Upload `image/gif`; `gifPlaybackUtils.js`, reprodução manual no canvas quando necessário; controlos no inspector (velocidade, loop, repetições). |
| Pop-ups interativos | **Não** | Sem hotspots/pop-ups tipo leitor interativo; existem **modais** de edição de mídia (`MediaEditModal`) e confirmações de UI, não overlays de conteúdo por página. |
| Histórico por página | **Parcial** | **Undo/redo** em sessão (`useEditorState.js`): snapshots por alteração de página (pilhas até 80 entradas), atalhos Ctrl/Cmd+Z/Y; **não** há histórico versionado persistido no servidor por página. |
| Visão consolidada do livro | **Parcial** | Lista de páginas com miniatura (`getPagePreviewMedia`); reprodução da timeline no rodapé percorre passos. **Não** há modo “pré-visualização do livro” dedicado: `isPreviewMode` existe no canvas mas em `edit-v2.jsx` está fixo em `false`. |

---

## 3. Componentes e ficheiros-chave

| Ficheiro | Função |
|----------|--------|
| `frontend/pages/books/[id]/edit-v2.jsx` | Orquestra layout, tabs, gravação, rascunho local, capítulos/outline, atalhos (copiar/colar nó, undo, guardar). |
| `frontend/pages/books/[id]/edit.js` | Reexporta `edit-v2` (compatibilidade de rota). |
| `frontend/components/editor/CanvasStageKonva.jsx` | Canvas: texto rico, imagem, vídeo, formas, GIF, áudio; modo preview preparado para leitura sem edição. |
| `frontend/components/editor/v2/hooks/useEditorState.js` | `patchPage`, `patchNode`, `undo`/`redo`, reordenar/adicionar páginas, clipboard de nó. |
| `frontend/components/editor/v2/panels/PageSidebar.jsx` | Páginas, capítulos, biblioteca imagem/vídeo/áudio, upload, modais de imagem/vídeo. |
| `frontend/components/editor/v2/panels/PropertiesInspector.jsx` | Cor, tipografia, transições, vídeo, GIF, animações de entrada, etc. |
| `frontend/components/editor/v2/panels/BottomDock.jsx` | Timeline + grelha/snap. |
| `frontend/components/editor/v2/panels/LayerManagerPanel.jsx` | Camadas (z-order, visibilidade, bloqueio). |
| `frontend/components/editor/v2/panels/ShapeSidebar.jsx` | Inserção de formas. |
| `frontend/components/editor/v2/media/*` | Modais e painéis de edição de imagem/vídeo; utilitários da biblioteca. |
| `frontend/lib/pagesV2/migrate.js` | Sincronização entre modelo v2 e legado ao gravar. |

---

## 4. Multimédia e armazenamento

- Biblioteca do livro usa a API de média com cabeçalhos de contexto (`x-book-id` / `bookId`) e `root: 'library'` onde aplicável (ver `storageApi.js` e `PageSidebar`).
- Formatos visíveis no upload de imagens incluem **GIF** e WebP/JPEG/PNG (`accept` em `PageSidebar`).
- Vídeos e áudos são listados por prefixo nos buckets configurados na API (`media` routes).

---

## 5. Histórico e rascunhos (clarificação)

1. **Undo/redo:** apenas na memória da sessão do browser; ao mudar de página, o undo continua a operar sobre snapshots que guardam o **índice da página** afetada.
2. **Rascunho local:** `localStorage` com merge de `pages_v2`, título, descrição, autor, categoria, capa e `workflow_status`; oferta de restauração ao reabrir o livro.
3. **Servidor:** cada “Guardar” substitui o documento do livro; não há cadeia de revisões por página na base de dados nesta entrega.

---

## 6. Checklist manual sugerido

1. Autenticar como editor; abrir `/books/{id}/edit-v2`.
2. Inserir **texto**, editar inline, alterar fonte/cor no inspector.
3. Carregar **imagem** e **GIF**; verificar animação e controlos no inspector.
4. Inserir **vídeo** e **áudio** (biblioteca ou fluxo de pick); reproduzir na timeline.
5. Usar **Ctrl+Z / Ctrl+Y** após mover um nó; confirmar reversão.
6. Guardar, recarregar a página e confirmar persistência (e ausência de rascunho local após guardar com sucesso).
7. Percorrer **miniaturas** na sidebar e **play** na timeline como “visão” espacial/temporal do conteúdo.

---

## 7. Lacunas face ao enunciado completo

- **Pop-ups / conteúdo interativo tipo Kotobee** (hotspots, lightbox pedagógico): não implementado como tipo de nó ou fluxo.
- **Prompts / IA** para texto ou imagem: não implementado.
- **Histórico versionado** por página no backend: não implementado.
- **Modo leitor / visão consolidada full-screen** do livro: o canvas suporta `isPreviewMode`, mas o CMS **não** expõe toggle para o utilizador nesta página.

Quando a equipa fechar a 3.4 no quadro de tarefas, estes itens podem passar a roadmap explícito ou novas evidências por incremento.
