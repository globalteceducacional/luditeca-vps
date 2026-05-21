# Luditeca Design System v1

Documento de referência para unificar CMS (Argon/Bootstrap) e app infantil (Tailwind).

## Objetivo

Uma linguagem visual coerente: editorial moderno (SaaS) no CMS, com acentos suaves na área `/app`, sem parecer dois produtos distintos.

## Tokens (`frontend/styles/tokens.css`)

| Categoria | Variáveis principais |
|-----------|---------------------|
| Tipografia | `--luditeca-font-sans`, `--luditeca-text-*`, `--luditeca-leading-*` |
| Marca | `--luditeca-primary-600` (#4f46e5), `--luditeca-app-accent` (#7c3aed) |
| Superfície | `--luditeca-bg`, `--luditeca-surface`, `--luditeca-border` |
| Espaço | `--luditeca-space-1` … `--luditeca-space-12` |
| Raios / sombra | `--luditeca-radius-*`, `--luditeca-shadow-*` |
| Layout | `--luditeca-content-max`, `--luditeca-form-max`, `--luditeca-app-max` |

## Overrides (`frontend/styles/luditeca-ds.css`)

Importado **depois** de `argon-luditeca.css`. Responsável por:

- Navbar CMS clara (sem gradiente roxo)
- Sidebar com grupos e estados activos unificados
- Botões primários sólidos (sem gradiente Argon)
- Labels de formulário sem CAPS
- Breadcrumbs, footer minimal, app `/app` alinhado aos tokens
- `prefers-reduced-motion`: desactiva animações pesadas

## Navegação

- **Sidebar agrupada**: `buildCmsSidebarGroups()` em `frontend/lib/argonRoutes.js`
  - Conteúdo → Livros, Admin
  - Catálogo → Autores, Categorias
  - Sistema (admin) → Utilizadores, Auditoria, Telemetria
  - Conta → Perfil
  - Experiência → App preview
- **Breadcrumbs**: `ArgonBreadcrumbs` + `buildCmsBreadcrumbs()`; activos automaticamente em `ArgonCmsShell`

## Uso em páginas CMS

```jsx
<ArgonCmsShell
  title="Livros"
  subtitle="…"
  breadcrumbContext={{ bookTitle: book.title }}
  contentConstrained
>
  …
</ArgonCmsShell>
```

`contentConstrained` limita largura máxima (`--luditeca-content-max`).

## Roadmap visual (fases)

### Fase 1 — Fundação (actual)
- [x] Tokens CSS
- [x] Overrides DS v1
- [x] Sidebar hierárquica
- [x] Breadcrumbs automáticos no shell
- [x] Navbar/footer CMS modernizados
- [x] Piloto `/books`, fluxo por tipo (`edit-flow`), timeline páginas+quiz

### Fase 2 — Componentes
- [x] `LuditecaButton`, `LuditecaInput`, `LuditecaModal` — `frontend/components/argon/luditeca/`
- [x] `LuditecaAlert` em `/admin`, `/authors`, `/categories` e modais de livros
- [x] Tabelas CMS: padding e cabeçalhos sem CAPS em `luditeca-ds.css`
- [x] Migrar `Button`/`Input`/`Alert` em `/books`, `/profile` e componentes `books/create/*`
- [x] `new-legacy` — LuditecaInput/Button/Alert + BookCatalogPickers
- [x] `edit-v2` — painel «Informações» + header com `theme="editor-dark"`
- [x] Admin CMS completo: hub, puzzle, coloring, libras, activities, users, audit, telemetria — LuditecaButton/Input/Modal
- [x] `AdminQuizQuestionsEditor`, `AdminImageUploadField`, `/authors`, `/categories` — Luditeca

### Fase 3 — App infantil
- [x] `tailwind.config.js` — cores `luditeca.*`, fonte Plus Jakarta Sans
- [x] Classes `app-*` em `globals.css` (`@layer components`)
- [x] Leitores e páginas `/app/library`, `/app/activities` migrados de sky/violet
- [x] `lib/designTokens.js` — espelho JS dos tokens
- [x] Páginas `/app/puzzle`, `/app/libras`, `/app/coloring` — tokens `luditeca-app-*` / `app-*`

### Fase 4 — Polish
- [x] Skeleton: `BookCatalogGridSkeleton`, `TableRowsSkeleton`, `AppListGridSkeleton`
- [x] Catálogo `/books`: skeleton inicial + barra de refresh (sem alerta spinner)
- [x] `ArgonCmsShell` — `loadingVariant`: `spinner` | `books` | `table`
- [x] Listagens admin (puzzle, coloring, libras, activities, users) — skeleton `table`
- [x] `animate.css` removido do `_app` global (mantido no editor v2)
- [x] Hover `luditeca-hover-lift` unificado (200ms)
- [x] Dark mode CMS — `data-luditeca-theme` em `ArgonAdmin`, toggle na navbar + perfil (`CmsThemeProvider`)

## Princípios UX

1. **Uma acção primária por ecrã** — CTA no `ArgonPageHeader`, secundárias `outline`
2. **Hierarquia** — Título → breadcrumbs → subtítulo → conteúdo
3. **Densidade** — Formulários com `contentConstrained` / `luditeca-form-constrained`
4. **Continuidade** — Mesma fonte, primária e radius entre CMS e app
5. **Motion** — Transições ≤ 200ms; respeitar `prefers-reduced-motion`

## Tailwind (área `/app`)

```jsx
<p className="text-luditeca-ink">Título</p>
<p className="text-luditeca-muted">Legenda</p>
<div className="app-card">…</div>
<button type="button" className="app-btn-nav">Anterior</button>
```

Cores: `luditeca.primary.*`, `luditeca.accent.*`, `luditeca.ink`, `luditeca.body`, `luditeca.muted`.

### Componentes Luditeca (CMS)

```jsx
import { LuditecaAlert, LuditecaButton, LuditecaInput, LuditecaModal } from '../components/argon/luditeca';

<LuditecaInput label="Título" required value={title} onChange={…} />
<LuditecaInput label="Autor" type="select" labelAction={<LuditecaButton variant="link">+ Novo</LuditecaButton>}>…</LuditecaInput>
<LuditecaButton variant="primary" loading={saving}>Guardar</LuditecaButton>
```

`LuditecaButton` aceita `variant` ou `color` (compatível com reactstrap).

### Skeleton e loading (Fase 4)

```jsx
import { BookCatalogGridSkeleton, TableRowsSkeleton } from '../components/argon/luditeca';

<ArgonCmsShell loading={loading} loadingVariant="table" loadingLabel="Lista" />
{loading && books.length === 0 ? <BookCatalogGridSkeleton count={8} /> : null}
```

### Tema escuro CMS (Fase 4)

- Preferência: `localStorage` chave `luditeca-cms-theme` — `light` | `dark` | `system`
- Contexto: `CmsThemeProvider` + `useCmsTheme()` em `frontend/contexts/cmsTheme.js`
- Escopo: `.luditeca-cms-chrome[data-luditeca-theme="dark"]` (sidebar + conteúdo; `/app` não usa este shell)
- Toggle: `LuditecaThemeToggle` na navbar; select em `/profile` («Aparência do painel»)

## Referências de ficheiros

| Ficheiro | Papel |
|----------|--------|
| `frontend/styles/tokens.css` | Variáveis globais |
| `frontend/styles/luditeca-ds.css` | Overrides visuais |
| `frontend/styles/argon-luditeca.css` | Legado Argon (a ir consumindo tokens) |
| `frontend/lib/argonRoutes.js` | Sidebar agrupada |
| `frontend/lib/cmsBreadcrumbs.js` | Mapa pathname → crumbs |
| `frontend/components/argon/ArgonCmsShell.js` | Layout página CMS |
| `frontend/tailwind.config.js` | Tema Tailwind luditeca |
| `frontend/styles/globals.css` | Tailwind + classes `app-*` |
| `frontend/lib/designTokens.js` | Tokens em JS |
| `frontend/components/argon/LuditecaSkeleton.jsx` | Skeletons CMS e app |
