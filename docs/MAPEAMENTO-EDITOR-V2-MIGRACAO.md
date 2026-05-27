# Mapeamento do editor de livros (v2 / Konva) — reutilização vs migração

Este documento descreve as **pilhas** de código do CMS em `luditeca-vps` ligadas ao editor actual (`pages_v2`, `react-konva`), o que tende a **substituir-se** com um novo fluxo de criação de livros e o que é **candidato a reutilização** ou depende do **contrato de dados** até haver migração completa.

**Entrada do editor actual:** `frontend/pages/books/[id]/edit-v2.jsx` (e `edit.js`, que reexporta o v2).

**Referência interna:** `frontend/components/editor/README.md` e `frontend/components/editor/v2/README.md`.

---

## 1. Pilha A — Específico do editor Konva / v2 (substituir)

Assume o modelo **`pages_v2`** (canvas, nós, timeline). Com um editor novo baseado noutro paradigma, este bloco **deixa de ser a solução** (pode manter-se em ramo até ao novo editor estar pronto).

| Caminho | Função resumida |
|---------|-----------------|
| `frontend/pages/books/[id]/edit-v2.jsx` | Orquestração: livro, `ensurePagesV2`, workflow, layout, painéis, `CanvasStageKonva` dinâmico (`ssr: false`). |
| `frontend/pages/books/[id]/edit.js` | Reexporta `edit-v2`. |
| `frontend/components/EditorLayout.js` | *Shell* da página de edição. |
| `frontend/components/editor/CanvasStageKonva.jsx` | Stage Konva: nós, transformer, mídia, GIF. |
| `frontend/components/editor/ProTimeline.js` | Timeline de animações por nó. |
| `frontend/components/editor/RulersOverlay.js` | Réguas em volta do stage. |
| `frontend/components/editor/StorageBackedHtmlImage.jsx` | Pré-visualização `<img>` com URL de storage resolvida. |
| `frontend/components/editor/useGifManualCanvas.js` | Controlo manual de frame GIF no canvas. |
| `frontend/components/editor/editorConstants.js` | Fontes do editor, `MAX_TIMELINE_STEP`, etc. |
| `frontend/components/editor/gifPlaybackUtils.js` | Constantes e helpers GIF (`DEFAULT_GIF_NODE_PROPS`, hints). |
| `frontend/components/editor/canvas/snapViewportUtils.js` | Snap, pan, menu de contexto do viewport. |
| `frontend/components/editor/canvas/snapViewportUtils.test.js` | Testes do snap/viewport. |
| `frontend/components/editor/v2/panels/PageSidebar.jsx` | Páginas, biblioteca de mídia, modais de imagem/vídeo. |
| `frontend/components/editor/v2/panels/PropertiesInspector.jsx` | Propriedades do nó seleccionado. |
| `frontend/components/editor/v2/panels/LayerManagerPanel.jsx` | Camadas: ordem, visibilidade, bloqueio. |
| `frontend/components/editor/v2/panels/ShapeSidebar.jsx` | Inserção de formas. |
| `frontend/components/editor/v2/panels/BottomDock.jsx` | Dock inferior (timeline + `ProTimeline`). |
| `frontend/components/editor/v2/hooks/useEditorState.js` | Estado partilhado do v2. |
| `frontend/components/editor/v2/hooks/useEditorState.test.js` | Testes do hook. |
| `frontend/components/editor/v2/hooks/useMediaLibraryData.js` | Lista da biblioteca por separador + métricas. |
| `frontend/components/editor/v2/lib/editorMetrics.js` | Métricas de performance (desenvolvimento). |
| `frontend/components/editor/v2/media/MediaLibraryThumb.jsx` | Miniatura na grelha da biblioteca. |
| `frontend/components/editor/v2/media/GifFirstFrameThumb.jsx` | Miniatura estática de GIF. |
| `frontend/components/editor/v2/media/MediaEditModal.jsx` | Modal (portal) de edição de mídia. |
| `frontend/components/editor/v2/media/ImageEditorPanel.jsx` | Conteúdo do modal — imagem (crop/ajustes). |
| `frontend/components/editor/v2/media/VideoEditorPanel.jsx` | Conteúdo do modal — vídeo. |
| `frontend/components/editor/v2/media/AudioLibraryPickModal.jsx` | Escolha de áudio na biblioteca. |
| `frontend/components/editor/README.md` | Documentação do stack actual. |
| `frontend/components/editor/v2/README.md` | Documentação da pasta v2. |

**Teste associado às utilidades de mídia (ver pilha B):** `frontend/components/editor/v2/media/mediaLibraryUtils.test.js`.

---

## 2. Pilha B — Lógica pouco acoplada ao Konva (reutilizar ou extrair para `lib/`)

Candidata a **manter** ou a **mover** para `frontend/lib/` se o novo editor precisar dos mesmos conceitos (upload, buckets, crop em %, nomes de ficheiro, filtros CSS de imagem).

