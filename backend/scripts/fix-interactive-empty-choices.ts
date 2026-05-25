/**
 * Corrige livros interativos com páginas não-finais sem escolhas.
 * Uso: npx tsx scripts/fix-interactive-empty-choices.ts [bookId]
 */
import { prisma } from '../src/lib/prisma.js';
import { BookType } from '@prisma/client';

const targetId = process.argv[2] ? Number(process.argv[2]) : null;

function isStoryRow(row: Record<string, unknown>) {
  const pt = String(row.page_type ?? '').toLowerCase();
  return pt !== 'quiz' && pt !== 'interactive_meta';
}

function getPageKey(row: Record<string, unknown>) {
  const n = Number(row.page_id);
  if (Number.isFinite(n) && n > 0) return n;
  const sid = String(row.scene_id ?? '').trim();
  const m = /^scene_(\d+)$/i.exec(sid);
  if (m) return Number(m[1]);
  const asNum = Number(sid);
  return Number.isFinite(asNum) && asNum > 0 ? asNum : null;
}

function getChoiceTarget(ch: Record<string, unknown>) {
  const n = Number(ch.target_page_id);
  if (Number.isFinite(n) && n > 0) return n;
  const sid = String(ch.target_scene_id ?? '').trim();
  const asNum = Number(sid);
  return Number.isFinite(asNum) && asNum > 0 ? asNum : null;
}

async function main() {
  const books = await prisma.book.findMany({
    where: {
      bookType: BookType.interactive,
      ...(targetId ? { id: targetId } : {}),
    },
    select: { id: true, title: true, pages: true },
  });

  for (const book of books) {
    const pages = Array.isArray(book.pages) ? [...(book.pages as object[])] : [];
    const story = pages.filter((p) => isStoryRow(p as Record<string, unknown>)) as Record<
      string,
      unknown
    >[];
    const incomingTargets = new Set<number>();
    for (const p of story) {
      for (const ch of Array.isArray(p.choices) ? p.choices : []) {
        const t = getChoiceTarget(ch as Record<string, unknown>);
        if (t != null) incomingTargets.add(t);
      }
    }

    const stuck = story.filter(
      (p) => !p.is_ending && !(Array.isArray(p.choices) && p.choices.length > 0),
    );
    if (!stuck.length) continue;

    const keys = story.map(getPageKey).filter((k): k is number => k != null);
    let nextId = keys.length ? Math.max(...keys) + 1 : 2;
    let changed = false;

    for (const row of stuck) {
      const key = getPageKey(row);
      // Página só recebe visitas (ex.: «Página 2» do modelo) → marcar como final
      if (key != null && incomingTargets.has(key)) {
        row.is_ending = true;
        row.ending_type = row.ending_type || 'neutral';
        if (!String(row.text ?? '').trim()) row.text = 'Fim da história.';
        if (!String(row.scene_title ?? '').trim()) row.scene_title = 'Final';
        changed = true;
        continue;
      }

      const endingPage = {
        page_id: nextId,
        scene_id: String(nextId),
        scene_title: 'Final',
        text: 'Fim da história.',
        image_url: '',
        choices: [],
        is_start: false,
        is_ending: true,
        ending_type: 'neutral',
      };
      row.choices = [
        {
          label: 'Continuar',
          target_page_id: nextId,
          target_scene_id: String(nextId),
        },
      ];
      if (key != null) {
        row.page_id = key;
        row.scene_id = String(key);
      }
      pages.push(endingPage);
      nextId += 1;
      changed = true;
    }

    if (!changed) continue;

    await prisma.book.update({
      where: { id: book.id },
      data: { pages: pages as object },
    });
    console.log(`Livro ${book.id} (${book.title}): ${stuck.length} página(s) corrigida(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
