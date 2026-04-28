import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { BookWorkflowStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../lib/auditLog.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireCmsEditor } from '../plugins/auth.js';
import { requireAuth } from '../plugins/auth.js';
import {
  copyObject,
  deletePrefix,
  deleteObject,
  listAllKeys,
  presignedGetUrl,
} from '../lib/s3.js';
import { isPagesV2, migratePagesLegacyToV2 } from '../lib/pagesV2/migrate.js';
import { parseCatalogStringArrayFromBody, persistBookSearchIndex } from '../lib/bookSearchIndex.js';

function toBigIntOrNull(v: unknown): bigint | null {
  if (v === null || v === undefined || v === '') return null;
  const n = BigInt(String(v));
  return n;
}

function isNonEmptyString(v: unknown) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const WORKFLOW_SET = new Set<string>([
  BookWorkflowStatus.draft,
  BookWorkflowStatus.review,
  BookWorkflowStatus.published,
  BookWorkflowStatus.archived,
]);

function parseBookWorkflowStatus(v: unknown): BookWorkflowStatus | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  if (!WORKFLOW_SET.has(s)) return undefined;
  return s as BookWorkflowStatus;
}

async function resolveStorageUrl(
  cache: Map<string, string>,
  storage: unknown,
): Promise<string | null> {
  if (!isRecord(storage)) return null;
  const bucket = isNonEmptyString(storage.bucket) ? String(storage.bucket) : '';
  const filePath = isNonEmptyString(storage.filePath) ? String(storage.filePath) : '';
  if (!bucket || !filePath) return null;

  const key = `${bucket}:${filePath}`;
  if (cache.has(key)) return cache.get(key) || null;
  try {
    const signed = await presignedGetUrl(bucket, filePath, 3600);
    cache.set(key, signed);
    return signed;
  } catch {
    return null;
  }
}

function parseStorageFromUrl(rawUrl: unknown): { bucket: string; filePath: string } | null {
  if (!isNonEmptyString(rawUrl)) return null;
  try {
    const parsed = new URL(String(rawUrl));
    const path = parsed.pathname.replace(/^\/+/, '');
    const [bucket, ...rest] = path.split('/');
    if (!bucket || rest.length === 0) return null;
    return { bucket, filePath: rest.join('/') };
  } catch {
    return null;
  }
}

async function hydrateLegacyPagesMediaUrls(pages: unknown, cache: Map<string, string>) {
  if (!Array.isArray(pages)) return pages;
  const next = JSON.parse(JSON.stringify(pages)) as Array<Record<string, unknown>>;

  for (const page of next) {
    const bg = isRecord(page.background) ? page.background : null;
    if (bg) {
      const bgStorage = bg.storage ?? parseStorageFromUrl(bg.url);
      const signedBg = await resolveStorageUrl(cache, bgStorage);
      if (signedBg) bg.url = signedBg;
      if (!bg.storage && bgStorage) bg.storage = bgStorage;
      page.background = bg;
    }

    const elements = Array.isArray(page.elements) ? page.elements : [];
    for (const element of elements) {
      if (!isRecord(element)) continue;
      const fallbackStorage = parseStorageFromUrl(element.content);
      const signedEl = await resolveStorageUrl(
        cache,
        element.storage ?? element.contentStorage ?? fallbackStorage,
      );
      if (signedEl && element.type === 'image') {
        element.content = signedEl;
      }
      if (!element.storage && fallbackStorage && element.type === 'image') {
        element.storage = fallbackStorage;
      }
    }
  }

  return next;
}

