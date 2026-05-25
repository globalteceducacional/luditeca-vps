import { emptyQuizQuestion, normalizeQuizForApi } from './bookTypes';
import { emptyAdventurePage, isInteractiveMetaRow } from './interactiveAdventure';
import { normalizeInteractiveScenes, nextPageId } from './interactiveScenes';

function emptyAnimatedPage(pageNumber = 1) {
  return {
    image_url: '',
    is_gif: false,
    text: '',
    page_type: PAGE_TYPE_READING,
    page_number: pageNumber,
  };
}

function emptyInteractiveSceneForTimeline({ isFirst = false, pageId = null } = {}) {
  const id = Number(pageId) > 0 ? Number(pageId) : nextPageId([]);
  return emptyAdventurePage(id, { isFirst });
}

export const PAGE_TYPE_QUIZ = 'quiz';
export const PAGE_TYPE_READING = 'reading';

export function isQuizTimelineItem(item) {
  return String(item?.page_type || '').toLowerCase() === PAGE_TYPE_QUIZ;
}

export function renumberTimeline(list) {
  return (Array.isArray(list) ? list : []).map((item, i) => ({
    ...item,
    page_number: i + 1,
  }));
}

export function emptyQuizTimelineItem(pageNumber = 1) {
  return {
    page_type: PAGE_TYPE_QUIZ,
    page_number: pageNumber,
    ...emptyQuizQuestion(),
  };
}

function quizItemToQuestion(item) {
  const normalized = normalizeQuizForApi([item]);
  return normalized[0] || null;
}

function quizQuestionToItem(q, pageNumber) {
  return {
    page_type: PAGE_TYPE_QUIZ,
    page_number: pageNumber,
    question: q.question || '',
    options:
      Array.isArray(q.options) && q.options.length >= 2
        ? q.options
        : ['', '', '', ''],
    correct: Number.isFinite(Number(q.correct)) ? Number(q.correct) : 0,
  };
}

/** API → lista ordenada no editor (páginas/cenas + quiz intercalados). */
export function timelineFromBook(data, bookType) {
  const pages = Array.isArray(data?.pages) ? [...data.pages] : [];
  const hasInlineQuiz = pages.some(isQuizTimelineItem);

  if (hasInlineQuiz) {
    const ordered = renumberTimeline(pages);
    return bookType === 'interactive' ? normalizeInteractiveTimeline(ordered) : ordered;
  }

  let content = pages;
  if (bookType === 'interactive') {
    const meta = pages.find(isInteractiveMetaRow) || null;
    const storyRaw = pages.filter((p) => !isInteractiveMetaRow(p) && !isQuizTimelineItem(p));
    content = storyRaw.length
      ? normalizeInteractiveScenes(storyRaw)
      : [emptyInteractiveSceneForTimeline({ isFirst: true })];
    if (meta) content = [meta, ...content];
  }

  const quiz = normalizeQuizForApi(data?.quiz ?? data?.book_quiz ?? data?.bookQuiz ?? []);
  const quizItems = quiz.map((q, i) => quizQuestionToItem(q, content.length + i + 1));
  return renumberTimeline([...content, ...quizItems]);
}

/** Normaliza só as cenas, mantendo blocos de quiz no mesmo índice. */
export function normalizeInteractiveTimeline(timeline) {
  const list = Array.isArray(timeline) ? [...timeline] : [];
  const sceneIndices = [];
  const scenes = [];
  list.forEach((item, i) => {
    if (!isQuizTimelineItem(item) && !isInteractiveMetaRow(item)) {
      sceneIndices.push(i);
      scenes.push(item);
    }
  });
  const normalized = normalizeInteractiveScenes(scenes);
  const out = [...list];
  sceneIndices.forEach((listIdx, j) => {
    out[listIdx] = normalized[j];
  });
  return renumberTimeline(out);
}

/** Separa timeline para gravar: `pages` com ordem completa + `quiz` derivado (compat API). */
export function splitTimelineForApi(timeline, bookType) {
  const list = bookType === 'interactive' ? normalizeInteractiveTimeline(timeline) : renumberTimeline(timeline);
  const quiz = [];
  const pages = [];

  list.forEach((item) => {
    if (isQuizTimelineItem(item)) {
      const q = quizItemToQuestion(item);
      if (q) quiz.push(q);
      pages.push({
        page_type: PAGE_TYPE_QUIZ,
        page_number: pages.length + 1,
        question: item.question ?? q?.question ?? '',
        options: item.options ?? q?.options ?? ['', '', '', ''],
        correct: item.correct ?? q?.correct ?? 0,
      });
    } else if (bookType === 'animated') {
      pages.push({
        ...emptyAnimatedPage(pages.length + 1),
        ...item,
        page_type: PAGE_TYPE_READING,
        page_number: pages.length + 1,
      });
    } else {
      pages.push({ ...item, page_number: pages.length + 1 });
    }
  });

  return { pages, quiz };
}

/** Slots para o leitor animado (página | pergunta de quiz). */
export function buildAnimatedReaderSlots(pages = [], bookQuiz = []) {
  const list = Array.isArray(pages) ? [...pages] : [];
  const sorted = list.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
  const hasInline = sorted.some(isQuizTimelineItem);

  if (hasInline) {
    return sorted.map((item) =>
      isQuizTimelineItem(item)
        ? { kind: 'quiz', data: quizItemToQuestion(item) || item }
        : { kind: 'page', data: item },
    );
  }

  const slots = sorted
    .filter((p) => !isQuizTimelineItem(p))
    .map((p) => ({ kind: 'page', data: p }));
  normalizeQuizForApi(bookQuiz).forEach((q) => {
    slots.push({ kind: 'quiz', data: q });
  });
  return slots;
}

export function filterScenesOnly(timeline) {
  return (Array.isArray(timeline) ? timeline : []).filter(
    (i) => !isQuizTimelineItem(i) && !isInteractiveMetaRow(i),
  );
}

export function extractQuizFromTimeline(timeline) {
  return (Array.isArray(timeline) ? timeline : [])
    .filter(isQuizTimelineItem)
    .map(quizItemToQuestion)
    .filter(Boolean);
}

/** Slots para leitor interativo quando há quiz na timeline (cena | pergunta). */
export function buildInteractiveReaderSlots(pages = [], bookQuiz = []) {
  const list = Array.isArray(pages) ? [...pages] : [];
  const sorted = list.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
  const hasInline = sorted.some(isQuizTimelineItem);

  if (hasInline) {
    return sorted.map((item) =>
      isQuizTimelineItem(item)
        ? { kind: 'quiz', data: quizItemToQuestion(item) || item }
        : { kind: 'scene', data: item },
    );
  }

  const scenes = sorted.filter((p) => !isQuizTimelineItem(p) && !isInteractiveMetaRow(p));
  const slots = scenes.map((s) => ({ kind: 'scene', data: s }));
  normalizeQuizForApi(bookQuiz).forEach((q) => {
    slots.push({ kind: 'quiz', data: q });
  });
  return slots;
}

export function timelineHasInlineQuiz(pages = []) {
  return (Array.isArray(pages) ? pages : []).some(isQuizTimelineItem);
}

/** Insere um bloco de quiz logo após o índice dado (página ou cena). */
export function insertQuizAfterTimeline(timeline, afterIndex) {
  const list = Array.isArray(timeline) ? [...timeline] : [];
  const insertAt = Math.min(Math.max(0, afterIndex + 1), list.length);
  list.splice(insertAt, 0, emptyQuizTimelineItem(insertAt + 1));
  return renumberTimeline(list);
}
