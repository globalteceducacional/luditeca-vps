import {
  buildRenamedFileName,
  clampNum,
  getAcceptFromMediaType,
  getLibraryMediaFormatBadge,
  normalizeCropRect,
  normalizeImageAdjustments,
} from './mediaLibraryUtils';

describe('mediaLibraryUtils', () => {
  it('retorna accept correto por tipo', () => {
    expect(getAcceptFromMediaType('audio')).toContain('audio/*');
    expect(getAcceptFromMediaType('video')).toContain('video/*');
    expect(getAcceptFromMediaType('image')).toContain('image/*');
  });

  it('normaliza retângulo de recorte dentro dos limites', () => {
    const rect = normalizeCropRect({ x: 98, y: -20, width: 30, height: 300 });
    expect(rect.x).toBe(98);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(2);
    expect(rect.height).toBe(100);
  });

  it('preserva extensão no rename e sanitiza o nome', () => {
    const next = buildRenamedFileName({ name: 'capa.final.png' }, ' Novo nome *@ ');
    expect(next).toBe('Novo_nome.png');
  });

  it('aplica clamp numérico com fallback', () => {
    expect(clampNum('abc', 0, 10, 5)).toBe(5);
    expect(clampNum(99, 0, 10, 5)).toBe(10);
    expect(clampNum(-2, 0, 10, 5)).toBe(0);
  });

  it('normaliza ajustes visuais no intervalo suportado', () => {
    const a = normalizeImageAdjustments({ brightness: 9, contrast: -1, saturation: 5, rotation: -999 });
    expect(a).toEqual({
      brightness: 3,
      contrast: 0.2,
      saturation: 3,
      rotation: -180,
    });
  });

  it('getLibraryMediaFormatBadge distingue extensões e tipos', () => {
    expect(
      getLibraryMediaFormatBadge({ name: 'foto.JPEG' }, { isVideo: false, isAudio: false }),
    ).toEqual({ label: 'JPG', variant: 'jpg' });
    expect(
      getLibraryMediaFormatBadge({ name: 'capa.png' }, { isVideo: false, isAudio: false }),
    ).toEqual({ label: 'PNG', variant: 'png' });
    expect(
      getLibraryMediaFormatBadge({ name: 'anim.gif' }, { isVideo: false, isAudio: false }),
    ).toEqual({ label: 'GIF', variant: 'other' });
    expect(
      getLibraryMediaFormatBadge({ name: 'clip.mov' }, { isVideo: true, isAudio: false }),
    ).toEqual({ label: 'MOV', variant: 'video' });
    expect(
      getLibraryMediaFormatBadge({ name: 'som.wav' }, { isVideo: false, isAudio: true }),
    ).toEqual({ label: 'WAV', variant: 'audio' });
    expect(
      getLibraryMediaFormatBadge(
        { name: 'sem_ext' },
        { isVideo: false, isAudio: false, previewUrl: 'https://x.com/a.gif?token=1' },
      ),
    ).toEqual({ label: 'GIF', variant: 'other' });
  });
});