async function hydratePagesV2MediaUrls(v2: unknown, cache: Map<string, string>) {
  if (!isPagesV2(v2)) return v2;
  const next = JSON.parse(JSON.stringify(v2)) as {
    version: 2;
    canvas: { width: number; height: number };
    pages: Array<Record<string, unknown>>;
  };

  for (const page of next.pages) {
    const bg = isRecord(page.background) ? page.background : null;
    if (bg) {
      const bgStorage = bg.storage ?? parseStorageFromUrl(bg.url);
      const signedBg = await resolveStorageUrl(cache, bgStorage);
      if (signedBg) bg.url = signedBg;
      if (!bg.storage && bgStorage) bg.storage = bgStorage;
      page.background = bg;
    }

    const nodes = Array.isArray(page.nodes) ? page.nodes : [];
    for (const node of nodes) {
      if (!isRecord(node) || (node.type !== 'image' && node.type !== 'video')) continue;
      const props = isRecord(node.props) ? node.props : null;
      if (!props) continue;
      const nodeStorage = props.storage ?? parseStorageFromUrl(props.content);
      const signedNode = await resolveStorageUrl(cache, nodeStorage);
      if (signedNode) props.content = signedNode;
      if (!props.storage && nodeStorage) props.storage = nodeStorage;
      if (node.type === 'video') {
        const posterStorage = props.posterStorage ?? parseStorageFromUrl(props.poster);
        const signedPoster = await resolveStorageUrl(cache, posterStorage);
        if (signedPoster) props.poster = signedPoster;
        if (!props.posterStorage && posterStorage) props.posterStorage = posterStorage;
      }
      node.props = props;
    }
  }

  return next;
}

async function finalizeImportSession({
  userId,
  importSessionId,
  bookId,
}: {
  userId: string;
  importSessionId: string;
  bookId: bigint;
}) {
  const srcBase = `${userId}/imports/${importSessionId}`;
  const dstBase = `${userId}/books/${bookId.toString()}`;
  const buckets = ['pages', 'presentations'] as const;

  const moved: Array<{
    bucket: (typeof buckets)[number];
    from: string;
    to: string;
  }> = [];

  for (const bucket of buckets) {
    const keys = await listAllKeys(bucket, srcBase);
    for (const fromKey of keys) {
      const suffix = fromKey.startsWith(`${srcBase}/`)
        ? fromKey.slice(srcBase.length + 1)
        : fromKey;
      const toKey = `${dstBase}/${suffix}`;
      await copyObject(bucket, fromKey, toKey);
      await deleteObject(bucket, fromKey);
      moved.push({ bucket, from: fromKey, to: toKey });
    }
  }

  for (const m of moved) {
    await prisma.mediaFile.updateMany({
      where: { userId, bucketName: m.bucket, filePath: m.from },
      data: { bookId, filePath: m.to } as Record<string, unknown>,
    });
  }

  return { srcBase, dstBase, moved };
}

type ImportRemapCtx = {
  importSessionId: string;
  moved: Array<{ bucket: string; from: string; to: string }>;
};

function buildImportRemapLookup(remap: ImportRemapCtx) {
  const byFrom = new Map<string, { bucket: string; to: string }>();
  for (const m of remap.moved) {
    byFrom.set(`${m.bucket}:${m.from}`, { bucket: m.bucket, to: m.to });
  }
  return byFrom;
}

/** Atualiza `filePath` no JSON após mover objetos de `imports/{session}` → `books/{id}`. */
function remapImportedStorageInPages(pages: unknown, remap: ImportRemapCtx) {
  if (!Array.isArray(pages)) return pages;

  const byFrom = buildImportRemapLookup(remap);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next = (pages as any[]).map((p) => {
    if (!p || typeof p !== 'object') return p;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = { ...(p as any) };

    const bg = page.background;
    if (bg && typeof bg === 'object') {
      const storage = bg.storage;
      if (
        storage &&
        storage.importSessionId === remap.importSessionId &&
        storage.bucket &&
        storage.filePath
      ) {
        const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
        if (hit) {
          bg.storage = { bucket: hit.bucket, filePath: hit.to };
          bg.url = '';
        }
      }
      page.background = bg;
    }

    const rawEls = page.elements;
    if (Array.isArray(rawEls)) {
      page.elements = rawEls.map((el: any) => {
        if (!el || typeof el !== 'object') return el;
        const e = { ...el };
        const storage = e.storage;
        if (
          storage &&
          storage.importSessionId === remap.importSessionId &&
          storage.bucket &&
          storage.filePath
        ) {
          const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
          if (hit) {
            e.storage = { bucket: hit.bucket, filePath: hit.to };
            e.content = '';
          }
        }
        return e;
      });
    }

    return page;
  });

  return next;
}

