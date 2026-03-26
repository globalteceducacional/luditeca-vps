import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import 'animate.css';
import {
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiImage,
  FiSave,
  FiSquare,
  FiType,
} from 'react-icons/fi';

import EditorLayout from '../../../components/EditorLayout';
import RulersOverlay from '../../../components/editor/RulersOverlay';
import BottomDock from '../../../components/editor/v2/BottomDock';
import PageSidebar from '../../../components/editor/v2/PageSidebar';
import PropertiesInspector from '../../../components/editor/v2/PropertiesInspector';
import { useAuth } from '../../../contexts/auth';
import { getBook, updateBook } from '../../../lib/books';
import { CMS_ROLES, isRole } from '../../../lib/roles';
import {
  isPagesV2,
  migratePagesLegacyToV2,
  migratePagesV2ToLegacy,
} from '../../../lib/pagesV2/migrate';

const CanvasStageKonva = dynamic(
  () => import('../../../components/editor/CanvasStageKonva'),
  { ssr: false },
);

function ensurePagesV2(v2) {
  if (!isPagesV2(v2)) return { version: 2, canvas: { width: 1280, height: 720 }, pages: [] };
  if (!Array.isArray(v2.pages) || v2.pages.length === 0) {
    return {
      ...v2,
      pages: [{ id: String(Date.now()), background: null, nodes: [], meta: { orientation: 'landscape' } }],
    };
  }
  return v2;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

function makeTextNode() {
  return {
    id: String(Date.now()),
    type: 'text',
    transform: { x: 90, y: 90, width: 320, height: 80, rotation: 0 },
    zIndex: 1,
    step: 0,
    props: { content: 'Clique para editar', fontSize: 24, color: '#111111', fontFamily: 'Roboto', textAlign: 'left' },
  };
}

function makeShapeNode() {
  return {
    id: String(Date.now()),
    type: 'shape',
    transform: { x: 120, y: 120, width: 180, height: 140, rotation: 0 },
    zIndex: 1,
    step: 0,
    props: { shapeProperties: { type: 'rectangle', fill: '#fcfdff' } },
  };
}

function ToolButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-lg p-2.5 text-slate-400 transition-all hover:bg-slate-800 hover:text-indigo-400"
      title={label}
    >
      {icon}
      <span className="pointer-events-none absolute left-12 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase text-slate-200 opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function EmptyState({ onAddImage }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-700/50 bg-slate-900/80 p-6 text-center shadow-2xl backdrop-blur-sm">
        <FiImage className="mx-auto mb-3 text-slate-500" size={32} />
        <h3 className="mb-1 text-sm font-semibold text-slate-200">Pagina em branco</h3>
        <p className="mb-4 text-xs text-slate-400">Comece adicionando uma imagem.</p>
        <button
          type="button"
          onClick={onAddImage}
          className="w-full rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Inserir imagem
        </button>
      </div>
    </div>
  );
}

