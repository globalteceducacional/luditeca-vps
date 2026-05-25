import { describe, expect, it } from 'vitest';
import {
  buildAnimatedReaderSlots,
  buildInteractiveReaderSlots,
  insertQuizAfterTimeline,
  isQuizTimelineItem,
  normalizeInteractiveTimeline,
  splitTimelineForApi,
  timelineFromBook,
} from './bookContentTimeline';
import { getChoiceTargetPageId } from './interactiveAdventure';
describe('bookContentTimeline', () => {
  it('timelineFromBook intercala quiz legado no fim', () => {
    const t = timelineFromBook(
      {
        pages: [{ page_type: 'reading', page_number: 1, image_url: 'a.jpg', text: '', is_gif: false }],
        quiz: [{ question: 'Q1?', options: ['A', 'B'], correct: 0 }],
      },
      'animated',
    );
    expect(t).toHaveLength(2);
    expect(isQuizTimelineItem(t[1])).toBe(true);
    expect(t[1].question).toBe('Q1?');
  });

  it('splitTimelineForApi preserva ordem página-quiz-página', () => {
    const { pages, quiz } = splitTimelineForApi(
      [
        { page_type: 'reading', page_number: 1, image_url: '1.jpg', text: '', is_gif: false },
        { page_type: 'quiz', question: 'Q?', options: ['A', 'B'], correct: 1 },
        { page_type: 'reading', page_number: 3, image_url: '2.jpg', text: '', is_gif: false },
      ],
      'animated',
    );
    expect(pages).toHaveLength(3);
    expect(isQuizTimelineItem(pages[1])).toBe(true);
    expect(quiz).toHaveLength(1);
    expect(quiz[0].correct).toBe(1);
  });

  it('buildAnimatedReaderSlots respeita ordem inline', () => {
    const slots = buildAnimatedReaderSlots(
      [
        { page_number: 1, page_type: 'reading', image_url: 'a.jpg' },
        { page_number: 2, page_type: 'quiz', question: 'Q?', options: ['A', 'B'], correct: 0 },
      ],
      [],
    );
    expect(slots.map((s) => s.kind)).toEqual(['page', 'quiz']);
  });

  it('buildInteractiveReaderSlots intercala cena e quiz', () => {
    const slots = buildInteractiveReaderSlots(
      [
        { page_number: 1, scene_id: 's1', text: 'A', is_start: true },
        { page_number: 2, page_type: 'quiz', question: 'Q?', options: ['A', 'B'], correct: 0 },
      ],
      [],
    );
    expect(slots.map((s) => s.kind)).toEqual(['scene', 'quiz']);
  });

  it('splitTimelineForApi preserva cenas e quiz interativo', () => {
    const { pages, quiz } = splitTimelineForApi(
      [
        {
          scene_id: 's1',
          scene_title: 'Início',
          text: 'Olá',
          image_url: 'a.jpg',
          is_start: true,
          choices: [{ label: 'Ir', target_scene_id: 's2' }],
        },
        { page_type: 'quiz', question: 'Q?', options: ['A', 'B'], correct: 0 },
        {
          scene_id: 's2',
          text: 'Fim',
          image_url: 'b.jpg',
          is_ending: true,
          choices: [],
        },
      ],
      'interactive',
    );
    expect(pages).toHaveLength(3);
    expect(pages[0].scene_id).toBe('1');
    expect(pages[0].page_id).toBe(1);
    expect(isQuizTimelineItem(pages[1])).toBe(true);
    expect(pages[2].scene_id).toBe('2');
    expect(quiz).toHaveLength(1);
  });

  it('preserva destino ao selecionar página no editor', () => {
    const timeline = [
      {
        page_id: 1,
        scene_id: '1',
        is_start: true,
        choices: [{ label: '', target_page_id: null, target_scene_id: '' }],
      },
      { page_id: 2, scene_id: '2', is_ending: true, choices: [] },
    ];
    const choices = [{ label: 'Ir', target_page_id: 2, target_scene_id: '2' }];
    const next = normalizeInteractiveTimeline(
      timeline.map((s, i) => (i === 0 ? { ...s, choices } : s)),
    );
    expect(getChoiceTargetPageId(next[0].choices[0])).toBe(2);
  });

  it('preserva destino com bloco meta na timeline', () => {
    const timeline = [
      { page_type: 'interactive_meta', version: 1, story_title: 'Demo' },
      {
        page_id: 1,
        scene_id: '1',
        is_start: true,
        choices: [{ label: 'Ir', target_page_id: 2, target_scene_id: '2' }],
      },
      { page_id: 2, scene_id: '2', is_ending: true, choices: [] },
    ];
    const next = normalizeInteractiveTimeline(timeline);
    const start = next.find((p) => p.page_id === 1);
    expect(getChoiceTargetPageId(start.choices[0])).toBe(2);
  });

  it('timelineFromBook interativo preserva meta e escolhas da página 1', () => {
    const apiPages = [
      { page_type: 'interactive_meta', version: 1, story_title: 'Demo' },
      {
        page_id: 1,
        scene_id: '1',
        is_start: true,
        text: 'Início',
        choices: [{ label: 'Ir', target_page_id: 2, target_scene_id: '2' }],
      },
      { page_id: 2, scene_id: '2', is_ending: true, choices: [] },
    ];
    const t = timelineFromBook({ pages: apiPages }, 'interactive');
    expect(t[0].page_type).toBe('interactive_meta');
    const start = t.find((p) => p.page_id === 1);
    expect(start?.choices?.length).toBe(1);
    expect(start.choices[0].target_page_id).toBe(2);
    const { pages } = splitTimelineForApi(t, 'interactive');
    const saved = pages.find((p) => p.page_id === 1);
    expect(saved?.choices?.length).toBe(1);
  });

  it('insertQuizAfterTimeline insere quiz após o índice da página', () => {
    const base = [
      { page_type: 'reading', page_number: 1, image_url: '1.jpg', text: '', is_gif: false },
      { page_type: 'reading', page_number: 2, image_url: '2.jpg', text: '', is_gif: false },
    ];
    const next = insertQuizAfterTimeline(base, 0);
    expect(next).toHaveLength(3);
    expect(isQuizTimelineItem(next[1])).toBe(true);
    expect(next[0].image_url).toBe('1.jpg');
    expect(next[2].image_url).toBe('2.jpg');
  });
});
