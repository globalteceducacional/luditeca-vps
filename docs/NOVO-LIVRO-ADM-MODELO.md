# Modelo de dados e parâmetros — novo fluxo ADM «Novo Livro»

Especificação para as telas de criação de livro no CMS (`luditeca-vps` / Next), alinhada aos mockups: **escolha de tipo (imutável)**, **metadados comuns**, **conteúdo por tipo** (Animado / Interativo / Digital).

---

## 1. Tipo de obra (`book_kind`)

Escolha na primeira tela; **não pode ser alterada** após persistência do registo (validação no `PUT` / regra de negócio).

| Valor API | Rótulo UI | Descrição UI |
|-----------|-----------|----------------|
| `animated` | Animado | GIFs + texto + áudio e narração |
| `interactive` | Interativo | Escolhas que levam a diferentes caminhos |
| `digital` | Digital | E-book em PDF ou EPUB |

```ts
/** Tipo editorial da obra — definido na criação, imutável. */
type BookKind = 'animated' | 'interactive' | 'digital';
```

**Sugestão Prisma** (evolução do modelo `Book`):

```prisma
enum BookKind {
  animated
  interactive
  digital
}

// Em model Book:
// bookKind  BookKind?  @map("book_kind")  // null = livros antigos (legado Konva / sem tipo)
```

- Livros existentes: `book_kind = null` → tratados pelo fluxo legado (`pages_v2`) até migração.
- Novos livros: `book_kind` **obrigatório** após o primeiro `POST` bem-sucedido.

---

## 2. Metadados comuns (todas as telas de edição)

Campos partilhados pelo formulário após seleção do tipo.

| Campo API | UI | Tipo | Obrigatório | Notas |
|-----------|-----|------|-------------|--------|
| `title` | Título do livro | `string` | sim | Trim, max razoável (ex.: 500). |
| `catalog_level` | Faixa etária (ex.: 4-8 anos) | `string?` | não | Reutilizar coluna existente `Book.catalogLevel` (`catalog_level`). |
| `description` | Descrição do livro | `string?` | não | `Book.description`. |
| `cover_image` | Capa | `string?` (URL ou chave storage) | não | `Book.coverImage`; upload via `/media` → guardar referência. |
| `workflow_status` | Publicar livro | `BookWorkflowStatus` | — | Checkbox «Publicar»: mapear para `published` ou manter `draft` se desmarcado. |
| `creation_tags` | Categoria (grelha multi-opção) | `string[]` | não | Ver §2.1; persistir em JSON (novo campo ou `catalog_keywords` com convenção). |
| `book_kind` | — | `BookKind` | sim (após passo 1) | Imutável após criação. |

### 2.1 Tags de categoria (UI em grelha)

Valores estáveis sugeridos (slug) para filtros e índice de busca:

| Slug | Rótulo UI |
|------|-----------|
| `infantil` | Infantil |
| `juvenil` | Juvenil |
| `ficcao` | Ficção |
| `br_nacional` | BR Nacional |
| `internacional` | Internacional |
| `educativo` | Educativo |
| `aventura` | Aventura |
| `misterio` | Mistério |
| `fantasia` | Fantasia |

```ts
type CreationTagSlug =
  | 'infantil' | 'juvenil' | 'ficcao' | 'br_nacional' | 'internacional'
  | 'educativo' | 'aventura' | 'misterio' | 'fantasia';
```

**Persistência sugerida:** novo campo `Book.creation_tags Json?` (array de strings) **ou** reutilizar `catalog_keywords` guardando apenas estes slugs — documentar a convenção.  
**Relação `categoryId`:** opcional — uma categoria «principal» do catálogo editorial; as tags da UI podem coexistir para filtros ADM/catálogo.

---

## 3. Payload por tipo (`creation_payload`)

Conteúdo específico **por** `book_kind`. Um único campo JSON no livro evita colunas opcionais em cascata e facilita versão futura do schema.

**Sugestão Prisma:**

```prisma
// creationPayload  Json?  @map("creation_payload")
```

Regras:

- Só preencher estrutura correspondente a `book_kind`.
- Validação no backend: `book_kind === 'animated'` ⇒ validar forma `AnimatedPayload`, etc.

### 3.1 `animated` — Animado

Tabs: **Páginas** | **Áudio** | **Quiz**.

```ts
interface AnimatedPayload {
  /** Páginas = imagens ordenadas (PNG, JPG, GIF). Ordenação natural por nome de ficheiro (1, 2, …, 10). */
  pages: AnimatedPage[];
  /** Faixas ou ficheiros de narração / música. */
  audio: AnimatedAudioTrack[];
  /** Questionários associados à obra. */
  quizzes: BookQuiz[];
}

interface AnimatedPage {
  id: string; // uuid client ou servidor
  order: number;
  /** Referência storage (bucket + path ou URL assinada persistente). */
  storage: { bucket: string; filePath: string } | null;
  fileName?: string;
}

interface AnimatedAudioTrack {
  id: string;
  order?: number;
  label?: string;
  storage: { bucket: string; filePath: string } | null;
}
```

