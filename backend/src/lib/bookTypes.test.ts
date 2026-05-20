import { describe, expect, it } from 'vitest';
import { BookType } from '@prisma/client';
import {
  normalizeBookQuiz,
  parseBookType,
  validateBookTypePages,
  validateDigitalBookAssets,
} from './bookTypes.js';

describe('parseBookType', () => {
  it('aceita valores válidos', () => {
    expect(parseBookType('animated')).toBe(BookType.animated);
    expect(parseBookType('interactive')).toBe(BookType.interactive);
    expect(parseBookType('digital')).toBe(BookType.digital);
  });

  it('rejeita valor inválido', () => {
    expect(parseBookType('comic')).toBeUndefined();
  });
});

describe('validateBookTypePages', () => {
  it('exige image_url em páginas animadas', () => {
    const r = validateBookTypePages(BookType.animated, [
      { image_url: 'https://cdn/a.png', page_number: 1 },
      { text: 'sem img' },
    ]);
    expect(r.ok).toBe(false);
  });

  it('exige scene_id único em interativo', () => {
    const r = validateBookTypePages(BookType.interactive, [
      { scene_id: 'a', is_start: true, choices: [] },
      { scene_id: 'a', choices: [] },
    ]);
    expect(r.ok).toBe(false);
  });

  it('valida destino de escolha', () => {
    const r = validateBookTypePages(BookType.interactive, [
      {
        scene_id: 'start',
        is_start: true,
        choices: [{ label: 'Ir', target_scene_id: 'missing' }],
      },
    ]);
    expect(r.ok).toBe(false);
  });

  it('aceita fluxo interativo válido', () => {
    const r = validateBookTypePages(BookType.interactive, [
      {
        scene_id: 'start',
        is_start: true,
        choices: [{ label: 'Fim', target_scene_id: 'end' }],
      },
      { scene_id: 'end', is_ending: true, choices: [] },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe('validateDigitalBookAssets', () => {
  it('exige pdf ou epub', () => {
    expect(validateDigitalBookAssets({}).ok).toBe(false);
    expect(validateDigitalBookAssets({ pdf_url: 'https://x/a.pdf' }).ok).toBe(true);
  });
});

describe('normalizeBookQuiz', () => {
  it('filtra perguntas incompletas', () => {
    const q = normalizeBookQuiz([
      { question: 'Ok?', options: ['a', 'b'], correct: 0 },
      { question: '', options: ['a'], correct: 0 },
    ]);
    expect(q).toHaveLength(1);
  });
});
