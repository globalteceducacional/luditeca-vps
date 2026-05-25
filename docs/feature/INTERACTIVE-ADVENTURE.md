# Livro interativo — «Escolha sua aventura»

## Modelo de dados

Cada **página** da história (guardada em `books.pages[]`):

```json
{
  "page_id": 1,
  "scene_id": "1",
  "scene_title": "A praça",
  "text": "Chegas à praça vazia. O vento sopra forte.",
  "image_url": "uid/library/book-interactive/plaza.jpg",
  "characters": ["narrador", "mendigo"],
  "is_start": true,
  "is_ending": false,
  "ending_type": null,
  "on_enter": {
    "set_flags": { "visited_plaza": true },
    "add_items": []
  },
  "choices": [
    {
      "label": "Falar com o mendigo",
      "target_page_id": 2,
      "target_scene_id": "2",
      "conditions": null,
      "effects": { "add_items": ["moeda"] }
    },
    {
      "label": "Ir para a biblioteca",
      "target_page_id": 3,
      "target_scene_id": "3",
      "conditions": { "requires_items": ["mapa"] },
      "effects": null
    }
  ]
}
```

**Final** — `is_ending: true` e `ending_type`: `good` | `bad` | `secret` | `neutral`.

**Quiz editorial** (opcional) — bloco com `page_type: "quiz"` na mesma lista (modo «Ordem do livro» na app).

**Metadados** (opcional) — um objeto com `page_type: "interactive_meta"` no array:

```json
{
  "page_type": "interactive_meta",
  "version": 1,
  "story_title": "A chave perdida",
  "characters": ["narrador", "mendigo", "bibliotecaria"],
  "items_catalog": ["moeda", "mapa", "chave_antiga"]
}
```

## Exemplo de história ramificada

```
Página 1 (início) — A praça
  → 2 Falar com o mendigo
  → 3 Ir para a biblioteca (requer item: mapa)

Página 2 — O mendigo
  → 4 Seguir o túnel

Página 3 — Biblioteca
  → 5 Abrir o cofre (requer flag: tem_chave)
  → 6 Sair (final mau)

Página 4 — Túnel
  → 7 Sala secreta (final secreto)

Página 5 — Cofre aberto (final bom)
```

## Estado do leitor (app)

Em `localStorage` (`luditeca-adventure-{bookId}`):

- `currentPageId` — página actual
- `flags` — variáveis de decisão (`{ tem_chave: true }`)
- `inventory` — itens (`["moeda", "mapa"]`)
- `history` — pilha para **Voltar**
- `visitedPageIds` — páginas já visitadas

## Leitor (app)

- Mostra texto + imagem da página
- Lista escolhas disponíveis (respeita `conditions`)
- Ao escolher: aplica `effects` → navega → `on_enter` da página destino
- **Voltar**, **Guardar**, **Carregar**, **Recomeçar**
- Encerra com mensagem conforme `ending_type`

## Editor (CMS)

`/books/new/interactive` ou `/books/{id}/edit-flow`

- ID numérico por página
- Escolhas com destino = ID da página
- Tipo de final (bom / mau / secreto / neutro)
- Grafo e mapa de cenas (ferramentas existentes)

## Código

| Ficheiro | Função |
|----------|--------|
| `frontend/lib/interactiveAdventure.js` | Motor: normalização, condições, efeitos, save/load |
| `frontend/components/app/AppInteractiveAdventureReader.jsx` | Leitor na app |
| `frontend/lib/interactiveScenes.js` | Editor + grafo (usa adventure) |

## Seed de demonstração

```bash
cd backend
npm run seed:interactive-demo
npm run publish:interactive-demo -- 36
```

Abre o livro **36** (ou o ID devolvido) em `/books/36/edit-flow`.  
Na app (após publicar): `/app/library/36`.

Imagens nas cenas são **opcionais** (história pode ser só texto + escolhas).
