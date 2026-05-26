import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiRotateCcw, FiSave, FiUpload } from 'react-icons/fi';
import { resolveBookAssetUrl, BOOK_MEDIA_BUCKETS } from '../../lib/bookMediaSrc';
import {
  applyEffects,
  applyPageEnter,
  buildPageIndex,
  clearRunState,
  createInitialRunState,
  endingLabel,
  extractStoryPages,
  getAvailableChoices,
  getChoiceTargetPageId,
  getPageId,
  getPageLabel,
  getStartPageId,
  goBack,
  loadRunState,
  navigateToPage,
  saveRunState,
} from '../../lib/interactiveAdventure';

function mediaSrc(url) {
  return resolveBookAssetUrl(url, BOOK_MEDIA_BUCKETS.pages);
}

/**
 * Leitor «Escolha sua aventura»: páginas numeradas, inventário, flags, save/load, voltar.
 */
export default function AppInteractiveAdventureReader({
  bookId,
  pages = [],
  jumpToPageId = null,
  onJumpApplied,
}) {
  const storyPages = useMemo(() => extractStoryPages(pages), [pages]);
  const pageIndex = useMemo(() => buildPageIndex(storyPages), [storyPages]);
  const startId = useMemo(() => getStartPageId(storyPages), [storyPages]);

  const [run, setRun] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!bookId || !startId) {
      setRun(null);
      return;
    }
    if (jumpToPageId != null && pageIndex.has(jumpToPageId)) {
      const base = createInitialRunState(bookId, storyPages);
      const jumped = navigateToPage(base, jumpToPageId, storyPages);
      setRun(jumped);
      saveRunState(bookId, jumped);
      onJumpApplied?.();
      return;
    }
    const saved = loadRunState(bookId);
    if (saved?.currentPageId && pageIndex.has(saved.currentPageId)) {
      setRun(saved);
    } else {
      setRun(createInitialRunState(bookId, storyPages));
    }
  }, [bookId, startId, storyPages, pageIndex, jumpToPageId, onJumpApplied]);

  const persist = useCallback(
    (next) => {
      setRun(next);
      if (bookId) saveRunState(bookId, next);
    },
    [bookId],
  );

  const currentPage = run?.currentPageId ? pageIndex.get(run.currentPageId) : null;
  const choices = currentPage
    ? getAvailableChoices(currentPage, run, pageIndex)
    : [];

  const pickChoice = useCallback((ch) => {
    const target = getChoiceTargetPageId(ch);
    if (!target || !run) return;
    let next = ch.effects ? applyEffects(run, ch.effects) : run;
    next = navigateToPage(next, target, storyPages);
    persist(next);
  }, [run, storyPages, persist]);

  const handleBack = () => {
    if (!run) return;
    const prevId = run.history?.length >= 2 ? run.history[run.history.length - 2] : null;
    if (!prevId) return;
    const prevPage = pageIndex.get(prevId);
    let next = goBack(run);
    if (prevPage) next = applyPageEnter(next, prevPage);
    persist(next);
  };

  const handleRestart = () => {
    if (bookId) clearRunState(bookId);
    const fresh = createInitialRunState(bookId, storyPages);
    persist(fresh);
    setToast('História reiniciada.');
  };

  const handleSave = () => {
    if (run && bookId) {
      saveRunState(bookId, run);
      setToast('Progresso guardado.');
    }
  };

  const handleLoad = () => {
    const saved = loadRunState(bookId);
    if (saved?.currentPageId && pageIndex.has(saved.currentPageId)) {
      setRun(saved);
      setToast('Progresso carregado.');
    } else {
      setToast('Nenhum progresso guardado.');
    }
  };

  if (!storyPages.length) {
    return <p className="text-sm text-luditeca-muted">Este livro ainda não tem páginas da história.</p>;
  }

  if (!run || !currentPage) {
    return <p className="text-sm text-luditeca-muted">A preparar a aventura…</p>;
  }

  const isEnding = Boolean(currentPage.is_ending);
  const endingType = currentPage.ending_type;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="app-btn-nav text-sm" onClick={handleBack} disabled={(run.history?.length || 0) < 2}>
            <FiArrowLeft className="inline mr-1" />
            Voltar
          </button>
          <button type="button" className="app-btn-nav text-sm" onClick={handleRestart}>
            <FiRotateCcw className="inline mr-1" />
            Recomeçar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="app-btn-nav text-sm" onClick={handleSave}>
            <FiSave className="inline mr-1" />
            Guardar
          </button>
          <button type="button" className="app-btn-nav text-sm" onClick={handleLoad}>
            <FiUpload className="inline mr-1" />
            Carregar
          </button>
        </div>
      </div>

      {toast ? (
        <p className="text-xs text-luditeca-muted bg-luditeca-primary-50 border border-luditeca-primary-200 rounded-lg px-3 py-2">
          {toast}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="app-badge">Página {getPageId(currentPage)}</span>
        {run.inventory?.length > 0 ? (
          <span className="app-badge">
            Inventário: {run.inventory.join(', ')}
          </span>
        ) : (
          <span className="text-luditeca-muted">Inventário vazio</span>
        )}
      </div>

      <div className="app-panel-padded">
        <p className="text-xs text-luditeca-muted mb-2 uppercase tracking-wide">
          {getPageLabel(currentPage)}
        </p>
        {mediaSrc(currentPage.image_url) ? (
          <img
            src={mediaSrc(currentPage.image_url)}
            alt=""
            className="w-full max-h-64 object-contain rounded-lg mb-3"
          />
        ) : null}
        {currentPage.text ? (
          <p className="text-luditeca-ink whitespace-pre-wrap text-lg leading-relaxed">{currentPage.text}</p>
        ) : (
          <p className="text-luditeca-muted italic">Sem texto nesta página.</p>
        )}
        {isEnding ? (
          <p className="text-luditeca-accent-700 font-semibold mt-4 text-lg">
            {endingLabel(endingType)}
          </p>
        ) : null}
      </div>

      {!isEnding && choices.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-luditeca-ink mb-2">O que fazes?</p>
          <ul className="space-y-2">
            {choices.map((ch, i) => (
              <li key={i}>
                <button type="button" className="app-choice-branch" onClick={() => pickChoice(ch)}>
                  {ch.label || 'Continuar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isEnding && choices.length === 0 ? (
        <p className="text-sm text-amber-700">Nenhuma escolha disponível (condições ou destinos em falta).</p>
      ) : null}

      {isEnding ? (
        <button type="button" className="app-btn-nav w-full justify-center" onClick={handleRestart}>
          Jogar outra vez
        </button>
      ) : null}
    </div>
  );
}
