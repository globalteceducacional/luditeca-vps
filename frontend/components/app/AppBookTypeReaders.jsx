import { useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { getFileUrl } from '../../lib/mediaUrl';

function mediaSrc(url, bucket = 'pages') {
  if (!url) return null;
  if (String(url).startsWith('http')) return url;
  return getFileUrl(bucket, url);
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
    <section className="mt-6 pt-6 border-t border-sky-100">
      <h3 className="text-lg font-bold text-sky-900 mb-3">Quiz</h3>
      {done ? (
        <p className="text-violet-800 font-semibold">
          Concluído! Acertos: {score} / {questions.length}
        </p>
      ) : (
        <>
          <p className="text-sm text-sky-600 mb-2">
            Pergunta {index + 1} de {questions.length}
          </p>
          <p className="text-lg font-medium text-sky-900 mb-3">{current.question}</p>
          <ul className="space-y-2">
            {options.map((opt, i) => {
              const label = typeof opt === 'string' ? opt : opt?.label || String(opt);
              let cls =
                'w-full text-left px-4 py-3 rounded-xl border border-sky-200 text-sky-900 hover:bg-sky-50';
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

/** Livro animado: páginas com imagem/GIF + texto. */
export function AppAnimatedBookReader({ pages = [], soundtrackUrl, quiz }) {
  const sorted = useMemo(() => {
    const list = Array.isArray(pages) ? [...pages] : [];
    return list.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
  }, [pages]);

  const [index, setIndex] = useState(0);
  if (!sorted.length) {
    return <p className="text-sm text-sky-600">Este livro ainda não tem páginas.</p>;
  }

  const safe = Math.min(index, sorted.length - 1);
  const page = sorted[safe];
  const img = mediaSrc(page.image_url);

  return (
    <div className="space-y-4">
      {soundtrackUrl ? (
        <audio controls className="w-full" src={mediaSrc(soundtrackUrl)} preload="metadata">
          <track kind="captions" />
        </audio>
      ) : null}
      <div className="bg-sky-50 rounded-xl overflow-hidden border border-sky-100">
        {img ? (
          page.is_gif ? (
            <img src={img} alt="" className="w-full max-h-[70vh] object-contain mx-auto" />
          ) : (
            <img src={img} alt="" className="w-full max-h-[70vh] object-contain mx-auto" />
          )
        ) : (
          <p className="p-6 text-sky-600 text-sm">Sem imagem nesta página.</p>
        )}
        {page.text ? (
          <p className="p-4 text-sky-900 whitespace-pre-wrap border-t border-sky-100">{page.text}</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={safe <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-sky-200 text-sky-800 disabled:opacity-40 hover:bg-sky-50"
        >
          <FiChevronLeft />
          Anterior
        </button>
        <span className="text-sm text-sky-700 font-medium">
          {safe + 1} / {sorted.length}
        </span>
        <button
          type="button"
          disabled={safe >= sorted.length - 1}
          onClick={() => setIndex((i) => Math.min(sorted.length - 1, i + 1))}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-sky-200 text-sky-800 disabled:opacity-40 hover:bg-sky-50"
        >
          Seguinte
          <FiChevronRight />
        </button>
      </div>
      <AppBookQuiz quiz={quiz} />
    </div>
  );
}

/** Livro interativo: cenas com escolhas. */
export function AppInteractiveBookReader({ scenes = [], quiz }) {
  const byId = useMemo(() => {
    const map = new Map();
    (Array.isArray(scenes) ? scenes : []).forEach((s) => {
      if (s?.scene_id) map.set(String(s.scene_id), s);
    });
    return map;
  }, [scenes]);

  const startId = useMemo(() => {
    const list = Array.isArray(scenes) ? scenes : [];
    const start = list.find((s) => s.is_start && s.scene_id);
    return start?.scene_id || list[0]?.scene_id || null;
  }, [scenes]);

  const [sceneId, setSceneId] = useState(null);
  const activeId = sceneId || startId;
  const scene = activeId ? byId.get(String(activeId)) : null;

  if (!scene) {
    return <p className="text-sm text-sky-600">Este livro ainda não tem cenas.</p>;
  }

  const img = mediaSrc(scene.image_url);
  const choices = Array.isArray(scene.choices) ? scene.choices : [];

  return (
    <div className="space-y-4">
      <div className="bg-sky-50 rounded-xl overflow-hidden border border-sky-100 p-4">
        {img ? (
          <img src={img} alt="" className="w-full max-h-64 object-contain rounded-lg mb-3" />
        ) : null}
        {scene.text ? (
          <p className="text-sky-900 whitespace-pre-wrap text-lg">{scene.text}</p>
        ) : null}
        {scene.is_ending ? (
          <p className="text-violet-700 font-semibold mt-3">Fim da história.</p>
        ) : null}
      </div>
      {choices.length > 0 && !scene.is_ending ? (
        <ul className="space-y-2">
          {choices.map((ch, i) => {
            const target = ch.target_scene_id;
            const disabled = !target || !byId.has(String(target));
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => target && setSceneId(String(target))}
                  className="w-full text-left px-4 py-3 rounded-xl border border-violet-200 text-violet-900 hover:bg-violet-50 disabled:opacity-40"
                >
                  {ch.label || 'Continuar'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {startId && activeId !== startId ? (
        <button
          type="button"
          className="text-sm text-sky-600 underline"
          onClick={() => setSceneId(startId)}
        >
          Recomeçar história
        </button>
      ) : null}
      <AppBookQuiz quiz={quiz} />
    </div>
  );
}

/** E-book digital: PDF embutido ou link EPUB. */
export function AppDigitalBookReader({ pdfUrl, epubUrl }) {
  const pdf = mediaSrc(pdfUrl);
  const epub = mediaSrc(epubUrl);

  if (!pdf && !epub) {
    return <p className="text-sm text-sky-600">Nenhum ficheiro PDF ou EPUB disponível.</p>;
  }

  return (
    <div className="space-y-4">
      {pdf ? (
        <iframe
          title="PDF"
          src={pdf}
          className="w-full rounded-xl border border-sky-100 bg-white"
          style={{ minHeight: '70vh' }}
        />
      ) : null}
      {epub ? (
        <p className="text-sky-800">
          <a
            href={epub}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-violet-700 underline"
          >
            Abrir EPUB
          </a>{' '}
          (abre num separador ou na app de leitura do dispositivo)
        </p>
      ) : null}
    </div>
  );
}
