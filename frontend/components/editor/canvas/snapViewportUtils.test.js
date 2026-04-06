import {
  clampPanToViewport,
  getGuides,
  resolveContextMenuPositionFromViewportBox,
} from './snapViewportUtils';

describe('snapViewportUtils', () => {
  it('mantém menu de contexto dentro da viewport', () => {
    global.window = { innerWidth: 800, innerHeight: 600 };
    const pos = resolveContextMenuPositionFromViewportBox({ x: 780, y: 590, width: 40, height: 20 });
    expect(pos.x).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeGreaterThanOrEqual(8);
    expect(pos.x).toBeLessThanOrEqual(800);
    expect(pos.y).toBeLessThanOrEqual(600);
  });

  it('faz clamp do pan ao viewport', () => {
    const next = clampPanToViewport({ x: 999, y: -999 }, { width: 400, height: 300 }, 1280, 720, 1);
    expect(next.x).toBeLessThanOrEqual(120);
    expect(next.y).toBeGreaterThanOrEqual(-540);
  });

  it('resolve melhor guia vertical/horizontal', () => {
    const guides = getGuides(
      { vertical: [100, 200], horizontal: [40, 80] },
      {
        vertical: [{ guide: 102, offset: 10 }],
        horizontal: [{ guide: 79, offset: 4 }],
      },
      6,
    );
    expect(guides.v?.guide).toBe(100);
    expect(guides.h?.guide).toBe(80);
  });
});
