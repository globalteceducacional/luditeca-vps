import { buildInteractiveSceneGraph, validateInteractiveScenesClient } from './interactiveScenes';
import { isQuizTimelineItem } from './bookContentTimeline';
import { normalizeQuizForApi } from './bookTypes';

/**
 * Itens de checklist antes de publicar na app infantil.
 * @returns {{ ready: boolean, items: Array<{ id: string, label: string, done: boolean, required: boolean, step?: number, hint?: string }> }}
 */
export function getBookPublishChecklist(bookType, form) {
  const items = [];
  const f = form || {};

  const add = (id, label, done, required, step = null, hint = null) => {
    items.push({ id, label, done, required, step, hint });
  };

  add('title', 'Título do livro', Boolean(String(f.title || '').trim()), true, 0);
  add('cover', 'Capa (recomendado)', Boolean(String(f.cover_image || '').trim()), false, 0);
  add('author', 'Autor (recomendado)', Boolean(String(f.author_id || '').trim()), false, 0);
  add('category', 'Categoria (recomendado)', Boolean(String(f.category_id || '').trim()), false, 0);

  if (bookType === 'animated') {
    const pages = Array.isArray(f.pages) ? f.pages : [];
    const reading = pages.filter((p) => !isQuizTimelineItem(p));
    const withImage = reading.filter((p) => String(p?.image_url || '').trim());
    add('pages', 'Pelo menos uma página de leitura', withImage.length > 0, true, 1);
    const allHaveImage =
      reading.length > 0 && reading.every((p) => String(p?.image_url || '').trim());
    add('pages_images', 'Todas as páginas com imagem', allHaveImage, true, 1);
    add('soundtrack', 'Trilha sonora (opcional)', Boolean(String(f.soundtrack_url || '').trim()), false, 1);
    const quizSlots = pages.filter(isQuizTimelineItem);
    const quizValid = quizSlots.every((q) => normalizeQuizForApi([q]).length === 1);
    add(
      'quiz',
      'Perguntas de quiz válidas (opcional)',
      quizSlots.length === 0 || quizValid,
      false,
      1,
      quizSlots.length && !quizValid ? 'Complete enunciado e opções de cada pergunta.' : null,
    );
  }

  if (bookType === 'interactive') {
    const timeline = Array.isArray(f.pages) ? f.pages : [];
    const scenes = timeline.filter((s) => !isQuizTimelineItem(s));
    add('scenes', 'Pelo menos uma cena', scenes.length > 0, true, 1);
    const withImage = scenes.filter((s) => String(s?.image_url || '').trim());
    add('scene_images', 'Todas as cenas com imagem', scenes.length > 0 && withImage.length === scenes.length, true, 1);
    const hasStart = scenes.some((s) => s.is_start);
    add('scene_start', 'Cena inicial definida', hasStart || scenes.length <= 1, true, 1);
    const validation = validateInteractiveScenesClient(timeline, { requireContent: true });
    add('scene_valid', 'Cenas e escolhas válidas', validation.ok, true, 1, validation.ok ? null : validation.error);
    const graph = buildInteractiveSceneGraph(scenes);
    add('scene_graph', 'Mapa sem ligações quebradas', graph.issues.length === 0, true, 1);
    const quizSlots = timeline.filter(isQuizTimelineItem);
    const quizValid = quizSlots.every((q) => normalizeQuizForApi([q]).length === 1);
    add('quiz', 'Perguntas de quiz válidas (opcional)', quizSlots.length === 0 || quizValid, false, 1);
  }

  if (bookType === 'digital') {
    const hasPdf = Boolean(String(f.pdf_url || '').trim());
    const hasEpub = Boolean(String(f.epub_url || '').trim());
    add('file', 'PDF ou EPUB carregado', hasPdf || hasEpub, true, 1);
    add('pdf', 'Ficheiro PDF (opcional se tiver EPUB)', hasPdf, false, 1);
    add('epub', 'Ficheiro EPUB (opcional se tiver PDF)', hasEpub, false, 1);
  }

  const requiredPending = items.filter((i) => i.required && !i.done);
  return {
    ready: requiredPending.length === 0,
    items,
    pendingCount: requiredPending.length,
    pendingLabels: requiredPending.map((i) => i.label),
  };
}
