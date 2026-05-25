import { useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { resolveBookAssetUrl, BOOK_MEDIA_BUCKETS } from '../../lib/bookMediaSrc';
import {
  buildAnimatedReaderSlots,
  buildInteractiveReaderSlots,
  timelineHasInlineQuiz,
} from '../../lib/bookContentTimeline';
import { getSceneDisplayLabel } from '../../lib/interactiveScenes';
import AppInteractiveAdventureReader from './AppInteractiveAdventureReader';
import { extractStoryPages } from '../../lib/interactiveAdventure';

function mediaSrc(url, bucket = BOOK_MEDIA_BUCKETS.pages) {
  return resolveBookAssetUrl(url, bucket);
}

function SlotNav({ safe, total, slotKind, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" disabled={safe <= 0} onClick={onPrev} className="app-btn-nav">
        <FiChevronLeft />
        Anterior
      </button>
      <span className="text-sm text-luditeca-body font-medium">
        {safe + 1} / {total}
        {slotKind === 'quiz' ? ' · Quiz' : ''}
      </span>
      <button type="button" disabled={safe >= total - 1} onClick={onNext} className="app-btn-nav">
        Seguinte
        <FiChevronRight />
      </button>
    </div>
  );
}

function AppBookQuizSingle({ question }) {
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);

  if (!question?.question) return null;
  const options = Array.isArray(question.options) ? question.options : [];

  const pick = (optionIndex) => {
    if (selected !== null || done) return;
    setSelected(optionIndex);
    setTimeout(() => setDone(true), 600);
  };

  return (
    <div className="app-panel-padded">
      <h3 className="text-lg font-bold text-luditeca-ink mb-3">Quiz</h3>
      {done ? (
        <p className="text-luditeca-accent-800 font-semibold">
          {selected === Number(question.correct) ? 'Resposta correta!' : 'Resposta incorreta.'}
        </p>
      ) : (
        <>
          <p className="text-lg font-medium text-luditeca-ink mb-3">{question.question}</p>
          <ul className="space-y-2">
            {options.map((opt, i) => {
              const label = typeof opt === 'string' ? opt : opt?.label || String(opt);
              return (
                <li key={i}>
                  <button type="button" className="app-choice-default" onClick={() => pick(i)}>
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function AppBookQuiz({ quiz }) {
  const questions = useMemo(() => {
    if (!Array.isArray(quiz)) return [];
    return quiz.filter((q) => q?.question && Array.isArray(q.options) && q.options.length >= 2);
  }, [quiz]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!questions.length) return null;

  const current = questions[index];
  const options = current.options || [];

  const pick = (optionIndex) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    const correct = Number.isFinite(Number(current.correct))
      ? optionIndex === Number(current.correct)
      : false;
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (index + 1 >= questions.length) setDone(true);
      else {
        setIndex((i) => i + 1);
        setSelected(null);
      }
    }, 800);
  };

  return (
    <section className="mt-6 pt-6 border-t border-luditeca-primary-100">
      <h3 className="text-lg font-bold text-luditeca-ink mb-3">Quiz</h3>
      {done ? (
        <p className="text-luditeca-accent-800 font-semibold">
          Concluído! Acertos: {score} / {questions.length}
        </p>
      ) : (
        <>
          <p className="text-sm text-luditeca-muted mb-2">
            Pergunta {index + 1} de {questions.length}
          </p>
          <p className="text-lg font-medium text-luditeca-ink mb-3">{current.question}</p>
          <ul className="space-y-2">
            {options.map((opt, i) => {
              const label = typeof opt === 'string' ? opt : opt?.label || String(opt);
              let cls = 'app-choice-default';
              if (selected !== null) {
                if (i === Number(current.correct)) cls += ' bg-green-50 border-green-300';
                else if (i === selected) cls += ' bg-red-50 border-red-200';
              }
              return (
                <li key={i}>
                  <button type="button" className={cls} disabled={selected !== null} onClick={() => pick(i)}>
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Livro animado: sequência páginas + quiz na ordem editorial. */
export function AppAnimatedBookReader({ pages = [], soundtrackUrl, quiz }) {
  const slots = useMemo(() => buildAnimatedReaderSlots(pages, quiz), [pages, quiz]);
  const [index, setIndex] = useState(0);

  if (!slots.length) {
    return <p className="text-sm text-luditeca-muted">Este livro ainda não tem conteúdo.</p>;
  }

  const safe = Math.min(index, slots.length - 1);
  const slot = slots[safe];

  return (
    <div className="space-y-4">
      {soundtrackUrl ? (
        <audio controls className="w-full" src={mediaSrc(soundtrackUrl)} preload="metadata">
          <track kind="captions" />
        </audio>
      ) : null}

      {slot.kind === 'page' ? (
        <div className="app-panel">
          {mediaSrc(slot.data?.image_url) ? (
            <img
              src={mediaSrc(slot.data.image_url)}
              alt=""
              className="w-full max-h-[70vh] object-contain mx-auto"
            />
          ) : (
            <p className="p-6 text-luditeca-muted text-sm">Sem imagem nesta página.</p>
          )}
          {slot.data?.text ? (
            <p className="p-4 text-luditeca-ink whitespace-pre-wrap border-t border-luditeca-primary-100">
              {slot.data.text}
            </p>
          ) : null}
        </div>
      ) : (
        <AppBookQuizSingle question={slot.data} />
      )}

      <SlotNav
        safe={safe}
        total={slots.length}
        slotKind={slot.kind}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(slots.length - 1, i + 1))}
      />
    </div>
  );
}

/** Modo sequência: cenas e quiz na ordem definida no CMS. */
function AppInteractiveSequenceReader({ pages = [], quiz, sceneById, onFollowChoice }) {
  const slots = useMemo(() => buildInteractiveReaderSlots(pages, quiz), [pages, quiz]);
  const [index, setIndex] = useState(0);

  if (!slots.length) {
    return <p className="text-sm text-luditeca-muted">Este livro ainda não tem conteúdo.</p>;
  }

  const safe = Math.min(index, slots.length - 1);
  const slot = slots[safe];

  if (slot.kind === 'quiz') {
    return (
      <div className="space-y-4">
        <AppBookQuizSingle question={slot.data} />
        <SlotNav
          safe={safe}
          total={slots.length}
          slotKind="quiz"
          onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => setIndex((i) => Math.min(slots.length - 1, i + 1))}
        />
      </div>
    );
  }

  const scene = slot.data;
  const img = mediaSrc(scene?.image_url);
  const choices = Array.isArray(scene?.choices) ? scene.choices : [];

  return (
    <div className="space-y-4">
      <div className="app-panel-padded">
        <p className="text-xs text-luditeca-muted mb-2 uppercase tracking-wide">Ordem do livro</p>
        {img ? (
          <img src={img} alt="" className="w-full max-h-64 object-contain rounded-lg mb-3" />
        ) : null}
        {scene?.text ? (
          <p className="text-luditeca-ink whitespace-pre-wrap text-lg">{scene.text}</p>
        ) : null}
        {scene?.is_ending ? (
          <p className="text-luditeca-accent-700 font-semibold mt-3">Fim desta cena.</p>
        ) : null}
      </div>
      {choices.length > 0 && !scene?.is_ending ? (
        <ul className="space-y-2">
          {choices.map((ch, i) => {
            const target = String(ch?.target_scene_id || '').trim();
            const canFollow = target && sceneById?.has(target);
            return (
              <li key={i}>
                {canFollow ? (
                  <button
                    type="button"
                    className="app-choice-branch"
                    onClick={() => onFollowChoice?.(target)}
                  >
                    {ch.label || 'Continuar'}
                  </button>
                ) : (
                  <span className="app-choice-branch block text-left opacity-60 cursor-default">
                    {ch.label || 'Escolha'}
                    {target ? ' (destino inválido)' : ' (sem destino)'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <SlotNav
        safe={safe}
        total={slots.length}
        slotKind="scene"
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(slots.length - 1, i + 1))}
      />
    </div>
  );
}

/** Livro interativo: aventura ramificada; modo sequência quando há quiz editorial. */
export function AppInteractiveBookReader({ bookId, scenes = [], quiz }) {
  const hasSequence = useMemo(() => timelineHasInlineQuiz(scenes), [scenes]);
  const [mode, setMode] = useState(hasSequence ? 'sequence' : 'adventure');
  const storyPages = useMemo(() => extractStoryPages(scenes), [scenes]);

  const sceneList = useMemo(() => {
    return (Array.isArray(scenes) ? scenes : []).filter(
      (s) => String(s?.page_type || '').toLowerCase() !== 'quiz',
    );
  }, [scenes]);

  const byId = useMemo(() => {
    const map = new Map();
    sceneList.forEach((s) => {
      if (s?.scene_id) map.set(String(s.scene_id), s);
    });
    return map;
  }, [sceneList]);

  if (!storyPages.length && !hasSequence) {
    return <p className="text-sm text-luditeca-muted">Este livro ainda não tem páginas da história.</p>;
  }

  return (
    <div className="space-y-4">
      {hasSequence ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              mode === 'adventure'
                ? 'bg-luditeca-primary-600 text-white border-luditeca-primary-600'
                : 'bg-luditeca-surface text-luditeca-body border-luditeca-primary-200'
            }`}
            onClick={() => setMode('adventure')}
          >
            Escolha sua aventura
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              mode === 'sequence'
                ? 'bg-luditeca-primary-600 text-white border-luditeca-primary-600'
                : 'bg-luditeca-surface text-luditeca-body border-luditeca-primary-200'
            }`}
            onClick={() => setMode('sequence')}
          >
            Ordem do livro (+ quiz)
          </button>
        </div>
      ) : null}

      {mode === 'adventure' || !hasSequence ? (
        <AppInteractiveAdventureReader bookId={bookId} pages={scenes} />
      ) : (
        <AppInteractiveSequenceReader
          pages={scenes}
          quiz={quiz}
          sceneById={byId}
          onFollowChoice={() => setMode('adventure')}
        />
      )}
    </div>
  );
}

/** E-book digital: PDF embutido ou link EPUB. */
export function AppDigitalBookReader({ pdfUrl, epubUrl }) {
  const pdf = mediaSrc(pdfUrl);
  const epub = mediaSrc(epubUrl);

  if (!pdf && !epub) {
    return <p className="text-sm text-luditeca-muted">Nenhum ficheiro PDF ou EPUB disponível.</p>;
  }

  return (
    <div className="space-y-4">
      {pdf ? (
        <iframe
          title="PDF"
          src={pdf}
          className="w-full rounded-xl border border-luditeca-primary-100 bg-luditeca-surface"
          style={{ minHeight: '70vh' }}
        />
      ) : null}
      {epub ? (
        <p className="text-luditeca-body">
          <a
            href={epub}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-luditeca-accent-700 underline hover:text-luditeca-accent-800"
          >
            Abrir EPUB
          </a>{' '}
          (abre num separador ou na app de leitura do dispositivo)
        </p>
      ) : null}
    </div>
  );
}
