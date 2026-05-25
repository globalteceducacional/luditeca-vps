/**
 * Publica o livro demo interativo (por ID ou título «Demo interativo (QA)»).
 * Uso: npx tsx scripts/publish-interactive-demo.ts [bookId]
 */
import { prisma } from '../src/lib/prisma.js';
import { validateBookTypePages } from '../src/lib/bookTypes.js';
import { BookType } from '@prisma/client';

const bookIdArg = process.argv[2] ? Number(process.argv[2]) : null;

async function main() {
  const book = bookIdArg
    ? await prisma.book.findUnique({
        where: { id: bookIdArg },
        select: { id: true, title: true, bookType: true, pages: true, workflowStatus: true },
      })
    : await prisma.book.findFirst({
        where: { title: 'Demo interativo (QA)', bookType: BookType.interactive },
        select: { id: true, title: true, bookType: true, pages: true, workflowStatus: true },
      });

  if (!book) {
    console.error('Livro não encontrado.');
    process.exit(1);
  }

  if (book.bookType !== BookType.interactive) {
    console.error(`Livro ${book.id} não é interativo.`);
    process.exit(1);
  }

  const validation = validateBookTypePages(book.bookType, book.pages, {
    workflowStatus: 'published',
  });
  if (!validation.ok) {
    console.error(`Não pode publicar: ${validation.error}`);
    process.exit(1);
  }

  const updated = await prisma.book.update({
    where: { id: book.id },
    data: { workflowStatus: 'published' },
    select: { id: true, title: true, workflowStatus: true },
  });

  console.log('Publicado:', updated);
  console.log(`App: http://localhost:3000/app/library/${updated.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
