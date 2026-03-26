import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAccessToken } from '../lib/jwt.js';
import { requireAuth } from '../plugins/auth.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  const parseJsonMap = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  };

  const parseJsonList = (value: unknown): unknown[] => {
    if (!Array.isArray(value)) return [];
    return value;
  };

  app.post('/auth/register', async (request, reply) => {
    if (process.env.ENABLE_PUBLIC_REGISTER !== 'true') {
      return reply
        .code(403)
        .send({ error: 'Registo público desativado. Use ENABLE_PUBLIC_REGISTER=true ou crie utilizador com o script.' });
    }
    const body = request.body as { email?: string; password?: string; name?: string };
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const name = body?.name?.trim() || null;
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email e senha obrigatórios.' });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return reply.code(409).send({ error: 'Email já registado.' });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });
    await prisma.profile.create({ data: { userId: user.id } });
    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return reply.send({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: null,
      },
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email e senha obrigatórios.' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Credenciais inválidas.' });
    }
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });
    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return reply.send({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: full?.name ?? user.name,
        role: user.role,
        avatar_url: full?.profile?.icone ?? null,
      },
    });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const row = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { profile: true },
    });
    if (!row) return reply.code(404).send({ error: 'Utilizador não encontrado.' });
    return reply.send({
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.createdAt,
        avatar_url: row.profile?.icone ?? null,
      },
    });
  });

  app.patch('/auth/profile', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { name?: string; avatar_url?: string | null };
    const id = request.user!.id;
    if (body.name !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { name: body.name?.trim() || null },
      });
    }
    if (body.avatar_url !== undefined) {
      await prisma.profile.upsert({
        where: { userId: id },
        create: { userId: id, icone: body.avatar_url },
        update: { icone: body.avatar_url },
      });
    }
    return reply.send({ ok: true });
  });

  app.post('/auth/change-password', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { currentPassword?: string; newPassword?: string };
    const current = String(body?.currentPassword || '');
    const next = String(body?.newPassword || '');
    if (!current || !next) {
      return reply.code(400).send({ error: 'Senha atual e nova senha são obrigatórias.' });
    }
    if (next.length < 6) {
      return reply.code(400).send({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user || !(await verifyPassword(current, user.passwordHash))) {
      return reply.code(400).send({ error: 'Senha atual incorreta.' });
    }
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { passwordHash: await hashPassword(next) },
    });
    return reply.send({ ok: true });
  });

  app.get('/me/profile', { preHandler: requireAuth }, async (request, reply) => {
    const row = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { profile: true },
    });
    if (!row) return reply.code(404).send({ error: 'Utilizador não encontrado.' });

    return reply.send({
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.createdAt,
      },
      profile: {
        role: row.profile?.role ?? 'aluno',
        books_read: Number(row.profile?.booksRead ?? 0),
        permissions: row.profile?.permissions ?? {},
        functions: row.profile?.functions ?? null,
        progress: row.profile?.progress ?? {},
        favorites: row.profile?.favorites ?? [],
        name: row.profile?.name ?? row.name ?? '',
        icone: row.profile?.icone ?? null,
        books_read_history: row.profile?.booksReadHistory ?? [],
      },
    });
  });

  app.patch('/me/profile', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      name?: string;
      icone?: string | null;
      progress?: unknown;
      favorites?: unknown;
      permissions?: unknown;
      books_read?: unknown;
      books_read_history?: unknown;
    };
    const id = request.user!.id;

    if (body.name !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { name: body.name?.trim() || null },
      });
    }

    const profileData: Record<string, unknown> = {};
    if (body.name !== undefined) profileData.name = body.name?.trim() || null;
    if (body.icone !== undefined) profileData.icone = body.icone;
    if (body.progress !== undefined) profileData.progress = parseJsonMap(body.progress);
    if (body.permissions !== undefined) profileData.permissions = parseJsonMap(body.permissions);
    if (body.favorites !== undefined) profileData.favorites = parseJsonList(body.favorites);
    if (body.books_read_history !== undefined) {
      profileData.booksReadHistory = parseJsonList(body.books_read_history);
    }
    if (body.books_read !== undefined) {
      const n = Number(body.books_read);
      profileData.booksRead = Number.isFinite(n) && n >= 0 ? BigInt(Math.floor(n)) : BigInt(0);
    }

    if (Object.keys(profileData).length > 0) {
      await prisma.profile.upsert({
        where: { userId: id },
        create: { userId: id, ...profileData },
        update: profileData,
      });
    }

    return reply.send({ ok: true });
  });

  app.get('/me/favorites/books', { preHandler: requireAuth }, async (request, reply) => {
    const row = await prisma.profile.findUnique({
      where: { userId: request.user!.id },
      select: { favorites: true },
    });
    const ids = parseJsonList(row?.favorites).map((v) => Number(v)).filter((v) => Number.isFinite(v));
    if (ids.length === 0) return reply.send([]);

    const books = await prisma.book.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      include: { authorRel: true },
    });
    return reply.send(
      books.map((b) => ({
        id: Number(b.id),
        title: b.title,
        author: b.author,
        description: b.description,
        cover_image: b.coverImage,
        pages: b.pages,
        link_slidebook: b.linkSlidebook,
        created_at: b.createdAt,
        author_id: b.authorId != null ? Number(b.authorId) : null,
        category_id: b.categoryId != null ? Number(b.categoryId) : null,
        authors: b.authorRel ? { id: Number(b.authorRel.id), name: b.authorRel.name } : null,
      })),
    );
  });
}
