# Evidências — Etapa 5.3 (processamento e entrega de mídia)

**Referência de requisito:** Etapa 5 — subtarefa **5.3** — *upload, validação, compressão quando necessário, geração de miniaturas, organização do armazenamento e entrega eficiente* de imagens, GIFs, vídeos e áudios.

**Repositório:** `luditeca-vps` (API Fastify + `lib/s3.ts` + `lib/imageProcessor.ts` + rotas `mediaRoutes.ts`; CMS em Next.js com `frontend/lib/storageApi.js` e biblioteca no editor v2).

**Relação com outras evidências:** [EVIDENCIAS-ETAPA-5.1.md](./EVIDENCIAS-ETAPA-5.1.md) (inventário de rotas `/media/*` na API), [EVIDENCIAS-TAREFA-3.4.md](./EVIDENCIAS-TAREFA-3.4.md) (consumo de mídia no editor).

---

## 1. Visão geral do fluxo

1. **Upload:** o cliente (CMS) envia `multipart/form-data` para a API (`/media/upload` ou `/media/replace`), com `mediaType` → bucket lógico, `root`/`path` e opcionalmente **`bookId`** na query ou cabeçalho **`x-book-id`** para ficheiros da biblioteca do livro.
2. **Validação e limites:** buckets permitidos (`assertBucket`); chaves sem `..`; nome de ficheiro sanitizado; tamanho máximo **500 MB** por ficheiro no plugin multipart do Fastify (`server.ts`); corpo máximo **600 MB**.
3. **Processamento de imagem:** para tipos `image/*` exceto SVG, o backend tenta **miniatura PNG** (Sharp) e metadados; falhas de miniatura **não bloqueiam** o upload.
4. **Armazenamento:** objeto guardado em S3/MinIO ou disco local (`STORAGE_DRIVER=local`) sob chave hierárquica `{uid}/…` ou `{uid}/books/{bookId}/…`.
5. **Metadados:** registo opcional em `media_files` (Prisma) e auditoria `EVT:MEDIA_UPLOAD` em uploads bem-sucedidos.
6. **Entrega:** URLs **pré-assinadas** (GET, TTL típico 1–2 h) ou, em desenvolvimento com storage local, leitura estática **`GET /media/{bucket}/…`** no próprio Fastify. O detalhe do livro hidrata URLs em `pages` / `pages_v2` ao responder `GET /books/:id`.

---

## 2. Organização do armazenamento

| Conceito | Implementação |
|----------|----------------|
| **Buckets lógicos** | `MEDIA_BUCKET_MAP` em [`backend/src/routes/mediaRoutes.ts`](../../backend/src/routes/mediaRoutes.ts): `covers`, `pages`, `audios`, `videos`, `categories`, `autores`, `avatars`, `presentations`. |
| **Raiz por utilizador** | `userFsBase(uid, root)` → prefixo `{uid}/{root}` com `root` default `library`. |
| **Mídia do livro** | Com `bookId` numérico e `root === 'library'`, o prefixo efetivo inclui `books/{bookId}` (partilha entre editores com o mesmo livro). |
| **Pastas** | Marcador `/.folder` via `POST /media/folder`; miniaturas em `/.thumbs/{nome}.thumb.png` ao lado do ficheiro original. |
| **Chave única no upload** | `{baseDir}/{uuid}-{nomeSanitizado}` — evita colisões. |
| **Segurança de caminho** | `assertSafeRelPath`, `ensureSafeKey` em [`backend/src/lib/s3.ts`](../../backend/src/lib/s3.ts); listagem/remoção/movimento validam posse ou vínculo `mediaFile` + `bookId` coerente. |

---

## 3. Processamento de imagem (Sharp)

**Ficheiro:** [`backend/src/lib/imageProcessor.ts`](../../backend/src/lib/imageProcessor.ts).

| Função | Comportamento |
|--------|----------------|
| `isSupportedImageType` | Aceita `image/*` **exceto SVG** para pipeline raster (SVG não gera miniatura por este caminho). |
| `generateThumbnail` | Redimensiona com *fit inside* (default 400×300), exporta **PNG** com nível de compressão configurável; **GIF animado** → primeiro frame (`animated: false`). |
| `getImageMeta` | Largura, altura, formato, tamanho — usado na resposta do upload de imagem. |
| `convertToWebP` | Conversão opcional WebP (qualidade default 82) — **implementada na biblioteca**, **não integrada** hoje no `POST /media/upload` (não há recompressão automática do master para WebP no pipeline). |

**Onde as miniaturas são criadas:** `POST /media/upload` e `POST /media/replace` em `mediaRoutes.ts` (best-effort em `try/catch`).

---

## 4. Vídeo, áudio e GIF