| Caminho | O quê reaproveitar |
|---------|-------------------|
| `frontend/components/editor/v2/media/mediaLibraryUtils.js` | `getAcceptFromMediaType`, sanitização de nomes, `normalizeCropRect`, `normalizeImageAdjustments`, `imageCssFilter`, badges de formato, `readMediaMetaMap` / `writeMediaMetaMap` (se se mantiver meta de mídia por livro no cliente). |
| `frontend/lib/editorUtils.js` | `toNum`, `clamp`, `round2` — utilitários genéricos. |
| `frontend/lib/useResolvedStorageUrl.js` | Resolução de URLs de storage para previews. |
| `frontend/lib/storageApi.js` | Upload e listagem na API de mídia — dependência directa do v2, mas **não** pertence ao editor. |
| `frontend/lib/books.js`, `frontend/lib/apiClient.js`, `frontend/lib/apiNormalize.js` | Contrato HTTP do livro; o novo editor continua a usar a API. |

**Sugestão de evolução:** extrair as funções **puras** de `mediaLibraryUtils.js` para algo como `frontend/lib/mediaLibraryPure.js`, para o novo editor não importar de `components/editor/`.

---

## 3. Pilha C — Contrato `pages_v2` / fluxo editorial (manter enquanto o formato existir)

Ficheiros **fora** de `components/editor/`, mas acoplados ao modelo actual do livro e usados por `edit-v2.jsx` (e possivelmente pelo leitor).

| Caminho | Notas |
|---------|--------|
| `frontend/lib/pagesV2/migrate.js` | Migração entre `pages` legado e `pages_v2`; necessário até não existir legado ou até um único formato novo. |
| `frontend/lib/bookFlowOutline.js` | Outline / capítulos em cima da estrutura v2 (`ensureBookOutlineOnV2`, `getOutlineFromV2`, etc.). |
| `frontend/lib/audioBadgeCanvas.js` | Geometria do badge de áudio alinhada ao modelo de nós actual — **reutilizar** se o novo formato mantiver as mesmas propriedades; caso contrário revisar com o `luditeca_app` leitor. |

O **backend** (`bookRoutes`, hidratação de URLs, `search_index`, workflow) mantém-se; pode evoluir o **schema JSON** em `Book.pages` / `Book.pagesV2` conforme o novo editor.

---

## 4. Pilha D — Infra transversal

| Caminho | Uso |
|---------|-----|
| `frontend/lib/telemetryClient.js` | Ex.: `CanvasStageKonva` reporta falhas de reprodução de vídeo; o novo editor pode reutilizar o mesmo padrão. |

---

## 5. Grafo de dependências (resumo)

```text
edit-v2.jsx
  → EditorLayout, components/editor/* (Konva, timeline, rulers, gif)
  → components/editor/v2/panels/*, hooks/*, v2/lib/editorMetrics
  → lib: books, authors, categories, storageApi, pagesV2/migrate,
         bookFlowOutline, roles, contexts/auth

CanvasStageKonva.jsx
  → react-konva, editorUtils, editorConstants, useGifManualCanvas,
     gifPlaybackUtils, audioBadgeCanvas, v2/media/mediaLibraryUtils,
     useResolvedStorageUrl, telemetryClient

Painéis / modais / inspector
  → storageApi, useResolvedStorageUrl, mediaLibraryUtils,
     StorageBackedHtmlImage
```

---

## 6. Tabela rápida “manter / arquivar com Konva”

| Manter ou evoluir noutro sítio | Arquivar com o editor Konva v2 |
|-------------------------------|--------------------------------|
| `lib/editorUtils.js` | `CanvasStageKonva.jsx` |
| `lib/useResolvedStorageUrl.js` | `ProTimeline.js` |
| `lib/storageApi.js` | `RulersOverlay.js` |
| `lib/books.js` (+ API backend) | `useEditorState.js` |
| Funções puras de `mediaLibraryUtils.js` (ideal extrair para `lib/`) | Resto de `v2/panels/*`, `v2/media/*` (JSX) |
| `pagesV2/migrate.js`, `bookFlowOutline.js` até migração de formato | `edit-v2.jsx`, `EditorLayout.js` |
| `audioBadgeCanvas.js` se o contrato do nó se mantiver | `useGifManualCanvas.js`, `StorageBackedHtmlImage.jsx` |

---

## 7. Relação com outras entregas

- Catálogo e mídia (API, S3): ver evidências da etapa 5.3 e rotas `/media/*` na documentação de inventário de rotas, se existir.
- Telemetria técnica: etapa 5.4 (`technical_logs`, `telemetryClient`).

---

*Documento gerado para apoiar a migração do fluxo de criação de livros no VPS; actualizar quando o formato alvo do livro e o novo editor estiverem definidos.*
