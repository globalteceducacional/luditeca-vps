# Editor de livros (stack atual)

Entrada: `pages/books/[id]/edit-v2.jsx` (e `edit.js` que reexporta).

## Componentes principais

- `CanvasStageKonva.jsx` — stage Konva, nós, transformer, fundo
- `ProTimeline.js` — timeline (usado por `v2/panels/BottomDock.jsx`)
- `RulersOverlay.js` — réguas decorativas ao redor do stage
- `editorConstants.js` — fontes, limites da timeline
- `StorageBackedHtmlImage.jsx` — pré-visualizações HTML com URL de storage
- `canvas/snapViewportUtils.js` — snap, pan, menu de contexto

## Pasta `v2/`

UI lateral, timeline dock, mídia e hooks do editor. **Mapa detalhado:** [`v2/README.md`](./v2/README.md).

## Princípios de UI

1. Painel lateral com categorias claras e hierarquia visual consistente.
2. Ações primárias explícitas (`Guardar e fechar`, `Substituir ficheiro`, etc.).
3. Evitar modais presos ao contexto do canvas; usar portal no `document.body`.
4. Timeline e inspector devem refletir o mesmo contrato de dados dos nós (`pages_v2`).