| Tipo | Upload | Miniatura | Notas |
|------|--------|-----------|--------|
| **Imagem** (JPEG, PNG, WebP, GIF, …) | Sim | PNG a partir do buffer (GIF = 1.º frame) | Metadados `width`/`height` quando disponível. |
| **GIF animado** | Guardado como enviado | Pré-visualização estática na biblioteca (CMS); reprodução no canvas trata animação no frontend. |
| **Áudio** (mp3, wav, ogg) | Sim | Não | Extensões reconhecidas em `extType` para classificação; bucket `audios`. |
| **Vídeo** (mp4, webm, mov) | Sim | Não | Bucket `videos`; sem transcodificação na API nesta entrega. |
| **Compressão transcodificada** (vídeo/áudio) | — | — | **Não implementada** no backend (ficheiros gravados tal como recebidos). |

---

## 5. Rotas HTTP de mídia (contrato resumido)

Todas abaixo usam **`requireCmsEditor`** salvo indicação contrária. Detalhe completo: secção 3.5 em [EVIDENCIAS-ETAPA-5.1.md](./EVIDENCIAS-ETAPA-5.1.md).

| Método | Rota | Função |
|--------|------|--------|
| `GET` | `/media/list` | Lista por `mediaType`, `path`, `root`, `bookId`, `recursive`; modo livro via `media_files`. |
| `GET` | `/media/signed-get` | URL assinada para leitura de uma `key` (dono ou mídia ligada a livro). |
| `POST` | `/media/upload` | Multipart `file`; miniatura + `mediaFile` + auditoria. |
| `POST` | `/media/replace` | Substitui bytes na mesma chave; regera miniatura para imagem. |
| `POST` | `/media/folder` | Cria marcador de pasta. |
| `DELETE` | `/media/object` | Apaga objeto e linhas `media_files` associadas. |
| `POST` | `/media/rename` | Atualiza `fileName` em `media_files`. |
| `POST` | `/media/move` | Cópia + delete no storage + atualização de `filePath`. |
| `POST` | `/media/presign` | URL **PUT** assinada para upload direto ao storage. |

**Entrega no modo local:** [`backend/src/server.ts`](../../backend/src/server.ts) — `GET /media/*` serve ficheiros de `LOCAL_STORAGE_DIR` com `Content-Type` por extensão.

---

## 6. Cliente CMS (`frontend/lib/storageApi.js`)

| Export | Uso |
|--------|-----|
| `storageListWithRoot` | Lista biblioteca com `root` e cabeçalhos opcionais (`x-book-id`). |
| `storageUploadWithRoot` / `storageUploadWithProgressAndRoot` | Upload com progresso (XHR) para `/media/upload`. |
| `storageReplaceWithRoot` | Substituição sem alterar referências no JSON do livro. |
| `uploadFile` (no mesmo ficheiro, se existir) | Abstração por bucket usada em capas, anexos, etc. |

O editor v2 (`PageSidebar`, modais de imagem/vídeo) consome estes fluxos e buckets `pages` / `videos` / `audios`.

---

## 7. Modelo de dados (`media_files`)

Definido em [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma): `userId`, `bookId` opcional, `filePath`, `fileName`, `fileType`, `fileSize`, `bucketName`, timestamps. Suporta listagem por livro e políticas de acesso em `signed-get` / `canAccessStorageObject`.

---

## 8. Matriz requisito 5.3 × implementação

| Requisito | Estado |
|-----------|--------|
| Upload | Sim — multipart, presign opcional. |
| Validação (bucket, caminho, tamanho, nome) | Sim. |
| Compressão quando necessário | **Parcial** — PNG nas miniaturas; **sem** pipeline de recompressão sistemática do master; WebP disponível mas não ligado ao upload. |
| Miniaturas | Sim — imagens (incl. 1.º frame GIF); listagem anexa `thumbUrl` quando existe ficheiro em `.thumbs`. |
| Organização do armazenamento | Sim — prefixos por utilizador e por livro; buckets por tipo. |
| Entrega eficiente (imagens, GIF, vídeo, áudio) | Sim — URLs assinadas + cache de hidratação no GET do livro; leitura local em dev. **Sem** CDN própria nem HLS no código da API. |

---

## 9. Checklist manual

1. Definir `STORAGE_DRIVER`, credenciais S3/MinIO ou `LOCAL_STORAGE_DIR`.
2. Login como editor; **upload** de imagem na biblioteca do livro (com `x-book-id`) e confirmar ficheiro + pasta `.thumbs` quando aplicável.
3. **Substituir** imagem (`/media/replace`) e confirmar que URLs no editor continuam válidas.
4. Upload de **áudio** e **vídeo**; confirmar listagem em `/media/list` com `mediaType` adequado.
5. `GET /books/:id` e verificar URLs assinadas em elementos com `storage` no JSON.
