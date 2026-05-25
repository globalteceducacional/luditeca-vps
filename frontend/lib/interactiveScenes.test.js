import { describe, expect, it } from 'vitest';
import {
  buildInteractiveSceneGraph,
  listChoiceDestinationScenes,
  normalizeInteractiveScenes,
  validateInteractiveScenesClient,
} from './interactiveScenes';

describe('interactiveScenes', () => {
  it('normalizeInteractiveScenes ignora linhas de quiz', () => {
    const scenes = normalizeInteractiveScenes([
      { page_id: 1, scene_id: '1', is_start: true, choices: [] },
      { page_type: 'quiz', question: 'Q?', options: ['A', 'B'], correct: 0 },
    ]);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].page_id).toBe(1);
  });

  it('validateInteractiveScenesClient detecta escolha para página inexistente', () => {
    const r = validateInteractiveScenesClient([
      {
        page_id: 1,
        is_start: true,
        image_url: 'x.jpg',
        choices: [{ label: 'X', target_page_id: 99 }],
      },
    ]);
    expect(r.ok).toBe(false);
  });

  it('listChoiceDestinationScenes usa page_id e exclui a página actual', () => {
    const page1 = { page_id: 1, scene_id: '1', is_start: true, choices: [] };
    const page2 = { page_id: 2, scene_id: '2', choices: [] };
    const dest = listChoiceDestinationScenes([page1, page2], page1);
    expect(dest).toHaveLength(1);
    expect(dest[0].page_id).toBe(2);
  });

  it('buildInteractiveSceneGraph com ciclo (2→1) termina sem travar', () => {
    const g = buildInteractiveSceneGraph([
      {
        page_id: 1,
        scene_id: '1',
        is_start: true,
        choices: [{ label: 'Ir para 2', target_page_id: 2 }],
      },
      {
        page_id: 2,
        scene_id: '2',
        choices: [{ label: 'Voltar para 1', target_page_id: 1 }],
      },
    ]);
    expect(g.nodes.length).toBe(2);
    expect(g.edges).toHaveLength(2);
    expect(g.edges.some((e) => e.from === '2' && e.to === '1')).toBe(true);
  });

  it('buildInteractiveSceneGraph sem ligações quebradas', () => {
    const g = buildInteractiveSceneGraph([
      {
        page_id: 1,
        scene_title: 'A',
        is_start: true,
        choices: [{ label: 'B', target_page_id: 2 }],
      },
      { page_id: 2, scene_title: 'B', choices: [] },
    ]);
    expect(g.issues).toHaveLength(0);
    expect(g.edges.some((e) => e.from === '1' && e.to === '2')).toBe(true);
  });
});
