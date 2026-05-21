import { describe, expect, it } from 'vitest';
import {
  canonicalBookAssetUrl,
  parseBookMediaStorage,
  peelBookMediaSegments,
  resolveBookAssetUrl,
} from './bookMediaSrc';

describe('peelBookMediaSegments', () => {
  it('remove prefixo media/ duplicado', () => {
    expect(
      peelBookMediaSegments(['media', 'pages', 'uid', 'library', 'file.gif']),
    ).toEqual({
      bucket: 'pages',
      filePath: 'uid/library/file.gif',
    });
  });
});

describe('parseBookMediaStorage', () => {
  it('interpreta caminho relativo com media/pages', () => {
    expect(
      parseBookMediaStorage('media/pages/525d8be5/library/book-animated/x.gif'),
    ).toEqual({
      bucket: 'pages',
      filePath: '525d8be5/library/book-animated/x.gif',
    });
  });

  it('interpreta URL com /media/media/pages', () => {
    expect(
      parseBookMediaStorage(
        'http://localhost:3020/media/media/pages/525d8be5/library/book-animated/x.gif',
      ),
    ).toEqual({
      bucket: 'pages',
      filePath: '525d8be5/library/book-animated/x.gif',
    });
  });
});

describe('resolveBookAssetUrl', () => {
  it('não duplica /media/ no path', () => {
    const url = resolveBookAssetUrl('media/pages/uid/library/book-animated/a.gif');
    expect(url).not.toMatch(/\/media\/media\//);
    expect(url).toMatch(/pages\/uid\/library\/book-animated\/a\.gif$/);
  });
});

describe('canonicalBookAssetUrl', () => {
  it('prefere chave object storage do upload', () => {
    expect(
      canonicalBookAssetUrl({
        path: 'book-animated/a.gif',
        url: 'http://localhost:3020/media/pages/uid/library/book-animated/a.gif',
      }),
    ).toBe('uid/library/book-animated/a.gif');
  });
});
