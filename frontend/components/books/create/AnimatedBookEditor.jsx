import { FiArrowDown, FiArrowUp, FiHelpCircle, FiPlus, FiTrash2 } from 'react-icons/fi';
import { sortFilesByNumericName } from '../../../lib/bookTypes';
import { BookPreviewImage } from './BookPreviewMedia';
import {
  emptyQuizTimelineItem,
  insertQuizAfterTimeline,
  isQuizTimelineItem,
  renumberTimeline,
} from '../../../lib/bookContentTimeline';
import { emptyAnimatedPage } from '../../../hooks/useBookTypeFlow';
import { LuditecaButton, LuditecaInput } from '../../argon/luditeca';
import AnimatedPreviewPanel from './AnimatedPreviewPanel';
import BookQuizSlotEditor from './BookQuizSlotEditor';

export default function AnimatedBookEditor({ form, onChange, onUpload, uploading, uploadProgress }) {
  const timeline = Array.isArray(form.pages) ? form.pages : [];

  const setTimeline = (next) => onChange({ pages: renumberTimeline(next) });

  const handleMultiUpload = async (e) => {
    const files = sortFilesByNumericName(Array.from(e.target.files || []));
    if (!files.length) return;
    const next = [...timeline];
    const total = files.length;
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const url = await onUpload(file, 'pages', 'book-animated', {
        current: i + 1,
        total,
        label: `A enviar ficheiro ${i + 1} de ${total}…`,
      });
      next.push({
        ...emptyAnimatedPage(next.length + 1),
        image_url: url,
        is_gif: file.type === 'image/gif',
      });
    }
    setTimeline(next);
    e.target.value = '';
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= timeline.length) return;
    const next = [...timeline];
    [next[idx], next[j]] = [next[j], next[idx]];
    setTimeline(next);
  };

  const removeAt = (idx) => {
    setTimeline(timeline.filter((_, i) => i !== idx));
  };

  const addEmptyPage = () => {
    setTimeline([...timeline, emptyAnimatedPage(timeline.length + 1)]);
  };

  const addQuizSlot = () => {
    setTimeline([...timeline, emptyQuizTimelineItem(timeline.length + 1)]);
  };

  const addQuizAfterPage = (pageIndex) => {
    setTimeline(insertQuizAfterTimeline(timeline, pageIndex));
  };

  const uploadPageImage = async (idx, file) => {
    const url = await onUpload(file, 'pages', 'book-animated', {
      current: 1,
      total: 1,
      label: `A enviar imagem do bloco ${idx + 1}…`,
    });
    const next = timeline.map((p, i) =>
      i === idx ? { ...p, image_url: url, is_gif: file.type === 'image/gif' } : p,
    );
    setTimeline(next);
  };

  const readingCount = timeline.filter((i) => !isQuizTimelineItem(i)).length;
  const quizCount = timeline.filter(isQuizTimelineItem).length;

  const progressPct =
    uploadProgress?.total > 0
      ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
      : 100;

  return (
    <>
      <AnimatedPreviewPanel pages={timeline} soundtrackUrl={form.soundtrack_url} />
      <LuditecaInput
        label="Enviar várias imagens (opcional)"
        type="file"
        accept="image/*"
        multiple
        onChange={handleMultiUpload}
        disabled={uploading}
        hint="Adiciona páginas no fim da lista. Em cada página pode usar «Quiz após esta página» ou as setas para reordenar."
      />
      {uploading && uploadProgress ? (
        <div className="mt-2 mb-3">
          <p className="small mb-1">{uploadProgress.label}</p>
          <div className="progress" style={{ height: 8 }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <span className="small text-muted mb-2 mb-md-0">
          {timeline.length
            ? `${readingCount} página${readingCount === 1 ? '' : 's'}, ${quizCount} quiz${quizCount === 1 ? '' : 'zes'}`
            : 'Ordem de leitura vazia'}
        </span>
        <div className="d-flex flex-wrap">
          <LuditecaButton
            type="button"
            variant="outline"
            outlineColor="primary"
            size="sm"
            className="d-inline-flex align-items-center mr-2 mb-2"
            onClick={addEmptyPage}
            disabled={uploading}
          >
            <FiPlus size={14} className="mr-1" />
            Nova página
          </LuditecaButton>
          <LuditecaButton
            type="button"
            variant="outline"
            outlineColor="info"
            size="sm"
            className="d-inline-flex align-items-center mb-2"
            onClick={addQuizSlot}
            disabled={uploading}
          >
            <FiPlus size={14} className="mr-1" />
            Nova pergunta
          </LuditecaButton>
        </div>
      </div>

      {!timeline.length ? (
        <p className="text-muted small mb-3">
          Monte a sequência: página → pergunta → página… Use as setas para reordenar.
        </p>
      ) : null}

      {timeline.map((item, idx) => {
        const isQuiz = isQuizTimelineItem(item);
        const label = isQuiz
          ? `Quiz ${idx + 1}`
          : `Página de leitura ${item.page_number ?? idx + 1}`;

        return (
          <div
            key={`${isQuiz ? 'quiz' : 'page'}-${idx}-${item.page_number ?? idx}`}
            className={`mb-3 p-3 border rounded ${isQuiz ? 'bg-white border-info' : 'bg-light'}`}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className={`small font-weight-bold ${isQuiz ? 'text-info' : 'text-muted'}`}>
                {label}
              </span>
              <div>
                <LuditecaButton
                  type="button"
                  variant="link"
                  className="p-0 mr-2"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0 || uploading}
                  title="Subir"
                >
                  <FiArrowUp />
                </LuditecaButton>
                <LuditecaButton
                  type="button"
                  variant="link"
                  className="p-0 mr-2"
                  onClick={() => move(idx, 1)}
                  disabled={idx === timeline.length - 1 || uploading}
                  title="Descer"
                >
                  <FiArrowDown />
                </LuditecaButton>
                <LuditecaButton
                  type="button"
                  variant="link"
                  className="p-0 text-danger"
                  onClick={() => removeAt(idx)}
                  disabled={uploading}
                >
                  <FiTrash2 />
                </LuditecaButton>
              </div>
            </div>

            {isQuiz ? (
              <BookQuizSlotEditor
                item={item}
                canRemove
                onRemove={() => removeAt(idx)}
                onChange={(next) => {
                  const updated = timeline.map((p, i) => (i === idx ? next : p));
                  setTimeline(updated);
                }}
              />
            ) : (
              <>
                {item.image_url ? (
                  <BookPreviewImage
                    url={item.image_url}
                    alt=""
                    className="mb-2 rounded"
                    style={{ maxHeight: 100 }}
                  />
                ) : null}
                <LuditecaInput
                  label={item.image_url ? 'Substituir imagem' : 'Imagem da página'}
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await uploadPageImage(idx, file);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
                <LuditecaInput
                  type="textarea"
                  rows={2}
                  placeholder="Texto da página"
                  value={item.text || ''}
                  onChange={(e) => {
                    const updated = timeline.map((p, i) =>
                      i === idx ? { ...p, text: e.target.value } : p,
                    );
                    setTimeline(updated);
                  }}
                />
                <LuditecaButton
                  type="button"
                  variant="outline"
                  outlineColor="info"
                  size="sm"
                  className="d-inline-flex align-items-center mt-2"
                  onClick={() => addQuizAfterPage(idx)}
                  disabled={uploading}
                >
                  <FiHelpCircle size={14} className="mr-1" />
                  Quiz após esta página
                </LuditecaButton>
              </>
            )}
          </div>
        );
      })}

      <LuditecaInput
        label="Trilha sonora (opcional)"
        type="file"
        accept="audio/*"
        disabled={uploading}
        hint={form.soundtrack_url ? 'Áudio carregado.' : undefined}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = await onUpload(file, 'pages', 'book-soundtrack');
          onChange({ soundtrack_url: url });
          e.target.value = '';
        }}
      />
    </>
  );
}

