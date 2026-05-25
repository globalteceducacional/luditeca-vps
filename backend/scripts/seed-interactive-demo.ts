/**
 * Cria um livro interativo de demonstração — «Escolha sua aventura».
 * Uso: npx tsx scripts/seed-interactive-demo.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { validateBookTypePages } from '../src/lib/bookTypes.js';
import { BookType } from '@prisma/client';

const DEMO_META = {
  page_type: 'interactive_meta',
  version: 1,
  story_title: 'A chave perdida',
  characters: ['narrador', 'mendigo', 'bibliotecaria'],
  items_catalog: ['moeda', 'mapa', 'chave_antiga'],
};

const DEMO_PAGES = [
  DEMO_META,
  {
    page_id: 1,
    scene_id: '1',
    scene_title: 'A praça',
    text: 'Chegas à praça ao anoitecer. Um mendigo acena para ti.',
    image_url: '',
    characters: ['narrador', 'mendigo'],
    is_start: true,
    is_ending: false,
    choices: [
      {
        label: 'Dar uma moeda e perguntar pelo túnel',
        target_page_id: 2,
        target_scene_id: '2',
        effects: { add_items: ['moeda'] },
      },
      {
        label: 'Ir directo à biblioteca',
        target_page_id: 3,
        target_scene_id: '3',
        conditions: { requires_items: ['mapa'] },
      },
    ],
  },
  {
    page_id: 2,
    scene_id: '2',
    scene_title: 'O túnel',
    text: 'O mendigo sussurra: «A chave está na biblioteca.»',
    image_url: '',
    is_ending: false,
    choices: [
      {
        label: 'Ir à biblioteca',
        target_page_id: 3,
        target_scene_id: '3',
        effects: { set_flags: { sabe_chave: true } },
      },
    ],
  },
  {
    page_id: 3,
    scene_id: '3',
    scene_title: 'Biblioteca',
    text: 'A bibliotecária aponta para um cofre antigo.',
    image_url: '',
    on_enter: { set_flags: { need_key: true } },
    is_ending: false,
    choices: [
      {
        label: 'Abrir o cofre com a chave antiga',
        target_page_id: 4,
        target_scene_id: '4',
        conditions: { flags_all: { sabe_chave: true }, requires_items: ['chave_antiga'] },
      },
      {
        label: 'Desistir e sair',
        target_page_id: 5,
        target_scene_id: '5',
      },
    ],
  },
  {
    page_id: 4,
    scene_id: '4',
    scene_title: 'Tesouro',
    text: 'Dentro do cofre brilha um coração de cristal. Encontraste o final verdadeiro!',
    image_url: '',
    is_ending: true,
    ending_type: 'secret',
    choices: [],
  },
  {
    page_id: 5,
    scene_id: '5',
    scene_title: 'Noite fria',
    text: 'Voltas para a praça sem respostas. O vento continua.',
    image_url: '',
    is_ending: true,
    ending_type: 'bad',
    choices: [],
  },
];

const DEMO_QUIZ = [];

async function main() {
  const existing = await prisma.book.findFirst({
    where: { title: 'Demo interativo (QA)', bookType: BookType.interactive },
    select: { id: true },
  });

  const validation = validateBookTypePages(BookType.interactive, DEMO_PAGES, {
    workflowStatus: 'draft',
  });
  if (!validation.ok) {
    throw new Error(`Payload demo inválido: ${validation.error}`);
  }

  const data = {
    title: 'Demo interativo (QA)',
    description: 'História ramificada «Escolha sua aventura» — páginas 1–5, finais bom/mau/secreto.',
    bookType: BookType.interactive,
    workflowStatus: 'draft' as const,
    pages: DEMO_PAGES,
    bookQuiz: DEMO_QUIZ,
  };

  const book = existing
    ? await prisma.book.update({
        where: { id: existing.id },
        data,
        select: { id: true, title: true, bookType: true, workflowStatus: true },
      })
    : await prisma.book.create({
        data,
        select: { id: true, title: true, bookType: true, workflowStatus: true },
      });

  console.log('Livro interativo demo:');
  console.log(JSON.stringify({ ...book, id: book.id.toString() }, null, 2));
  console.log('\nCMS: http://localhost:3000/books/' + book.id + '/edit-flow');
  console.log('App: http://localhost:3000/app/library/' + book.id + ' (após publicar)');
  console.log('Publicar: npm run publish:interactive-demo -- ' + book.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
