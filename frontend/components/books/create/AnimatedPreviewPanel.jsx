import { useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { Button } from 'reactstrap';
import { BookPreviewAudio, BookPreviewImage } from './BookPreviewMedia';

export default function AnimatedPreviewPanel({ pages = [], soundtrackUrl }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const sorted = useMemo(() => {
    const list = Array.isArray(pages) ? [...pages] : [];
    return list
      .filter(
        (p) =>
          String(p?.page_type || 'reading').toLowerCase() !== 'quiz' &&
          String(p?.image_url || '').trim(),
      )
      .sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
  }, [pages]);

  if (!sorted.length) return null;

  const safe = Math.min(index, sorted.length - 1);
  const page = sorted[safe];

  return (
    <div className="mb-4">
      <Button color="info" outline size="sm" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar pré-visualização' : 'Pré-visualizar slideshow'}
      </Button>
      {open ? (
        <div className="mt-3 p-3 border rounded bg-white">
          <BookPreviewAudio url={soundtrackUrl} />
          <BookPreviewImage
            url={page.image_url}
            className="d-block mx-auto mb-3 rounded"
            style={{ maxHeight: 280, maxWidth: '100%', objectFit: 'contain' }}
          />
          {page.text ? (
            <p className="text-dark mb-3" style={{ whiteSpace: 'pre-wrap' }}>
              {page.text}
            </p>
          ) : null}
          <div className="d-flex justify-content-between align-items-center">
            <Button
              type="button"
              color="secondary"
              outline
              size="sm"
              disabled={safe <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <FiChevronLeft /> Anterior
            </Button>
            <span className="small text-muted">
              {safe + 1} / {sorted.length}
            </span>
            <Button
              type="button"
              color="secondary"
              outline
              size="sm"
              disabled={safe >= sorted.length - 1}
              onClick={() => setIndex((i) => Math.min(sorted.length - 1, i + 1))}
            >
              Seguinte <FiChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