function remapImportedStorageInPagesV2(v2: unknown, remap: ImportRemapCtx) {
  if (!isPagesV2(v2)) return v2;
  const next = JSON.parse(JSON.stringify(v2)) as {
    version: 2;
    canvas: { width: number; height: number };
    pages: Array<Record<string, unknown>>;
  };
  const byFrom = buildImportRemapLookup(remap);

  for (const page of next.pages) {
    const bg = page.background;
    if (bg && typeof bg === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storage = (bg as any).storage;
      if (
        storage &&
        storage.importSessionId === remap.importSessionId &&
        storage.bucket &&
        storage.filePath
      ) {
        const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
        if (hit) {
          (bg as any).storage = { bucket: hit.bucket, filePath: hit.to };
          (bg as any).url = '';
        }
      }
    }

    const nodes = Array.isArray(page.nodes) ? page.nodes : [];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n: any = node;
      if (n.type !== 'image' && n.type !== 'video') continue;
      const props = n.props && typeof n.props === 'object' ? { ...n.props } : {};
      const storage = props.storage;
      if (
        storage &&
        storage.importSessionId === remap.importSessionId &&
        storage.bucket &&
        storage.filePath
      ) {
        const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
        if (hit) {
          props.storage = { bucket: hit.bucket, filePath: hit.to };
          props.content = '';
          n.props = props;
        }
      }
      if (
        n.type === 'video' &&
        props.posterStorage &&
        props.posterStorage.importSessionId === remap.importSessionId &&
        props.posterStorage.bucket &&
        props.posterStorage.filePath
      ) {
        const hitPoster = byFrom.get(`${props.posterStorage.bucket}:${props.posterStorage.filePath}`);
        if (hitPoster) {
          props.posterStorage = { bucket: hitPoster.bucket, filePath: hitPoster.to };
          props.poster = '';
          n.props = props;
        }
      }
    }
  }

  return next;
}

