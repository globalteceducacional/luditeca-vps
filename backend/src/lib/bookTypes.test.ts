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
  it('permite rascunho animado sem páginas', () => {
    const r = validateBookTypePages(BookType.animated, [], { workflowStatus: 'draft' });
    expect(r.ok).toBe(true);
  });

  it('exige imagem em páginas animadas quando publicado', () => {
    const r = validateBookTypePages(
      BookType.animated,
      [
        { image_url: 'https://cdn/a.png', page_number: 1 },
        { text: 'sem img' },
      ],
      { workflowStatus: 'published' },
    );
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

  it('aceita page_id numérico e ignora meta', () => {
    const r = validateBookTypePages(BookType.interactive, [
      { page_type: 'interactive_meta', version: 1 },
      {
        page_id: 1,
        is_start: true,
        choices: [{ label: 'Ir', target_page_id: 2 }],
      },
      { page_id: 2, is_ending: true, choices: [] },
    ]);
    expect(r.ok).toBe(true);
  });

  it('permite publicar interativo sem imagem nas cenas', () => {
    const r = validateBookTypePages(
      BookType.interactive,
      [
        {
          page_id: 1,
          is_start: true,
          text: 'Início',
          choices: [{ label: 'Fim', target_page_id: 2 }],
        },
        { page_id: 2, is_ending: true, text: 'Fim', choices: [] },
      ],
      { workflowStatus: 'published' },
    );
    expect(r.ok).toBe(true);
  });
});

describe('validateDigitalBookAssets', () => {
  it('permite rascunho digital sem ficheiros', () => {
    expect(validateDigitalBookAssets({}, { workflowStatus: 'draft' }).ok).toBe(true);
  });

  it('exige pdf ou epub quando publicado', () => {
    expect(validateDigitalBookAssets({}, { workflowStatus: 'published' }).ok).toBe(false);
    expect(
      validateDigitalBookAssets({ pdf_url: 'https://x/a.pdf' }, { workflowStatus: 'published' }).ok,
    ).toBe(true);
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
