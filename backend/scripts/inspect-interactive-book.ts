/**
 * Inspeciona um livro interativo na BD e valida estrutura pages/quiz.
 * Uso: npx tsx scripts/inspect-interactive-book.ts [id]
 */
import { prisma } from '../src/lib/prisma.js';
import { validateBookTypePages } from '../src/lib/bookTypes.js';
import { BookType } from '@prisma/client';

const arg = process.argv[2] || '33';
const listOnly = arg === '--list' || arg === '-l';

function summarizePages(pages: unknown, bookType: string | null) {
  if (!Array.isArray(pages)) return { count: 0, scenes: 0, quizzes: 0, issues: ['pages não é array'] };
  const isInteractive = bookType === 'interactive';
  let scenes = 0;
  let quizzes = 0;
  const issues: string[] = [];
  const sceneIds = new Set<string>();

  pages.forEach((row, i) => {
    if (!row || typeof row !== 'object') {
      issues.push(`bloco ${i + 1}: inválido`);
      return;
    }
    const r = row as Record<string, unknown>;
    const pt = String(r.page_type || '').toLowerCase();
    if (pt === 'quiz') {
      quizzes += 1;
      const q = String(r.question || '').trim();
      const opts = Array.isArray(r.options) ? r.options : [];
      if (!q) issues.push(`quiz pos ${i + 1}: sem pergunta`);
      if (opts.filter((o) => String(o ?? '').trim()).length < 2) {
        issues.push(`quiz pos ${i + 1}: menos de 2 opções`);
      }
      return;
    }
    scenes += 1;
    const sid = String(r.scene_id || '').trim();
    if (isInteractive && !sid) issues.push(`cena pos ${i + 1}: sem scene_id`);
    if (!isInteractive && pt !== 'reading' && !pt) issues.push(`página pos ${i + 1}: page_type inesperado (${pt || 'vazio'})`);
    else if (sceneIds.has(sid)) issues.push(`cena pos ${i + 1}: scene_id duplicado (${sid})`);
    else sceneIds.add(sid);
    if (!String(r.image_url || '').trim()) issues.push(`cena pos ${i + 1} (${sid || '?'}): sem image_url`);
    const choices = Array.isArray(r.choices) ? r.choices : [];
    for (const ch of choices) {
      const target = String((ch as Record<string, unknown>)?.target_scene_id || '').trim();
      if (target && !sceneIds.has(target) && !pages.some((p) => (p as Record<string, unknown>)?.scene_id === target)) {
        /* target pode aparecer mais à frente na lista */
      }
    }
  });

  for (const row of pages) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (String(r.page_type || '').toLowerCase() === 'quiz') continue;
    const sid = String(r.scene_id || '').trim();
    const choices = Array.isArray(r.choices) ? r.choices : [];
    for (const ch of choices) {
      const target = String((ch as Record<string, unknown>)?.target_scene_id || '').trim();
      if (target && !sceneIds.has(target)) {
        issues.push(`cena ${sid}: escolha aponta para ${target} (inexistente)`);
      }
    }
  }

  return { count: pages.length, scenes, quizzes, sceneIds: [...sceneIds], issues };
}

async function main() {
  if (listOnly) {
    const all = await prisma.book.findMany({
      select: { id: true, title: true, bookType: true, workflowStatus: true },
      orderBy: { id: 'desc' },
      take: 20,
    });
    console.log('--- Livros na base (últimos 20) ---');
    for (const b of all) {
      console.log(`${b.id.toString().padStart(4)} | ${String(b.bookType || 'null').padEnd(12)} | ${b.workflowStatus} | ${b.title}`);
    }
    await prisma.$disconnect();
    return;
  }

  const id = BigInt(arg);
  const book = await prisma.book.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      bookType: true,
      workflowStatus: true,
      pages: true,
      bookQuiz: true,
      pagesV2: true,
      coverImage: true,
    },
  });

  if (!book) {
    console.error(`Livro ${arg} não encontrado.`);
    process.exit(1);
  }

  console.log('--- Livro ---');
  console.log(JSON.stringify({ ...book, id: book.id.toString() }, null, 2));

  const pages = book.pages;
  const summary = summarizePages(pages, book.bookType);
  console.log('\n--- Resumo pages ---');
  console.log(summary);

  const bookQuiz = book.bookQuiz;
  console.log('\n--- book_quiz (legado) ---');
  console.log(Array.isArray(bookQuiz) ? `itens: ${bookQuiz.length}` : bookQuiz);

  const strict = book.workflowStatus === 'published';
  if (book.bookType) {
    const validation = validateBookTypePages(book.bookType, pages, {
      workflowStatus: book.workflowStatus,
    });
    console.log('\n--- Validação backend (publish=' + strict + ') ---');
    console.log(validation);
  }

  const interactiveBooks = await prisma.book.findMany({
    where: { bookType: BookType.interactive },
    select: { id: true, title: true, workflowStatus: true },
    take: 10,
    orderBy: { id: 'desc' },
  });
  console.log('\n--- Últimos livros interativos ---');
  console.log(interactiveBooks.map((b) => ({ id: b.id.toString(), title: b.title, status: b.workflowStatus })));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
