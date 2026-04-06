import { useCallback, useEffect, useRef } from 'react';
import { MAX_TIMELINE_STEP } from '../../editorConstants';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function useEditorState({
  pagesV2,
  setPagesV2,
  currentPage,
  setCurrentPage,
  selectedNodeId,
  setSelectedNodeId,
  setIsModified,
  ensurePagesV2,
}) {
  const historyRef = useRef({ undo: [], redo: [] });
  const isApplyingHistoryRef = useRef(false);
  const currentPageRef = useRef(0);
  const selectedNodeIdRef = useRef(null);
  const clipboardRef = useRef(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const pushUndoSnapshot = useCallback((pageIndex, pageSnapshot) => {
    if (!pageSnapshot) return;
    historyRef.current.undo.push({ pageIndex, page: deepClone(pageSnapshot) });
    if (historyRef.current.undo.length > 80) {
      historyRef.current.undo.shift();
    }
    historyRef.current.redo = [];
  }, []);

  const patchPage = useCallback((idx, patcher) => {
    setPagesV2((prev) => {
      const base = ensurePagesV2(prev);
      const next = deepClone(base);
      if (!next.pages[idx]) return next;
      if (!isApplyingHistoryRef.current) {
        pushUndoSnapshot(idx, base.pages[idx]);
      }
      next.pages[idx] = patcher(next.pages[idx]);
      return next;
    });
    setIsModified(true);
  }, [setPagesV2, ensurePagesV2, pushUndoSnapshot, setIsModified]);

  const patchNode = useCallback((nodeId, patch) => {
    patchPage(currentPage, (p) => {
      p.nodes = (p.nodes || []).map((n) => (String(n.id) === String(nodeId) ? { ...n, ...patch } : n));
      return p;
    });
  }, [currentPage, patchPage]);

  const updateNodeStep = useCallback((nodeId, nextStep) => {
    const safeStep = Math.max(
      0,
      Math.min(
        MAX_TIMELINE_STEP,
        Number.isFinite(Number(nextStep)) ? Math.trunc(Number(nextStep)) : 0,
      ),
    );
    patchNode(nodeId, { step: safeStep });
  }, [patchNode]);

  const deleteNode = useCallback((nodeId) => {
    patchPage(currentPage, (p) => {
      p.nodes = (p.nodes || []).filter((n) => String(n.id) !== String(nodeId));
      return p;
    });
    if (String(selectedNodeId) === String(nodeId)) setSelectedNodeId(null);
  }, [currentPage, patchPage, selectedNodeId, setSelectedNodeId]);

  const duplicateNodeToCurrentPage = useCallback((nodeLike) => {
    if (!nodeLike) return;
    const copy = deepClone(nodeLike);
    copy.id = String(Date.now());
    if (copy.transform) {
      copy.transform = {
        ...copy.transform,
        x: Number(copy.transform.x || 0) + 24,
        y: Number(copy.transform.y || 0) + 24,
      };
    }
    patchPage(currentPageRef.current, (p) => {
      const maxZ = Math.max(0, ...(p.nodes || []).map((n) => Number(n.zIndex || 0)));
      copy.zIndex = maxZ + 1;
      p.nodes = [...(p.nodes || []), copy];
      return p;
    });
    setSelectedNodeId(copy.id);
  }, [patchPage, setSelectedNodeId]);

  const addPage = useCallback(() => {
    setPagesV2((prev) => {
      const base = ensurePagesV2(prev);
      const next = deepClone(base);
      next.pages.push({
        id: String(Date.now()),
        background: null,
        nodes: [],
        meta: { orientation: 'landscape' },
      });
      return next;
    });
    setCurrentPage((v) => v + 1);
    setIsModified(true);
  }, [setPagesV2, ensurePagesV2, setCurrentPage, setIsModified]);

  const deletePage = useCallback(() => {
    setPagesV2((prev) => {
      const base = ensurePagesV2(prev);
      if (base.pages.length <= 1) return base;
      const next = deepClone(base);
      next.pages.splice(currentPage, 1);
      return next;
    });
    setCurrentPage((v) => Math.max(0, v - 1));
    setSelectedNodeId(null);
    setIsModified(true);
  }, [setPagesV2, ensurePagesV2, currentPage, setCurrentPage, setSelectedNodeId, setIsModified]);

  const applyHistoryEntry = useCallback((entry, toKey) => {
    setPagesV2((prev) => {
      const base = ensurePagesV2(prev);
      if (!base.pages?.[entry.pageIndex]) return base;
      const next = deepClone(base);
      const beforeTarget = deepClone(base.pages[entry.pageIndex]);
      historyRef.current[toKey].push({ pageIndex: entry.pageIndex, page: beforeTarget });
      if (historyRef.current[toKey].length > 80) {
        historyRef.current[toKey].shift();
      }
      isApplyingHistoryRef.current = true;
      next.pages[entry.pageIndex] = deepClone(entry.page);
      return next;
    });
    setCurrentPage(entry.pageIndex);
    setSelectedNodeId(null);
    setIsModified(true);
    Promise.resolve().then(() => {
      isApplyingHistoryRef.current = false;
    });
  }, [setPagesV2, ensurePagesV2, setCurrentPage, setSelectedNodeId, setIsModified]);

  const undo = useCallback(() => {
    const entry = historyRef.current.undo.pop();
    if (!entry) return false;
    applyHistoryEntry(entry, 'redo');
    return true;
  }, [applyHistoryEntry]);

  const redo = useCallback(() => {
    const entry = historyRef.current.redo.pop();
    if (!entry) return false;
    applyHistoryEntry(entry, 'undo');
    return true;
  }, [applyHistoryEntry]);

  return {
    historyRef,
    isApplyingHistoryRef,
    currentPageRef,
    selectedNodeIdRef,
    clipboardRef,
    pushUndoSnapshot,
    patchPage,
    patchNode,
    updateNodeStep,
    deleteNode,
    duplicateNodeToCurrentPage,
    addPage,
    deletePage,
    undo,
    redo,
  };
}
