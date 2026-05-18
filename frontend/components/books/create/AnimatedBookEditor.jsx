import { FiArrowDown, FiArrowUp, FiTrash2 } from 'react-icons/fi';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import AdminQuizQuestionsEditor from '../../admin/AdminQuizQuestionsEditor';
import { sortFilesByNumericName } from '../../../lib/bookTypes';
import { emptyAnimatedPage } from '../../../hooks/useBookTypeFlow';

const fc = 'luditeca-form-control';

export default function AnimatedBookEditor({ form, onChange, onUpload, uploading }) {
  const pages = Array.isArray(form.pages) ? form.pages : [];

  const setPages = (next) => onChange({ pages: next });

  const handleMultiUpload = async (e) => {
    const files = sortFilesByNumericName(Array.from(e.target.files || []));
    if (!files.length) return;
    const next = [...pages];
    let n = next.length;
    for (const file of files) {
      const url = await onUpload(file, 'pages', 'book-animated');
      n += 1;
      next.push({
        ...emptyAnimatedPage(n),
        image_url: url,
        is_gif: file.type === 'image/gif',
      });
    }
    setPages(next.map((p, i) => ({ ...p, page_number: i + 1 })));
    e.target.value = '';
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[idx], next[j]] = [next[j], next[idx]];
    setPages(next.map((p, i) => ({ ...p, page_number: i + 1 })));
  };

  const removeAt = (idx) => {
    const next = pages.filter((_, i) => i !== idx);
    setPages(next.map((p, i) => ({ ...p, page_number: i + 1 })));
  };

  return (
    <>
      <FormGroup>
        <Label className="form-control-label">Páginas (imagens / GIF)</Label>
        <Input
          className={fc}
          type="file"
          accept="image/*"
          multiple
          onChange={handleMultiUpload}
          disabled={uploading}
        />
        <p className="small text-muted mb-0 mt-1">
          Os ficheiros são ordenados pelo nome (ordem numérica).
        </p>
      </FormGroup>

      {pages.map((page, idx) => (
        <div key={idx} className="mb-3 p-3 border rounded bg-light">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small font-weight-bold text-uppercase text-muted">
              Página {page.page_number ?? idx + 1}
            </span>
            <div>
              <Button type="button" color="link" className="p-0 mr-2" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <FiArrowUp />
              </Button>
              <Button
                type="button"
                color="link"
                className="p-0 mr-2"
                onClick={() => move(idx, 1)}
                disabled={idx === pages.length - 1}
              >
                <FiArrowDown />
              </Button>
              <Button type="button" color="link" className="p-0 text-danger" onClick={() => removeAt(idx)}>
                <FiTrash2 />
              </Button>
            </div>
          </div>
          {page.image_url ? (
            <img src={page.image_url} alt="" className="mb-2 rounded" style={{ maxHeight: 100 }} />
          ) : null}
          <Input
            className={fc}
            type="textarea"
            rows={2}
            placeholder="Texto da página"
            value={page.text || ''}
            onChange={(e) => {
              const next = pages.map((p, i) => (i === idx ? { ...p, text: e.target.value } : p));
              setPages(next);
            }}
          />
        </div>
      ))}

      <FormGroup className="mt-4">
        <Label className="form-control-label">Trilha sonora</Label>
        <Input
          className={fc}
          type="file"
          accept="audio/*"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await onUpload(file, 'pages', 'book-soundtrack');
            onChange({ soundtrack_url: url });
            e.target.value = '';
          }}
        />
        {form.soundtrack_url ? (
          <p className="small text-success mt-1 mb-0">Áudio carregado.</p>
        ) : null}
      </FormGroup>

      <hr />
      <p className="small text-muted font-weight-bold text-uppercase">Quiz do livro</p>
      <AdminQuizQuestionsEditor
        type="quiz"
        value={form.quiz}
        onChange={(quiz) => onChange({ quiz })}
      />
    </>
  );
}
