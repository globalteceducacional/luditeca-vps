# Decisões — integração Área Admin (kickoff Sprint 0)

| Data | Decisão | Estado |
|------|---------|--------|
| 2026-05-18 | **Auth:** só JWT + `UserRole`; não portar `AdminLoginModal` / senha `localStorage`. | Aprovado |
| 2026-05-18 | **Livros:** editor oficial = `/books/[id]/edit-v2`; publicação = `workflow_status` (`published`). | Aprovado |
| 2026-05-18 | **Novo livro:** fluxo ativo = `/books/new` → tipo (`animated` \| `interactive` \| `digital`) → `/books/new/[tipo]`; assistente capítulos/PPTX em `/books/new-wizard`; legado em `/books/new-legacy`. Editor v2 continua para livros sem `book_type`. | Aprovado |
| 2026-05-18 | **App infantil:** API `/app/*` + UI em `/app` (library com leitor v2, atividades, LIBRAS, puzzle, pinturas). Livros com `book_type` usam leitores dedicados em `/app/library/[id]` (animado / interativo / digital). Players puzzle/coloring completos adiados. | Provisório |
| 2026-05-18 | **Coloring defaults:** merge de SVGs no frontend na v1 (portar `DEFAULT_COLORING_PAGES` na Sprint 2); API só persiste overrides. | Provisório |
| 2026-05-18 | **Activity `matching`:** adiado na UI; API aceita tipos `quiz`, `flashcard`, `trueFalse`, `fillBlank`. | Aprovado |
| 2026-05-18 | **IA CMS:** atividades, LIBRAS, puzzle e pinturas só no hub `/admin` (abas); sidebar não duplica. Rotas `/admin/*` mantêm-se para gestão completa. Utilizadores / trilha / telemetria: sidebar admin + atalhos no cabeçalho do hub. | Aprovado |
| 2026-05-21 | **Mídia:** desenvolvimento com ficheiros em `backend/storage/` (`STORAGE_DRIVER=local`). Produção futura: S3/MinIO via `STORAGE_DRIVER=s3` sem mudar contrato de upload (`/media/upload`) nem buckets lógicos. Ver [`ARMAZENAMENTO-MIDIA.md`](./ARMAZENAMENTO-MIDIA.md). | Aprovado |

Rever antes da Sprint 4 se a app criança for outro repositório.
