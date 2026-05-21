import { describe, expect, it } from 'vitest';
import {
  buildAnimatedReaderSlots,
  buildInteractiveReaderSlots,
  isQuizTimelineItem,
  splitTimelineForApi,
  timelineFromBook,
} from './bookContentTimeline';
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
});
