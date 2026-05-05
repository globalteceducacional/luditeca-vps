// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState, useCallback } from 'react';
import useEditorState from './useEditorState';

/**
 * Issue 03 — testes do `useEditorState` validam:
 *  1) Operações estruturais (addPage, reorderPages, deletePage).
 *  2) Histórico de undo/redo (limite, ordem, restauro).
 *  3) Imutabilidade — páginas não tocadas mantêm a mesma referência;
 *     o snapshot de undo guarda a referência antiga sem ter sido mutada.
 *
 * Para evitar montar todo o `edit-v2.jsx`, montamos um host React mínimo
 * que expõe os mesmos contracts que `useEditorState` espera.
 */

const makePage = (id, nodes = []) => ({
  id: String(id),
  background: null,
  nodes,
  meta: { orientation: 'landscape' },
});

const makeNode = (id, extra = {}) => ({
  id: String(id),
  type: 'text',
  zIndex: 1,
  step: 0,
  transform: { x: 0, y: 0 },
  props: { text: `node-${id}` },
  ...extra,
});

function useHost(initialPages) {
  const [pagesV2, setPagesV2] = useState({ version: 2, pages: initialPages });
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [, setIsModified] = useState(false);

  const ensurePagesV2 = useCallback(
    (v) =>
      v && v.version === 2 && Array.isArray(v.pages)
        ? v
        : { version: 2, pages: [makePage('p1')] },
    [],
  );

  const editor = useEditorState({
    pagesV2,
    setPagesV2,
    currentPage,
    setCurrentPage,
    selectedNodeId,
    setSelectedNodeId,
    setIsModified,
    ensurePagesV2,
  });

  return { pagesV2, currentPage, selectedNodeId, ...editor };
}

describe('useEditorState', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('addPage adiciona página ao final e move o cursor', () => {
    const { result } = renderHook(() => useHost([makePage('a')]));
    expect(result.current.pagesV2.pages).toHaveLength(1);
    act(() => result.current.addPage());
    expect(result.current.pagesV2.pages).toHaveLength(2);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pagesV2.pages[1].meta.orientation).toBe('landscape');
  });

  it('addPage aceita meta extra mantendo orientation por defeito', () => {
    const { result } = renderHook(() => useHost([makePage('a')]));
    act(() => result.current.addPage({ chapterId: 'cap1' }));
    expect(result.current.pagesV2.pages[1].meta).toMatchObject({
      orientation: 'landscape',
      chapterId: 'cap1',
    });
  });

  it('reorderPages troca posições preservando referências das páginas', () => {
    const pageA = makePage('a');
    const pageB = makePage('b');
    const pageC = makePage('c');
    const { result } = renderHook(() => useHost([pageA, pageB, pageC]));
    act(() => result.current.reorderPages(0, 2));
    expect(result.current.pagesV2.pages.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    // As referências devem manter-se: imutabilidade estrutural.
    expect(result.current.pagesV2.pages[0]).toBe(pageB);
    expect(result.current.pagesV2.pages[1]).toBe(pageC);
    expect(result.current.pagesV2.pages[2]).toBe(pageA);
  });

  it('deletePage remove a página corrente e move o cursor para trás', () => {
    const { result } = renderHook(() => useHost([makePage('a'), makePage('b')]));
    act(() => result.current.addPage());
    expect(result.current.pagesV2.pages).toHaveLength(3);
    expect(result.current.currentPage).toBe(1);
    act(() => result.current.deletePage());
    expect(result.current.pagesV2.pages).toHaveLength(2);
    expect(result.current.currentPage).toBe(0);
  });

  it('deletePage não permite remover a última página', () => {
    const { result } = renderHook(() => useHost([makePage('única')]));
    act(() => result.current.deletePage());
    expect(result.current.pagesV2.pages).toHaveLength(1);
  });

  it('patchNode aplica patch criando nova referência da página, mas mantendo a antiga intacta', () => {
    const node = makeNode('n1', { transform: { x: 10, y: 20 } });
    const pageA = makePage('a', [node]);
    const { result } = renderHook(() => useHost([pageA]));

    act(() => result.current.patchNode('n1', { transform: { x: 50, y: 60 } }));

    // A página activa deve ser uma nova referência (imutabilidade).
    expect(result.current.pagesV2.pages[0]).not.toBe(pageA);
    expect(result.current.pagesV2.pages[0].nodes[0].transform).toEqual({ x: 50, y: 60 });

    // A snapshot original (pageA) NÃO deve ter sido mutada — o pushUndoSnapshot
    // guardou a referência directa, mas o patcher trabalhou num draft separado.
    expect(pageA.nodes[0].transform).toEqual({ x: 10, y: 20 });
    expect(pageA.nodes).toHaveLength(1);
  });

  it('undo restaura o estado anterior; redo aplica de novo', () => {
    const node = makeNode('n1', { transform: { x: 0, y: 0 } });
    const { result } = renderHook(() => useHost([makePage('a', [node])]));

    act(() => result.current.patchNode('n1', { transform: { x: 100, y: 100 } }));
    expect(result.current.pagesV2.pages[0].nodes[0].transform).toEqual({ x: 100, y: 100 });

    act(() => {
      const ok = result.current.undo();
      expect(ok).toBe(true);
    });
    expect(result.current.pagesV2.pages[0].nodes[0].transform).toEqual({ x: 0, y: 0 });

    act(() => {
      const ok = result.current.redo();
      expect(ok).toBe(true);
    });
    expect(result.current.pagesV2.pages[0].nodes[0].transform).toEqual({ x: 100, y: 100 });
  });

  it('undo retorna false quando a pilha está vazia', () => {
    const { result } = renderHook(() => useHost([makePage('a')]));
    let ok;
    act(() => {
      ok = result.current.undo();
    });
    expect(ok).toBe(false);
  });

  it('histórico mantém limite de 80 entradas', () => {
    const node = makeNode('n1');
    const { result } = renderHook(() => useHost([makePage('a', [node])]));

    // Faz 90 alterações sucessivas — só as últimas 80 devem caber.
    for (let i = 0; i < 90; i++) {
      // act síncrono pequeno: cada chamada actualiza o estado e empurra entry.
      act(() => result.current.patchNode('n1', { props: { text: `v${i}` } }));
    }
    expect(result.current.historyRef.current.undo.length).toBeLessThanOrEqual(80);

    // Pode-se desfazer pelo menos 80 vezes seguidas.
    let undoneCount = 0;
    for (let i = 0; i < 80; i++) {
      let ok = false;
      act(() => {
        ok = result.current.undo();
      });
      if (ok) undoneCount += 1;
      else break;
    }
    expect(undoneCount).toBeGreaterThanOrEqual(80);
  });

  it('reorderPages com índices iguais é no-op (mesma identidade do estado)', () => {
    const pageA = makePage('a');
    const pageB = makePage('b');
    const { result } = renderHook(() => useHost([pageA, pageB]));
    const before = result.current.pagesV2;
    act(() => result.current.reorderPages(1, 1));
    // Mesma identidade — reorder não deve criar novo pagesV2 sem necessidade.
    expect(result.current.pagesV2).toBe(before);
  });
});
