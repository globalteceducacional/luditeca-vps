import { describe, expect, it } from 'vitest';
import {
  applyEffects,
  choiceMeetsConditions,
  createInitialRunState,
  getChoiceTargetPageId,
  navigateToPage,
  normalizeAdventurePages,
  validateAdventureStory,
} from './interactiveAdventure';

describe('interactiveAdventure', () => {
  const story = [
    {
      page_id: 1,
      text: 'Início',
      is_start: true,
      choices: [
        { label: 'A', target_page_id: 2 },
        { label: 'B', target_page_id: 3, conditions: { flags_all: { need_key: true } } },
      ],
    },
    {
      page_id: 2,
      text: 'Final bom',
      is_ending: true,
      ending_type: 'good',
      choices: [],
    },
    {
      page_id: 3,
      text: 'Precisa chave',
      on_enter: { set_flags: { need_key: true } },
      choices: [{ label: 'Voltar ao início', target_page_id: 1 }],
    },
  ];

  it('normaliza page_id e destinos', () => {
    const { story: s } = normalizeAdventurePages(story);
    expect(s[0].page_id).toBe(1);
    expect(getChoiceTargetPageId(s[0].choices[0])).toBe(2);
  });

  it('condição de flag bloqueia escolha', () => {
    const state = createInitialRunState('1', story);
    const page = story[0];
    const index = new Map(story.map((p) => [p.page_id, p]));
    expect(choiceMeetsConditions(state, page.choices[1].conditions, index)).toBe(false);
    const withFlag = applyEffects(state, { set_flags: { need_key: true } });
    expect(choiceMeetsConditions(withFlag, page.choices[1].conditions, index)).toBe(true);
  });

  it('navega para página destino', () => {
    const state = createInitialRunState('1', story);
    const next = navigateToPage(state, 2, story);
    expect(next.currentPageId).toBe(2);
    expect(next.visitedPageIds).toContain(2);
  });

  it('valida história mínima', () => {
    expect(validateAdventureStory(story, { requireContent: false }).ok).toBe(true);
  });

  it('ignora bloco interactive_meta na validação', () => {
    const withMeta = [
      { page_type: 'interactive_meta', version: 1, story_title: 'Título' },
      ...story,
    ];
    expect(validateAdventureStory(withMeta, { requireContent: false }).ok).toBe(true);
  });

  it('rejeita página não-final sem escolhas', () => {
    const r = validateAdventureStory(
      [
        { page_id: 1, is_start: true, choices: [{ label: 'Ir', target_page_id: 2 }] },
        { page_id: 2, is_ending: false, choices: [] },
      ],
      { requireContent: false },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Página 2/);
  });

  it('aceita página final sem escolhas (modelo livro novo)', () => {
    const r = validateAdventureStory(
      [
        {
          page_id: 1,
          is_start: true,
          choices: [{ label: '', target_page_id: 2 }],
        },
        { page_id: 2, is_ending: true, ending_type: 'neutral', choices: [] },
      ],
      { requireContent: false },
    );
    expect(r.ok).toBe(true);
  });
});