### 3.2 `interactive` — Interativo

Tabs: **Cenas** | **Quiz**.  
Regra de negócio (UI): uma cena **inicial**; cenas **finais** marcadas explicitamente; escolhas ligam a outras cenas.

```ts
interface InteractivePayload {
  scenes: InteractiveScene[];
  quizzes: BookQuiz[];
}

interface InteractiveScene {
  id: string;
  title: string;
  /** Copy / conteúdo da cena (Markdown ou texto simples). */
  body?: string;
  /** Mídia opcional de fundo ou ilustração. */
  media?: { bucket: string; filePath: string } | null;
  isInitial: boolean;
  isFinal: boolean;
  /** Opções que levam a outra cena. */
  choices: SceneChoice[];
}

interface SceneChoice {
  id: string;
  label: string;
  targetSceneId: string | null; // null = fim sem cena seguinte (validar com isFinal)
}
```

Validação sugerida:

- Exactamente uma cena com `isInitial === true` (ou zero no rascunho, com erro ao publicar).
- Toda cena não final alcançável a partir da inicial (opcional, fase 2).
- Cenas finais sem escolhas obrigatórias ou com escolhas terminais.

### 3.3 `digital` — Digital

Secção: **Importar e-book** (PDF e/ou EPUB).

```ts
interface DigitalPayload {
  pdf?: { bucket: string; filePath: string } | null;
  epub?: { bucket: string; filePath: string } | null;
}
```

Regra: pelo menos um de `pdf` | `epub` para publicar (ou aviso na UI).

---

## 4. Quiz (partilhado entre Animado e Interativo)

Estrutura mínima para contador «Quiz (0)» e evolução.

```ts
interface BookQuiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

interface QuizQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string; correct?: boolean }[];
}
```

---

## 5. Fluxo de rotas ADM (Next)

| Rota | Descrição |
|------|-----------|
| `GET/POST` | `/admin/books/new` ou `/books/new` — **Passo 1**: apenas seleção de `book_kind` + criação mínima (`POST` com `book_kind`, título opcional vazio → redireccionar para edição). |
| `GET` | `/books/[id]/edit-novo` (nome final a definir) — **Passo 2**: formulário conforme `book_kind`; badge «Imutável» no tipo. |
| `PUT` | Mesmo recurso — actualizar metadados + `creation_payload`; **rejeitar** alteração de `book_kind`. |

Alternativa: um único `POST /books` com `book_kind` no corpo e redireccionamento para `[id]` sem passo intermédio em URL separada — desde que o primeiro save grave o tipo.

---

## 6. Contrato JSON resumido (corpo útil para API)

```ts
/** Criação inicial (após escolha do tipo). */
interface CreateBookFromKindBody {
  book_kind: BookKind;
  title?: string;
}

/** Actualização do formulário completo. */
interface UpdateBookCreationBody {
  title: string;
  catalog_level?: string | null;
  description?: string | null;
  cover_image?: string | null;
  creation_tags?: CreationTagSlug[];
  workflow_status?: 'draft' | 'review' | 'published' | 'archived';
  creation_payload: AnimatedPayload | InteractivePayload | DigitalPayload;
}
```

**Imutabilidade:** em `UpdateBookCreationBody` **não** incluir `book_kind`; o servidor lê `book_kind` da BD e valida o `creation_payload` contra esse valor.

---

## 7. Mapeamento com colunas `Book` actuais

| Novo conceito | Coluna / campo actual |
|----------------|------------------------|
| Título, descrição, capa, workflow | `title`, `description`, `cover_image`, `workflow_status` |
| Faixa etária | `catalog_level` |
| Tags da grelha | Novo `creation_tags` ou `catalog_keywords` com convenção |
| Tipo imutável | Novo `book_kind` |
| Conteúdo novo | Novo `creation_payload` Json |
| Páginas canvas legado | `pages`, `pages_v2` — ignorados quando `book_kind` preenchido e leitor usar novo pipeline |

---

## 8. Índice e busca

- Incluir `book_kind`, slugs em `creation_tags` e título/descrição/`catalog_level` no `search_index` (mesmo padrão que `persistBookSearchIndex` no backend).
- Garantir que o `luditeca_app` receba, no `GET` do livro, `book_kind` + `creation_payload` (ou formato já hidratado com URLs) conforme o leitor for implementado.

---

*Documento de especificação; a migração Prisma e as rotas `bookRoutes` devem ser implementadas na sequência deste modelo.*
