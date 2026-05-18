# Migração UI — Argon Dashboard (Creative Tim, MIT)

Base visual alinhada ao demo [Argon Dashboard React](https://demos.creative-tim.com/argon-dashboard-react/) / [NextJS Argon Dashboard](https://github.com/creativetimofficial/nextjs-argon-dashboard).

## Estado atual (concluído)

| Área | Estado |
|------|--------|
| Bootstrap 4 + Reactstrap + Font Awesome + Nucleo | `package.json` |
| CSS Argon | `/public/argon/css/nextjs-argon-dashboard.min.css` via `_document.js` |
| Layout CMS | `layouts/ArgonAdmin.js`, `components/argon/*` |
| Auth | `login`, `forgot-password`, `reset-password` → `ArgonAuth` |
| Catálogo | `/books` (cards, pesquisa, paginação) |
| Hub admin | `/admin` (abas: livros, LIBRAS, atividades, puzzle, pinturas; atalhos admin no cabeçalho) |
| Conteúdo CMS | Rotas `/admin/puzzle`, `/admin/coloring`, … só para gestão detalhada / edição (sem item na sidebar) |
| Admin sistema | `/admin/users`, `/admin/audit`, `/admin/telemetry` na sidebar (admin); no hub há atalhos Utilizadores · Trilha · Telemetria |
| Sidebar CMS | `Livros`, `Área Admin`, `Autores`, `Categorias`, `Perfil` (+ itens admin acima); não duplicar secções do hub |
| Metadados | `/authors`, `/categories` (+ `new` / `edit`) |
| Perfil | `/profile` (`ArgonFormCard`) |
| Assistente novo livro | `/books/new` — `Layout` (Argon) + Reactstrap completo nos passos 1–3; legado **apenas URL** `/books/new-legacy` (`EditorLayout`), sem links na UI — ver `DECISOES.md` |

## Mantido fora do Argon (intencional)

| Área | Motivo |
|------|--------|
| Editor v2 `/books/[id]/edit-v2` | `EditorLayout` + Tailwind — ferramenta de edição |
| App infantil `/app/*` | `AppShell` + tokens `luditeca-app-*` (Argon leve, sem sidebar CMS) |
| Tailwind global | Ainda presente; restringir gradualmente ao editor |

## Próximos passos opcionais

1. ~~Completar Reactstrap no wizard `/books/new` (passos 1–3).~~ Feito: `/books/new` usa Argon + Reactstrap; lógica partilhada em `hooks/useNewBookWizard.js`.
2. ~~Skin Argon leve em `/app/*`.~~ Feito: `luditeca-app-*` em `argon-luditeca.css`, `AppShell`, `AppHubCard`, `AppStatusBlock`.
3. Remover classes Tailwind residuais nas páginas CMS (baixa prioridade; editor mantém Tailwind).

## Documentação Creative Tim e animações

- **Overview / docs no browser:** [Argon Dashboard React — documentação](https://demos.creative-tim.com/argon-dashboard-react/#/documentation/overview) — design system em **Bootstrap 4**, **Reactstrap** e React (alinhado ao nosso `package.json`).
- **Repositório Next.js oficial (referência de layout):** [nextjs-argon-dashboard](https://github.com/creativetimofficial/nextjs-argon-dashboard) — estrutura `Sidebar`, `AdminNavbar`, `Header` com gradiente, etc.
- **Uso de componentes:** na demo, cada exemplo é HTML/Reactstrap + classes Argon (`Card`, `shadow`, `bg-gradient-primary`, ícones **Nucleo** em `public/argon/plugins/nucleo/`). Portar = mesmos componentes Reactstrap + mesmas classes do demo; CSS já carregado em `_document.js`.
- **Animate.css (v4):** import global em `_app.js`. Prefixo das classes: `animate__animated` + efeito (ex.: `animate__fadeIn`, `animate__fadeInUp`). Exemplo em carteiras/CMS:

```jsx
<div className="animate__animated animate__fadeIn">
  <Card className="shadow">…</Card>
</div>
```

Evitar animações em listas longas (livros) para não cansar; usar em modais, headers ou primeira entrada da página.

## Licença

Argon Dashboard — [MIT](https://github.com/creativetimofficial/nextjs-argon-dashboard/blob/master/LICENSE.md). Crédito Creative Tim em `ArgonAdmin`.
