import { describe, expect, it } from 'vitest';
import { getBookPublishChecklist } from './bookPublishChecklist';

describe('getBookPublishChecklist', () => {
  it('interativo só com texto pode estar pronto para publicar', () => {
    const { ready } = getBookPublishChecklist('interactive', {
      title: 'Aventura',
      pages: [
        {
          page_id: 1,
          is_start: true,
          text: 'Início',
          choices: [{ label: 'Ir', target_page_id: 2 }],
        },
        { page_id: 2, is_ending: true, text: 'Fim', choices: [] },
      ],
    });
    expect(ready).toBe(true);
  });

  it('interativo sem imagens não bloqueia publicação', () => {
    const { items } = getBookPublishChecklist('interactive', {
      title: 'Aventura',
      pages: [
        {
          page_id: 1,
          is_start: true,
          text: 'Início',
          choices: [{ label: 'Ir', target_page_id: 2 }],
        },
        { page_id: 2, is_ending: true, text: 'Fim', choices: [] },
      ],
    });
    const images = items.find((i) => i.id === 'scene_images');
    expect(images?.required).toBe(false);
    expect(images?.done).toBe(false);
  });
});