async function signLegacyPagesMediaUrls(pages: unknown) {
  if (!Array.isArray(pages)) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const page of pages as any[]) {
    const bg = page?.background;
    if (bg && typeof bg === 'object') {
      const storage = bg.storage;
      if (storage?.bucket && storage?.filePath && isNonEmptyString(storage.filePath)) {
        try {
          bg.url = await presignedGetUrl(
            String(storage.bucket),
            String(storage.filePath),
            3600,
          );
        } catch {
          /* manter url existente */
        }
      }
    }
    const elements = page?.elements;
    if (!Array.isArray(elements)) continue;
    for (const el of elements) {
      if (!el || typeof el !== 'object') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e: any = el;
      if (e.type !== 'image') continue;
      const st = e.storage;
      if (st?.bucket && st?.filePath && isNonEmptyString(st.filePath)) {
        try {
          e.content = await presignedGetUrl(String(st.bucket), String(st.filePath), 3600);
        } catch {
          /* ignorar */
        }
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bookResponse(b: any) {
  if (!b) return null;
  const { authorRel, categoryRel, searchIndex: _searchIndex, ...rest } = b;
  return {
    ...jsonSafe(rest),
    authors: authorRel
      ? { id: Number(authorRel.id), name: authorRel.name }
      : null,
    category: categoryRel
      ? { id: Number(categoryRel.id), name: categoryRel.name }
      : null,
  };
}

function stripHeavyBookFields(resp: Record<string, unknown>) {
  delete resp.pages;
  delete resp.pagesV2;
  delete resp.pages_v2;
  return resp;
}

function tokenizeSearchQuery(raw: string): string[] {
  return String(raw || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export async function registerBookRoutes(app: FastifyInstance) {
  app.get('/books', { preHandler: requireAuth }, async (_request, reply) => {
    const rows = await prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      include: { authorRel: true, categoryRel: true },
    });
    return reply.send(rows.map((r) => bookResponse(r)));
  });

  app.get<{ Querystring: Record<string, string | undefined> }>(
    '/books/search',
    { preHandler: requireAuth },
    async (request, reply) => {
      const q = typeof request.query.q === 'string' ? request.query.q : '';
      const character =
        typeof request.query.character === 'string' ? request.query.character : '';
      const collection =
        typeof request.query.collection === 'string' ? request.query.collection : '';
      const keyword =
        typeof request.query.keyword === 'string' ? request.query.keyword : '';
      const level = typeof request.query.level === 'string' ? request.query.level : '';

      const limit = Math.min(100, Math.max(1, parseInt(String(request.query.limit || '50'), 10) || 50));
      const skip = Math.max(0, parseInt(String(request.query.offset || '0'), 10) || 0);

      const and: Prisma.BookWhereInput[] = [];

      for (const t of tokenizeSearchQuery(q)) {
        and.push({
          OR: [
            { searchIndex: { contains: t, mode: 'insensitive' } },
            { title: { contains: t, mode: 'insensitive' } },
          ],
        });
      }

      const ch = character.trim();
      if (ch) {
        and.push({
          OR: [{ searchIndex: { contains: ch, mode: 'insensitive' } }],
        });
      }

      const col = collection.trim();
      if (col) {
        and.push({
          OR: [
            { catalogCollection: { contains: col, mode: 'insensitive' } },
            { searchIndex: { contains: col, mode: 'insensitive' } },
          ],
        });
      }

      const kw = keyword.trim();
      if (kw) {
        and.push({
          OR: [{ searchIndex: { contains: kw, mode: 'insensitive' } }],
        });
      }

      const lv = level.trim();
      if (lv) {
        and.push({
          OR: [
            { catalogLevel: { contains: lv, mode: 'insensitive' } },
            { searchIndex: { contains: lv, mode: 'insensitive' } },
          ],
        });
      }

      const where: Prisma.BookWhereInput = and.length > 0 ? { AND: and } : {};

      const [rows, total] = await Promise.all([
        prisma.book.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { authorRel: true, categoryRel: true },
        }),
        prisma.book.count({ where }),
      ]);

      const data = rows.map((r) => stripHeavyBookFields(bookResponse(r) as Record<string, unknown>));
      return reply.send(jsonSafe({ data, total, limit, skip }));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/books/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const b = await prisma.book.findUnique({
        where: { id },
        include: { authorRel: true, categoryRel: true },
      });
      if (!b) return reply.code(404).send({ error: 'Livro não encontrado.' });
      const resp = bookResponse(b) as Record<string, unknown>;
      const mediaUrlCache = new Map<string, string>();
      resp.pages = await hydrateLegacyPagesMediaUrls(resp.pages, mediaUrlCache);
      resp.pages_v2 = await hydratePagesV2MediaUrls(
        (resp.pagesV2 ?? resp.pages_v2) as unknown,
        mediaUrlCache,
      );
      const pagesV2 = (resp.pagesV2 ?? resp.pages_v2) as unknown;
      const pagesLegacy = resp.pages as unknown;
      const hasV2 = isPagesV2(pagesV2);
      if (!hasV2 && Array.isArray(pagesLegacy) && pagesLegacy.length > 0) {
        // Não salvamos no GET para evitar efeitos colaterais.
        resp.needsMigration = true;
        resp.pages_v2_suggested = migratePagesLegacyToV2(pagesLegacy);
      }
      return reply.send(resp);
    },
  );

  app.post('/books', { preHandler: requireCmsEditor }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    let pages: unknown = body.pages ?? [
      { id: String(Date.now()), background: '', elements: [], orientation: 'portrait' },
    ];
    const pagesV2 = (body.pages_v2 ?? body.pagesV2) as unknown;

    const importSessionId = isNonEmptyString(body.import_session_id)
      ? String(body.import_session_id).trim()
      : null;

    const createData: Record<string, unknown> = {
      title: String(body.title || ''),
      author: body.author != null ? String(body.author) : null,
      description: body.description != null ? String(body.description) : null,
      coverImage: body.cover_image != null ? String(body.cover_image) : null,
      pages: pages as object,
      authorId: toBigIntOrNull(body.author_id),
      categoryId: toBigIntOrNull(body.category_id),
      linkSlidebook:
        body.link_slidebook != null ? String(body.link_slidebook) : null,
    };
    const wfCreate = parseBookWorkflowStatus(body.workflow_status ?? body.workflowStatus);
    if (wfCreate) {
      createData.workflowStatus = wfCreate;
    }
    if (pagesV2 != null) {
      createData.pagesV2 = pagesV2 as object;
    }

    if ('catalog_characters' in body || 'catalogCharacters' in body) {
      const raw = body.catalog_characters ?? body.catalogCharacters;
      if (raw === null) {
        createData.catalogCharacters = null;
      } else {
        const arr = parseCatalogStringArrayFromBody(raw);
        if (arr !== undefined) createData.catalogCharacters = arr;
      }
    }
    if ('catalog_keywords' in body || 'catalogKeywords' in body) {
      const raw = body.catalog_keywords ?? body.catalogKeywords;
      if (raw === null) {
        createData.catalogKeywords = null;
      } else {
        const arr = parseCatalogStringArrayFromBody(raw);
        if (arr !== undefined) createData.catalogKeywords = arr;
      }
    }
    if ('catalog_collection' in body || 'catalogCollection' in body) {
      const v = body.catalog_collection ?? body.catalogCollection;
      createData.catalogCollection =
        v == null || String(v).trim() === '' ? null : String(v).trim();
    }
    if ('catalog_level' in body || 'catalogLevel' in body) {
      const v = body.catalog_level ?? body.catalogLevel;
      createData.catalogLevel =
        v == null || String(v).trim() === '' ? null : String(v).trim();
    }

    const created = await prisma.book.create({
      data: createData as any,
      include: { authorRel: true, categoryRel: true },
    });

    let responseBook = created;

    if (importSessionId) {
      const userId = request.user?.id;
      if (userId) {
        const result = await finalizeImportSession({
          userId,
          importSessionId,
          bookId: BigInt(created.id),
        });

        const remapCtx: ImportRemapCtx = {
          importSessionId,
          moved: result.moved,
        };
        pages = remapImportedStorageInPages(pages, remapCtx);

        let nextV2: unknown;
        if (isPagesV2(pagesV2)) {
          nextV2 = remapImportedStorageInPagesV2(pagesV2, remapCtx);
        } else {
          nextV2 = migratePagesLegacyToV2(pages);
        }

        const mediaUrlCache = new Map<string, string>();
        nextV2 = await hydratePagesV2MediaUrls(nextV2, mediaUrlCache);
        await signLegacyPagesMediaUrls(pages);

        await prisma.book.update({
          where: { id: BigInt(created.id) },
          data: { pages: pages as object, pagesV2: nextV2 as object },
        });

        const refreshed = await prisma.book.findUnique({
          where: { id: BigInt(created.id) },
          include: { authorRel: true, categoryRel: true },
        });
        if (refreshed) responseBook = refreshed;
      }
    }

    await persistBookSearchIndex(BigInt(responseBook.id));

    await writeAuditLog({
      actorUserId: request.user!.id,
      actionCode: 'EVT:BOOK_CREATE',
      module: 'api',
      targetType: 'BOOK',
      targetId: `BOOK:${responseBook.id}`,
      bookId: BigInt(responseBook.id),
      request,
      metadata: {
        title: responseBook.title,
        importSessionId: importSessionId || undefined,
        workflowStatus: responseBook.workflowStatus,
      },
    });

    return reply.code(201).send(bookResponse(responseBook));
  });

  app.patch<{ Params: { id: string } }>(
    '/books/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const body = request.body as Record<string, unknown>;
      const clean: Record<string, unknown> = { ...body };
      delete clean.authors;
      const data: Record<string, unknown> = {};
      if ('title' in clean) data.title = clean.title;
      if ('author' in clean) data.author = clean.author;
      if ('description' in clean) data.description = clean.description;
      if ('cover_image' in clean) data.coverImage = clean.cover_image;
      if ('pages' in clean) data.pages = clean.pages;
      if ('pages_v2' in clean) data.pagesV2 = clean.pages_v2;
      if ('pagesV2' in clean) data.pagesV2 = clean.pagesV2;
      if ('author_id' in clean) data.authorId = toBigIntOrNull(clean.author_id);
      if ('category_id' in clean) data.categoryId = toBigIntOrNull(clean.category_id);
      if ('link_slidebook' in clean) data.linkSlidebook = clean.link_slidebook;

      const wfRaw = clean.workflow_status ?? clean.workflowStatus;
      if (wfRaw !== undefined) {
        const wf = parseBookWorkflowStatus(wfRaw);
        if (wfRaw !== null && wfRaw !== '' && !wf) {
          return reply.code(400).send({ error: 'workflow_status inválido (draft|review|published|archived).' });
        }
        if (wf) data.workflowStatus = wf;
      }

      if ('catalog_characters' in clean || 'catalogCharacters' in clean) {
        const raw = clean.catalog_characters ?? clean.catalogCharacters;
        if (raw === null) {
          data.catalogCharacters = null;
        } else {
          const arr = parseCatalogStringArrayFromBody(raw);
          if (arr !== undefined) data.catalogCharacters = arr;
        }
      }
      if ('catalog_keywords' in clean || 'catalogKeywords' in clean) {
        const raw = clean.catalog_keywords ?? clean.catalogKeywords;
        if (raw === null) {
          data.catalogKeywords = null;
        } else {
          const arr = parseCatalogStringArrayFromBody(raw);
          if (arr !== undefined) data.catalogKeywords = arr;
        }
      }
      if ('catalog_collection' in clean || 'catalogCollection' in clean) {
        const v = clean.catalog_collection ?? clean.catalogCollection;
        data.catalogCollection =
          v == null || String(v).trim() === '' ? null : String(v).trim();
      }
      if ('catalog_level' in clean || 'catalogLevel' in clean) {
        const v = clean.catalog_level ?? clean.catalogLevel;
        data.catalogLevel =
          v == null || String(v).trim() === '' ? null : String(v).trim();
      }

      const prev = await prisma.book.findUnique({
        where: { id },
        select: { workflowStatus: true, title: true },
      });
      if (!prev) {
        return reply.code(404).send({ error: 'Livro não encontrado.' });
      }

      if (Object.keys(data).length === 0) {
        const row = await prisma.book.findUnique({
          where: { id },
          include: { authorRel: true, categoryRel: true },
        });
        return reply.send(bookResponse(row));
      }

      const updated = await prisma.book.update({
        where: { id },
        data: data as object,
        include: { authorRel: true, categoryRel: true },
      });

      await persistBookSearchIndex(id);

      await writeAuditLog({
        actorUserId: request.user!.id,
        actionCode: 'EVT:BOOK_UPDATE',
        module: 'api',
        targetType: 'BOOK',
        targetId: `BOOK:${id.toString()}`,
        bookId: id,
        request,
        metadata: {
          fields: Object.keys(data),
          title: updated.title,
        },
      });

      if (
        data.workflowStatus != null &&
        String(data.workflowStatus) !== String(prev.workflowStatus)
      ) {
        await writeAuditLog({
          actorUserId: request.user!.id,
          actionCode: 'EVT:BOOK_WORKFLOW_CHANGE',
          module: 'api',
          targetType: 'BOOK',
          targetId: `BOOK:${id.toString()}`,
          bookId: id,
          request,
          metadata: {
            from: prev.workflowStatus,
            to: data.workflowStatus,
          },
        });
      }

      return reply.send(bookResponse(updated));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/books/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const bookIdAsString = id.toString();

      // Limpa mídias vinculadas ao livro (evita acúmulo no storage)
      const media = await prisma.mediaFile.findMany({
        where: { bookId: id } as Record<string, unknown>,
        select: { bucketName: true, filePath: true, userId: true },
      });
      for (const m of media) {
        try {
          await deleteObject(m.bucketName, m.filePath);
        } catch {
          // Se já não existir no storage, seguimos.
        }
      }
      await prisma.mediaFile.deleteMany({ where: { bookId: id } as Record<string, unknown> });

      // Limpeza extra por prefixo de pasta do livro (user/books/{id}) em todos os buckets.
      // Cobre arquivos órfãos e remove o acúmulo no storage local.
      const userIds = Array.from(new Set(media.map((m) => m.userId).filter(Boolean)));
      const buckets = [
        'covers',
        'pages',
        'presentations',
        'audios',
        'videos',
        'categories',
        'autores',
        'avatars',
      ] as const;
      for (const userId of userIds) {
        const prefix = `${userId}/books/${bookIdAsString}`;
        for (const bucket of buckets) {
          try {
            await deletePrefix(bucket, prefix);
          } catch {
            // Se não houver nada no bucket/prefixo, seguimos.
          }
        }
      }

      await writeAuditLog({
        actorUserId: request.user!.id,
        actionCode: 'EVT:BOOK_DELETE',
        module: 'api',
        targetType: 'BOOK',
        targetId: `BOOK:${bookIdAsString}`,
        bookId: id,
        request,
      });

      await prisma.book.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}
