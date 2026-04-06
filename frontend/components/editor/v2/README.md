# Editor v2 — UI em torno do canvas

Esta pasta concentra **painéis, mídia, hooks e métricas** do editor de livros. O **canvas Konva** está em `../CanvasStageKonva.jsx`. A página que monta tudo é `pages/books/[id]/edit-v2.jsx`.

## Estrutura de pastas

```
v2/
├── panels/          # Laterais, inspector, camadas, formas, dock da timeline
├── media/           # Biblioteca (thumbs), modais de edição, utilitários de mídia
├── hooks/           # Estado do editor e dados da biblioteca
└── lib/             # Código partilhado só do v2 (ex.: métricas)
```

## `panels/`

| Ficheiro | Função |
|----------|--------|
| `PageSidebar.jsx` | Barra lateral: páginas, biblioteca, upload/substituição; orquestra modais de imagem/vídeo. |
| `PropertiesInspector.jsx` | Propriedades do elemento selecionado. |
| `LayerManagerPanel.jsx` | Camadas da página (visibilidade, bloqueio, ordem). |
| `ShapeSidebar.jsx` | Inserção de formas. |
| `BottomDock.jsx` | Timeline + `../../ProTimeline.js` e controlos de grade/snap. |

## `media/`

| Ficheiro | Função |
|----------|--------|
| `MediaLibraryThumb.jsx` | Miniatura na grelha da biblioteca. |
| `GifFirstFrameThumb.jsx` | Miniatura estática de GIF. |
| `MediaEditModal.jsx` | Modal (portal) para edição de vídeo/imagem. |
| `ImageEditorPanel.jsx` | Conteúdo do modal — imagem. |
| `VideoEditorPanel.jsx` | Conteúdo do modal — vídeo. |
| `mediaLibraryUtils.js` | Funções puras (storage, crop, meta, filtros). |
| `mediaLibraryUtils.test.js` | Testes das utilidades. |

## `hooks/`

| Ficheiro | Função |
|----------|--------|
| `useEditorState.js` | Estado partilhado (página ativa, eliminar página, …). |
| `useMediaLibraryData.js` | Lista da biblioteca por separador + métricas. |

## `lib/`

| Ficheiro | Função |
|----------|--------|
| `editorMetrics.js` | Métricas no `window` (dev). |

## Importações externas

- `edit-v2.jsx` importa painéis em `v2/panels/*`, `v2/lib/editorMetrics`, `v2/hooks/useEditorState`.
- `CanvasStageKonva.jsx` importa `v2/media/mediaLibraryUtils` (`readMediaMetaMap`, etc.).