export default function EditBookV2() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [book, setBook] = useState(null);
  const [title, setTitle] = useState('');
  const [pagesV2, setPagesV2] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState('pages');
  const [mediaType, setMediaType] = useState('image');
  const [bottomHeight, setBottomHeight] = useState(280);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elementAnimationTest, setElementAnimationTest] = useState({
    nonce: 0,
    elementId: null,
    animation: '',
  });
  const [pageTransitionTest, setPageTransitionTest] = useState({
    nonce: 0,
    className: '',
  });
  const [showTransitionEditor, setShowTransitionEditor] = useState(false);

  const playTimerRef = useRef(null);
  const isResizingBottomRef = useRef(false);
  const resizeStartRef = useRef(null);
  const historyRef = useRef({ undo: [], redo: [] });
  const isApplyingHistoryRef = useRef(false);
  const currentPageRef = useRef(0);
  const selectedNodeIdRef = useRef(null);
  const clipboardRef = useRef(null);

  const safeV2 = useMemo(() => ensurePagesV2(pagesV2), [pagesV2]);
  const page = safeV2.pages?.[currentPage] || safeV2.pages?.[0] || null;
  const nodes = Array.isArray(page?.nodes) ? page.nodes : [];
  const pageIsVisuallyEmpty = nodes.length === 0 && !page?.background;

  useEffect(() => {
    const list = Array.isArray(safeV2.pages?.[currentPage]?.nodes) ? safeV2.pages[currentPage].nodes : [];
    setSelectedNodeId((sel) => {
      if (!sel) return null;
      const exists = list.some((n) => String(n?.id) === String(sel));
      return exists ? sel : null;
    });
  }, [currentPage, safeV2.pages]);

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

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/app');
  }, [authLoading, user, router]);

  const fetchBook = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await getBook(id);
    if (error) {
      setLoading(false);
      return;
    }
    setBook(data);
    setTitle(data.title || '');
    let nextV2 = null;
    if (isPagesV2(data.pages_v2)) nextV2 = data.pages_v2;
    else if (Array.isArray(data.pages) && data.pages.length > 0) nextV2 = migratePagesLegacyToV2(data.pages);
    else nextV2 = { version: 2, canvas: { width: 1280, height: 720 }, pages: [] };
    setPagesV2(ensurePagesV2(nextV2));
    setCurrentPage(0);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id && user?.id) void fetchBook();
  }, [id, user?.id, fetchBook]);

  const openImageAssets = useCallback(() => {
    setMediaType('image');
    setLeftTab('media');
  }, []);
  const openAudioAssets = useCallback(() => {
    setMediaType('audio');
    setLeftTab('media');
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
  }, [pushUndoSnapshot]);

  const patchNode = useCallback((nodeId, patch) => {
    patchPage(currentPage, (p) => {
      p.nodes = (p.nodes || []).map((n) => (String(n.id) === String(nodeId) ? { ...n, ...patch } : n));
      return p;
    });
  }, [currentPage, patchPage]);

  const patchCurrentPageTransition = useCallback(
    (transitionPatch) => {
      patchPage(currentPage, (p) => {
        p.meta = p.meta && typeof p.meta === 'object' ? { ...p.meta } : {};
        p.meta.transition = {
          type: String(transitionPatch?.type || 'none'),
          durationMs: Math.max(
            200,
            Math.min(4000, Number(transitionPatch?.durationMs || 500)),
          ),
          direction:
            transitionPatch?.direction == null || transitionPatch.direction === ''
              ? null
              : String(transitionPatch.direction),
        };
        return p;
      });
    },
    [currentPage, patchPage],
  );

  const testElementAnimation = useCallback(
    (animation) => {
      if (!selectedNodeId) return;
      setElementAnimationTest((prev) => ({
        nonce: prev.nonce + 1,
        elementId: selectedNodeId,
        animation: String(animation || ''),
      }));
    },
    [selectedNodeId],
  );

  const mapTransitionToAnimateClass = (t) => {
    const type = String(t?.type || 'none').toLowerCase();
    const dir = String(t?.direction || '').toLowerCase();
    switch (type) {
      case 'fade':
      case 'dissolve':
      case 'esmaecer':
        return 'animate__fadeIn';
      case 'zoom':
      case 'morph':
        return 'animate__zoomIn';
      case 'push':
      case 'reveal':
      case 'wipe':
      case 'uncover':
      case 'cover':
        return dir === 'left' ? 'animate__slideInLeft' : 'animate__slideInRight';
      case 'split':
      case 'shreds':
        return 'animate__fadeIn';
      case 'flash':
        return 'animate__bounce';
      default:
        return '';
    }
  };

  const testPageTransition = useCallback((transitionMeta) => {
    const cls = mapTransitionToAnimateClass(transitionMeta);
    if (!cls) return;
    setPageTransitionTest((prev) => ({ nonce: prev.nonce + 1, className: cls }));
  }, []);

  const selectTransitionBetweenPages = useCallback((fromPageIndex) => {
    const safeIndex = Math.max(0, Number.isFinite(Number(fromPageIndex)) ? Math.trunc(Number(fromPageIndex)) : 0);
    setCurrentPage(safeIndex);
    setSelectedNodeId(null);
    setRightCollapsed(false);
    setShowTransitionEditor(true);
  }, []);

  const updateNodeStep = useCallback((nodeId, nextStep) => {
    const safeStep = Math.max(0, Number.isFinite(Number(nextStep)) ? Math.trunc(Number(nextStep)) : 0);
    patchNode(nodeId, { step: safeStep });
  }, [patchNode]);

  const deleteNode = useCallback((nodeId) => {
    patchPage(currentPage, (p) => {
      p.nodes = (p.nodes || []).filter((n) => String(n.id) !== String(nodeId));
      return p;
    });
    if (String(selectedNodeId) === String(nodeId)) setSelectedNodeId(null);
  }, [currentPage, patchPage, selectedNodeId]);

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
  }, [patchPage]);

  const addPage = useCallback(() => {
    setPagesV2((prev) => {
      const base = ensurePagesV2(prev);
      const next = JSON.parse(JSON.stringify(base));
      next.pages.push({ id: String(Date.now()), background: null, nodes: [], meta: { orientation: 'landscape' } });
      return next;
    });
    setCurrentPage((v) => v + 1);
    setIsModified(true);
  }, []);

  const deletePage = useCallback(() => {
    setPagesV2((prev) => {
      const base = ensurePagesV2(prev);
      if (base.pages.length <= 1) return base;
      const next = JSON.parse(JSON.stringify(base));
      next.pages.splice(currentPage, 1);
      return next;
    });
    setCurrentPage((v) => Math.max(0, v - 1));
    setSelectedNodeId(null);
    setIsModified(true);
  }, [currentPage]);

  const addText = useCallback(() => {
    const node = makeTextNode();
    patchPage(currentPage, (p) => {
      const maxZ = Math.max(0, ...(p.nodes || []).map((n) => Number(n.zIndex || 0)));
      node.zIndex = maxZ + 1;
      p.nodes = [...(p.nodes || []), node];
      return p;
    });
    setSelectedNodeId(node.id);
  }, [currentPage, patchPage]);

  const addShape = useCallback(() => {
    const node = makeShapeNode();
    patchPage(currentPage, (p) => {
      const maxZ = Math.max(0, ...(p.nodes || []).map((n) => Number(n.zIndex || 0)));
      node.zIndex = maxZ + 1;
      p.nodes = [...(p.nodes || []), node];
      return p;
    });
    setSelectedNodeId(node.id);
  }, [currentPage, patchPage]);

  const handlePickMedia = useCallback((file) => {
    if (!file) return;
    const isAudio = String(file?.type || '').toLowerCase() === 'audio';

    const basePath = file?.path ? `${user?.id}/books/${String(id || '').trim()}/${file.path}`.replace(/\/+/g, '/') : null;

    const fileVisualType = String(file?.type || '').toLowerCase();

    if (!isAudio) {
      const node = {
        id: String(Date.now()),
        type: 'image',
        transform: { x: 100, y: 100, width: 260, height: 200, rotation: 0 },
        zIndex: 1,
        step: 0,
        props: {
          content: String(file?.url || ''),
          ...(basePath ? { storage: { bucket: 'pages', filePath: basePath } } : {}),
          ...(fileVisualType === 'gif' ? { mediaKind: 'gif' } : {}),
        },
      };
      patchPage(currentPage, (p) => {
        const maxZ = Math.max(0, ...(p.nodes || []).map((n) => Number(n.zIndex || 0)));
        node.zIndex = maxZ + 1;
        p.nodes = [...(p.nodes || []), node];
        return p;
      });
      setSelectedNodeId(node.id);
      return;
    }
    if (selectedNodeId) {
      const target = nodes.find((n) => String(n.id) === String(selectedNodeId));
      const targetType = String(target?.type || '');
      if (targetType !== 'text' && targetType !== 'image') {
        return;
      }
      const audioStorage = basePath ? { bucket: 'audios', filePath: basePath } : null;
      patchNode(selectedNodeId, {
        props: {
          ...(nodes.find((n) => String(n.id) === String(selectedNodeId))?.props || {}),
          audio: String(file?.url || ''),
          ...(audioStorage ? { audioStorage } : {}),
        },
      });
    }
  }, [user?.id, id, currentPage, patchPage, selectedNodeId, patchNode, nodes]);

  const handleCanvasDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw =
        event.dataTransfer.getData('application/x-luditeca-media') ||
        event.dataTransfer.getData('application/json');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed) handlePickMedia(parsed);
      } catch {
        // ignorar payload inválido de drag/drop
      }
    },
    [handlePickMedia],
  );

  const handleCanvasDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  useEffect(() => {
    if (pageIsVisuallyEmpty) openImageAssets();
  }, [currentPage, pageIsVisuallyEmpty, openImageAssets]);

  useEffect(() => {
    setSelectedNodeId(null);
  }, [currentPage]);

  useEffect(() => {
    if (selectedNodeId == null) return;
    const n = nodes.find((x) => String(x?.id) === String(selectedNodeId));
    if (!n) return;
    const st = Number.isFinite(Number(n.step)) ? Number(n.step) : 0;
    if (st > currentStep) setSelectedNodeId(null);
  }, [currentStep, nodes, selectedNodeId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      const isMod = event.ctrlKey || event.metaKey;
      const key = String(event.key || '').toLowerCase();

      if (isMod && key === 'c') {
        const currentPageIdx = currentPageRef.current;
        const selectedId = selectedNodeIdRef.current;
        if (!selectedId) return;
        const current = ensurePagesV2(pagesV2);
        const node = current.pages?.[currentPageIdx]?.nodes?.find((n) => String(n.id) === String(selectedId));
        if (!node) return;
        clipboardRef.current = deepClone(node);
        event.preventDefault();
        return;
      }

      if (isMod && key === 'v') {
        if (!clipboardRef.current) return;
        event.preventDefault();
        duplicateNodeToCurrentPage(clipboardRef.current);
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        const selectedId = selectedNodeIdRef.current;
        if (!selectedId) return;
        event.preventDefault();
        deleteNode(selectedId);
        return;
      }

      if (isMod && (key === 'z' || key === 'y')) {
        event.preventDefault();
        const shouldRedo = key === 'y' || (key === 'z' && event.shiftKey);
        const fromKey = shouldRedo ? 'redo' : 'undo';
        const toKey = shouldRedo ? 'undo' : 'redo';
        const entry = historyRef.current[fromKey].pop();
        if (!entry) return;

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pagesV2, deleteNode, duplicateNodeToCurrentPage]);

  const saveBook = useCallback(async () => {
    if (!book || !id || !pagesV2) return;
    setSaving(true);
    const payload = { ...book, title, pages: migratePagesV2ToLegacy(ensurePagesV2(pagesV2)), pages_v2: ensurePagesV2(pagesV2) };
    if (payload.authors) delete payload.authors;
    const { error } = await updateBook(id, payload);
    setSaving(false);
    if (!error) setIsModified(false);
  }, [book, id, pagesV2, title]);

  const playPause = useCallback(() => {
    if (isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      setIsPlaying(false);
      return;
    }
    const maxStep = Math.max(0, ...nodes.map((n) => Number(n.step || 0)));
    playTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => (prev >= maxStep ? 0 : prev + 1));
    }, 900);
    setIsPlaying(true);
  }, [isPlaying, nodes]);

  useEffect(() => () => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
  }, []);

  const handleBottomResizeStart = useCallback((event) => {
    event.preventDefault();
    isResizingBottomRef.current = true;
    resizeStartRef.current = { y: event.clientY, height: bottomHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      if (!isResizingBottomRef.current || !resizeStartRef.current) return;
      const delta = resizeStartRef.current.y - ev.clientY;
      const next = Math.max(180, Math.min(520, resizeStartRef.current.height + delta));
      setBottomHeight(next);
    };
    const onUp = () => {
      isResizingBottomRef.current = false;
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [bottomHeight]);

  if (loading) {
    return (
      <EditorLayout variant="editor">
        <div className="flex h-full items-center justify-center bg-slate-900 text-slate-200">Carregando workspace...</div>
      </EditorLayout>
    );
  }

  return (
    <EditorLayout variant="editor">
      <Head>
        <title>{title || 'Editor'} - UniverseTeca</title>
      </Head>
      <div className="flex h-full flex-col overflow-hidden bg-slate-900 font-sans text-slate-300">
        <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => router.push('/books')} className="rounded-md bg-slate-700 p-2 text-slate-200 transition-colors hover:bg-slate-600" title="Voltar aos livros">
              <FiChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 border-l border-slate-600 pl-4">
              <input
                className="w-80 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 transition-colors focus:border-indigo-500 focus:outline-none"
                value={title}
                placeholder="Titulo do livro..."
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsModified(true);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRulers((v) => !v)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${showRulers ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              title="Alternar guias e reguas"
            >
              <FiGrid size={16} />
              <span>Guias</span>
            </button>
            <button
              type="button"
              onClick={saveBook}
              disabled={saving || !isModified}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSave size={16} />
              {saving ? 'Salvando...' : 'Salvar projeto'}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateRows: `minmax(360px, 1fr) 8px ${bottomHeight}px` }}>
          <main className="relative flex min-h-0 overflow-hidden">
            {!leftCollapsed ? (
              <aside className="relative z-10 flex h-full w-[280px] shrink-0 flex-col border-r border-slate-700 bg-slate-800 shadow-[2px_0_8px_rgba(0,0,0,0.1)]">
                <PageSidebar
                  pages={safeV2.pages}
                  currentPage={currentPage}
                  onSelectPage={(idx) => {
                    setCurrentPage(idx);
                    setShowTransitionEditor(false);
                  }}
                  onAddPage={addPage}
                  onDeletePage={deletePage}
                  onSelectTransitionBetweenPages={selectTransitionBetweenPages}
                  activeTab={leftTab}
                  onTabChange={setLeftTab}
                  mediaType={mediaType}
                  onMediaTypeChange={setMediaType}
                  bookId={id}
                  onSelectMedia={handlePickMedia}
                />
                <button type="button" onClick={() => setLeftCollapsed(true)} className="absolute -right-4 top-1/2 flex h-8 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-slate-700 bg-slate-800 text-slate-400 hover:text-white" title="Ocultar painel esquerdo">
                  <FiChevronLeft size={14} />
                </button>
              </aside>
            ) : (
              <button type="button" onClick={() => setLeftCollapsed(false)} className="absolute left-0 top-1/2 z-20 flex h-8 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-slate-700 bg-slate-800 text-slate-400 shadow-md hover:text-white" title="Mostrar painel esquerdo">
                <FiChevronRight size={14} />
              </button>
            )}

            <nav className="z-10 flex w-14 shrink-0 flex-col items-center gap-3 border-r border-slate-700 bg-slate-900 py-4 shadow-inner">
              <ToolButton icon={<FiType size={18} />} label="Texto" onClick={addText} />
              <ToolButton icon={<FiSquare size={18} />} label="Forma" onClick={addShape} />
              <div className="my-2 h-px w-8 bg-slate-700" />
              <ToolButton icon={<FiImage size={18} />} label="Imagem" onClick={openImageAssets} />
            </nav>

            <section
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-950"
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
            >
              <div className="relative flex-1 overflow-hidden">
                <RulersOverlay visible={showRulers} />
                <div
                  key={pageTransitionTest.nonce}
                  className={`absolute inset-0 flex items-center justify-center pl-6 pt-6 ${pageTransitionTest.className ? `animate__animated ${pageTransitionTest.className}` : ''}`}
                >
                  <CanvasStageKonva
                    pagesV2={safeV2}
                    pageIndex={currentPage}
                    onChange={(next) => {
                      setPagesV2((prev) => {
                        if (!isApplyingHistoryRef.current) {
                          const base = ensurePagesV2(prev);
                          const idx = currentPageRef.current;
                          if (base.pages?.[idx]) {
                            pushUndoSnapshot(idx, base.pages[idx]);
                          }
                        }
                        return next;
                      });
                      setIsModified(true);
                    }}
                    selectedId={selectedNodeId}
                    setSelectedId={setSelectedNodeId}
                    isPreviewMode={false}
                    timelineStep={currentStep}
                    elementAnimationTest={elementAnimationTest}
                  />
                </div>
                {pageIsVisuallyEmpty ? <EmptyState onAddImage={openImageAssets} /> : null}
              </div>
            </section>

            {!rightCollapsed ? (
              <aside className="relative z-10 h-full w-[320px] shrink-0 border-l border-slate-700 bg-slate-800 shadow-[-2px_0_8px_rgba(0,0,0,0.1)]">
                <button type="button" onClick={() => setRightCollapsed(true)} className="absolute -left-4 top-1/2 flex h-8 w-4 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-slate-700 bg-slate-800 text-slate-400 hover:text-white" title="Ocultar painel direito">
                  <FiChevronRight size={14} />
                </button>
                <PropertiesInspector
                  page={page}
                  selectedNodeId={selectedNodeId}
                  onPatchNode={patchNode}
                  onDeleteNode={deleteNode}
                  onOpenAudioLibrary={openAudioAssets}
                  onPatchPageTransition={patchCurrentPageTransition}
                  onTestElementAnimation={testElementAnimation}
                  onTestPageTransition={testPageTransition}
                  showPageTransitionEditor={showTransitionEditor}
                />
              </aside>
            ) : (
              <button type="button" onClick={() => setRightCollapsed(false)} className="absolute right-0 top-1/2 z-20 flex h-8 w-6 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-slate-700 bg-slate-800 text-slate-400 shadow-md hover:text-white" title="Mostrar painel direito">
                <FiChevronLeft size={14} />
              </button>
            )}
          </main>

          <div role="separator" aria-label="Redimensionar painel inferior" onPointerDown={handleBottomResizeStart} className="h-2 shrink-0 cursor-row-resize border-y border-slate-700 bg-slate-900 hover:bg-slate-800" />

          <footer className="min-h-0 border-t border-slate-700 bg-slate-800">
            <BottomDock
              pageNodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              isPlaying={isPlaying}
              onPlayPause={playPause}
              onStepBack={() => setCurrentStep((v) => Math.max(0, v - 1))}
              onStepForward={() => setCurrentStep((v) => v + 1)}
              onUpdateElementStep={updateNodeStep}
            />
          </footer>
        </div>
      </div>
    </EditorLayout>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}

