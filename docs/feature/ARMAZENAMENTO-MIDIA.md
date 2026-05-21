# Armazenamento de mídia (livros e CMS)

## Decisão atual (2026-05)

| Fase | Onde ficam os ficheiros | Configuração |
|------|-------------------------|--------------|
| **Agora** | Pasta local `backend/storage/<bucket>/...` | `STORAGE_DRIVER=local`, `LOCAL_STORAGE_DIR=./storage` |
| **Futuro** | S3 (AWS) ou MinIO compatível | `STORAGE_DRIVER=s3` + variáveis `S3_*` |

A aplicação **não grava caminhos absolutos do disco** na base de dados. O contrato é:

- **Upload:** `POST /media/upload` → devolve `url` (pública ou presigned) e metadados em `mediaFile` (`bucketName`, `filePath`).
- **Leitura na API:** `presignedGetUrl` / hidratação em `bookMediaHydrate.ts` — em `local` devolve URL via `PUBLIC_MEDIA_BASE`; em `s3` devolve URL assinada temporária.
- **Frontend:** URLs completas (`http…`) usam-se tal como estão; caminhos relativos resolvem-se com `NEXT_PUBLIC_MEDIA_BASE_URL` + bucket (`resolveBookAssetUrl` em `frontend/lib/bookMediaSrc.js`).

## Buckets usados no fluxo de livros por tipo

| Bucket lógico | Conteúdo |
|---------------|----------|
| `covers` | Capa do livro |
| `pages` | Páginas animadas, imagens interativas, PDF/EPUB, trilha |
| `autores` | Foto do autor (criação rápida) |
| `categories` | Imagem da categoria (criação rápida) |

Prefixos de upload no editor (ex.): `book-animated/`, `book-interactive/`, `book-digital-pdf_url`, `book-soundtrack/`.

## Desenvolvimento local

```env
# backend/.env
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=./storage
PUBLIC_MEDIA_BASE=http://localhost:3020/media

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3020
NEXT_PUBLIC_MEDIA_BASE_URL=http://localhost:3020/media
```

A API expõe ficheiros em `/media/*` quando `STORAGE_DRIVER=local` (ver `backend/src/server.ts`).

## Migração para S3 (checklist futuro)

1. Criar bucket(s) e políticas IAM (ou MinIO em staging).
2. Alterar `backend/.env`: `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, chaves, `PUBLIC_MEDIA_BASE` (CDN ou proxy).
3. Alinhar `NEXT_PUBLIC_MEDIA_BASE_URL` no frontend (mesma origem pública das imagens).
4. **Opcional:** migrar ficheiros de `storage/` para o bucket (script `copyObject` já existe em `backend/src/lib/s3.ts`).
5. Registos em `mediaFile` mantêm `bucketName` + `filePath` — **não é obrigatório** alterar JSON de livros se as URLs forem re-hidratadas no GET.

## Código de referência

- Driver local/S3: [`backend/src/lib/s3.ts`](../../backend/src/lib/s3.ts)
- Rotas upload/list: [`backend/src/routes/mediaRoutes.ts`](../../backend/src/routes/mediaRoutes.ts)
- Cliente CMS: [`frontend/lib/storageApi.js`](../../frontend/lib/storageApi.js)
- URLs no fluxo livros: [`frontend/lib/bookMediaSrc.js`](../../frontend/lib/bookMediaSrc.js)
